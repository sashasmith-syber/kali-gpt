import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const encodedRoot = join(root, 'encoded-assets');

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.name.endsWith('.b64')) files.push(path);
  }
  return files;
}

try {
  const files = await walk(encodedRoot);
  for (const source of files) {
    const target = join(root, 'public', relative(encodedRoot, source).replace(/\.b64$/, ''));
    await mkdir(dirname(target), { recursive: true });
    const encoded = await readFile(source, 'utf8');
    await writeFile(target, Buffer.from(encoded.replace(/\s/g, ''), 'base64'));
  }
  console.log(`Decoded ${files.length} bundled assets.`);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.log('Encoded assets already decoded; continuing.');
  } else {
    throw error;
  }
}
