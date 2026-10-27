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
 * new businesses start empty, users without business get 403. HU-15 paging: page (0-based) and
 * size (default 10, 1..100, else 400), stable order by name and id. HU-13 filters: `name` (contains,
 * case-insensitive), `status` (ACTIVE/INACTIVE, anything else 400) and `employeeIds=a,b` (any). POST /api/servicios (HU-09) adds
 * one: 400 per field, 409 for a duplicate name in the same business (case-insensitive).
 * GET and PUT /api/servicios/{id} (HU-10) read and update one: 404 for unknown, DELETED or other
 * businesses' ids; the PUT 409 ignores the service itself and `employeeIds` replaces the list.
 * GET /api/empleados (HU-16) lists the employees of the business with their services (not DELETED),
 * ordered by last name, first name and id, with the HU-15 paging rules: owner has 24 visible
 * employees (one more is DELETED), new businesses none, users without business get 403.
 * POST /api/empleados (HU-17) adds one: 400 per field (firstName/lastName 1..100, phone `+`
 * optional and 7..15 digits, email, status ACTIVE/INACTIVE, unknown `serviceIds[i]`), 409 when the
 * email or phone is already used in the business (`errors.email` / `errors.phone`).
 * GET and PUT /api/empleados/{id} (HU-18) read and update one with the HU-17 rules: 404 for unknown,
 * DELETED or other businesses' ids; the PUT 409 ignores the employee itself and `serviceIds`
 * replaces its services (an empty list removes them all).
 * PATCH /api/empleados/{id}/estado (HU-20) switches ACTIVE ↔ INACTIVE (200, idempotent) keeping its
 * services; DELETED or another value answers 400, unknown/DELETED/foreign ids 404.
 * POST and PUT accept `employeeIds` (HU-12): unknown ids answer 400 as `errors["employeeIds[i]"]`.
 * PATCH /api/servicios/{id}/estado (HU-11) switches ACTIVE ↔ INACTIVE (200, idempotent); DELETED
 * or another value answers 400.
 * DELETE /api/servicios/{id} (HU-14) marks it DELETED (204); owner's "Corte de cabello" (svc-01)
 * has future appointments and answers 409.
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

/** Employees of owner's business (HU-16 Back). DELETED ones are never listed nor accepted. */
const employees = Object.fromEntries(
  [
    ['ana', 'Ana', 'López', '3001234567', 'ana.lopez@barberia.com', 'ACTIVE'],
    ['juan', 'Juan', 'Pérez', '3012345678', 'juan.perez@barberia.com', 'ACTIVE'],
    ['maria', 'María', 'Gómez', '3023456789', 'maria.gomez@barberia.com', 'ACTIVE'],
    ['pedro', 'Pedro', 'Ruiz', '3034567890', null, 'INACTIVE'],
    ['luisa', 'Luisa', 'Díaz', null, 'luisa.diaz@barberia.com', 'ACTIVE'],
    // HU-16: enough employees for owner to page through with 20 per page.
    ['carlos', 'Carlos', 'Ramírez', '3045678901', 'carlos.ramirez@barberia.com', 'ACTIVE'],
    ['laura', 'Laura', 'Martínez', '3056789012', 'laura.martinez@barberia.com', 'ACTIVE'],
    ['diego', 'Diego', 'Torres', '3067890123', 'diego.torres@barberia.com', 'ACTIVE'],
    ['sofia', 'Sofía', 'Hernández', '3078901234', 'sofia.hernandez@barberia.com', 'INACTIVE'],
    ['andres', 'Andrés', 'Castro', '3089012345', 'andres.castro@barberia.com', 'ACTIVE'],
    ['camila', 'Camila', 'Rojas', '3090123456', 'camila.rojas@barberia.com', 'ACTIVE'],
    ['felipe', 'Felipe', 'Moreno', '3101234567', 'felipe.moreno@barberia.com', 'ACTIVE'],
    ['valentina', 'Valentina', 'Vargas', '3112345678', 'valentina.vargas@barberia.com', 'ACTIVE'],
    ['santiago', 'Santiago', 'Jiménez', '3123456789', 'santiago.jimenez@barberia.com', 'ACTIVE'],
    ['daniela', 'Daniela', 'Ortiz', '3134567890', 'daniela.ortiz@barberia.com', 'ACTIVE'],
    ['mateo', 'Mateo', 'Silva', '3145678901', null, 'ACTIVE'],
    ['isabella', 'Isabella', 'Mendoza', '3156789012', 'isabella.mendoza@barberia.com', 'ACTIVE'],
    [
      'sebastian',
      'Sebastián',
      'Navarro',
      '3167890123',
      'sebastian.navarro@barberia.com',
      'INACTIVE',
    ],
    ['gabriela', 'Gabriela', 'Ríos', '3178901234', 'gabriela.rios@barberia.com', 'ACTIVE'],
    ['nicolas', 'Nicolás', 'Guerrero', '3189012345', 'nicolas.guerrero@barberia.com', 'ACTIVE'],
    ['paula', 'Paula', 'Cárdenas', '3190123456', 'paula.cardenas@barberia.com', 'ACTIVE'],
    ['tomas', 'Tomás', 'Herrera', '3201234567', 'tomas.herrera@barberia.com', 'ACTIVE'],
    ['juliana', 'Juliana', 'Acosta', '3212345678', 'juliana.acosta@barberia.com', 'ACTIVE'],
    ['martin', 'Martín', 'López', '3223456789', 'martin.lopez@barberia.com', 'ACTIVE'],
    ['elena', 'Elena', 'Suárez', '3234567890', 'elena.suarez@barberia.com', 'DELETED'],
  ].map(([key, firstName, lastName, phone, email, status]) => [
    key,
    { id: `e-${key}`, businessId: OWNER_BUSINESS_ID, firstName, lastName, phone, email, status },
  ]),
);

/** Employee as embedded in a service (HU-08 Back: id, name, photo). */
function employeeSummary(employee) {
  return { id: employee.id, name: `${employee.firstName} ${employee.lastName}`, photoUrl: null };
}

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
  // HU-15: enough services for owner to page through with 20 per page.
  ['Alisado', 'Alisado con keratina.', 120, 150000, 'ACTIVE', ['maria']],
  ['Balayage', 'Iluminación degradada.', 150, 180000, 'ACTIVE', ['ana', 'maria']],
  ['Cejas', 'Diseño y depilación de cejas.', 20, 15000, 'ACTIVE', ['luisa']],
  ['Corte infantil', 'Corte para niños hasta 12 años.', 25, 25000, 'ACTIVE', ['juan']],
  ['Depilación con cera', 'Piernas o brazos.', 40, 40000, 'INACTIVE', ['luisa']],
  ['Diseño de barba', 'Perfilado con navaja.', 30, 25000, 'ACTIVE', ['pedro']],
  ['Hidratación capilar', 'Tratamiento de hidratación profunda.', 45, 55000, 'ACTIVE', ['ana']],
  ['Lavado y secado', null, 30, 20000, 'ACTIVE', ['ana', 'juan']],
  ['Maquillaje social', 'Maquillaje para eventos.', 60, 90000, 'ACTIVE', ['maria']],
  ['Masaje capilar', 'Masaje relajante de cuero cabelludo.', 15, 15000, 'INACTIVE', []],
  ['Mechas', 'Mechas tradicionales.', 120, 120000, 'ACTIVE', ['maria']],
  ['Pedicure', 'Cuidado de pies y uñas.', 50, 40000, 'ACTIVE', ['luisa']],
  ['Permanente de pestañas', null, 60, 70000, 'ACTIVE', ['luisa']],
  ['Planchado', 'Planchado de cabello.', 40, 35000, 'ACTIVE', ['ana']],
  ['Recorte de puntas', null, 15, 15000, 'ACTIVE', ['juan', 'pedro']],
  ['Semipermanente de uñas', 'Esmaltado semipermanente.', 60, 50000, 'ACTIVE', ['luisa']],
  ['Tinte de raíz', 'Retoque de raíz.', 60, 60000, 'ACTIVE', ['maria']],
  ['Uñas acrílicas', 'Aplicación completa.', 90, 110000, 'INACTIVE', ['luisa']],
  // HU-16: services of the new employees.
  [
    'Corte clásico',
    'Corte con tijera y máquina.',
    30,
    30000,
    'ACTIVE',
    ['carlos', 'diego', 'andres'],
  ],
  [
    'Spa de manos',
    'Exfoliación e hidratación.',
    40,
    45000,
    'ACTIVE',
    ['laura', 'camila', 'gabriela'],
  ],
].map(([name, description, durationMinutes, price, status, staff], index) => ({
  id: `svc-${String(index + 1).padStart(2, '0')}`,
  businessId: OWNER_BUSINESS_ID,
  name,
  description,
  durationMinutes,
  price,
  status,
  employees: staff.map((key) => employeeSummary(employees[key])),
}));

/** Future appointments per service id (HU-14): deleting one of these answers 409. */
const futureAppointments = { 'svc-01': 3 };

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

// Mirrors the backend service rules (see HU-09 Back): name and status required.
// Mirrors the backend CreateEmployeeRequest rules (see HU-17 Back).
const EMPLOYEE_RULES = [
  [
    'firstName',
    (v) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 100,
    'El nombre es obligatorio y debe tener máximo 100 caracteres',
  ],
  [
    'lastName',
    (v) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 100,
    'El apellido es obligatorio y debe tener máximo 100 caracteres',
  ],
  ['phone', (v) => isBlank(v) || /^\+?\d{7,15}$/.test(String(v)), 'El teléfono no es válido'],
  [
    'email',
    (v) => isBlank(v) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v)),
    'El correo no es válido',
  ],
  ['status', (v) => v === 'ACTIVE' || v === 'INACTIVE', 'El estado debe ser ACTIVE o INACTIVE'],
];

const SERVICE_RULES = [
  ['name', (v) => isFilled(v), 'El nombre del servicio es obligatorio'],
  [
    'description',
    (v) => isBlank(v) || (typeof v === 'string' && v.length <= 255),
    'La descripción admite máximo 255 caracteres',
  ],
  [
    'durationMinutes',
    (v) => v === null || v === undefined || (Number.isInteger(v) && v > 0),
    'La duración debe ser mayor a 0 minutos',
  ],
  [
    'price',
    (v) => v === null || v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= 0),
    'El precio no puede ser negativo',
  ],
  ['status', (v) => v === 'ACTIVE' || v === 'INACTIVE', 'El estado debe ser ACTIVE o INACTIVE'],
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
    const paging = readPaging(query);
    if (paging.errors) {
      return problem(400, 'Bad Request', 'Invalid request content.', instance, paging.errors);
    }
    const { page, size } = paging;
    // HU-13 filters, combined with AND: name contains (case-insensitive), status, any employee.
    const name = (query.get('name') ?? '').trim().toLowerCase();
    const status = query.get('status');
    if (status !== null && status !== 'ACTIVE' && status !== 'INACTIVE') {
      return problem(400, 'Bad Request', 'Invalid request content.', instance, {
        status: 'El estado debe ser ACTIVE o INACTIVE',
      });
    }
    const employeeIds = (query.get('employeeIds') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const visible = services
      .filter((s) => s.businessId === business.id && s.status !== 'DELETED')
      .filter((s) => !name || s.name.toLowerCase().includes(name))
      .filter((s) => !status || s.status === status)
      .filter((s) => !employeeIds.length || s.employees.some((e) => employeeIds.includes(e.id)))
      // Stable order across pages: name, then id (HU-15 Back).
      .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
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

  'POST /api/servicios': (body, req) => {
    const instance = '/api/servicios';
    const user = authenticatedUser(req);
    if (!user) {
      return problem(401, 'Unauthorized', 'Missing or invalid access token', instance);
    }
    const business = businesses.find((b) => b.ownerUsername === user.username);
    if (!business) {
      return problem(403, 'Forbidden', 'Business required', instance);
    }
    const errors = {};
    for (const [field, isValid, message] of SERVICE_RULES) {
      if (!isValid(body[field])) {
        errors[field] = message;
      }
    }
    Object.assign(errors, employeeErrors(business, body.employeeIds));
    if (Object.keys(errors).length > 0) {
      return problem(400, 'Bad Request', 'Invalid request content.', instance, errors);
    }
    const name = body.name.trim();
    const duplicate = services.some(
      (s) =>
        s.businessId === business.id &&
        s.status !== 'DELETED' &&
        s.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      return problem(409, 'Conflict', 'Service name already exists', instance);
    }
    const service = {
      id: crypto.randomUUID(),
      businessId: business.id,
      name,
      description: isBlank(body.description) ? null : body.description.trim(),
      durationMinutes: body.durationMinutes ?? null,
      price: body.price ?? null,
      status: body.status,
      employees: pickStaff(business, body.employeeIds ?? []),
    };
    services.push(service);
    const { businessId, ...response } = service;
    return json(201, response);
  },

  // HU-16: paged employees with their services; also feeds the HU-12 picker (size=100).
  'GET /api/empleados': (_body, req) => {
    const instance = '/api/empleados';
    const user = authenticatedUser(req);
    if (!user) {
      return problem(401, 'Unauthorized', 'Missing or invalid access token', instance);
    }
    const business = businesses.find((b) => b.ownerUsername === user.username);
    if (!business) {
      return problem(403, 'Forbidden', 'Business required', instance);
    }
    const query = new URL(req.url || '', 'http://localhost').searchParams;
    const paging = readPaging(query);
    if (paging.errors) {
      return problem(400, 'Bad Request', 'Invalid request content.', instance, paging.errors);
    }
    const { page, size } = paging;
    const visible = [...businessStaff(business)].sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName, 'es') ||
        a.firstName.localeCompare(b.firstName, 'es') ||
        a.id.localeCompare(b.id),
    );
    const content = visible
      .slice(page * size, page * size + size)
      .map(({ businessId, ...employee }) => ({
        ...employee,
        services: services
          .filter((s) => s.businessId === business.id && s.status !== 'DELETED')
          .filter((s) => s.employees.some((e) => e.id === employee.id))
          .map(({ id, name }) => ({ id, name })),
      }));
    return json(200, {
      content,
      page,
      size,
      totalElements: visible.length,
      totalPages: Math.ceil(visible.length / size),
    });
  },

  'POST /api/empleados': (body, req) => {
    const instance = '/api/empleados';
    const user = authenticatedUser(req);
    if (!user) {
      return problem(401, 'Unauthorized', 'Missing or invalid access token', instance);
    }
    const business = businesses.find((b) => b.ownerUsername === user.username);
    if (!business) {
      return problem(403, 'Forbidden', 'Business required', instance);
    }
    const errors = {};
    for (const [field, isValid, message] of EMPLOYEE_RULES) {
      if (!isValid(body[field])) {
        errors[field] = message;
      }
    }
    Object.assign(errors, serviceErrors(business, body.serviceIds));
    if (Object.keys(errors).length > 0) {
      return problem(400, 'Bad Request', 'Invalid request content.', instance, errors);
    }
    const phone = isBlank(body.phone) ? null : String(body.phone).trim();
    const email = isBlank(body.email) ? null : String(body.email).trim().toLowerCase();
    // Duplicates: same email or phone in another employee of the business (not DELETED).
    const staff = businessStaff(business);
    const duplicated = {
      ...(email && staff.some((e) => e.email?.toLowerCase() === email)
        ? { email: 'Ya existe un empleado con este correo' }
        : {}),
      ...(phone && staff.some((e) => e.phone === phone)
        ? { phone: 'Ya existe un empleado con este teléfono' }
        : {}),
    };
    if (Object.keys(duplicated).length > 0) {
      return problem(
        409,
        'Conflict',
        'Employee email or phone already exists',
        instance,
        duplicated,
      );
    }
    const employee = {
      id: crypto.randomUUID(),
      businessId: business.id,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      phone,
      email,
      status: body.status,
    };
    employees[employee.id] = employee;
    // service_employees is owned by the service module: link through the services.
    const serviceIds = [...new Set(body.serviceIds ?? [])];
    for (const service of services.filter((s) => serviceIds.includes(s.id))) {
      service.employees.push(employeeSummary(employee));
    }
    const { businessId, ...response } = employee;
    return json(201, {
      ...response,
      services: services
        .filter((s) => serviceIds.includes(s.id))
        .map(({ id, name }) => ({ id, name })),
    });
  },

  'GET /api/empleados/{id}': (_body, req, params) => {
    const instance = `/api/empleados/${params.id}`;
    const user = authenticatedUser(req);
    if (!user) {
      return problem(401, 'Unauthorized', 'Missing or invalid access token', instance);
    }
    const business = businesses.find((b) => b.ownerUsername === user.username);
    if (!business) {
      return problem(403, 'Forbidden', 'Business required', instance);
    }
    const employee = findEmployee(business, params.id);
    if (!employee) {
      return problem(404, 'Not Found', 'Employee not found', instance);
    }
    return json(200, employeeResponse(business, employee));
  },

  'PUT /api/empleados/{id}': (body, req, params) => {
    const instance = `/api/empleados/${params.id}`;
    const user = authenticatedUser(req);
    if (!user) {
      return problem(401, 'Unauthorized', 'Missing or invalid access token', instance);
    }
    const business = businesses.find((b) => b.ownerUsername === user.username);
    if (!business) {
      return problem(403, 'Forbidden', 'Business required', instance);
    }
    const employee = findEmployee(business, params.id);
    if (!employee) {
      return problem(404, 'Not Found', 'Employee not found', instance);
    }
    const errors = {};
    for (const [field, isValid, message] of EMPLOYEE_RULES) {
      if (!isValid(body[field])) {
        errors[field] = message;
      }
    }
    Object.assign(errors, serviceErrors(business, body.serviceIds));
    if (Object.keys(errors).length > 0) {
      return problem(400, 'Bad Request', 'Invalid request content.', instance, errors);
    }
    const phone = isBlank(body.phone) ? null : String(body.phone).trim();
    const email = isBlank(body.email) ? null : String(body.email).trim().toLowerCase();
    // Duplicates: same email or phone in another employee of the business (itself does not count).
    const others = businessStaff(business).filter((e) => e.id !== employee.id);
    const duplicated = {
      ...(email && others.some((e) => e.email?.toLowerCase() === email)
        ? { email: 'Ya existe un empleado con este correo' }
        : {}),
      ...(phone && others.some((e) => e.phone === phone)
        ? { phone: 'Ya existe un empleado con este teléfono' }
        : {}),
    };
    if (Object.keys(duplicated).length > 0) {
      return problem(
        409,
        'Conflict',
        'Employee email or phone already exists',
        instance,
        duplicated,
      );
    }
    Object.assign(employee, {
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      phone,
      email,
      status: body.status,
    });
    // serviceIds replaces the whole association (kept on the services, as in HU-17).
    const serviceIds = [...new Set(body.serviceIds ?? [])];
    for (const service of services.filter((s) => s.businessId === business.id)) {
      service.employees = service.employees.filter((e) => e.id !== employee.id);
      if (serviceIds.includes(service.id)) {
        service.employees.push(employeeSummary(employee));
      }
    }
    return json(200, employeeResponse(business, employee));
  },

  'PATCH /api/empleados/{id}/estado': (body, req, params) => {
    const instance = `/api/empleados/${params.id}/estado`;
    const user = authenticatedUser(req);
    if (!user) {
      return problem(401, 'Unauthorized', 'Missing or invalid access token', instance);
    }
    const business = businesses.find((b) => b.ownerUsername === user.username);
    if (!business) {
      return problem(403, 'Forbidden', 'Business required', instance);
    }
    // DELETED is not a valid target here: deleting is HU-21.
    if (body.status !== 'ACTIVE' && body.status !== 'INACTIVE') {
      return problem(400, 'Bad Request', 'Invalid request content.', instance, {
        status: 'El estado debe ser ACTIVE o INACTIVE',
      });
    }
    const employee = findEmployee(business, params.id);
    if (!employee) {
      return problem(404, 'Not Found', 'Employee not found', instance);
    }
    // Idempotent; its services and appointments are kept.
    employee.status = body.status;
    return json(200, employeeResponse(business, employee));
  },

  'GET /api/servicios/{id}': (_body, req, params) => {
    const instance = `/api/servicios/${params.id}`;
    const user = authenticatedUser(req);
    if (!user) {
      return problem(401, 'Unauthorized', 'Missing or invalid access token', instance);
    }
    const business = businesses.find((b) => b.ownerUsername === user.username);
    if (!business) {
      return problem(403, 'Forbidden', 'Business required', instance);
    }
    const service = findService(business, params.id);
    if (!service) {
      return problem(404, 'Not Found', 'Service not found', instance);
    }
    const { businessId, ...response } = service;
    return json(200, response);
  },

  'PUT /api/servicios/{id}': (body, req, params) => {
    const instance = `/api/servicios/${params.id}`;
    const user = authenticatedUser(req);
    if (!user) {
      return problem(401, 'Unauthorized', 'Missing or invalid access token', instance);
    }
    const business = businesses.find((b) => b.ownerUsername === user.username);
    if (!business) {
      return problem(403, 'Forbidden', 'Business required', instance);
    }
    const service = findService(business, params.id);
    if (!service) {
      return problem(404, 'Not Found', 'Service not found', instance);
    }
    const errors = {};
    for (const [field, isValid, message] of SERVICE_RULES) {
      if (!isValid(body[field])) {
        errors[field] = message;
      }
    }
    const employeeIds = body.employeeIds;
    Object.assign(errors, employeeErrors(business, employeeIds));
    if (Object.keys(errors).length > 0) {
      return problem(400, 'Bad Request', 'Invalid request content.', instance, errors);
    }
    const name = body.name.trim();
    // The service itself does not count as a duplicate (HU-10 Back).
    const duplicate = services.some(
      (s) =>
        s.id !== service.id &&
        s.businessId === business.id &&
        s.status !== 'DELETED' &&
        s.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      return problem(409, 'Conflict', 'Service name already exists', instance);
    }
    Object.assign(service, {
      name,
      description: isBlank(body.description) ? null : body.description.trim(),
      durationMinutes: body.durationMinutes ?? null,
      price: body.price ?? null,
      status: body.status,
    });
    // employeeIds replaces the whole association; an empty list removes everyone.
    if (Array.isArray(employeeIds)) {
      service.employees = pickStaff(business, employeeIds);
    }
    const { businessId, ...response } = service;
    return json(200, response);
  },

  'DELETE /api/servicios/{id}': (_body, req, params) => {
    const instance = `/api/servicios/${params.id}`;
    const user = authenticatedUser(req);
    if (!user) {
      return problem(401, 'Unauthorized', 'Missing or invalid access token', instance);
    }
    const business = businesses.find((b) => b.ownerUsername === user.username);
    if (!business) {
      return problem(403, 'Forbidden', 'Business required', instance);
    }
    const service = findService(business, params.id);
    if (!service) {
      return problem(404, 'Not Found', 'Service not found', instance);
    }
    const count = futureAppointments[service.id] ?? 0;
    if (count > 0) {
      const conflict = problem(
        409,
        'Conflict',
        `Service has ${count} future appointments`,
        instance,
      );
      // Assumed extension member for the count: HU-14 Back does not name it yet.
      conflict.body = JSON.stringify({ ...JSON.parse(conflict.body), futureAppointments: count });
      return conflict;
    }
    // Logical delete: the record and its employees stay; it just stops being listed.
    service.status = 'DELETED';
    return { status: 204, headers: {}, body: '' };
  },

  'PATCH /api/servicios/{id}/estado': (body, req, params) => {
    const instance = `/api/servicios/${params.id}/estado`;
    const user = authenticatedUser(req);
    if (!user) {
      return problem(401, 'Unauthorized', 'Missing or invalid access token', instance);
    }
    const business = businesses.find((b) => b.ownerUsername === user.username);
    if (!business) {
      return problem(403, 'Forbidden', 'Business required', instance);
    }
    // DELETED is not a valid target here: deleting is HU-14.
    if (body.status !== 'ACTIVE' && body.status !== 'INACTIVE') {
      return problem(400, 'Bad Request', 'Invalid request content.', instance, {
        status: 'El estado debe ser ACTIVE o INACTIVE',
      });
    }
    const service = findService(business, params.id);
    if (!service) {
      return problem(404, 'Not Found', 'Service not found', instance);
    }
    // Idempotent: the same status answers 200 without changes. Appointments are never touched.
    service.status = body.status;
    const { businessId, ...response } = service;
    return json(200, response);
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

/** Employees of a business that are not DELETED: owner has the sample team; HU-17 adds more. */
function businessStaff(business) {
  return Object.values(employees).filter(
    (e) => e.businessId === business.id && e.status !== 'DELETED',
  );
}

/** HU-18: employee of the business that is not DELETED; null for unknown ids or other businesses. */
function findEmployee(business, id) {
  return businessStaff(business).find((e) => e.id === id) ?? null;
}

/** Employee as answered by the API (HU-16/17/18): without businessId, with its services. */
function employeeResponse(business, employee) {
  const { businessId, ...response } = employee;
  return {
    ...response,
    services: services
      .filter((s) => s.businessId === business.id && s.status !== 'DELETED')
      .filter((s) => s.employees.some((e) => e.id === employee.id))
      .map(({ id, name }) => ({ id, name })),
  };
}

/** HU-17: each unknown, foreign or DELETED service is reported by its position, `serviceIds[i]`. */
function serviceErrors(business, serviceIds) {
  if (serviceIds === undefined || serviceIds === null) {
    return {};
  }
  if (!Array.isArray(serviceIds)) {
    return { serviceIds: 'serviceIds debe ser una lista' };
  }
  return Object.fromEntries(
    serviceIds
      .map((id, index) => [index, findService(business, id) !== null])
      .filter(([, known]) => !known)
      .map(([index]) => [`serviceIds[${index}]`, 'El servicio no pertenece al negocio']),
  );
}

/**
 * HU-15 paging: 0-based page, default page 0 and size 10. The Front offers 20/50/100, so the mock
 * accepts up to 100 (HU-15 Back says 50: pending to align).
 */
function readPaging(query) {
  const page = Number(query.get('page') ?? '0');
  const size = Number(query.get('size') ?? '10');
  const errors = {
    ...(!Number.isInteger(page) || page < 0 ? { page: 'page debe ser un entero >= 0' } : {}),
    ...(!Number.isInteger(size) || size < 1 || size > 100
      ? { size: 'size debe estar entre 1 y 100' }
      : {}),
  };
  return Object.keys(errors).length > 0 ? { errors } : { page, size };
}

/** HU-12: each unknown employee is reported by its position, `employeeIds[i]`, Spring style. */
function employeeErrors(business, employeeIds) {
  if (employeeIds === undefined || employeeIds === null) {
    return {};
  }
  if (!Array.isArray(employeeIds)) {
    return { employeeIds: 'employeeIds debe ser una lista' };
  }
  const staff = businessStaff(business);
  return Object.fromEntries(
    employeeIds
      .map((id, index) => [index, staff.some((e) => e.id === id)])
      .filter(([, known]) => !known)
      .map(([index]) => [`employeeIds[${index}]`, 'El empleado no pertenece al negocio']),
  );
}

/** Staff of the business with those ids, each once, in the order sent. */
function pickStaff(business, employeeIds) {
  const staff = businessStaff(business);
  return [...new Set(employeeIds)]
    .map((id) => staff.find((e) => e.id === id))
    .filter(Boolean)
    .map(employeeSummary);
}

/** Service of the business that is not DELETED; null for unknown ids or other businesses. */
function findService(business, id) {
  return (
    services.find((s) => s.id === id && s.businessId === business.id && s.status !== 'DELETED') ??
    null
  );
}

/**
 * Exact route first, then servicios/empleados routes with an `{id}` path parameter (optionally
 * `/{id}/estado`).
 */
function resolveRoute(method, pathname) {
  const exact = routes[`${method} ${pathname}`];
  if (exact) {
    return { handler: exact, params: {} };
  }
  const match = /^(\/api\/(?:servicios|empleados))\/([^/]+)(\/estado)?$/.exec(pathname);
  const handler = match && routes[`${method} ${match[1]}/{id}${match[3] ?? ''}`];
  return handler ? { handler, params: { id: decodeURIComponent(match[2]) } } : null;
}

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
    const route = resolveRoute(req.method, pathname);
    let response;
    if (!route) {
      response = json(404, { error: 'Endpoint not defined' });
    } else {
      try {
        response = route.handler(raw ? JSON.parse(raw) : {}, req, route.params);
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
