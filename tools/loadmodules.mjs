/* loadmodules.mjs — shared loader for the DOM-free modules (physics, levels).
 *
 * Usage:  const { BROS } = load(['js/01-namespace.js', ...], { console });
 * `window` is aliased to the sandbox global so the classic scripts work unchanged.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export function load(files, extraGlobals = {}) {
  const root = path.resolve(import.meta.dirname, '..');
  const sandbox = { window: null, console, setTimeout, clearTimeout, performance };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  Object.assign(sandbox, extraGlobals);
  vm.createContext(sandbox);
  for (const f of files) {
    const abs = path.isAbsolute(f) ? f : path.join(root, f);
    vm.runInContext(fs.readFileSync(abs, 'utf8'), sandbox, { filename: f });
  }
  return { BROS: sandbox.BROS, sandbox };
}
