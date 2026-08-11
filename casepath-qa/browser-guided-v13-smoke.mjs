import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function assemble(prefix, output) {
  const parts = (await fs.readdir('.')).filter(name => name.startsWith(prefix)).sort();
  if (!parts.length) throw new Error(`No source parts found for ${prefix}`);
  const content = (await Promise.all(parts.map(name => fs.readFile(name, 'utf8')))).join('');
  await fs.writeFile(output, content);
}

await assemble('browser-guided-v19-final.mjs.part', 'browser-guided-v19-runtime.mjs');
await assemble('generate-visual-story.py.part', 'generate-visual-story.py');
await import(pathToFileURL(path.resolve('browser-guided-v19-runtime.mjs')).href);
