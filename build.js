/*
  Builds the publishable web root into dist/ and stamps asset versions.

  There is nothing to compile — the pages are plain HTML. This exists because
  hosting panels (Hostinger among them) insist on an output directory, and
  because it guarantees that only public files are published: server/ holds the
  member database and the SMTP credentials and must never end up in a web root.

  It also rewrites every local stylesheet and script reference to carry a short
  hash of that file's contents. Hostinger's CDN serves css/ and js/ with
  max-age=604800 — a week — so without a changing URL, visitors keep the old
  files for days after a deployment. That is not theoretical: a fix to
  animations.js sat live for hours while every browser still ran the version
  from three days earlier.
*/

import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'dist');
const folders = ['css', 'js', 'images'];

/* Short content hash of a file, or null when it does not exist. */
function versionOf(relativePath) {
  try {
    const content = readFileSync(join(here, relativePath));
    return createHash('sha1').update(content).digest('hex').slice(0, 8);
  } catch {
    return null;
  }
}

/*
  Rewrites href/src of local css and js files to "path?v=<hash>". An existing
  ?v= is replaced, so running this repeatedly stays stable.
*/
function stampAssets(html) {
  return html.replace(/(href|src)="((?:css|js)\/[^"?]+\.(?:css|js))(?:\?v=[a-f0-9]+)?"/g, (match, attr, path) => {
    const version = versionOf(path);
    return version ? `${attr}="${path}?v=${version}"` : match;
  });
}

const pages = readdirSync(here).filter((name) => name.endsWith('.html'));
let stamped = 0;

for (const page of pages) {
  const source = join(here, page);
  const original = readFileSync(source, 'utf8');
  const updated = stampAssets(original);

  /* The live server serves these files directly, so the source is rewritten. */
  if (updated !== original) {
    writeFileSync(source, updated);
    stamped += 1;
  }
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const page of pages) {
  cpSync(join(here, page), join(out, page));
}

for (const folder of folders) {
  cpSync(join(here, folder), join(out, folder), { recursive: true });
}

console.log(`dist/ built: ${pages.length} pages, folders: ${folders.join(', ')}`);
console.log(`asset versions stamped in ${stamped} page(s)`);
