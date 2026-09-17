import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createApi, publicConfig as getPublicConfig } from './api.mjs';
export { validateInquiry, validEmail, checkoutReady, SHIPPING_COUNTRIES } from './api.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

export function createHandler({ config, env = process.env, fetcher = fetch, root = ROOT } = {}) {
  const siteUrl = new URL(env.SITE_URL || config.siteUrl).origin;
  const api = createApi({config, env, fetcher});
  function json(res,status,data) {res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(data));}
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // JSON-LD is the only inline script; no inline executable scripts are used.
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, siteUrl);
      if (url.pathname === '/shop.html' || url.pathname === '/shop') res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://js.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com; connect-src 'self' https://api.stripe.com https://*.stripe.com; img-src 'self' data: https://*.stripe.com; style-src 'self' 'unsafe-inline'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
      if (url.pathname.startsWith('/api/')) {
        const request = new Request(url, {method:req.method, headers:req.headers, ...(!['GET','HEAD'].includes(req.method) ? {body:Readable.toWeb(req), duplex:'half'} : {})});
        const ip = env.TRUST_PROXY === 'true' ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim() : req.socket.remoteAddress;
        const response = await api(request,ip);
        res.writeHead(response.status,Object.fromEntries(response.headers));
        return res.end(Buffer.from(await response.arrayBuffer()));
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });
      if (url.pathname === '/js/site-config.js') {
        const publicConfig = getPublicConfig(config,env);
        res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' });
        return res.end(req.method === 'HEAD' ? '' : 'window.TRUSELV_CONFIG = ' + JSON.stringify(publicConfig) + ';');
      }
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { return json(res, 400, { error: 'Invalid URL.' }); }
      if (pathname === '/') pathname = '/index.html';
      if (pathname === '/more/' || pathname === '/more') { res.writeHead(301, { Location: '/resources.html' }); return res.end(); }
      const retired = { care: 'index', 'home-improvements': 'index', careers: 'about', folda: 'bedbord', ngage: 'tess', teevy: 'tess', documentation: 'resources', 'compliance-blog': 'trust', 'edi-blog': 'accessibility', 'innovation-blog': 'about', Partnership: 'partnerships' };
      const routeName = pathname.slice(1).replace(/\.html$/, '');
      if (retired[routeName]) { res.writeHead(301, { Location: '/' + retired[routeName] + '.html' }); return res.end(); }
      if (/^\/[a-zA-Z0-9-]+$/.test(pathname)) {
        try { await stat(resolve(root, '.' + pathname + '.html')); res.writeHead(301, { Location: pathname + '.html' }); return res.end(); } catch { /* Use the useful 404 below. */ }
      }
      const permitted = /^\/[a-zA-Z0-9-]+\.html$/.test(pathname) || /^\/(assets|downloads)\/[a-zA-Z0-9_.-]+$/.test(pathname) || /^\/(css\/site\.css|js\/site\.js|robots\.txt|sitemap\.xml)$/.test(pathname) || /^\/documents\/(Bedbord-solution|TruSelv-Investor-ready)\.pdf$/.test(pathname);
      const path = resolve(root, '.' + pathname);
      if (!permitted || !path.startsWith(resolve(root) + sep)) { res.writeHead(404, { 'Content-Type': MIME['.html'] }); return res.end(await readFile(resolve(root, '404.html'))); }
      let info;
      try { info = await stat(path); if (!info.isFile()) throw new Error(); }
      catch { res.writeHead(404, { 'Content-Type': MIME['.html'] }); return res.end(await readFile(resolve(root, '404.html'))); }
      const headers = { 'Content-Type': MIME[extname(path)] || 'application/octet-stream', 'Cache-Control': extname(path) === '.html' ? 'no-cache' : 'public, max-age=3600', 'Accept-Ranges': 'bytes' };
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        let start, end;
        if (match && (match[1] || match[2])) { start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2])); end = match[1] && match[2] ? Number(match[2]) : info.size - 1; }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size || start < 0) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); return res.end(); }
        end = Math.min(end, info.size - 1);
        res.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${info.size}` });
        if (req.method === 'HEAD') return res.end();
        return createReadStream(path, { start, end }).on('error', () => res.destroy()).pipe(res);
      }
      res.writeHead(200, { ...headers, 'Content-Length': info.size });
      if (req.method === 'HEAD') return res.end();
      createReadStream(path).on('error', () => res.destroy()).pipe(res);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      json(res, error.status || 500, { error: error.status ? error.message : 'The service could not complete this request. Please contact TruSelv.' });
    }
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = JSON.parse(await readFile(resolve(ROOT, 'site.config.json'), 'utf8'));
  const port = Number(process.env.PORT || 4173);
  const server = http.createServer(createHandler({ config }));
  server.requestTimeout = 30000; server.headersTimeout = 15000;
  server.listen(port, '0.0.0.0', () => console.log(`TruSelv preview: http://localhost:${port}`));
}
