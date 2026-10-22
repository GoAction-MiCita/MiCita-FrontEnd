// Security scan for a HU branch (see .claude/skills/hu-workflow/SKILL.md §6.1).
//
// 1. Static rules over the lines ADDED in src/ compared with the base branch (default
//    origin/integration): XSS sinks, dynamic code, secrets, token storage, logging, open
//    redirects, unsafe links, raw HTTP, auth bypasses ("back doors").
// 2. New dependencies in package.json (need explicit approval per CLAUDE.md).
// 3. Production bundle in dist/ (if built): mock data, localhost URLs, source maps.
//
// Usage: node tools/security/security-scan.js [baseRef]
// Exit code 1 when a HIGH finding exists. MEDIUM/LOW are reported for review.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const base = process.argv[2] || 'origin/integration';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

const isTest = (file) => /\.spec\.ts$/.test(file) || /\/testing\//.test(file);

/** [id, severity, description, regex, appliesTo(file)] */
const RULES = [
  [
    'xss-sink',
    'HIGH',
    'Asignación de HTML sin sanitizar (innerHTML/outerHTML/insertAdjacentHTML/document.write)',
    /\b(innerHTML|outerHTML|insertAdjacentHTML)\b|document\.write\(/,
    (f) => !isTest(f),
  ],
  [
    'sanitizer-bypass',
    'HIGH',
    'Desactiva la sanitización de Angular (bypassSecurityTrust*)',
    /bypassSecurityTrust/,
    () => true,
  ],
  [
    'dynamic-code',
    'HIGH',
    'Ejecución de código dinámico (eval / new Function / setTimeout con string)',
    /\beval\(|new Function\(|set(Timeout|Interval)\(\s*['"`]/,
    (f) => !isTest(f),
  ],
  [
    'secret',
    'HIGH',
    'Posible secreto o credencial en el código',
    /(api[_-]?key|secret|client[_-]?secret|private[_-]?key)\s*[:=]\s*['"`][^'"`]{6,}|-----BEGIN [A-Z ]*PRIVATE KEY|\bsk-[A-Za-z0-9-]{16,}|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{20,}/i,
    (f) => !isTest(f),
  ],
  [
    'hardcoded-password',
    'HIGH',
    'Contraseña escrita en el código de producción',
    /password\s*[:=]\s*['"`][^'"`]+['"`]/i,
    (f) => !isTest(f),
  ],
  [
    'token-storage',
    'HIGH',
    'Uso de localStorage/sessionStorage fuera de core/auth/token-storage.ts',
    /\b(localStorage|sessionStorage)\b/,
    (f) => !isTest(f) && !f.endsWith('core/auth/token-storage.ts'),
  ],
  [
    'auth-bypass',
    'HIGH',
    'Posible puerta trasera: bypass/skip de auth, modo debug o credenciales de prueba',
    /\b(skipAuth|bypassAuth|disableAuth|noAuth|backdoor|isDebug|debugMode|godMode)\b|mock-signature|Abc#12/i,
    (f) => !isTest(f),
  ],
  [
    'raw-fetch',
    'MEDIUM',
    'Petición HTTP fuera de HttpClient (fetch/XMLHttpRequest): se salta los interceptores',
    /\bfetch\(|XMLHttpRequest/,
    (f) => !isTest(f),
  ],
  [
    'absolute-url',
    'MEDIUM',
    'URL absoluta fuera de environments: usa API_URL',
    /['"`]https?:\/\/(?!www\.w3\.org)/,
    (f) => !isTest(f) && !f.includes('src/environments/'),
  ],
  [
    'open-redirect',
    'MEDIUM',
    'Navegación con window.location: revisa que no sea una redirección abierta',
    /window\.location(\.href)?\s*=|location\.(assign|replace)\(/,
    (f) => !isTest(f),
  ],
  [
    'blank-target',
    'MEDIUM',
    'target="_blank" sin rel="noopener noreferrer"',
    /target=["']_blank["'](?![^>]*rel=["'][^"']*noopener)/,
    (f) => f.endsWith('.html'),
  ],
  [
    'console',
    'LOW',
    'console.* en código de producción (posible fuga de datos)',
    /\bconsole\.(log|debug|info|trace)\(/,
    (f) => !isTest(f),
  ],
  [
    'disabled-guard',
    'MEDIUM',
    'Guard comentado o eliminado de una ruta',
    /\/\/\s*canActivate|\/\/\s*canMatch/,
    (f) => f.endsWith('.routes.ts') || f.endsWith('app.routes.ts'),
  ],
];

const findings = [];
const add = (severity, id, where, detail) => findings.push({ severity, id, where, detail });

// 1. Added lines in src/
let mergeBase;
try {
  mergeBase = git('merge-base', base, 'HEAD').trim();
} catch {
  console.error(`No se pudo calcular el merge-base con ${base}. ¿Hiciste git fetch?`);
  process.exit(2);
}
const scanLine = (file, line, text) => {
  for (const [id, severity, description, regex, applies] of RULES) {
    if (applies(file) && regex.test(text)) {
      add(severity, id, `${file}:${line}`, `${description} → ${text.trim().slice(0, 120)}`);
    }
  }
};

// Committed and uncommitted changes to tracked files.
const diff = git('diff', '--unified=0', '--no-color', mergeBase, '--', 'src');
let file = null;
let line = 0;
for (const raw of diff.split('\n')) {
  if (raw.startsWith('+++ ')) {
    file = raw.slice(6);
    continue;
  }
  const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(raw);
  if (hunk) {
    line = Number(hunk[1]);
    continue;
  }
  if (!file || !raw.startsWith('+') || raw.startsWith('+++')) {
    continue;
  }
  scanLine(file, line, raw.slice(1));
  line++;
}

// New files not yet tracked by git (a HU before its commit): every line counts as added.
const untracked = git('ls-files', '--others', '--exclude-standard', '--', 'src')
  .split('\n')
  .filter(Boolean);
for (const newFile of untracked) {
  fs.readFileSync(path.join(root, newFile), 'utf8')
    .split('\n')
    .forEach((text, index) => scanLine(newFile, index + 1, text));
}

// 2. New dependencies
try {
  const before = JSON.parse(git('show', `${mergeBase}:package.json`));
  const after = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const section of ['dependencies', 'devDependencies']) {
    for (const dep of Object.keys(after[section] ?? {})) {
      if (!(dep in (before[section] ?? {}))) {
        add(
          'MEDIUM',
          'new-dependency',
          `package.json › ${section}`,
          `Dependencia nueva "${dep}": requiere aprobación explícita (CLAUDE.md) y npm audit`,
        );
      }
    }
  }
} catch {
  // package.json missing in base: nothing to compare.
}

// 3. Production bundle
const dist = path.join(root, 'dist', 'mi-cita-app', 'browser');
if (fs.existsSync(dist)) {
  const BUNDLE_RULES = [
    ['bundle-mock', 'HIGH', /mock-signature|Abc#12|mock-refresh-/],
    ['bundle-localhost', 'HIGH', /https?:\/\/localhost[:/]/],
    ['bundle-sourcemap', 'MEDIUM', /sourceMappingURL=/],
  ];
  for (const name of fs.readdirSync(dist)) {
    if (!/\.(js|html|css)$/.test(name)) {
      continue;
    }
    const content = fs.readFileSync(path.join(dist, name), 'utf8');
    for (const [id, severity, regex] of BUNDLE_RULES) {
      if (regex.test(content)) {
        add(severity, id, `dist/${name}`, `El build de producción contiene ${regex}`);
      }
    }
  }
} else {
  add(
    'LOW',
    'bundle-missing',
    'dist/',
    'No hay build de producción: ejecuta npm run build antes del escaneo',
  );
}

// Report
const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity]);
console.log(`Security scan · base ${base} (${mergeBase.slice(0, 7)})`);
if (findings.length === 0) {
  console.log('Sin hallazgos.');
}
for (const f of findings) {
  console.log(`[${f.severity}] ${f.id} · ${f.where}\n    ${f.detail}`);
}
const high = findings.filter((f) => f.severity === 'HIGH').length;
console.log(
  `Resumen: ${high} HIGH · ${findings.filter((f) => f.severity === 'MEDIUM').length} MEDIUM · ${findings.filter((f) => f.severity === 'LOW').length} LOW`,
);
process.exit(high > 0 ? 1 : 0);
