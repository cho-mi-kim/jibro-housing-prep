import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {familyConditionGuide} from './familyGuide.mjs';
const e=quote=>({quote});
const table='▪ 세대구성원의 범위\n세대구성원 비고\n • 신청자\n • 신청자의 배우자';
const marriage='① 신혼부부 : 공고일 현재 혼인 7년 이내(혼인신고일이 2019.9.17 ~ 2026.9.17)인 사람';
test('household membership does not become a requirement to marry or have a child',()=>{
 const guide=familyConditionGuide([e(table),e('한부모가족 증명서 제출')]);
 assert.deepEqual(guide.rows,[{label:'함께 확인할 사람',text:'본인과 배우자',sourceIndex:0}]);
 assert.match(guide.note,/배우자가 있는 경우/);
 assert.equal(familyConditionGuide([e('배우자 또는 자녀')]).rows.length,0);
});
test('keeps numeric conditions with the named target and preserves alternatives',()=>{
 const guide=familyConditionGuide([e(marriage+'\n② 예비신혼부부 : 공고일 현재 혼인 예정인 사람으로서 입주일 전일까지 혼인신고를 하는 사람\n◯3-1 한부모가족 : 6세 이하 자녀를 둔 모자가족 또는 부자가족(출생한 자녀 및 태아)')]);
 assert.equal(guide.rows.length,3);
 assert.ok(guide.rows.some(r=>r.label==='신혼부부'&&r.text==='혼인 7년 이내'));
 assert.ok(guide.rows.some(r=>r.label==='한부모가족'&&r.text==='6세 이하 자녀 양육 · 태아 포함'));
 assert.ok(guide.rows.some(r=>r.label==='예비신혼부부'&&r.text==='입주일 전일까지 혼인신고'));
});
test('does not use priority points, cropped clauses, relaxed baseline or conflicting limits',()=>{
 for(const quote of ['1순위\n'+marriage,marriage+' : 3점',marriage+' 제출서류',marriage.replace('인 사람',''), '혼인기간 7년 이내 또는 6세 이하 자녀'])assert.equal(familyConditionGuide([e(quote)]).rows.length,0);
 assert.equal(familyConditionGuide([e(marriage)],'자격완화 모집').rows.length,0);
 assert.equal(familyConditionGuide([e(marriage),e(marriage.replace('7년','10년'))]).rows.length,0);
});
test('relaxed parent age is retained only with its explicit target and waiver marker',()=>{
 const quote='➀-㉰ (한부모가족) 【완화조건】만 9세이하 자녀를 둔 한부모인 자(태아포함)';
 assert.equal(familyConditionGuide([e(quote)],'완화 공고').rows[0].text,'만9세 이하 자녀 양육 · 태아 포함');
 assert.equal(familyConditionGuide([e(quote.replace('【완화조건】',''))],'완화 공고').rows.length,0);
});
test('saved notices use their own original sources and Chilgok identifies spouse scope',()=>{
 const bundle=JSON.parse(fs.readFileSync(new URL('../public/notice-evidence.json',import.meta.url)));
 let total=0;
 for(const [key,n] of Object.entries(bundle.summaries)){
  const evidence=n.criteria.find(c=>c.id==='family')?.evidence||[];
  const before=JSON.stringify(evidence),guide=familyConditionGuide(evidence);
  for(const row of guide.rows){assert.ok(evidence[row.sourceIndex]?.quote);total++;}
  assert.equal(JSON.stringify(evidence),before);
  if(key.includes('panId=2015122300020810'))assert.equal(guide.rows[0].text,'본인과 배우자');
 }
 assert.ok(total>30);
});
