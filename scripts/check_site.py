"""Check published HTML for broken local links, fragments, assets and empty targets."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import json
import sys

ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'scripts/page-manifest.json').read_text())
class Document(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.ids=[];self.h1=0;self.errors=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='h1':self.h1+=1
        if 'id' in a:self.ids.append(a['id'])
        if tag in ['a','link'] and 'href' in a:self.links.append(a['href'])
        if tag in ['img','script','source','video']:
            if a.get('src'):self.links.append(a['src'])
            if a.get('poster'):self.links.append(a['poster'])
        if tag=='img' and 'alt' not in a:self.errors.append('Image missing alt text')

def run():
    docs={}; errors=[]; links=0
    for path in list(ROOT.glob('*.html'))+[ROOT/'more/index.html']:
        d=Document();d.feed(path.read_text(encoding='utf-8'));docs[path.resolve()]=d
    for name in list(manifest)+['404.html','order-status.html']:
        path=ROOT/name;d=docs[path.resolve()]
        if d.h1 != 1:errors.append(f'{name}: expected 1 h1, got {d.h1}')
        if len(d.ids)!=len(set(d.ids)):errors.append(f'{name}: duplicate id')
        errors.extend(f'{name}: {e}' for e in d.errors)
        for href in d.links:
            links+=1
            if href in ('','#'):errors.append(f'{name}: empty link');continue
            u=urlsplit(href)
            if u.scheme or u.netloc:continue
            target=ROOT/unquote(u.path).lstrip('/') if u.path.startswith('/') else path.parent/unquote(u.path) if u.path else path
            if target.is_dir():target=target/'index.html'
            if not target.exists():errors.append(f'{name}: missing {href}');continue
            if target.stat().st_size==0:errors.append(f'{name}: empty {href}')
            if u.fragment and target.suffix=='.html':
                if unquote(u.fragment) not in docs.get(target.resolve(),Document()).ids:errors.append(f'{name}: missing fragment {href}')
    for old in ['home-improvements.html','careers.html','folda.html','ngage.html','teevy.html']:
        if 'http-equiv="refresh"' not in (ROOT/old).read_text(encoding='utf-8'):errors.append(f'{old}: missing legacy redirect')
    for path in (ROOT/'downloads').glob('*.pdf'):
        if not path.read_bytes().startswith(b'%PDF-'):errors.append(f'{path.name}: not a PDF')
    if errors:
        print('\n'.join(errors));return 1
    print(f'PASS: {len(manifest)+2} pages, {links} link/asset references, fragments, alt attributes, 7 PDFs and retired-page redirects.')
    return 0

if __name__=='__main__':sys.exit(run())
