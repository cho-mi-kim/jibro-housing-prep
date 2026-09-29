import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applicantDirty,applicantValue,changedApplicantFields,editableFields} from './applicantEditor.mjs';
import {signupFields,updateSignupProfile} from './signupFlow.mjs';
const original={consent:true,consentVersion:'2026-09-26',householdSize:3,monthlyIncome:0,maritalStatus:'married',marriageDate:'2023-01-01',dualIncome:'yes',childrenCount:1,youngestChildBirthDate:'2025-01-01'};
test('unchanged edits retain values; absent and empty are equal, zero is a real recorded value',()=>{
 assert.equal(applicantDirty(original,{...original,updatedAt:'later',residenceRegion:''}),false);
 assert.equal(applicantDirty(null,null),false);assert.equal(applicantDirty(null,{consent:true}),true);
 assert.equal(applicantValue(signupFields.find(f=>f.key==='monthlyIncome'),original),'0원');
 assert.equal(applicantValue(signupFields.find(f=>f.key==='householdSize'),original),'3명');
 assert.equal(applicantValue(signupFields.find(f=>f.key==='residenceRegion'),original),'미입력');
 assert.equal(applicantDirty(original,{...original,monthlyIncome:''}),true);
});
test('one-field edits preserve other answers and distinguish staged changes from the saved record',()=>{
 const next=updateSignupProfile(original,'householdSize',4);
 assert.equal(original.householdSize,3);assert.equal(next.householdSize,4);assert.equal(next.monthlyIncome,0);
 assert.deepEqual(changedApplicantFields(original,next).map(f=>f.key),['householdSize']);
 assert.equal(applicantDirty(original,next),true);assert.equal(applicantDirty(original,updateSignupProfile(next,'householdSize',3)),false);
});
test('dependent answers removed by changed circumstances stay visible in change accounting',()=>{
 const next=updateSignupProfile(original,'maritalStatus','single');
 assert.ok(!editableFields(next).some(f=>f.key==='marriageDate'));
 assert.deepEqual(changedApplicantFields(original,next).map(f=>f.key),['maritalStatus','marriageDate','dualIncome']);
 assert.equal(next.childrenCount,1);assert.equal(next.youngestChildBirthDate,'2025-01-01');
});
