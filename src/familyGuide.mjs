// Keep each household statement attached to its target group and source excerpt.
// These are partial reading aids, not a complete eligibility decision.
export function familyConditionGuide(evidence=[],noticeTitle=''){
 const rows=[];
 const add=(label,text,sourceIndex)=>{
  if(!rows.some(row=>row.label===label&&row.text===text))rows.push({label,text,sourceIndex});
 };
 evidence.forEach((e,sourceIndex)=>{
  const q=(e.quote||'').replace(/\s+/g,'');
  if(!q)return;
  // A points table, priority rule or supporting-document list is not eligibility.
  if(/순위|우선배정|가점|배점|\d+점|증명서|제출서류/.test(q))return;
  const relaxed=/완화|배제/.test(noticeTitle)||/완화조건/.test(q);
  // Do not combine a target from one excerpt with a threshold from another.
  if(!relaxed){
   let m=q.match(/(?<!예비)신혼부부[:：]공고일현재혼인(\d{1,2})년이내\(혼인신고일[^)]*\)인사람/);
   if(m)add('신혼부부',`혼인 ${m[1]}년 이내`,sourceIndex);
   m=q.match(/한부모가족[:：](\d{1,2})세이하자녀를둔모자가족또는부자가족\([^)]*태아\)/);
   if(m)add('한부모가족',`${m[1]}세 이하 자녀 양육 · 태아 포함`,sourceIndex);
   m=q.match(/유자녀혼인가구[:：](\d{1,2})세이하자녀가있는혼인가구\([^)]*태아\)/);
   if(m)add('자녀가 있는 혼인가구',`${m[1]}세 이하 자녀 · 태아 포함`,sourceIndex);
   m=q.match(/신생아가구[:：](\d{1,2})년이내출산한자녀가있는가구\([^)]*입양[^)]*태아\)/);
   if(m)add('신생아 가구',`${m[1]}년 이내 출산 · 해당 입양자녀·태아 포함`,sourceIndex);
  }
  if(/예비신혼부부[:：]공고일현재혼인예정인사람으로서입주일전일까지혼인신고를하는사람/.test(q))add('예비신혼부부','입주일 전일까지 혼인신고',sourceIndex);
  if(/\(예비신혼부부\)혼인을계획중이며입주전까지혼인사실을증명할수있을것/.test(q))add('예비신혼부부','입주 전까지 혼인 사실 증명',sourceIndex);
  // Happy-housing excerpts explicitly label the parent category. Keep that scope.
  let parent=q.match(/\(한부모가족\)(【완화조건】)?(만)?(\d{1,2})세이하자녀를둔한부모인자\(태아포함\)/);
  if(parent&&(!relaxed||parent[1]))add('한부모가족',`${parent[2]||''}${parent[3]}세 이하 자녀 양육 · 태아 포함`,sourceIndex);
  if(/세대구성원(?:의범위|비고|\(자격검증대상\))/.test(q)&&(/•신청자의배우자/.test(q)||/•신청자및배우자/.test(q))){
   add('함께 확인할 사람','본인과 배우자',sourceIndex);
   if(/세대분리되어있는배우자도세대구성원에포함|세대분리되어있는배우자\(이하[‘']분리배우자[’']\)포함/.test(q))add('따로 사는 배우자','세대가 분리되어 있어도 포함',sourceIndex);
  }
 });
 // Conflicting descriptions of one target require the original, not a guess.
 const safe=rows.filter(row=>!rows.some(other=>other.label===row.label&&other.text!==row.text));
 const targets=safe.filter(row=>!['함께 확인할 사람','따로 사는 배우자'].includes(row.label));
 return {rows:targets.length?targets:safe,note:targets.length?'공고에서 확인된 대상별 기준이에요. 다른 대상과 예외는 원문에서 확인하세요.':'배우자가 있는 경우 함께 확인해요. 부모·자녀 등 나머지 가구원 범위는 원문을 확인하세요.'};
}
