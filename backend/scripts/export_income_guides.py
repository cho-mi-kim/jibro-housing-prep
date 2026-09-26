"""Export verified standard National Rental 1–4 person limits from official PDFs.
Requires PyMuPDF. Unsupported/waived/ambiguous tables are omitted, never inferred.
Run after exporting evidence; source SHA and notice identity must match at render time.
"""
import concurrent.futures as futures
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import sys
import urllib.request

import pymupdf


def parse_page(text):
 compact=re.sub(r"\s+", "", text)
 if not all(s in compact for s in ['소득및자산보유기준','가구원수','월평균','70%80%90%']):
  return None
 if not re.search(r'1인가구20%p?가산[,，]2인가구10%p?가산',compact):return None
 if re.search(r'(소득|자산).{0,16}(배제|미적용|완화)',compact):return None
 if '세전' not in compact or '합산' not in compact:return None
 rows=[]
 for count in range(1,5):
  matches=re.findall(r'(?<!\d)'+str(count)+r'\s*인\s+([0-9]{1,3}(?:,[0-9]{3})+)\s+([0-9]{1,3}(?:,[0-9]{3})+)\s+([0-9]{1,3}(?:,[0-9]{3})+)',text,re.M)
  if len(matches)!=1:return None
  values=[int(v.replace(',','')) for v in matches[0]]
  if not 0<values[0]<values[1]<values[2]:return None
  if abs(values[1]/values[0]-8/7)>.002 or abs(values[2]/values[0]-9/7)>.002:return None
  index=2 if count==1 else 1 if count==2 else 0
  rows.append({'people':count,'monthlyWon':values[index],'percent':[70,80,90][index]})
 asset=re.search(r'총자산가액.*?합산기준\(?([\d,]+)\)?백만원이하',compact)
 car=re.search(r'자동차가액.*?개별자동차가액\(?([\d,]+)\)?만원이하',compact)
 if not asset or not car:return None
 return {'rows':rows,'totalAssetsWon':int(asset[1].replace(',',''))*1000000,'carWon':int(car[1].replace(',',''))*10000,'quote':text.strip()}


def collect(notice,summary):
 if len(summary['sources'])!=1:return None
 source=summary['sources'][0]
 if not source['name'].lower().endswith('.pdf'):return None
 url=source['url']
 if not re.fullmatch(r'https://apply\.lh\.or\.kr/lhapply/lhFile\.do\?fileid=\d+',url):return None
 cache=Path('.sites-runtime/income-pdfs');cache.mkdir(exist_ok=True)
 path=cache/(source['id']+'.pdf')
 if not path.exists():
  req=urllib.request.Request(url,headers={'User-Agent':'JIBRO/1.0 public-notice-evidence'})
  with urllib.request.urlopen(req,timeout=45) as response:
   data=response.read(48*1024*1024+1)
   if len(data)>48*1024*1024:raise ValueError('file too large')
   path.write_bytes(data)
 raw=path.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=source['sha256']:raise ValueError('source changed; refresh evidence first')
 found=[]
 with pymupdf.open(stream=raw,filetype='pdf') as doc:
  for index,page in enumerate(doc):
   clips=[(None,page.rect)]
   if page.rect.width>page.rect.height*1.25:
    clips=[('왼쪽',pymupdf.Rect(0,0,page.rect.width/2,page.rect.height)),('오른쪽',pymupdf.Rect(page.rect.width/2,0,page.rect.width,page.rect.height))]
   for region,clip in clips:
    text=page.get_text(clip=clip,sort=True)
    result=parse_page(text)
    if result:found.append(dict(result,page=index+1,region=region))
 if len(found)!=1:return None
 return dict(found[0],noticeUrl=summary['noticeUrl'],sourceId=source['id'],sourceUrl=url,sourceName=source['name'],sha256=source['sha256'],checkedAt=dt.datetime.now(dt.timezone.utc).isoformat())


def main():
 sys.stdout.reconfigure(encoding='utf-8')
 notices=json.loads(Path('src/lhNotices.js').read_text(encoding='utf-8').split('export default ',1)[1].strip().rstrip(';'))
 bundle=json.loads(Path('public/notice-evidence.json').read_text(encoding='utf-8'))
 today=dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date().isoformat()
 jobs=[]
 for n in notices:
  if n.get('deadline','')<today or '국민임대' not in n['title'] or re.search('완화|배제|취소',n['title']):continue
  summary=next((s for s in bundle['summaries'].values() if 'panId='+n['id'].removeprefix('lh-')+'&' in s['noticeUrl']),None)
  if summary:jobs.append((n,summary))
 guides={};report=[]
 with futures.ThreadPoolExecutor(max_workers=4) as pool:
  pending={pool.submit(collect,n,s):n for n,s in jobs}
  for future in futures.as_completed(pending):
   n=pending[future]
   try:
    guide=future.result()
    if guide:guides[guide['noticeUrl']]=guide
    status='verified' if guide else 'unsupported'
   except Exception as error:status='error: '+str(error)
   report.append({'id':n['id'],'title':n['title'],'status':status})
   print(n['id'],status,flush=True)
 Path('src/incomeGuides.json').write_text(json.dumps(guides,ensure_ascii=False,indent=2),encoding='utf-8')
 Path('.sites-runtime/income-guides-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Verified guides:',len(guides), '/',len(jobs),flush=True)

if __name__=='__main__':main()
