// These are reading/checklist categories, not an eligibility decision.
export const isFamilyNotice = notice => /신혼|신생아/.test(`${notice?.title||''} ${notice?.type||''}`);
const eligibilityLabels = new Set(['신혼부부','예비신혼부부','신생아 가구']);

export function conditionItemsForNotice(notice,items){
 if(!isFamilyNotice(notice))return items;
 return items.map(item=>item.id==='age'
  ? {id:'eligibility',title:'신혼부부·신생아 기준',desc:'공고의 혼인 기간·혼인 예정·출산 또는 입양 기준을 확인했어요.'}
  : item.id==='family'?{...item,title:'다른 가구 유형·범위',desc:'공고의 다른 신청 대상과 함께 확인할 가구원 범위를 확인했어요.'}:item);
}

export function conditionRowsForNotice(notice,readable){
 if(!isFamilyNotice(notice))return readable;
 const family=readable?.family||[];
 return {...readable,eligibility:family.filter(row=>eligibilityLabels.has(row.label)),family:family.filter(row=>!eligibilityLabels.has(row.label))};
}
