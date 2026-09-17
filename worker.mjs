import config from './site.config.json' with { type: 'json' };
import { createApi, publicConfig } from './api.mjs';

// Static files are served by Cloudflare Assets; only these dynamic paths invoke JS.
const handlers = new WeakMap();
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
