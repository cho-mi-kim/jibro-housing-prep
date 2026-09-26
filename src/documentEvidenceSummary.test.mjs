import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {documentEvidenceSummary as summarize} from './documentEvidenceSummary.mjs';
const directory=new URL('../public/notice-documents/',import.meta.url);
const evidence=Object.fromEntries(fs.readdirSync(directory).map(file=>[file.replace('.json',''),JSON.parse(fs.readFileSync(new URL(file,directory)))]));
const doc=(id,title)=>evidence[id].documents.find(d=>d.title===title);
test('all stored notices summarize without mutating evidence or including original paragraphs',()=>{
 const before=JSON.stringify(evidence);let count=0;
 for(const n of Object.values(evidence))for(const d of n.documents){const s=summarize(d);count++;assert.ok(s.purpose);assert.ok(!s.purpose.startsWith('이 서류의 용도'),d.title);assert.ok(s.points.length>0&&s.points.length<=4);for(const p of s.points)assert.ok(p.length<110,`${d.title}: ${p}`);}
 assert.equal(Object.keys(evidence).length,85);assert.equal(count,2902);assert.equal(JSON.stringify(evidence),before);
});
test('known rank and prospective-couple exemptions survive the summary',()=>{
 const youth=summarize(doc('lh-2015122300020759','자산 보유 사실확인서')).points.join(' ');
 assert.match(youth,/2·3순위/);assert.match(youth,/1순위는 필요 없/);
 const couple=summarize(doc('lh-2015122300020808','금융정보 등 제공 동의서')).points.join(' ');
 assert.match(couple,/한부모/);assert.match(couple,/수급자·차상위 예비신혼부부는 제출/);
 const family=summarize(doc('lh-2015122300020810','가족관계증명서')).points.join(' ');
 assert.match(family,/경우 제출/);assert.doesNotMatch(family,/모든|전원/);
});
test('lookup dictionaries and contractual references never become required application documents',()=>{
 const rows=Object.values(evidence).flatMap(n=>n.documents);
 const query=rows.find(d=>d.title==='소득금액증명'&&d.excerpt.includes('민원인정보'));
 assert.ok(query);assert.equal(summarize(query).kind,'lookup');assert.match(summarize(query).points.join(' '),/직접 제출해야 하는지는 별도 확인/);
 const lease=rows.find(d=>d.title==='임대차계약서'&&/위약금/.test(d.excerpt)&&!d.excerpt.includes('확정일자'));
 assert.ok(lease);assert.match(summarize(lease).points.join(' '),/신청 때 제출하는 서류인지는 확인/);
});
test('attachment-specific exceptions cannot leak to other notices or legacy records',()=>{
 const d=doc('lh-2015122300020808','금융정보 등 제공 동의서');
 const unrelated=summarize({...d,sourceUrl:'https://apply.lh.or.kr/lhapply/lhFile.do?fileid=new',excerpt:'금융정보 제공 동의서'});
 assert.doesNotMatch(unrelated.points.join(' '),/예비신혼부부는 제출/);
 assert.equal(summarize({title:'이전 기록'}).kind,'unverified');
});
