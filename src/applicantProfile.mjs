// User-entered context for reading a notice, never an eligibility decision.
export const APPLICANT_CONSENT_VERSION='2026-09-26';
export const regions=['서울특별시','부산광역시','대구광역시','인천광역시','광주광역시','대전광역시','울산광역시','세종특별자치시','경기도','강원특별자치도','충청북도','충청남도','전북특별자치도','전라남도','경상북도','경상남도','제주특별자치도'];
export const profileOptions={
 targetGroup:[['general','일반'],['youth','청년'],['student','대학생'],['jobseeker','취업준비생'],['newlywed','신혼부부'],['engaged','예비신혼부부'],['newborn','신생아 가구'],['singleParent','한부모가족'],['multiChild','다자녀 가구'],['senior','고령자']],
 selfHome:[['no','없어요'],['yes','있어요']],householdHome:[['no','모두 없어요'],['yes','보유한 사람이 있어요']],
 maritalStatus:[['single','혼인 중이 아니에요'],['married','혼인 중이에요'],['engaged','혼인 예정이에요']],
 dualIncome:[['no','아니요'],['yes','네']],householdRole:[['head','세대주'],['member','세대원']],
 incomeScope:[['household','공고의 세대구성원 합산'],['self','본인만'],['parents','본인과 부모 합산']],
 residenceRegion:regions.map(r=>[r,r])
};
const numericLimits={householdSize:[1,20],childrenCount:[0,20],monthlyIncome:[0,10000000000],totalAssets:[0,1000000000000],carValue:[0,10000000000],subscriptionCount:[0,1200]};
const dateFields=['birthDate','marriageDate','youngestChildBirthDate','residenceSince'];
export const koreaDate=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&!Number.isNaN(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
export function ageOn(birthDate,onDate){if(!validDate(birthDate)||!validDate(onDate)||birthDate>onDate)return null;return +onDate.slice(0,4)-+birthDate.slice(0,4)-(onDate.slice(5)<birthDate.slice(5)?1:0);}
export function normalizeApplicantProfile(value,now=new Date()){
 if(value==null)return null;
 if(typeof value!=='object'||Array.isArray(value)||value.consent!==true||value.consentVersion!==APPLICANT_CONSENT_VERSION)throw Error('내 조건 정보의 선택 동의를 확인해주세요.');
 const p={consent:true,consentVersion:APPLICANT_CONSENT_VERSION};
 for(const [key,options] of Object.entries(profileOptions)){const v=value[key];if(v==null||v==='')continue;if(typeof v!=='string'||!options.some(([id])=>id===v))throw Error('내 조건의 선택 항목을 확인해주세요.');p[key]=v;}
 for(const [key,[min,max]] of Object.entries(numericLimits)){const v=value[key];if(v==null||v==='')continue;if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)throw Error('가구원 수와 금액을 올바르게 입력해주세요.');p[key]=v;}
 const today=koreaDate(now);
 for(const key of dateFields){const v=value[key];if(v==null||v==='')continue;if(!validDate(v)||v<'1900-01-01'||v>today)throw Error('날짜를 올바르게 입력해주세요.');p[key]=v;}
 if(p.birthDate&&ageOn(p.birthDate,today)<14)throw Error('만 14세 이상만 가입할 수 있어요.');
 if(p.maritalStatus!=='married'){delete p.marriageDate;delete p.dualIncome;}
 if(p.childrenCount===0)delete p.youngestChildBirthDate;
 if(p.marriageDate&&p.birthDate&&p.marriageDate<p.birthDate)throw Error('혼인신고일을 확인해주세요.');
 if(p.youngestChildBirthDate&&p.birthDate&&p.youngestChildBirthDate<p.birthDate)throw Error('자녀 생년월일을 확인해주세요.');
 p.updatedAt=now.toISOString();return p;
}
export const optionLabel=(key,value)=>profileOptions[key]?.find(([id])=>id===value)?.[1]||'미입력';
export function profileSummary(p){if(!p)return '내 조건을 입력하면 관련 기준을 먼저 볼 수 있어요';return [p.birthDate?`만 ${ageOn(p.birthDate,koreaDate())}세`:null,p.householdSize?`${p.householdSize}인 가구`:null,p.targetGroup?optionLabel('targetGroup',p.targetGroup):null].filter(Boolean).join(' · ')||'저장한 내 조건으로 공고 기준을 확인해요';}
const groupLabels={youth:['청년','청년 전세임대'],student:['청년','기숙사형 청년','대학생 자산'],jobseeker:['청년','청년 전세임대'],newlywed:['신혼부부','자녀가 있는 혼인가구','혼인가구'],engaged:['예비신혼부부'],newborn:['신생아 가구'],singleParent:['한부모가족'],multiChild:['다자녀 가구'],senior:['고령자'],general:['기본 연령','일반공급','거주지·연령 요건']};
export function personalCondition({profile:p,notice,criterion,rows=[],incomeGuide}){
 if(!p?.consent)return null;
 const entered=[],focused=[],notes=[];
 const amount=n=>new Intl.NumberFormat('ko-KR').format(n)+'원';
 if(criterion==='age'){
  const at=validDate(notice?.posted)?notice.posted:null,age=ageOn(p.birthDate,at||koreaDate());
  if(age!==null)entered.push(`${at?'공고 게시일 '+at:'오늘'} 기준 만 ${age}세`);
  if(p.targetGroup)entered.push('선택한 대상: '+optionLabel('targetGroup',p.targetGroup));
  notes.push('공고에서 정한 나이 산정일과 예외를 함께 확인해주세요.');
 }
 if(criterion==='house'){
  if(p.selfHome)entered.push('본인 주택: '+optionLabel('selfHome',p.selfHome));
  if(p.householdHome)entered.push('세대원 주택: '+optionLabel('householdHome',p.householdHome));
  notes.push('세대 분리 배우자·분양권과 무주택 인정 예외도 원문에서 확인해주세요.');
 }
 if(criterion==='family'||criterion==='eligibility'){
  if(p.maritalStatus)entered.push(optionLabel('maritalStatus',p.maritalStatus));
  if(p.marriageDate)entered.push('혼인신고일 '+p.marriageDate);
  if(p.householdSize)entered.push('가구원 '+p.householdSize+'명');
  if(p.childrenCount!=null)entered.push('미성년 자녀 '+p.childrenCount+'명');
  if(p.youngestChildBirthDate)entered.push('막내 자녀 생년월일 '+p.youngestChildBirthDate);
  if(p.householdRole)entered.push(optionLabel('householdRole',p.householdRole));
  if(p.residenceRegion)entered.push('주민등록 '+p.residenceRegion);
  if(p.residenceSince)entered.push('전입일 '+p.residenceSince);
  if(p.subscriptionCount!=null)entered.push('청약 인정 '+p.subscriptionCount+'회');
  notes.push('배우자·부모·자녀의 포함 범위와 입양·태아 인정 조건은 공고마다 달라요.');
  if(p.residenceRegion||p.subscriptionCount!=null)notes.push('공고 지역은 주택 위치일 수 있어요. 거주지 제한·우선순위·청약 가점은 원문에서 확인해주세요.');
 }
 if(criterion==='income'){
  if(p.householdSize)entered.push(p.householdSize+'인 가구');
  if(p.incomeScope)entered.push(optionLabel('incomeScope',p.incomeScope));
  if(p.monthlyIncome!=null)entered.push('월소득 '+amount(p.monthlyIncome));
  if(p.totalAssets!=null)entered.push('총자산 '+amount(p.totalAssets));
  if(p.carValue!=null)entered.push('자동차 '+amount(p.carValue));
  if(p.dualIncome)entered.push('맞벌이 '+optionLabel('dualIncome',p.dualIncome));
  // Only amounts already bound to this exact notice and source hash are passed in.
  const match=incomeGuide?.rows.find(r=>r.people===p.householdSize);
  if(match)focused.push({label:`${p.householdSize}인 가구 기본 월소득 한도`,text:amount(match.monthlyWon)+' 이하',evidence:{sourceUrl:incomeGuide.sourceUrl,page:incomeGuide.page}});
  const householdRows=rows.filter(r=>r.label===`${p.householdSize}인 가구 월소득`);
  if(!match&&householdRows.length===1){
   const row=householdRows[0],m=row.text.match(/^일반 ([\d,]+)원 · 맞벌이 ([\d,]+)원 이하$/);
   focused.push(m&&p.dualIncome?{...row,text:`${p.dualIncome==='yes'?'맞벌이':'일반'} ${m[p.dualIncome==='yes'?2:1]}원 이하`}:row);
  }
  if(p.householdSize&&!focused.length)notes.push(`${p.householdSize}인 가구의 확정된 금액표가 없어 원문 확인이 필요해요.`);
  if(p.incomeScope&&p.incomeScope!=='household'&&focused.length)notes.push('이 금액표는 가구 기준이에요. 입력한 소득의 합산 범위와 다를 수 있어요.');
  notes.push('기본 한도와 입력값을 나란히 표시해요. 순위·맞벌이·출산 가산·면제와 공식 산정 금액은 원문에서 확인해주세요.');
 }
 const labels=new Set(groupLabels[p.targetGroup]||[]);
 if(p.maritalStatus==='engaged')labels.add('예비신혼부부');
 if(p.maritalStatus==='married'){labels.add('신혼부부');labels.add('혼인가구');if(p.childrenCount>0)labels.add('자녀가 있는 혼인가구');}
 if(criterion!=='income'||!focused.length)focused.push(...rows.filter(r=>labels.has(r.label)));
 if(!focused.length&&criterion==='house')focused.push(...rows.filter(r=>r.label==='가구 기준'));
 return {entered,focused,notes};
}
