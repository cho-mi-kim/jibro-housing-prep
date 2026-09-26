"""Validate a running collector and optionally compare the full official list.
Run from repository root; read-only except requesting the collector's refresh.
"""
import argparse, datetime, json, re, time, urllib.parse, urllib.request
from pathlib import Path

STATUSES=("공고중", "접수중", "정정공고중")
PREFIX=re.compile(r"^(?:(?:\[(?:정정|수정|변경|취소)(?:공고)?\]|\((?:정정|수정|변경|취소)(?:공고)?\))\s*)+")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--base-url",default="http://127.0.0.1:8080")
    parser.add_argument("--compare-source",action="store_true",help="Independently reread all LH pages; requires beautifulsoup4")
    parser.add_argument("--output",help="Optional local JSON report (contains public notice URLs only)")
    args=parser.parse_args()
    request=urllib.request.Request(args.base_url.rstrip("/")+"/api/notices/refresh",method="POST")
    with urllib.request.urlopen(request,timeout=90) as response: snapshot=json.load(response)
    assert snapshot["status"]=="ok",snapshot
    assert snapshot["lastCheckedAt"],"Successful collection must have a timestamp"
    today=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).date()
    ids=set()
    for notice in snapshot["items"]:
        assert notice["id"] not in ids,"Duplicate notice ID"
        ids.add(notice["id"])
        assert notice["title"].strip()
        assert notice["status"] in STATUSES
        assert datetime.date.fromisoformat(notice["deadline"])>=today
        assert notice["deadlineKind"]=="notice"
        uri=urllib.parse.urlparse(notice["url"])
        assert uri.scheme=="https" and uri.hostname=="apply.lh.or.kr"
        assert urllib.parse.parse_qs(uri.query)["panId"][0]==notice["id"][3:]
        assert not PREFIX.match(notice["title"]) or "취소" not in PREFIX.match(notice["title"])[0]
    assert sum(s["rows"] for s in snapshot["sources"])==snapshot["sourceRows"]
    report={**{k:v for k,v in snapshot.items() if k!="items"},"verification":"PASS","items":len(ids)}
    if args.compare_source:
        from bs4 import BeautifulSoup
        rows=[];pages_read=0
        for status in STATUSES:
            page=1;pages=1;total=None;received=0
            while page<=pages:
                if pages_read:time.sleep(1)
                params=dict(mi="1026",srchY="Y" if page==1 else "N",srchUppAisTpCd="061339",uppAisTpCd="061339",aisTpCd="",srchAisTpCd="",startDt="2000-01-01",endDt=str(today),panStDt="20000101",panEdDt=today.strftime("%Y%m%d"),schTy="0",listCo="100",prevListCo="100",currPage=str(page),panSs=status)
                url="https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?"+urllib.parse.urlencode(params)
                with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"JIBRO/1.0 collector-verification"}),timeout=25) as response: soup=BeautifulSoup(response.read(4*1024*1024),'html.parser')
                count=soup.select_one('.bbs_total').get_text(' ',strip=True)
                m=re.search(r"전체\s*([\d,]+)\s*건\s*(\d+)\s*/\s*(\d+)\s*페이지",count)
                assert m and int(m[2])==page,count
                if total is None: total=int(m[1].replace(',',''));pages=max(1,int(m[3]))
                else: assert total==int(m[1].replace(',','')),"Source changed during comparison; rerun"
                table=soup.select_one('.bbs_ListA');headers=[h.get_text(strip=True) for h in table.select('thead th')]
                for tr in table.select('tbody tr'):
                    a=tr.select_one('a.wrtancInfoBtn')
                    if not a:assert total==0;continue
                    for label in a.select('.day,.new'):label.decompose()
                    cells=dict(zip(headers,[c.get_text(' ',strip=True) for c in tr.select('td')]))
                    rows.append(dict(id='lh-'+a['data-id1'],title=a.get_text(' ',strip=True),region=cells['지역'],type=cells.get('유형',cells.get('분류')),posted=cells['게시일'].replace('.','-'),deadline=cells['마감일'].replace('.','-'),status=cells['상태']))
                    received+=1
                pages_read+=1;page+=1
            assert received==total,(status,received,total)
        latest={}
        def priority(n):
            m=PREFIX.match(n['title'])
            return 2 if (m and '취소' in m[0]) or n['title'].startswith('취소공고') else 1 if m or n['status']=='정정공고중' else 0
        def rank(n):return n['posted'],priority(n),n['id']
        for n in rows:
            key=(PREFIX.sub('',n['title']).strip(),n['region'],n['type'])
            if key not in latest or rank(n)>rank(latest[key]):latest[key]=n
        expected={n['id']:n for n in latest.values() if n['status'] in STATUSES and priority(n)!=2 and n['deadline']>=str(today)}
        assert ids==set(expected),{"missing":sorted(set(expected)-ids),"unexpected":sorted(ids-set(expected))}
        for n in snapshot['items']:
            for field in ('title','region','type','posted','deadline','status'):assert n[field]==expected[n['id']][field],(n['id'],field)
        report['independentComparison']={"matched":len(expected),"sourceRows":len(rows),"pages":pages_read,"duplicateTitles":len(rows)-len(latest),"cancelled":sum(priority(n)==2 for n in latest.values()),"expired":sum(priority(n)!=2 and n['deadline']<str(today) for n in latest.values())}
    if args.output:
        Path(args.output).parent.mkdir(parents=True,exist_ok=True)
        Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True,indent=2))

if __name__=="__main__":main()
