import {test} from 'node:test';
import assert from 'node:assert/strict';
import {APPLICANT_CONSENT_VERSION,normalizeApplicantProfile,ageOn,personalCondition} from './applicantProfile.mjs';
const now=new Date('2026-09-26T00:00:00Z'),consent={consent:true,consentVersion:APPLICANT_CONSENT_VERSION};
test('optional consent, dates, enums and money are validated and unrecognized sensitive fields discarded',()=>{
 assert.equal(normalizeApplicantProfile(null),null);
 for(const p of [{birthDate:'1996-01-01'},{...consent,householdSize:0},{...consent,monthlyIncome:-1},{...consent,monthlyIncome:'0'},{...consent,birthDate:'2020-02-29'},{...consent,birthDate:'2000-02-30'},{...consent,targetGroup:'admin'}])assert.throws(()=>normalizeApplicantProfile(p,now));
 const p=normalizeApplicantProfile({...consent,householdSize:3,monthlyIncome:0,maritalStatus:'single',marriageDate:'2020-01-01',childrenCount:0,youngestChildBirthDate:'2025-01-01',pregnancy:true,disability:true,ssn:'forbidden'},now);
 assert.equal(p.monthlyIncome,0);for(const field of ['marriageDate','youngestChildBirthDate','pregnancy','disability','ssn'])assert.equal(p[field],undefined);
 assert.equal(ageOn('2000-09-27','2026-09-26'),25);assert.equal(ageOn('2000-09-26','2026-09-26'),26);assert.equal(ageOn('2020-01-01','2019-12-31'),null);
});
test('personalization distinguishes absent amounts, 5+ households and applicable income branch without a verdict',()=>{
 const rows=[{label:'3인 가구 월소득',text:'일반 5,000,000원 · 맞벌이 7,000,000원 이하',evidence:{sourceUrl:'https://apply.lh.or.kr/lhapply/lhFile.do?fileid=1',page:1}}];
 const result=personalCondition({profile:{...consent,householdSize:3,dualIncome:'yes',monthlyIncome:0},criterion:'income',rows});
 assert.equal(result.focused[0].text,'맞벌이 7,000,000원 이하');assert.ok(result.entered.includes('월소득 0원'));
 assert.equal(personalCondition({profile:{...consent,householdSize:5},criterion:'income',rows}).focused.length,0);
 assert.equal(personalCondition({profile:{...consent,householdSize:3},criterion:'income',rows:[]}).focused.length,0);
 assert.equal(personalCondition({profile:null,criterion:'income',rows}),null);
 assert.ok(!JSON.stringify(result).match(/적격|부적격|신청 가능|신청 불가/));
});
test('date reference and target labels are exact; no inferred medical, family or housing eligibility',()=>{
 const result=personalCondition({profile:{...consent,birthDate:'1999-10-01',targetGroup:'engaged',maritalStatus:'engaged'},notice:{posted:'2026-09-15'},criterion:'age',rows:[{label:'신혼부부',text:'혼인 7년 이내'},{label:'예비신혼부부',text:'입주 전 신고'}]});
 assert.match(result.entered[0],/공고 게시일 2026-09-15 기준 만 26세/);assert.deepEqual(result.focused.map(r=>r.label),['예비신혼부부']);
});
