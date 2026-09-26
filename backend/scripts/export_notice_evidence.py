"""Export public LH evidence for static hosting. No user records or credentials.

Start the Spring API, then run from the repository root. Failed fetches are reported,
never converted into successful analysis. Existing sources retain their checkedAt.
After updating src/lhNotices.js, run with --missing-only before publishing the list.
"""
import argparse
import datetime as dt
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path
from snapshot_store import atomic_json, save_attempt

parser = argparse.ArgumentParser()
parser.add_argument('--api', default='http://127.0.0.1:8081')
parser.add_argument('--output', default='public/notice-evidence.json')
parser.add_argument('--notice-id', action='append', help='Refresh only these notice IDs; may be repeated')
parser.add_argument('--missing-only', action='store_true', help='Keep existing summaries and extract only newly listed notices')
args = parser.parse_args()
today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date().isoformat()
notices = json.loads(Path('src/lhNotices.js').read_text(encoding='utf-8').split('export default ', 1)[1].strip().rstrip(';'))
notices = [n for n in notices if n.get('deadline', '') >= today and '취소' not in n.get('title', '')]
if args.notice_id:
    notices = [n for n in notices if n['id'] in args.notice_id]
output = Path(args.output)
bundle = json.loads(output.read_text(encoding='utf-8')) if output.exists() else {'version': 'evidence-v1', 'generatedAt': None, 'summaries': {}}
if bundle.get('version') != 'evidence-v1' or not isinstance(bundle.get('summaries'), dict):
    raise ValueError('Invalid existing evidence snapshot')

def notice_key(url):
    parsed = urllib.parse.urlsplit(url)
    query = urllib.parse.parse_qs(parsed.query)
    pairs = [(key, query[key][0]) for key in ('panId','ccrCnntSysDsCd','aisTpCd','uppAisTpCd') if key in query]
    return parsed.scheme + '://' + parsed.netloc + parsed.path + '?' + urllib.parse.urlencode(pairs + [('mi', '1026')])

if args.missing_only:
    notices = [n for n in notices if notice_key(n['url']) not in bundle['summaries']]
failures = []
for i, notice in enumerate(notices):
    try:
        query = urllib.parse.urlencode({'url': notice['url']})
        with urllib.request.urlopen(args.api.rstrip('/') + '/api/notice-evidence?' + query, timeout=180) as response:
            data = json.load(response)
        if data.get('version') != 'evidence-v1' or data.get('noticeUrl') != notice_key(notice['url']) or not isinstance(data.get('criteria'), list):
            raise ValueError('Invalid evidence response')
        if data.get('status') == 'unavailable':
            raise ValueError('No readable evidence: previous successful excerpt retained')
        bundle['summaries'][data['noticeUrl']] = data
        save_attempt('public/notice-analysis-attempts.json','conditions',data['noticeUrl'],dt.datetime.now(dt.timezone.utc).isoformat(),True)
        print(f"{i+1}/{len(notices)} {notice['id']} {data['status']} sources={len(data['sources'])}", flush=True)
    except Exception as error:
        save_attempt('public/notice-analysis-attempts.json','conditions',notice_key(notice['url']),dt.datetime.now(dt.timezone.utc).isoformat(),False)
        failures.append({'noticeId': notice['id'], 'url': notice['url'], 'error': str(error)})
        print(f"{i+1}/{len(notices)} {notice['id']} FETCH_FAILED", flush=True)
    bundle['generatedAt'] = dt.datetime.now(dt.timezone.utc).isoformat()
    atomic_json(output, bundle)
    time.sleep(1)
report = {'total': len(notices), 'saved': len(bundle['summaries']), 'failed': failures,
          'withEvidence': sum(s['status'] == 'partial' for s in bundle['summaries'].values()),
          'unavailable': sum(s['status'] == 'unavailable' for s in bundle['summaries'].values())}
Path('.sites-runtime').mkdir(exist_ok=True)
Path('.sites-runtime/evidence-export-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='failed'}, ensure_ascii=False), flush=True)

if failures:
    raise SystemExit(1)
