import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {summarizeCondition,plainConditionSummary} from './conditionSummary.mjs';
const e=(quote,focus=quote)=>({quote,focus});

test('keeps the target group and age range together, not a child age or visit rule',()=>{
 const result=summarizeCondition('age',[
  e('청년 : 19세 이상 39세 이하인 사람'),
  e('한부모가족 : 6세 이하 자녀를 둔 사람'),
  e('고령자(만65세 이상)만 현장대행 접수를 진행합니다.')
 ]);
 assert.deepEqual(result.items,[{text:'청년 : 19세 이상 39세 이하인 사람',sourceIndex:0}]);
});
test('relaxed or waived requirements cannot become an ordinary numeric threshold',()=>{
 const result=summarizeCondition('income',[e('세대구성원 전원의 총자산가액 34,500만원 이하\n(금회 배제)','세대구성원 전원의 총자산가액 34,500만원 이하')]);
 assert.deepEqual(result.items,[]);assert.match(result.note,/완화·배제/);
 const exemption=summarizeCondition('income',[e('소득기준 및 자산기준 충족 여부와 상관없이 신청 가능합니다.')]);
 assert.match(exemption.items[0].text,/상관없이/);
});
test('does not convert a cropped sentence or unlabeled table cell into a rule',()=>{
 assert.deepEqual(summarizeCondition('income',[e('100% | 3,500만원 이하')]).items,[]);
 assert.deepEqual(summarizeCondition('house',[e('무주택자로서 아래 요건을 충')]).items,[]);
 assert.deepEqual(summarizeCondition('age',[]).items,[]);
});
test('preserves exceptions and references the actual excerpt',()=>{
 const result=summarizeCondition('age',[e('신청자는 만19세 이상의 성년자이어야 합니다. 단, 아래 예외를 적용합니다.')]);
 assert.match(result.items[0].text,/예외/);assert.equal(result.items[0].sourceIndex,0);
 assert.match(result.note,/예외/);
});
test('all saved summaries are bounded source text and never alter the original',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../public/notice-evidence.json',import.meta.url)));
 const normalize=s=>s.replace(/\s/g,'');let total=0;
 for(const notice of Object.values(data.summaries))for(const criterion of notice.criteria){
  const before=JSON.stringify(criterion.evidence);
  const result=summarizeCondition(criterion.id,criterion.evidence);
  assert.ok(result.items.length<=1);
  for(const item of result.items){
   total++;assert.ok(item.text.length<=220);
   assert.ok(normalize(criterion.evidence[item.sourceIndex].quote).includes(normalize(item.text)));
  }
  assert.equal(JSON.stringify(criterion.evidence),before);
 }
 assert.ok(total>250);
});

test('income exceptions stay beside the threshold and priority rules are not universal family rules',()=>{
 const result=summarizeCondition('income',[e('신청자 부모와 본인의 월평균소득 합계 100퍼센트 이하\n※ 단, 가구원 수가 1인인 경우 120퍼센트 이하일 것','신청자 부모와 본인의 월평균소득 합계 100퍼센트 이하')]);
 assert.match(result.items[0].text,/120퍼센트/);
 assert.deepEqual(summarizeCondition('family',[e('1순위\n- 혼인 중인 사람으로서 혼인기간이 7년 이내인 경우','- 혼인 중인 사람으로서 혼인기간이 7년 이내인 경우')]).items,[]);
});

test('plain summaries are short, scoped, and never invent a numeric limit',()=>{
 assert.equal(plainConditionSummary('age',[e('청년 : 19세 이상 39세 이하인 사람')]),'청년: 19~39세');
 assert.equal(plainConditionSummary('age',[e('청년 : 만 19세 이상 39세 이하인 사람')]),'청년: 만 19~39세');
 assert.doesNotMatch(plainConditionSummary('age',[e('한부모가족 : 6세 이하 자녀를 둔 사람')]),/6세/);
 assert.match(plainConditionSummary('income',[e('가구원 수에 따른 소득 한도 100퍼센트 이하')]),/대상·가구원/);
 assert.doesNotMatch(plainConditionSummary('income',[e('가구원 수에 따른 소득 한도 100퍼센트 이하')]),/100/);
 assert.match(plainConditionSummary('income',[e('소득 100퍼센트 이하')],'소득·총자산요건 배제 공고'),/완화 대상/);
 assert.equal(plainConditionSummary('house',[]),'공고 원문에서 확인해주세요');
 const data=JSON.parse(fs.readFileSync(new URL('../public/notice-evidence.json',import.meta.url)));
 for(const notice of Object.values(data.summaries))for(const criterion of notice.criteria){
  const text=plainConditionSummary(criterion.id,criterion.evidence);
  assert.ok(text.length<=40,text);
 }
});

test('adult age rule retains the explicit minor exception, including split PDF lines',()=>{
 const quote='■ 성년자\n미성년자(19세 미만)는 공급 신청할 수 없습니다. 단, 아래의 어느 하나에 해당하는 경우 미성년자도 공\n급 신청 가능합니다. (법정대리인의 동의 또는 대리 필요)';
 assert.equal(plainConditionSummary('age',[e(quote)]),'성년자 신청 가능 · 일부 미성년자는 예외 허용');
 for(const text of ['미성년자(19세 미만)는 공급 신청할 수 없습니다.', '미성년자녀가 있는 신혼부부 : 3점', '미성년자는 법정대리인의 동의 필요',quote.replace('신청 가능합니다','신청 불가능합니다')]){
  assert.doesNotMatch(plainConditionSummary('age',[e(text)]),/예외 허용/);
 }
 const data=JSON.parse(fs.readFileSync(new URL('../public/notice-evidence.json',import.meta.url)));
 const matching=Object.values(data.summaries).filter(n=>JSON.stringify(n).includes('칠곡왜관4'));
 assert.ok(matching.length>0);
 for(const notice of matching)assert.equal(plainConditionSummary('age',notice.criteria.find(c=>c.id==='age').evidence),'성년자 신청 가능 · 일부 미성년자는 예외 허용');
});
