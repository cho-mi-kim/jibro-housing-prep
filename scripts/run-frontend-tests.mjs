import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Explicit filenames work across shells and exclude Gradle's generated test reports.
const root = fileURLToPath(new URL('../', import.meta.url));
const files = readdirSync(new URL('../src/', import.meta.url))
  .filter(name => name.endsWith('.test.mjs')).sort().map(name => `src/${name}`);
if (!files.length) throw new Error('No frontend tests found');
const result = spawnSync(process.execPath, ['--test', ...files], {cwd:root, stdio:'inherit'});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
