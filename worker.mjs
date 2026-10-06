import config from './site.config.json' with { type: 'json' };
import { createApi, publicConfig } from './api.mjs';
import {GATED_RESOURCES, hasResourceAccess} from './resource-access.mjs';
import {publicResources} from './website-content/content.mjs';
import {validatePurchaseToken} from './purchase-access.mjs';

// Static files are served by Cloudflare Assets; only these dynamic paths invoke JS.
const handlers = new WeakMap();
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (['/shop', '/shop/', '/shop.html'].includes(url.pathname)) {
      const invitation = await validatePurchaseToken(env.PURCHASE_LINK_SECRET, url.searchParams.get('invite'));
      if (!invitation) {
        const location = new URL('/book-demo', url.origin);
        location.searchParams.set('purchase', 'demo-first');
        return Response.redirect(location, 302);
      }
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'private, no-store');
      headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      headers.set('Referrer-Policy', 'no-referrer');
      return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
    }
    if (url.pathname === '/api/resources' || url.pathname.startsWith('/api/resources/')) return publicResources(request, env);
    const resourceName = url.pathname.startsWith('/downloads/') ? url.pathname.slice('/downloads/'.length) : '';
    if (GATED_RESOURCES.has(resourceName) && ['GET', 'HEAD'].includes(request.method) && !await hasResourceAccess(request, env.RESOURCE_ACCESS_SECRET)) {
      const location = new URL('/resources', url.origin);
      location.searchParams.set('download', resourceName);
      location.searchParams.set('access', 'required');
      location.hash = 'resource-access';
      return Response.redirect(location, 302);
    }
    if (url.pathname === '/js/site-config.js') {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {status:405});
      return new Response(request.method === 'HEAD' ? null : 'window.TRUSELV_CONFIG = ' + JSON.stringify(publicConfig(config,env)) + ';', {
        headers: {'Content-Type':'text/javascript; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'}
      });
    }
    if (url.pathname.startsWith('/api/')) {
      let origins = handlers.get(env);
      if (!origins) { origins = new Map(); handlers.set(env, origins); }
      const origin = env.SITE_URL || url.origin;
      let api = origins.get(origin);
      if (!api) {
        api = createApi({config, env:{...env,SITE_URL:origin}, rateLimit: env.API_RATE_LIMITER ? async key => (await env.API_RATE_LIMITER.limit({key})).success : undefined});
        origins.set(origin,api);
      }
      return api(request,request.headers.get('CF-Connecting-IP') || 'unknown');
    }
    return env.ASSETS.fetch(request);
  }
};
