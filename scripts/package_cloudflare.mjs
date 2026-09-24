// Use a strict allowlist: never publish the repository root or local .env files.
import {mkdir, readFile, readdir, copyFile, writeFile, rm, lstat} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output=resolve(root,'.cloudflare-public');
if (dirname(output)!==root || !output.endsWith('.cloudflare-public')) throw new Error('Invalid output directory');
try { if ((await lstat(output)).isSymbolicLink()) throw new Error('Output cannot be a symlink'); } catch(e) {if(e.code!=='ENOENT')throw e;}
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
const files=(await readdir(root)).filter(n=>/^[a-zA-Z0-9-]+\.html$/.test(n));
files.push('robots.txt','sitemap.xml','_redirects','css/site.css','css/tess-spec.css','css/facility.css','js/site.js','more/index.html','documents/Bedbord-solution.pdf','documents/TruSelv-Investor-ready.pdf');
const allowed=/\.(?:svg|webp|png|jpg|jpeg|ico|woff2|mp4|pdf|txt)$/;
for(const directory of ['assets','downloads']) {
  for(const entry of await readdir(join(root,directory),{withFileTypes:true})) {
    if(entry.isFile() && allowed.test(entry.name))files.push(directory+'/'+entry.name);
  }
}
for(const file of files) {
  const source=join(root,file);
  const stat=await lstat(source);
  if(!stat.isFile() || stat.isSymbolicLink())throw new Error('Expected ordinary public file: '+file);
  if(stat.size>25*1024*1024)throw new Error('Cloudflare asset size limit: '+file);
  await mkdir(dirname(join(output,file)),{recursive:true});
  await copyFile(source,join(output,file));
}
await writeFile(join(output,'_redirects'), await readFile(join(root,'_redirects'),'utf8'));
const csp="default-src 'self'; script-src 'self' https://js.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com; connect-src 'self' https://api.stripe.com https://*.stripe.com; img-src 'self' data: https://*.stripe.com; style-src 'self' 'unsafe-inline'; font-src 'self'; media-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
await writeFile(join(output,'_headers'),`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: ${csp}\n  Cache-Control: no-cache\n`);
console.log(`Packaged ${files.length} public files. Environment files, source code and private configuration excluded.`);
