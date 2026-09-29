import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {documentPlan,noticeEvidenceKey} from './noticeDocuments.mjs';
const evidence={};
for(const file of fs.readdirSync(new URL('../public/notice-documents/',import.meta.url)))evidence[file.replace('.json','')]=JSON.parse(fs.readFileSync(new URL('../public/notice-documents/'+file,import.meta.url)));
const notice={id:'lh-2015122300020759'};
test('all 85 notices have source-backed, unique candidates',()=>{
 assert.equal(Object.keys(evidence).length,85);
 for(const e of Object.values(evidence)){assert.ok(e.documents.length);assert.equal(new Set(e.documents.map(d=>d.id)).size,e.documents.length);for(const d of e.documents){assert.match(d.sourceUrl,/^https:\/\/apply\.lh\.or\.kr\//);assert.ok(d.excerpt);assert.ok(['common','check'].includes(d.requirement));}}
});
test('youth rank-dependent documents are not automatically mandatory',()=>{
 const p=documentPlan(notice,{},evidence);assert.deepEqual(p.included.map(d=>d.id),['resident','family','consent']);assert.ok(p.pending.some(d=>d.id==='asset'));assert.equal(p.count,0);
});
test('old completion stays intact; exclusion changes denominator without deleting it',()=>{
 const record={done:['resident','income','asset'],documentChoices:{asset:'exclude'}};
 const before=JSON.stringify(record);const p=documentPlan(notice,record,evidence,[{id:'income',title:'소득 증빙서류'}]);
 assert.equal(p.count,2);assert.equal(p.included.length,4);assert.ok(p.excluded.find(d=>d.id==='asset').done);assert.equal(JSON.stringify(record),before);
 const restored=documentPlan(notice,{...record,documentChoices:{asset:'include'}},evidence);assert.equal(restored.count,3);
});
test('new notices do not inherit example documents or another notice choices',()=>{
 const unknown=documentPlan({id:'lh-new'},{},evidence);assert.equal(unknown.all.length,0);assert.ok(unknown.needsReview);
 const first=documentPlan(notice,{documentChoices:{asset:'include'}},evidence);const second=documentPlan(notice,{},evidence);assert.ok(first.included.some(d=>d.id==='asset'));assert.ok(!second.included.some(d=>d.id==='asset'));
});
test('imported official notice resolves the same evidence, arbitrary hosts do not',()=>{
 assert.equal(noticeEvidenceKey({id:'imported-x',url:'https://apply.lh.or.kr/test?panId=2015122300020759'}),notice.id);
 assert.equal(noticeEvidenceKey({id:'imported-x',url:'https://example.com/?panId=2015122300020759'}),null);
});
