import {APPLICANT_CONSENT_VERSION,normalizeApplicantProfile} from './applicantProfile.mjs';

export function temporaryNickname(){
 const random=crypto.getRandomValues(new Uint32Array(1))[0];
 return '임시'+String(100000+random%900000);
}
export function signupNickname(value,fallback){return String(value||'').trim().slice(0,16)||fallback||temporaryNickname();}

export const signupFields=[
 {key:'birthDate',type:'date',title:'생년월일을 알려주세요',label:'생년월일',help:'공고에서 정한 날짜에 맞춰 만 나이를 계산해요.'},
 {key:'targetGroup',type:'select',title:'어떤 신청 대상을 먼저 볼까요?',label:'신청 대상',help:'관심 있는 대상을 골라주세요. 실제 신청 자격은 공고별로 확인해요.'},
 {key:'selfHome',type:'select',title:'본인 명의의 집이 있나요?',label:'본인 주택·분양권 보유 여부',help:'주택과 분양권 등을 포함해 선택해주세요. 무주택 인정 예외는 공고에서 확인해요.'},
 {key:'householdHome',type:'select',title:'세대원이 보유한 집이 있나요?',label:'해당 세대원의 주택·분양권 보유 여부',help:'배우자 등 공고에서 정한 세대원 범위로 확인해주세요.'},
 {key:'householdSize',type:'number',title:'가구원은 몇 명인가요?',label:'공고 기준 가구원 수',unit:'명',min:1,max:20,help:'단순히 함께 사는 인원과 달라요. 공고의 세대구성원 범위를 기준으로 입력해주세요.'},
 {key:'maritalStatus',type:'select',title:'현재 혼인 상태를 알려주세요',label:'혼인 상태'},
 {key:'marriageDate',type:'date',title:'언제 혼인신고를 했나요?',label:'혼인신고일',when:p=>p.maritalStatus==='married'},
 {key:'dualIncome',type:'select',title:'두 분 모두 소득이 있나요?',label:'본인과 배우자의 맞벌이 여부',when:p=>p.maritalStatus==='married',help:'맞벌이 기준이 따로 있는 공고에서 참고해요.'},
 {key:'childrenCount',type:'number',title:'미성년 자녀는 몇 명인가요?',label:'미성년 자녀 수',unit:'명',min:0,max:20,help:'자녀가 없다면 0명을 입력해주세요. 태아·입양 인정 조건은 공고에서 별도로 확인해요.'},
 {key:'youngestChildBirthDate',type:'date',title:'막내 자녀는 언제 태어났나요?',label:'막내 자녀 생년월일',when:p=>Number(p.childrenCount)>0},
 {key:'householdRole',type:'select',title:'세대주인가요, 세대원인가요?',label:'세대주 여부',help:'주민등록표 기준으로 선택해주세요.'},
 {key:'incomeScope',type:'select',title:'누구의 소득·자산을 입력할까요?',label:'소득·자산 합산 범위',help:'공고에 따라 본인, 부모 또는 세대구성원의 정보를 합산해요.'},
 {key:'monthlyIncome',type:'number',title:'월평균 소득을 알려주세요',label:'세전 월평균 소득',unit:'원',min:0,max:10000000000,money:true,help:'선택한 합산 범위의 세전 금액이에요. 모르면 건너뛰고, 소득이 없으면 0원을 입력해주세요.'},
 {key:'totalAssets',type:'number',title:'총자산 가액을 알려주세요',label:'총자산 가액',unit:'원',min:0,max:1000000000000,money:true,help:'공고의 자산 산정 기준에 따른 금액을 입력해주세요. 모르면 건너뛰어도 돼요.'},
 {key:'carValue',type:'number',title:'자동차 가액을 알려주세요',label:'자동차 가액',unit:'원',min:0,max:10000000000,money:true,help:'구매 가격과 공고에서 인정하는 가액은 다를 수 있어요. 해당 자동차가 없으면 0원을 입력해주세요.'},
 {key:'residenceRegion',type:'select',title:'어느 지역에 주민등록이 있나요?',label:'현재 주민등록 지역'},
 {key:'residenceSince',type:'date',title:'현재 지역에 언제 전입했나요?',label:'현재 지역 전입일',when:p=>!!p.residenceRegion,help:'거주 기간을 확인할 때 참고해요.'},
 {key:'subscriptionCount',type:'number',title:'청약 납입 인정 횟수를 알려주세요',label:'청약통장 인정 납입 횟수',unit:'회',min:0,max:1200,help:'통장의 총 납입 횟수와 다를 수 있어요. 모르면 나중에 입력해주세요.'}
];
export function signupSteps(withProfile,profile={}){
 return ['nickname','email','password','profile-choice',...(withProfile?signupFields.filter(f=>!f.when||f.when(profile)).map(f=>f.key):[]),'agreements'];
}
export function updateSignupProfile(profile,key,value){
 const next={...profile,[key]:value};
 if(key==='maritalStatus'&&value!=='married'){delete next.marriageDate;delete next.dualIncome;}
 if(key==='childrenCount'&&!(Number(value)>0))delete next.youngestChildBirthDate;
 if(key==='residenceRegion'&&!value)delete next.residenceSince;
 return next;
}
export function validateSignupStep(step,account,profile={},opted=false,profileConsent=false){
 if(step==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim()))return '이메일 주소를 확인해주세요.';
 if(step==='password'){
  if(account.password.length<12||account.password.length>128)return '비밀번호는 12~128자로 입력해주세요.';
  if(account.password!==account.confirmation)return '비밀번호가 서로 달라요. 다시 확인해주세요.';
 }
 if(step==='profile-choice'){
  if(opted==null)return '내 조건을 입력할지 선택해주세요.';
  if(opted&&!profileConsent)return '내 조건 저장·활용에 선택 동의하거나, 나중에 입력을 선택해주세요.';
 }
 if(signupFields.some(f=>f.key===step)){
  try{normalizeApplicantProfile({...profile,consent:true,consentVersion:APPLICANT_CONSENT_VERSION});}catch(e){return e.message;}
 }
 return '';
}
