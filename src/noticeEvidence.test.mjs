import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evidenceNoticeKey,validEvidenceSummary,evidenceSourceLink,evidenceLocation,createEvidenceLoader} from './noticeEvidence.mjs';
const a='https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020763&aisTpCd=10';
test('notice identity ignores tracking but isolates different notices',()=>{
 assert.equal(evidenceNoticeKey(a),evidenceNoticeKey(a+'&v=123'));
 assert.notEqual(evidenceNoticeKey(a),evidenceNoticeKey(a.replace('20763','20764')));
 const data={version:'evidence-v1',noticeUrl:a,checkedAt:new Date().toISOString(),status:'partial',criteria:[],sources:[]};
 assert.ok(validEvidenceSummary(data,evidenceNoticeKey(a)));
 assert.ok(!validEvidenceSummary(data,evidenceNoticeKey(a.replace('20763','20764'))));
});
test('only official evidence file links are rendered',()=>{
 assert.equal(evidenceSourceLink('javascript:alert(1)',1),null);
 assert.equal(evidenceSourceLink('https://evil.test/file.pdf',1),null);
 assert.equal(evidenceSourceLink('https://apply.lh.or.kr/lhapply/lhFile.do?fileid=123',7),'https://apply.lh.or.kr/lhapply/lhFile.do?fileid=123#page=7');
 assert.equal(evidenceNoticeKey('https://apply.lh.or.kr.evil.test/'+a.split('/').slice(3).join('/')),null);
});

test('snapshot fetch failure stays an error and retry can recover',async()=>{
 let calls=0;const bundle={version:'evidence-v1',summaries:{}};
 const load=createEvidenceLoader(async()=>{if(++calls===1)throw Error('offline');return {ok:true,json:async()=>bundle}});
 await assert.rejects(load(),/offline/);assert.equal(await load(),bundle);assert.equal(calls,2);
 await load();assert.equal(calls,2);await load({force:true});assert.equal(calls,3);
});
test('invalid responses and stalled requests do not masquerade as missing notices',async()=>{
 await assert.rejects(createEvidenceLoader(async()=>({ok:true,json:async()=>({})}))(),/snapshot_invalid/);
 await assert.rejects(createEvidenceLoader(()=>new Promise(()=>{}),{timeoutMs:5})(),/snapshot_timeout/);
});

test('HWPX provenance never invents a PDF page',()=>{
 assert.equal(evidenceLocation({sourceName:'공고.hwpx',page:0,region:'본문 1구역'}),'HWPX · 본문 1구역');
 assert.equal(evidenceSourceLink('https://apply.lh.or.kr/lhapply/lhFile.do?fileid=123',0),'https://apply.lh.or.kr/lhapply/lhFile.do?fileid=123');
 assert.equal(evidenceLocation({sourceName:'공고.pdf',page:7,region:'왼쪽'}),'PDF 7쪽 (왼쪽)');
});
