/**
 * Scenario "frontend": stateful mock of the Mi Cita API (auth + business onboarding) for local
 * frontend work.
 *
 * Hand-written (not generated). Never run `postman mock generate --update` on this mock: it
 * rewrites the default scenario, which is this file. Regenerate the `contract` scenario as
 * described in CLAUDE.md. This scenario reads the request body so the app can exercise every
 * branch without special headers.
 *
 * Accounts (password `Abc#12`):
 *   analopez / ana@correo.com    → hasBusiness=false (dashboard opens the onboarding dialog)
 *   owner    / owner@correo.com  → hasBusiness=true  (owns "Barbería Central", NIT 900.123.456-7)
 *
 * GET /api/servicios (HU-08) lists the services of the user's business: owner has sample data,
 * new businesses start empty, users without business get 403.
 *
 * POST /api/negocios/onboarding needs a Bearer token issued by this mock. Creating the business
 * flips hasBusiness: the next login or refresh carries the claim.
 *
 * State lives in memory and resets on restart. Env vars: PORT (4010), MOCK_DELAY_MS (400),
 * MOCK_ACCESS_TTL_SECONDS (900).
 */
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 4010);
const DELAY_MS = Number(process.env.MOCK_DELAY_MS || 400);
const ACCESS_TTL_SECONDS = Number(process.env.MOCK_ACCESS_TTL_SECONDS || 900);

const users = [
  {
    id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed',
    firstName: 'Ana',
    lastName: 'López',
    address: 'Cra 25 # 45-67, Medellín',
    phone: '3001234567',
    email: 'ana@correo.com',
    username: 'analopez',
    password: 'Abc#12',
    hasBusiness: false,
  },
  {
    id: '9c858901-8a57-4791-81fe-4c455b099bc9',
    firstName: 'Óscar',
    lastName: 'Restrepo',
    address: 'Calle 10 # 43-12, Medellín',
    phone: '3109876543',
    email: 'owner@correo.com',
    username: 'owner',
    password: 'Abc#12',
    hasBusiness: true,
  },
];

/** refreshToken → username. Removed on logout and on rotation. */
const refreshTokens = new Map();

const businesses = [
  {
    id: '4f7c1d2e-8b3a-4c5d-9e6f-7a8b9c0d1e2f',
    ownerUsername: 'owner',
    name: 'Barbería Central',
    address: 'Calle 10 # 43-12, Medellín',
    phone: '3109876543',
    nit: '900.123.456-7',
    email: null,
    status: 'ACTIVE',
    timeZone: 'America/Bogota',
  },
];

const OWNER_BUSINESS_ID = '4f7c1d2e-8b3a-4c5d-9e6f-7a8b9c0d1e2f';

const employees = {
  ana: { id: 'e-ana', name: 'Ana López', photoUrl: null },
  juan: { id: 'e-juan', name: 'Juan Pérez', photoUrl: null },
  maria: { id: 'e-maria', name: 'María Gómez', photoUrl: null },
  pedro: { id: 'e-pedro', name: 'Pedro Ruiz', photoUrl: null },
  luisa: { id: 'e-luisa', name: 'Luisa Díaz', photoUrl: null },
};

/** Services per business (HU-08). DELETED ones are never listed. */
const services = [
  [
    'Corte de cabello',
    'Corte profesional para hombres y mujeres.',
    30,
    45000,
    'ACTIVE',
    ['ana', 'juan', 'maria', 'pedro', 'luisa'],
  ],
  [
    'Tinte completo',
    'Aplicación de tinte en todo el cabello.',
    60,
    85000,
    'ACTIVE',
    ['ana', 'maria'],
  ],
  ['Manicure', 'Cuidado y embellecimiento de uñas.', 45, 35000, 'ACTIVE', ['luisa']],
  ['Barba', 'Arreglo y perfilado de barba.', 20, 20000, 'ACTIVE', ['juan', 'pedro']],
  ['Limpieza facial', 'Limpieza profunda del rostro.', 90, 60000, 'INACTIVE', []],
  ['Asesoría de imagen', null, null, null, 'ACTIVE', []],
  ['Peinado para evento', 'Peinado para bodas y grados.', 75, 70000, 'DELETED', ['maria']],
].map(([name, description, durationMinutes, price, status, staff], index) => ({
  id: `svc-${String(index + 1).padStart(2, '0')}`,
  businessId: OWNER_BUSINESS_ID,
  name,
  description,
  durationMinutes,
  price,
  status,
  employees: staff.map((key) => employees[key]),
}));

// Mirrors the backend RegisterUserRequest rules (see HU-01 Back).
const REGISTER_RULES = [
  ['firstName', (v) => isFilled(v), 'El nombre es obligatorio'],
  ['lastName', (v) => isFilled(v), 'El apellido es obligatorio'],
  ['address', (v) => isFilled(v), 'La dirección es obligatoria'],
  [
    'phone',
    (v) => /^\+?\d{7,15}$/.test(String(v ?? '')),
    'El teléfono debe tener entre 7 y 15 dígitos',
  ],
  ['email', (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '')), 'El correo no es válido'],
  ['username', (v) => isFilled(v), 'El nombre de usuario es obligatorio'],
  [
    'password',
    (v) => {
      const p = String(v ?? '');
      return (
        p.length >= 6 &&
        p.length <= 72 &&
        /\p{Ll}/u.test(p) &&
        /\p{Lu}/u.test(p) &&
        /[^\p{L}\p{N}\s]/u.test(p)
      );
    },
    'La contraseña no cumple las reglas de seguridad',
  ],
];

// Mirrors the backend onboarding rules (see HU-03 Back): name, address and phone required.
const BUSINESS_RULES = [
  ['name', (v) => isFilled(v), 'El nombre del negocio es obligatorio'],
  ['address', (v) => isFilled(v), 'La dirección es obligatoria'],
  [
    'phone',
    (v) => /^\+?\d{7,15}$/.test(String(v ?? '')),
    'El teléfono debe tener entre 7 y 15 dígitos',
  ],
  ['nit', (v) => isBlank(v) || /^\d{6,10}(-\d)?$/.test(normalizeNit(v)), 'El NIT no es válido'],
  [
    'email',
    (v) => isBlank(v) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v)),
    'El correo no es válido',
  ],
];

const routes = {
  'POST /api/auth/register': (body) => {
    const errors = {};
    for (const [field, isValid, message] of REGISTER_RULES) {
      if (!isValid(body[field])) {
        errors[field] = message;
      }
    }
    if (Object.keys(errors).length > 0) {
      return problem(400, 'Bad Request', 'Invalid request content.', '/api/auth/register', errors);
    }
    const email = String(body.email).trim().toLowerCase();
    if (users.some((u) => u.username === body.username)) {
      return problem(409, 'Conflict', 'Username already exists', '/api/auth/register');
    }
    if (users.some((u) => u.email === email)) {
      return problem(409, 'Conflict', 'Email already exists', '/api/auth/register');
    }
    const user = {
      id: crypto.randomUUID(),
      firstName: body.firstName,
      lastName: body.lastName,
      address: body.address,
      phone: body.phone,
      email,
      username: body.username,
      password: body.password,
      hasBusiness: false,
    };
    users.push(user);
    return json(201, publicUser(user));
  },

  'POST /api/auth/login': (body) => {
    const identifier = String(body.username ?? '').trim();
    const user = users.find(
      (u) => u.username === identifier || u.email === identifier.toLowerCase(),
    );
    if (!user || user.password !== body.password) {
      return problem(401, 'Unauthorized', 'Bad credentials', '/api/auth/login');
    }
    return json(200, issueTokens(user));
  },

  'POST /api/auth/refresh': (body) => {
    const username = refreshTokens.get(body.refreshToken);
    const user = users.find((u) => u.username === username);
    if (!user) {
      return problem(401, 'Unauthorized', 'Invalid refresh token', '/api/auth/refresh');
    }
    refreshTokens.delete(body.refreshToken); // rotation: the old refresh token stops working
    return json(200, issueTokens(user));
  },

  'POST /api/auth/logout': (body) => {
    refreshTokens.delete(body.refreshToken);
    return { status: 204, headers: {}, body: '' };
  },

  'GET /api/servicios': (_body, req) => {
    const instance = '/api/servicios';
    const user = authenticatedUser(req);
    if (!user) {
      return problem(401, 'Unauthorized', 'Missing or invalid access token', instance);
    }
    const business = businesses.find((b) => b.ownerUsername === user.username);
    if (!business) {
      return problem(403, 'Forbidden', 'Business required', instance);
    }
    const query = new URL(req.url || '', 'http://localhost').searchParams;
    const page = Math.max(Number.parseInt(query.get('page') ?? '0', 10) || 0, 0);
    const size = Math.min(Math.max(Number.parseInt(query.get('size') ?? '20', 10) || 20, 1), 100);
    const visible = services
      .filter((s) => s.businessId === business.id && s.status !== 'DELETED')
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const content = visible
      .slice(page * size, page * size + size)
      .map(({ businessId, ...service }) => service);
    return json(200, {
      content,
      page,
      size,
      totalElements: visible.length,
      totalPages: Math.ceil(visible.length / size),
    });
  },

  'POST /api/negocios/onboarding': (body, req) => {
    const instance = '/api/negocios/onboarding';
    const user = authenticatedUser(req);
    if (!user) {
      return problem(401, 'Unauthorized', 'Missing or invalid access token', instance);
    }
    if (user.hasBusiness) {
      return problem(409, 'Conflict', 'User already has a business', instance);
    }
    const errors = {};
    for (const [field, isValid, message] of BUSINESS_RULES) {
      if (!isValid(body[field])) {
        errors[field] = message;
      }
    }
    if (Object.keys(errors).length > 0) {
      return problem(400, 'Bad Request', 'Invalid request content.', instance, errors);
    }
    const nit = isBlank(body.nit) ? null : String(body.nit).trim();
    if (nit && businesses.some((b) => b.nit && normalizeNit(b.nit) === normalizeNit(nit))) {
      return problem(409, 'Conflict', 'NIT already registered', instance);
    }
    const business = {
      id: crypto.randomUUID(),
      ownerUsername: user.username,
      name: body.name.trim(),
      address: body.address.trim(),
      phone: body.phone,
      nit,
      email: isBlank(body.email) ? null : String(body.email).trim().toLowerCase(),
      status: 'ACTIVE',
      timeZone: 'America/Bogota',
    };
    businesses.push(business);
    user.hasBusiness = true;
    const { ownerUsername, ...response } = business;
    return json(201, response);
  },
};

/** User of a valid, unexpired Bearer token issued by this mock; null otherwise. */
function authenticatedUser(req) {
  const [scheme, token] = String(req.headers.authorization ?? '').split(' ');
  const [, payload, signature] = String(token ?? '').split('.');
  if (scheme !== 'Bearer' || !payload || signature !== 'mock-signature') {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) {
      return null;
    }
    return users.find((u) => u.username === claims.sub) ?? null;
  } catch {
    return null;
  }
}

function issueTokens(user) {
  const now = Math.floor(Date.now() / 1000);
  const refreshToken = `mock-refresh-${crypto.randomUUID()}`;
  refreshTokens.set(refreshToken, user.username);
  return {
    accessToken: jwt({
      sub: user.username,
      hasBusiness: user.hasBusiness,
      iat: now,
      exp: now + ACCESS_TTL_SECONDS,
    }),
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TTL_SECONDS,
  };
}

function jwt(claims) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.mock-signature`;
}

function publicUser({ password, hasBusiness, ...user }) {
  return user;
}

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function normalizeNit(value) {
  return String(value).trim().replace(/\./g, '');
}

function json(status, data) {
  return { status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
}

function problem(status, title, detail, instance, errors) {
  const data = { type: 'about:blank', title, status, detail, instance, ...(errors && { errors }) };
  return {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
    body: JSON.stringify(data),
  };
}

// CORS for direct calls from the browser; the Angular dev proxy does not need it.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url || '', 'http://localhost');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }

  let raw = '';
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', () => {
    const handler = routes[`${req.method} ${pathname}`];
    let response;
    if (!handler) {
      response = json(404, { error: 'Endpoint not defined' });
    } else {
      try {
        response = handler(raw ? JSON.parse(raw) : {}, req);
      } catch {
        response = problem(400, 'Bad Request', 'Malformed JSON body', pathname);
      }
    }
    setTimeout(() => {
      console.log(`${req.method} ${pathname} → ${response.status}`);
      res.writeHead(response.status, { ...CORS_HEADERS, ...response.headers });
      res.end(response.body);
    }, DELAY_MS);
  });
});

server.listen(PORT, () =>
  console.log(`Mi Cita mock (frontend scenario) on http://localhost:${PORT}`),
);
