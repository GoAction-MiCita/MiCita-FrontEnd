// Regenerates the `contract` scenario (default.js) from the collection without touching
// frontend.js. `postman mock generate --update` cannot be used: it rewrites the default scenario
// (frontend.js) and does not add endpoints that are new in the collection.
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const collection = path.join(root, 'postman/collections/micita-backend.postman_collection.json');
const target = path.join(root, 'postman/mocks/micita-backend/default.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'micita-contract-'));

try {
  // A single command string: `postman` is a .cmd shim on Windows and needs a shell.
  execSync(`postman mock generate "${collection}" -o "${tmp}" --port 4010`, { stdio: 'inherit' });
  fs.copyFileSync(path.join(tmp, 'default.js'), target);
  console.log(`Contract scenario updated: ${path.relative(root, target)}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
