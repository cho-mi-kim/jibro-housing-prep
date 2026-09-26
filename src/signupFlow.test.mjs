import {test} from 'node:test';
import assert from 'node:assert/strict';
import {signupNickname,temporaryNickname,signupSteps,updateSignupProfile,validateSignupStep} from './signupFlow.mjs';

test('a blank or cleared nickname uses the same six-digit draft; a custom nickname stays intact',()=>{
 const generated=temporaryNickname();assert.match(generated,/^임시\d{6}$/);
 assert.equal(signupNickname('',generated),generated);assert.equal(signupNickname('   ',generated),generated);
 assert.equal(signupNickname(' 내집준비 ',generated),'내집준비');assert.match(signupNickname(''),/^임시\d{6}$/);
});
test('optional profile can be skipped entirely; family changes remove irrelevant questions and data',()=>{
 assert.deepEqual(signupSteps(false),['nickname','email','password','profile-choice','agreements']);
 const married={maritalStatus:'married',marriageDate:'2022-01-01',dualIncome:'yes',childrenCount:1,youngestChildBirthDate:'2025-02-01',residenceRegion:'서울특별시',residenceSince:'2024-01-01'};
 for(const key of ['marriageDate','dualIncome','youngestChildBirthDate','residenceSince'])assert.ok(signupSteps(true,married).includes(key));
 let changed=updateSignupProfile(married,'maritalStatus','single');
 assert.equal(changed.marriageDate,undefined);assert.equal(changed.dualIncome,undefined);assert.ok(!signupSteps(true,changed).includes('marriageDate'));
 changed=updateSignupProfile(changed,'childrenCount',0);assert.equal(changed.youngestChildBirthDate,undefined);assert.ok(!signupSteps(true,changed).includes('youngestChildBirthDate'));
 changed=updateSignupProfile(changed,'residenceRegion','');assert.equal(changed.residenceSince,undefined);assert.ok(!signupSteps(true,changed).includes('residenceSince'));
 assert.equal(married.marriageDate,'2022-01-01');
});
test('each step rejects invalid entries while allowing unknown profile values and explicit zero',()=>{
 const account={email:'valid@example.test',password:'Some-long-password-27',confirmation:'Some-long-password-27'};
 assert.equal(validateSignupStep('email',account),'');assert.ok(validateSignupStep('email',{...account,email:'invalid'}));
 assert.ok(validateSignupStep('password',{...account,password:'short'}));assert.ok(validateSignupStep('password',{...account,confirmation:'different'}));assert.equal(validateSignupStep('password',account),'');
 assert.ok(validateSignupStep('profile-choice',account,{},null));assert.ok(validateSignupStep('profile-choice',account,{},true,false));assert.equal(validateSignupStep('profile-choice',account,{},false,false),'');
 assert.equal(validateSignupStep('householdSize',account,{householdSize:''}),'');assert.ok(validateSignupStep('householdSize',account,{householdSize:0}));
 assert.equal(validateSignupStep('monthlyIncome',account,{monthlyIncome:0}),'');assert.ok(validateSignupStep('monthlyIncome',account,{monthlyIncome:-1}));
});
