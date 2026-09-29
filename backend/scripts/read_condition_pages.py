"""Read current verified PDF sources for the shared condition-summary exporter.
Run from the repository root after refreshing notice-evidence.json.
HWPX retains the existing section-based evidence as fallback.
"""
import sys,json,hashlib,re,concurrent.futures,urllib.request
import datetime as dt
from pathlib import Path
import pymupdf
sys.stdout.reconfigure(encoding='utf8')
b=json.loads(Path('public/notice-evidence.json').read_text(encoding='utf8'))
notices=json.loads(Path('src/lhNotices.js').read_text(encoding='utf8').split('export default ',1)[1].strip().rstrip(';'))
ns={n['id'].replace('lh-',''):n for n in notices if n.get('deadline','')>=dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date().isoformat()}
cache=Path('.sites-runtime/income-pdfs');cache.mkdir(parents=True,exist_ok=True)
def get(n):
 result=[]
 for s in n['sources']:
  if not s['name'].lower().endswith('.pdf'):continue
  if not re.fullmatch(r'https://apply\.lh\.or\.kr/lhapply/lhFile\.do\?fileid=\d+',s['url']):raise ValueError('unsupported source URL')
  if not re.fullmatch(r'[A-Za-z0-9_-]+',s['id']):raise ValueError('invalid source ID')
  p=cache/(s['id']+'.pdf')
  if not p.exists():
   req=urllib.request.Request(s['url'],headers={'User-Agent':'JIBRO/1.0 public-notice-evidence'})
   with urllib.request.urlopen(req,timeout=35) as r:raw=r.read(48*1024*1024+1)
   if len(raw)>48*1024*1024:raise ValueError('oversize')
   p.write_bytes(raw)
  raw=p.read_bytes()
  if hashlib.sha256(raw).hexdigest()!=s['sha256']:raise ValueError('source changed')
  with pymupdf.open(stream=raw,filetype='pdf') as doc:
   for i,page in enumerate(doc):
    if i>=150:break
    clips=[(None,page.rect)] if page.rect.width<=page.rect.height*1.25 else [('왼쪽',pymupdf.Rect(0,0,page.rect.width/2,page.rect.height)),('오른쪽',pymupdf.Rect(page.rect.width/2,0,page.rect.width,page.rect.height))]
    for region,clip in clips:
     t=page.get_text(clip=clip,sort=True)
     if any(w in t for w in ['신청자격','입주자격','세대구성원','혼인기간','소득','성년자']):result.append(dict(quote=t,sourceId=s['id'],sourceUrl=s['url'],sourceName=s['name'],sha256=s['sha256'],page=i+1,region=region))
 return result
out={};jobs=[]
for k,n in b['summaries'].items():
 m=re.search('panId=([^&]+)',k)
 if m and m[1] in ns:jobs.append((k,n,ns[m[1]]))
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 fs={pool.submit(get,n):(k,n,v) for k,n,v in jobs}
 for f in concurrent.futures.as_completed(fs):
  k,n,v=fs[f]
  try:
   pages=f.result();out[k]={'title':v['title'],'pages':pages,'sources':n['sources'],'criteria':n['criteria'],'noticeUrl':k}
   print(v['id'],len(pages),flush=True)
  except Exception as e:print(v['id'],'ERROR',str(e),flush=True)
Path('.sites-runtime/condition-pages.json').write_text(json.dumps(out,ensure_ascii=False),encoding='utf8')
print('TOTAL',len(out),'/',len(jobs))
