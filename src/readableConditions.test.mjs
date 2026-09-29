import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readableConditions,matchingReadableGuide} from './readableConditions.mjs';
const e=quote=>({quote,sourceId:'file',sourceUrl:'https://apply.lh.or.kr/lhapply/lhFile.do?fileid=1',page:1,sha256:'hash'});
const guides=JSON.parse(fs.readFileSync(new URL('./readableGuides.json',import.meta.url)));
const evidence=JSON.parse(fs.readFileSync(new URL('../public/notice-evidence.json',import.meta.url))).summaries;
test('all exported rules stay attached to the correct notice and current attachment',()=>{
 let count=0;
 for(const [key,guide] of Object.entries(guides)){
  if(Object.values(guide.criteria).some(r=>r.length))assert.ok(matchingReadableGuide(evidence[key],guides));
  else assert.equal(matchingReadableGuide(evidence[key],guides),null);
  for(const [kind,rows] of Object.entries(guide.criteria))for(const row of rows){
   count++;assert.ok(row.evidence.quote.length>5);
   assert.ok(row.label&&row.text&&row.evidence.sourceUrl);
   if(kind==='income')for(const number of row.text.matchAll(/\d{1,3}(?:,\d{3})+/g))assert.ok(row.evidence.quote.includes(number[0]),number[0]);
  }
  if(Object.values(guide.criteria).some(r=>r.length))assert.equal(matchingReadableGuide({...evidence[key],sources:[]},guides),null);
 }
 assert.ok(count>200);
});
test('child age and desk assistance age are never the applicants age',()=>{
 const rows=readableConditions([e('한부모가족 : 6세 이하 자녀를 둔 모자가족 또는 부자가족(태아)\n65세 이상 고령자 현장 접수 안내')]);
 assert.deepEqual(rows.age,[]);
 assert.equal(rows.family[0].text,'6세 이하 자녀 양육 · 태아 포함');
});
test('waived assets retain the car limit rather than waiving all property checks',()=>{
 const rows=readableConditions([e('③ 【완화조건】 소득요건 배제\n④ 【완화조건】 총자산가액 요건은 배제하나, 총 자산 중 자동차가액은 4,542만원 이하일 것')],'완화 모집');
 assert.equal(rows.income[0].text,'소득 요건 적용 안 함');
 assert.equal(rows.income[1].text,'총자산 요건 제외 · 자동차 4,542만원 이하');
});
test('standard family thresholds are not used in a relaxed notice',()=>{
 const rows=readableConditions([e('신혼부부 : 공고일 현재 혼인 7년 이내(혼인신고일 2019~2026)인 사람')],'입주자격 완화');
 assert.deepEqual(rows.family,[]);
});
test('matching a different notice or attachment never reuses a saved guide',()=>{
 const key=Object.keys(guides).find(k=>guides[k].criteria.age.length);
 for(const property of ['id','url','sha256'])assert.equal(matchingReadableGuide({...evidence[key],sources:evidence[key].sources.map(s=>({...s,[property]:'changed'}))},guides),null);
 assert.equal(matchingReadableGuide({...evidence[key],noticeUrl:'https://example.com'},guides),null);
});
test('a cropped income table cannot produce missing household amounts',()=>{
 const guide=Object.values(guides).find(g=>g.criteria.income.some(r=>r.label==='4인 가구 월소득'));
 const source=guide.criteria.income[0].evidence;
 const parsed=readableConditions([source],'신혼·신생아 모집');
 assert.equal(parsed.income.filter(r=>/가구 월소득/.test(r.label)).length,4);
 const changed={...source,quote:source.quote.replace(/(130%|70%)\s+[\d,]+원?\s+[\d,]+원?\s+[\d,]+원?\s+[\d,]+원?/,'표를 읽지 못함')};
 assert.equal(readableConditions([changed],'신혼·신생아 모집').income.filter(r=>/가구 월소득/.test(r.label)).length,0);
});
