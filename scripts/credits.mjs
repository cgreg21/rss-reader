// Writes src/app/pwa/credits.json from package.json and node_modules: the libraries shipped in the
// bundle, with their version, license and website. Run automatically before start / build / typecheck.
import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const pkg = read('package.json');
/** Build tools whose output ends up in the bundle (CSS). */
const SHIPPED_DEV = ['tailwindcss'];
/** Assets that are not npm packages. */
const EXTRAS = [
  { name: 'Material Design Icons', license: 'Apache-2.0', url: 'https://pictogrammers.com/library/mdi/' },
  { name: 'DM Sans', license: 'OFL-1.1', url: 'https://fonts.google.com/specimen/DM+Sans' },
];

const website = (meta) => {
  if (meta.homepage) return meta.homepage;
  const repo = typeof meta.repository === 'string' ? meta.repository : meta.repository?.url;
  return repo ? repo.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '').replace(/^github:/, 'https://github.com/') : `https://www.npmjs.com/package/${meta.name}`;
};

const credits = new Map();
for (const name of [...Object.keys(pkg.dependencies ?? {}), ...SHIPPED_DEV]) {
  const meta = read(`node_modules/${name}/package.json`);
  // One line for a scoped family (all @angular/* packages share version, license and site).
  const key = name.startsWith('@') ? name.split('/')[0] : name;
  if (credits.has(key)) continue;
  credits.set(key, {
    name: key.startsWith('@') ? key.slice(1).replace(/^./, (c) => c.toUpperCase()) : name,
    version: meta.version,
    license: typeof meta.license === 'string' ? meta.license : meta.license?.type ?? '?',
    url: website(meta),
  });
}

const list = [...credits.values(), ...EXTRAS].sort((a, b) => a.name.localeCompare(b.name));
writeFileSync('src/app/pwa/credits.json', JSON.stringify(list, null, 2) + '\n');
console.log(`credits.json: ${list.length} entries`);
