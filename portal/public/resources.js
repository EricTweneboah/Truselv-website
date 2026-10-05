/* Uses the portal's existing authenticated API and navigation. */
let resourceDirty = false;
let resourceBusy = false;
window.addEventListener('beforeunload', event => { if (resourceDirty || resourceBusy) { event.preventDefault(); event.returnValue = ''; } });
document.querySelector('nav').addEventListener('click', event => {
  if (!event.target.closest('button')) return;
  if (resourceBusy || (resourceDirty && !confirm('Leave this page and discard unsaved changes?'))) { event.preventDefault(); event.stopImmediatePropagation(); return; }
  resourceDirty = false;
}, true);

async function websiteResources() {
  app.innerHTML = '<h1>Website resources</h1><p role="status">Loading resources…</p>';
  const data = await api('admin/resources');
  if (!app.querySelector('h1') || app.querySelector('h1').textContent !== 'Website resources') return;
  app.innerHTML = `<div class="panel-heading"><div><p class="eyebrow">Website content</p><h1>Website resources</h1><p>Share documents and articles on the TruSelv website.</p></div><button class="primary" id="new-resource">Add resource</button></div>
    <p id="resource-feedback" role="status"></p>
    <section class="panel" id="resource-library"><div class="panel-heading"><h2>Resource library</h2><a href="https://truselv.co.uk/resources" target="_blank" rel="noopener">View website resources</a></div>
    <p>Published resources are visible to everyone. Existing website guides remain available alongside these additions.</p>
    <label>Search library<input type="search" id="resource-library-search" placeholder="Find a title or category"></label><div id="resource-items"></div></section>
    <section class="panel resource-editor" id="resource-editor" hidden></section>
    <dialog id="resource-preview" class="resource-preview"><form method="dialog"><button class="resource-secondary">Close preview</button></form><p class="eyebrow">Preview · not published</p><article id="resource-preview-content"></article></dialog>`;
  const items = document.querySelector('#resource-items');
  const renderList = () => {
    const term = document.querySelector('#resource-library-search').value.toLowerCase();
    const rows = data.resources.filter(row => `${row.title} ${row.category}`.toLowerCase().includes(term));
    items.innerHTML = rows.length ? rows.map(row => `<article class="resource-library-item"><div><span class="status">${row.published ? (row.hasChanges ? 'Published · unpublished changes' : 'Published') : 'Draft'}</span><h3>${esc(row.title)}</h3><p>${esc(row.category)} · Updated ${date(row.updatedAt)}</p></div><button class="resource-secondary" data-edit-resource="${row.id}" aria-label="Edit ${esc(row.title)}">Edit resource</button></article>`).join('') : `<p>${data.resources.length ? 'No matching resources. Try another search.' : 'No resources added yet. Select Add resource to upload a document or write an article.'}</p>`;
    items.querySelectorAll('[data-edit-resource]').forEach(button => button.onclick = () => openEditor(data.resources.find(row => row.id === button.dataset.editResource)));
  };
  document.querySelector('#resource-library-search').oninput = renderList;
  document.querySelector('#new-resource').onclick = () => openEditor();
  renderList();

  function openEditor(resource = {}) {
    if (resourceBusy || (resourceDirty && !confirm('Discard unsaved changes and open another resource?'))) return;
    resourceDirty = false;
    const editor = document.querySelector('#resource-editor');
    editor.hidden = false;
    editor.innerHTML = `<div class="panel-heading"><h2>${resource.id ? 'Edit resource' : 'Add resource'}</h2><button type="button" class="resource-secondary" id="close-resource-editor">Close editor</button></div>
      <form id="resource-form"><label class="full">Title<input name="title" required maxlength="160" value="${esc(resource.title)}"></label>
      <label>Category<select name="category">${['Products', 'Planning', 'Trust', 'Legal'].map(category => `<option${category === resource.category ? ' selected' : ''}>${category}</option>`).join('')}</select></label>
      <label class="full">Short description<textarea name="summary" required maxlength="500" rows="3">${esc(resource.summary)}</textarea></label>
      <label class="full">Article text (optional)<textarea name="body" maxlength="30000" rows="10" aria-describedby="resource-text-hint">${esc(resource.body)}</textarea></label><p class="full muted" id="resource-text-hint">Use blank lines between paragraphs. Add article text, a document, or both.</p>
      <label class="full">${resource.file ? 'Replace document (optional)' : 'Upload document (optional)'}<input name="file" type="file" accept=".pdf,.txt,application/pdf,text/plain" aria-describedby="resource-file-hint"></label><p class="full muted" id="resource-file-hint">PDF or plain text (.txt), up to 10 MB. Export Word documents as PDF before uploading.</p>
      ${resource.file ? `<div class="full resource-current-file"><a href="/api/admin/resources/${resource.id}/file">Download ${esc(resource.file.name)}</a><label><input type="checkbox" name="removeFile"> Remove this document</label></div>` : ''}
      <p class="full notice">${resource.published ? 'Saving a draft keeps the current published version on the website. Publish when your changes are ready.' : 'Save a private draft, or publish to make this resource visible on the website.'}</p>
      <p id="resource-save-error" class="full error" role="alert" hidden></p>
      <div class="full resource-actions"><button type="submit" class="primary" name="action" value="publish">${resource.published ? 'Publish changes' : 'Publish resource'}</button><button type="submit" class="resource-secondary" name="action" value="draft">Save draft</button><button type="button" class="resource-secondary" id="preview-resource">Preview</button>${resource.published ? '<button type="button" class="danger" id="unpublish-resource">Unpublish</button>' : ''}</div>
      <p class="full" id="resource-save-status" role="status"></p></form>`;
    const form = editor.querySelector('form');
    form.addEventListener('input', () => { resourceDirty = true; });
    document.querySelector('#close-resource-editor').onclick = () => {
      if (resourceBusy || (resourceDirty && !confirm('Close the editor and discard unsaved changes?'))) return;
      resourceDirty = false; editor.hidden = true; document.querySelector('#new-resource').focus();
    };
    const details = () => ({title: form.elements.title.value, summary: form.elements.summary.value, body: form.elements.body.value, category: form.elements.category.value, removeFile: Boolean(form.elements.removeFile?.checked), revision: resource.revision});
    document.querySelector('#preview-resource').onclick = () => {
      const values = details(), file = form.elements.file.files[0] || (!values.removeFile && resource.file);
      document.querySelector('#resource-preview-content').innerHTML = `<span class="status">${esc(values.category)}</span><h2>${esc(values.title || 'Untitled resource')}</h2><p>${esc(values.summary)}</p><div class="resource-article-text">${esc(values.body)}</div>${file ? `<p>Document: ${esc(file.name)}</p>` : ''}`;
      document.querySelector('#resource-preview').showModal();
    };
    const save = async action => {
      const errorBox = document.querySelector('#resource-save-error');
      errorBox.hidden = true;
      const file = form.elements.file.files[0];
      if (file && file.size > 10 * 1024 * 1024) { errorBox.textContent = 'Choose a file smaller than 10 MB.'; errorBox.hidden = false; form.elements.file.focus(); return; }
      const body = new FormData(); body.set('details', JSON.stringify({...details(), action}));
      if (file) body.set('file', file);
      const controls = [...editor.querySelectorAll('button, input, select, textarea')];
      controls.forEach(control => control.disabled = true); resourceBusy = true;
      document.querySelector('#resource-save-status').textContent = action === 'publish' ? 'Publishing resource…' : 'Saving resource…';
      try {
        await api(`admin/resources${resource.id ? `/${resource.id}` : ''}`, {method: 'POST', headers: {'X-TruSelv-Editor': '1'}, body});
        resourceDirty = false; resourceBusy = false;
        await websiteResources();
        const feedback = document.querySelector('#resource-feedback');
        feedback.textContent = action === 'publish' ? 'Resource published. It is now available on the website.' : action === 'unpublish' ? 'Resource unpublished. It is saved as a private draft.' : 'Draft saved. The website has not changed.';
        document.querySelector('#new-resource').focus();
      } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; document.querySelector('#resource-save-status').textContent = ''; }
      finally { resourceBusy = false; controls.forEach(control => control.disabled = false); }
    };
    form.onsubmit = event => { event.preventDefault(); save(event.submitter.value); };
    document.querySelector('#unpublish-resource')?.addEventListener('click', () => { if (confirm('Remove this resource from the public website? It will remain available here as a draft. Unsaved edits will be discarded.')) save('unpublish'); });
    form.elements.title.focus();
  }
}
