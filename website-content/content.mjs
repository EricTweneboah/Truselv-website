const categories = ['Products', 'Planning', 'Trust', 'Legal'];
const maxFile = 10 * 1024 * 1024;
const json = (value, status = 200) => Response.json(value, {status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
const problem = (message, status = 400) => { throw Object.assign(new Error(message), {status}); };

async function boundedBody(request, limit) {
  if (Number(request.headers.get('content-length')) > limit) problem('Upload a file smaller than 10 MB.', 413);
  const reader = request.body?.getReader();
  if (!reader) problem('The request body is missing.');
  const chunks = []; let length = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); problem('Upload a file smaller than 10 MB.', 413); }
    chunks.push(value);
  }
  return new Blob(chunks);
}

export function validateContent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) problem('Enter the resource details.');
  const result = {};
  for (const [field, limit] of [['title', 160], ['summary', 500], ['body', 30000]]) {
    if (typeof value[field] !== 'string' || value[field].trim().length > limit) problem(`Check the ${field} length (maximum ${limit} characters).`);
    result[field] = value[field].trim();
  }
  if (!result.title || !result.summary) problem('Add a title and short description.');
  if (!categories.includes(value.category)) problem('Choose a resource category.');
  result.category = value.category;
  return result;
}

export async function adminResources(request, env, user) {
  try {
    if (user.role !== 'truselv_admin') problem('Only TruSelv administrators can manage website resources.', 403);
    if (!env.RESOURCE_DB || !env.RESOURCE_FILES) problem('Resource storage is not configured. Contact TruSelv support.', 503);
    const url = new URL(request.url);
    const match = /^\/api\/admin\/resources(?:\/([a-f0-9-]{36})(\/file)?)?$/.exec(url.pathname);
    if (!match) problem('Resource not found.', 404);
    const resourceId = match[1];
    if (request.method === 'GET') {
      if (resourceId) {
        const row = await env.RESOURCE_DB.prepare('SELECT draft_json FROM website_resources WHERE id=?').bind(resourceId).first();
        const file = row && JSON.parse(row.draft_json).file;
        if (!match[2] || !file) problem('Document not found.', 404);
        return await download(request, env, file);
      }
      const rows = await env.RESOURCE_DB.prepare('SELECT * FROM website_resources ORDER BY updated_at DESC').all();
      return json({resources: rows.results.map(row => ({id: row.id, ...JSON.parse(row.draft_json), revision: row.revision, published: Boolean(row.published_json), hasChanges: Boolean(row.published_json && row.published_json !== row.draft_json), updatedAt: row.updated_at}))});
    }
    if (request.method !== 'POST' || match[2]) return json({error: 'Method not allowed.'}, 405);
    if (request.headers.get('Origin') !== url.origin || request.headers.get('X-TruSelv-Editor') !== '1') problem('Reload the editor and try again.', 403);
    const body = await boundedBody(request, maxFile + 128 * 1024);
    let form, data;
    try {
      form = await new Response(body, {headers: {'Content-Type': request.headers.get('Content-Type') || ''}}).formData();
      data = JSON.parse(form.get('details'));
    } catch { problem('The upload could not be read. Choose the file again.'); }
    if (!['draft', 'publish', 'unpublish'].includes(data?.action)) problem('Choose Save draft, Publish or Unpublish.');
    const row = resourceId ? await env.RESOURCE_DB.prepare('SELECT * FROM website_resources WHERE id=?').bind(resourceId).first() : null;
    if (resourceId && !row) problem('Resource not found.', 404);
    if (row && data.revision !== row.revision) problem('Another admin updated this resource. Reload the list before editing.', 409);
    const content = data.action === 'unpublish' && row ? JSON.parse(row.draft_json) : validateContent(data);
    const previousFile = row && JSON.parse(row.draft_json).file;
    content.file = data.action === 'unpublish' ? content.file : (data.removeFile ? null : previousFile || null);
    const file = form.get('file');
    let uploadedKey;
    if (data.action !== 'unpublish' && file && typeof file !== 'string' && file.name) {
      if (!file.size) problem('Choose a document that is not empty.');
      if (file.size > maxFile) problem('Upload a file smaller than 10 MB.', 413);
      const extension = file.name.split('.').pop().toLowerCase();
      // PDF and plain text avoid active office macros and browser-executable uploads.
      if (!['pdf', 'txt'].includes(extension)) problem('Choose a PDF or plain text (.txt) document.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (extension === 'pdf' && new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') problem('This file is not a valid PDF. Export it as PDF and try again.');
      if (extension === 'txt') { try { new TextDecoder('utf-8', {fatal: true}).decode(bytes); } catch { problem('Save the text file using UTF-8 and try again.'); } }
      uploadedKey = `resources/${crypto.randomUUID()}.${extension}`;
      content.file = {key: uploadedKey, name: file.name.replace(/[\r\n\x00-\x1f"\\/]/g, '_').slice(0, 180), size: file.size, type: extension === 'pdf' ? 'application/pdf' : 'text/plain; charset=utf-8'};
      await env.RESOURCE_FILES.put(uploadedKey, bytes, {httpMetadata: {contentType: content.file.type}});
    }
    if (data.action === 'publish' && !content.body && !content.file) problem('Add article text or upload a document before publishing.');
    const draft = JSON.stringify(content);
    const published = data.action === 'publish' ? draft : data.action === 'unpublish' ? null : row?.published_json || null;
    const id = resourceId || crypto.randomUUID();
    const updatedAt = new Date().toISOString();
    try {
      const result = row
        ? await env.RESOURCE_DB.prepare('UPDATE website_resources SET draft_json=?,published_json=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?').bind(draft, published, updatedAt, user.email, id, row.revision).run()
        : await env.RESOURCE_DB.prepare('INSERT INTO website_resources (id,draft_json,published_json,updated_at,updated_by) VALUES (?,?,?,?,?)').bind(id, draft, published, updatedAt, user.email).run();
      if (!result.meta.changes) problem('Another admin updated this resource. Reload the list before editing.', 409);
    } catch (error) {
      if (uploadedKey) await env.RESOURCE_FILES.delete(uploadedKey);
      throw error;
    }
    return json({id, revision: (row?.revision || 0) + 1, published: Boolean(published)}, row ? 200 : 201);
  } catch (error) { return json({error: error.status ? error.message : 'The resource could not be saved. Please try again.'}, error.status || 500); }
}

async function download(request, env, file) {
  const object = await env.RESOURCE_FILES.get(file.key);
  if (!object) return json({error: 'Document not found.'}, 404);
  return new Response(request.method === 'HEAD' ? null : object.body, {headers: {
    'Content-Type': file.type, 'Content-Length': String(object.size),
    'Content-Disposition': `attachment; filename="resource.${file.type === 'application/pdf' ? 'pdf' : 'txt'}"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, '%27')}`,
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'no-store'
  }});
}

export async function publicResources(request, env) {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) return json({error: 'Method not allowed.'}, 405);
    if (!env.RESOURCE_DB || !env.RESOURCE_FILES) return json({error: 'Resources are temporarily unavailable.'}, 503);
    const path = new URL(request.url).pathname;
    if (path === '/api/resources') {
      const rows = await env.RESOURCE_DB.prepare('SELECT id,published_json FROM website_resources WHERE published_json IS NOT NULL ORDER BY updated_at DESC').all();
      return json({resources: rows.results.map(row => {
        const {file, ...content} = JSON.parse(row.published_json);
        return {id: row.id, ...content, file: file ? {name: file.name, size: file.size, url: `/api/resources/${row.id}/file`} : null};
      })});
    }
    const match = /^\/api\/resources\/([a-f0-9-]{36})\/file$/.exec(path);
    const row = match && await env.RESOURCE_DB.prepare('SELECT published_json FROM website_resources WHERE id=? AND published_json IS NOT NULL').bind(match[1]).first();
    const file = row && JSON.parse(row.published_json).file;
    if (!file) return json({error: 'Resource not found.'}, 404);
    return await download(request, env, file);
  } catch { return json({error: 'Resources are temporarily unavailable. Please try again.'}, 503); }
}
