/*
  Builds the publishable web root into dist/.

  There is nothing to compile — the pages are plain HTML. This exists because
  hosting panels (Hostinger among them) insist on an output directory, and
  because it guarantees that only public files are published: server/ holds the
  member database and the SMTP credentials and must never end up in a web root.
*/

import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'dist');

const folders = ['css', 'js', 'images'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const pages = readdirSync(here).filter((name) => name.endsWith('.html'));
for (const page of pages) {
  cpSync(join(here, page), join(out, page));
}

for (const folder of folders) {
  cpSync(join(here, folder), join(out, folder), { recursive: true });
}

console.log(`dist/ built: ${pages.length} pages, folders: ${folders.join(', ')}`);
