// Recommendations change order only. They never decide eligibility or exemptions.
export function recommendDocument(doc,profile){
 if(!profile)return null;
 const t=doc.title||'',group=profile.targetGroup,married=profile.maritalStatus==='married'||group==='newlywed',engaged=profile.maritalStatus==='engaged'||group==='engaged';
 if(/예비신혼부부|세대구성확인서/.test(t)&&engaged)return '예비신혼부부로 입력했어요. 혼인 예정·세대 구성 증빙을 먼저 확인해요.';
 if(/혼인관계증명/.test(t)&&(married||engaged))return '혼인 상태를 입력했어요. 발급 대상과 혼인 기준일을 확인해요.';
 if(/출생증명|기본증명/.test(t)&&(group==='newborn'||profile.youngestChildBirthDate))return '자녀 정보를 입력했어요. 출생일·가족관계 증빙을 확인해요.';
 if(/가족관계증명/.test(t)&&(married||engaged||profile.childrenCount>0||profile.householdSize>1))return '입력한 가구원·가족관계에 맞춰 발급 대상을 확인해요.';
 if(/재학증명|입학증명|휴학증명/.test(t)&&group==='student')return '대학생으로 입력했어요. 재학·입학·휴학 중 해당하는 증빙을 확인해요.';
 if(/졸업·수료/.test(t)&&group==='jobseeker')return '취업준비생으로 입력했어요. 졸업 시점과 제출 대상을 확인해요.';
 if(/소득금액증명|소득·납세/.test(t)&&profile.monthlyIncome!==undefined)return '소득을 입력했어요. 본인·가구원 중 누구의 소득을 증명하는지 확인해요.';
 if(/자산 보유/.test(t)&&profile.totalAssets!==undefined)return '자산을 입력했어요. 신고 범위와 면제 여부를 확인해요.';
 if(/청약통장/.test(t)&&profile.subscriptionCount>0)return '청약 납입 횟수를 입력했어요. 순위·가입 증빙을 확인해요.';
 return null;
}
