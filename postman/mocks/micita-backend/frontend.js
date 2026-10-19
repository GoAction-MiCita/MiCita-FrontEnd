/**
 * Scenario "frontend": stateful mock of the Mi Cita auth API for local frontend work.
 *
 * Hand-written (not generated): `postman mock generate --update` only rewrites default.js, which
 * keeps the static examples of the collection. This scenario reads the request body so the app
 * can exercise every branch without special headers.
 *
 * Accounts (password `Abc#12`):
 *   analopez / ana@correo.com    → hasBusiness=false (goes to onboarding)
 *   owner    / owner@correo.com  → hasBusiness=true  (goes to dashboard)
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
};

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
        response = handler(raw ? JSON.parse(raw) : {});
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
