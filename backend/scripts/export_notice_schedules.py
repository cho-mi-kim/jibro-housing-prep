"""Collect public LH schedule fields and verified attachment schedule excerpts.
Run from the project root. Never execute page scripts or infer missing dates.
"""
import concurrent.futures, datetime as dt, hashlib, json, re, sys, time, urllib.parse, urllib.request
from pathlib import Path
from snapshot_store import atomic_json, merge_success, save_attempt
from bs4 import BeautifulSoup
from schedule_pdf import attachment_variants
import pymupdf
FIELDS={'sbscAcpStDt':'applicationStart','sbscAcpClsgDt':'deadline','pprSbmOpeAncDt':'documentAnnouncement','pprAcpStDt':'documentStart','pprAcpClsgDt':'documentDeadline'}

def canonical(raw):
 u=urllib.parse.urlparse(raw);q=urllib.parse.parse_qs(u.query)
 if u.scheme!='https' or u.netloc!='apply.lh.or.kr' or u.path!='/lhapply/apply/wt/wrtanc/selectWrtancInfo.do':raise ValueError('unsupported URL')
 values={k:q[k][0] for k in ['panId','ccrCnntSysDsCd','aisTpCd','uppAisTpCd'] if k in q}
 if not re.fullmatch(r'\d{8,30}',values.get('panId','')) or any(not v.isdigit() for v in values.values()):raise ValueError('invalid identity')
 values['mi']='1026';return u.scheme+'://'+u.netloc+u.path+'?'+urllib.parse.urlencode(values)

def date(raw):
 m=re.fullmatch(r'\s*(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?\s*',raw or '')
 if not m:return None
 try:return dt.date(*map(int,m.groups())).isoformat()
 except ValueError:return None

def literals(block):
 return dict(re.findall(r"([A-Za-z][A-Za-z0-9_]*)\s*:\s*'([^'\\]*)'",block))

def parse_html(raw,url):
 soup=BeautifulSoup(raw,'html.parser');html=raw.decode(soup.original_encoding or 'utf-8',errors='replace')
 pan=urllib.parse.parse_qs(urllib.parse.urlparse(url).query)['panId'][0]
 if not re.search(r"(?:var\s+panId\s*=|panId\s*:)\s*'"+re.escape(pan)+r"'",html):raise ValueError('notice identity missing')
 sections=[h.parent for h in soup.find_all(['h3','h4']) if '공급일정' in h.get_text()]
 if not sections:raise ValueError('supply schedule missing')
 common={};quotes=[]
 for section in sections:
  for li in section.find_all('li'):
   text=li.get_text(' ',strip=True);quotes.append(text)
   ds=[date(x) for x in re.findall(r'20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}',text)];ds=[x for x in ds if x]
   compact=re.sub(r'\s','',text)
   if compact.startswith('서류제출대상자발표일') and len(ds)==1:common['documentAnnouncement']=ds[0]
   elif compact.startswith('당첨자발표일') and len(ds)==1:common['winnerAnnouncement']=ds[0]
   elif compact.startswith('당첨자서류제출기간') and len(ds)==2:common.update(winnerDocumentStart=ds[0],winnerDocumentDeadline=ds[1])
   elif compact.startswith('서류접수기간') and len(ds)==2:common.update(documentStart=ds[0],documentDeadline=ds[1])
   elif compact.startswith('접수기간') and len(ds)==2:common.update(applicationStart=ds[0],deadline=ds[1])
 names={}
 for block in re.findall(r'sbdList\.push\(\{(.*?)\}\)',html,re.S):
  n=literals(block);names.setdefault((n.get('ltrUntNo'),n.get('ltrNot')),[]).append(n.get('lccNtNm') or n.get('sbdLgoNm',''))
 variants=[]
 for block in re.findall(r'splScdlist\.push\(\{(.*?)\}\)',html,re.S):
  n=literals(block)
  if n.get('panId')!=pan:continue
  fields={dest:date(n.get(src)) for src,dest in FIELDS.items()};fields={k:v for k,v in fields.items() if v}
  if not fields:continue
  label=' · '.join(dict.fromkeys(names.get((n.get('ltrUntNo'),n.get('ltrNot')),[]))) or '공급일정'
  variants.append({'label':label,'dates':fields})
 if not variants:
  # LH writes these literal server values into the visible reception-period label.
  if "$('#sta_acpDt').text(sbscAcpStDt" in html:
   for src,dest in FIELDS.items():
    matches=set(re.findall(r'var\s+'+src+r"\s*=\s*'([^']*)'",html))
    if len(matches)==1:
     value=date(next(iter(matches)))
     if value:common[dest]=value
   for src,dest in [('sbscAcpStHm','applicationStartTime'),('sbscAcpClsgHm','deadlineTime')]:
    m=re.search(r'var\s+'+src+r"\s*=\s*'([0-2]\d:[0-5]\d)'",html)
    if m:common[dest]=m[1]
  for section in sections:
   for table in section.find_all('table'):
    headers=[th.get_text(strip=True) for th in table.select('thead th')]
    if headers!=['구분','신청일시','신청방법']:continue
    for tr in table.select('tbody tr'):
     cells=tr.find_all('td',recursive=False)
     if len(cells)!=3:continue
     values=[c.get_text(' ',strip=True) for c in cells]
     dates=re.findall(r'(20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2})\s+([0-2]\d:[0-5]\d)',values[1])
     if len(dates)!=2 or not all(date(x[0]) for x in dates):continue
     variants.append({'label':values[0]+' · '+values[2],'dates':{**common,'applicationStart':date(dates[0][0]),'deadline':date(dates[1][0]),'applicationStartTime':dates[0][1],'deadlineTime':dates[1][1]}})
     quotes.append(' · '.join(values))
  if not variants:variants=[{'label':'공통 일정','dates':common}]
  if common.get('applicationStart') and not any(common['applicationStart'].replace('-','.') in q for q in quotes):quotes.insert(0,'접수기간 : '+common['applicationStart']+' '+common.get('applicationStartTime','')+' ~ '+common.get('deadline','')+' '+common.get('deadlineTime',''))
 # Identical building schedules can be combined without changing any date.
 grouped={}
 for v in variants:
  key=json.dumps(v['dates'],sort_keys=True)
  if key not in grouped:grouped[key]=v
  elif v['label'] not in grouped[key]['label']:grouped[key]['label']+=' · '+v['label']
 return list(grouped.values()),'\n'.join(quotes)

def pdf_excerpts(evidence):
 if not pymupdf:return []
 out=[]
 for source in evidence.get('sources',[]):
  p=Path('.sites-runtime/income-pdfs')/(source['id']+'.pdf')
  if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest()!=source.get('sha256'):continue
  with pymupdf.open(p) as doc:
   for i,page in enumerate(doc):
    if i>=50:break
    clips=[page.rect] if page.rect.width<page.rect.height*1.25 else [pymupdf.Rect(0,0,page.rect.width/2,page.rect.height),pymupdf.Rect(page.rect.width/2,0,page.rect.width,page.rect.height)]
    for clip in clips:
     text=page.get_text(clip=clip,sort=True)
     heading=re.search(r'(?:[1-9]\s*[.．]?|■)\s*(?:공급\s*일정|모집\s*일정|신청\s*일정|모집\s*일정\s*및|공급\s*일정\s*및)',text)
     if not heading:continue
     quote=text[heading.start():][:4800].strip()
     if len(re.findall(r'\d{1,2}\s*[.]\s*\d{1,2}',quote))<2:continue
     out.append({'sourceId':source['id'],'sourceUrl':source['url'],'sourceName':source['name'],'sha256':source['sha256'],'page':i+1,'quote':quote})
     if len(out)>=3:return out
 return out

def main():
 sys.stdout.reconfigure(encoding='utf-8')
 today=dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date().isoformat()
 ns=json.loads(Path('src/lhNotices.js').read_text(encoding='utf-8').split('export default ',1)[1].strip().rstrip(';'))
 ns=[n for n in ns if n.get('deadline','')>=today and '취소공고' not in n['title']]
 evidence=json.loads(Path('public/notice-evidence.json').read_text(encoding='utf-8'))['summaries']
 previous_path=Path('public/notice-schedules.json')
 previous=json.loads(previous_path.read_text(encoding='utf-8')) if previous_path.exists() else {'version':'schedule-v1','schedules':{}}
 if previous.get('version')!='schedule-v1' or not isinstance(previous.get('schedules'),dict):raise ValueError('Invalid existing schedule snapshot')
 out={};errors=[];cache=Path('.sites-runtime/schedule-html');cache.mkdir(parents=True,exist_ok=True)
 def get(n):
  url=canonical(n['url']);p=cache/(n['id']+'.html')
  if '--cached' in sys.argv and p.exists():raw=p.read_bytes()
  else:
   req=urllib.request.Request(url,headers={'User-Agent':'JIBRO/1.0 public-notice-reader'})
   with urllib.request.urlopen(req,timeout=30) as response:
    raw=response.read(4*1024*1024+1)
    if len(raw)>4*1024*1024:raise ValueError('oversized response')
   p.write_bytes(raw)
  variants,quote=parse_html(raw,url)
  excerpts=pdf_excerpts(evidence.get(url,{}))
  attached=attachment_variants(excerpts,Path('.sites-runtime/income-pdfs'),pymupdf) if pymupdf else []
  if attached:
   variants=[{**v,'label':'공식 상세 · '+v['label']} for v in variants]+attached
  result={'noticeUrl':url,'checkedAt':dt.datetime.fromtimestamp(p.stat().st_mtime,dt.timezone.utc).isoformat(),'variants':variants,'detailQuote':quote,'excerpts':excerpts}
  return url,result
 # PyMuPDF is not thread-safe; serialize attachment processing.
 with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
  jobs={pool.submit(get,n):n for n in ns}
  for f in concurrent.futures.as_completed(jobs):
   n=jobs[f]
   try:
    key,value=f.result();out[key]=value;save_attempt('public/notice-analysis-attempts.json','schedules',key,dt.datetime.now(dt.timezone.utc).isoformat(),True);print(n['id'],len(value['variants']),[list(v['dates']) for v in value['variants']],flush=True)
   except Exception as e:save_attempt('public/notice-analysis-attempts.json','schedules',canonical(n['url']),dt.datetime.now(dt.timezone.utc).isoformat(),False);errors.append({'id':n['id'],'error':str(e)});print(n['id'],'ERROR',str(e),flush=True)
 bundle={'version':'schedule-v1','schedules':merge_success(previous['schedules'],out)}
 atomic_json('public/notice-schedules.json',bundle)
 Path('.sites-runtime/schedule-report.json').write_text(json.dumps({'total':len(ns),'collected':len(out),'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
 print('COLLECTED',len(out),'/',len(ns))
 if errors:raise SystemExit(1)
if __name__=='__main__':main()
