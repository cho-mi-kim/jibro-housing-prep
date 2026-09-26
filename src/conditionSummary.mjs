import {familyConditionGuide} from './familyGuide.mjs';
// Extractive summaries only: retain complete source clauses and never invent thresholds.
const terms={age:/\d{1,2}\s*세(?!대)/,house:/무주택|주택\s*소유/,income:/소득|총자산|자산가액|자동차.*가액/,family:/세대구성원|가구원|혼인|한부모|배우자/};
const markers=/^(?:[•▪■◾○●※①-⑳]|[-*]\s|\d+[.)]\s)/;
const complete=/(?:다[.!]|사람|인\s*자|일\s*것|세대구성원)(?:\s*\([^)]*\))?\s*$/;
const clean=text=>text.replace(/^[•▪■◾○●①-⑳\s]+/,'').replace(/^[-*]\s+/,'').trim();
function units(quote,key){
 const result=[];let current='';
 const flush=()=>{if(current.trim())result.push(clean(current));current='';};
 for(const raw of quote.split(/\r?\n/)){
  const line=raw.trim();if(!line||/^-?\s*\d+\s*-?$/.test(line))continue;
  if(markers.test(line))flush();
  current+=(current?' ':'')+line;
  if(complete.test(line)||(key==='income'&&/(%|퍼센트|만원|백만원).*이하[,，]?\s*$/.test(line))||(key==='family'&&/(혼인|한부모|자녀).*경우\s*$/.test(line)))flush();
 }
 flush();return result;
}
export function summarizeCondition(key,evidence=[],noticeTitle=''){
 const pattern=terms[key];if(!pattern||!evidence.length)return {items:[],note:null};
 const context=evidence.map(e=>e.quote||'').join('\n');
 const relaxed=/완화|배제|미적용|폐지|상관없이|적용하지/.test(context);
 const noticeRelaxed=/완화|배제|미적용/.test(noticeTitle);
 const exception=/예외|단[,，\s]|다만|제외|별도|경우|공급대상|계층|순위/.test(context);
 const candidates=[];
 evidence.forEach((e,sourceIndex)=>{
  const clauses=units(e.quote||'',key);
  for(let index=0;index<clauses.length;index++){
   let text=clauses[index];
   const next=clauses[index+1];
   // Keep the immediately following exception with its numeric rule.
   if(next&&(/^(?:※\s*)?(?:단[,，\s]|다만)/.test(next)||(key==='house'&&/^※/.test(next)))){
    if(text.length+next.length+1>220)continue;
    text+=' '+next;
   }
   if(text.length<12||text.length>220||!pattern.test(text))continue;
   // Reject cropped phrases, table headings, consent forms and procedural help.
   if(!complete.test(text)&&!(key==='income'&&/(%|퍼센트|만원|백만원).*이하[,，]?\s*$/.test(text))&&!(key==='family'&&/(혼인|한부모|자녀).*경우\s*$/.test(text)))continue;
   if(/서명|날인|법정대리인.*동의서|현장\s*접수|인터넷.*어려|판단\s*기준일/.test(text))continue;
   if(key==='age'&&/자녀|한부모|형제|자매|직계존속|부양|현장|접수/.test(text))continue;
   if(key==='family'&&/순위/.test(e.quote||''))continue;
   if(/아래의?\s*요건|[①-⑳➀-➉].*[②-⑳➀-➉]/.test(text))continue;
   if(key==='family'&&/소득|자산|자동차|전산|검증|분양전환/.test(text))continue;
   if(key==='house'&&/분양전환|계약해지|서류제출|전산|검증/.test(text))continue;
   if(key==='income'&&(!/소득|총자산|자동차|자산가액/.test(text)||!/신청자|가구|세대|본인|배우자|부모|청년|신혼|고령|상관없이|배제|미적용/.test(text)))continue;
   // A numeric table cell without its target group is not a safe stand-alone summary.
   if(/^[\d,%.\s|]+$/.test(text)||text.includes(' | '))continue;
   const hasRelaxation=/완화|배제|미적용|폐지|상관없이|적용하지/.test(text);
   // Do not present an ordinary income/housing threshold as a relaxed notice's rule.
   if(relaxed&&['income','house'].includes(key)&&!hasRelaxation)continue;
   const focus=(e.focus||'').split(/\r?\n/)[0].trim();
   if(!focus||!text.replace(/\s/g,'').includes(clean(focus).replace(/\s/g,'')))continue;
   let score=(focus&&text.includes(clean(focus))?10:0)+(hasRelaxation?8:0);
   if(key==='age'&&/청년|성년|신청/.test(text))score+=5;
   if(key==='family'&&/혼인기간|혼인\s*중|한부모|세대구성원의\s*범위/.test(text))score+=5;
   candidates.push({text,sourceIndex,score});
  }
 });
 const seen=new Set();const items=candidates.sort((a,b)=>b.score-a.score).filter(item=>{
  const normalized=item.text.replace(/\s/g,'');if(seen.has(normalized))return false;seen.add(normalized);return true;
 }).slice(0,1).map(({text,sourceIndex})=>({text,sourceIndex}));
 const note=(relaxed||noticeRelaxed)?'완화·배제 내용이 포함돼 있어요. 적용 대상과 예외는 원문에서 확인하세요.':exception?'일부 대상의 기준을 요약했어요. 다른 대상과 예외는 원문에서 확인하세요.':'원문 일부를 요약했어요. 전체 조건은 원문에서 확인하세요.';
 return {items,note};
}

// A short orientation, not an eligibility decision. Detailed evidence stays below it.
export function plainConditionSummary(key,evidence=[],noticeTitle=''){
 const context=evidence.map(e=>e.quote||'').join(' ');
 if(!context.trim())return '공고 원문에서 확인해주세요';
 if(key==='age'){
  // Require both the general restriction and its explicit exception in one source.
  // Ignore unrelated minor-child points and guardian-consent instructions.
  const adultWithException=evidence.some(e=>{
   const quote=(e.quote||'').replace(/\s/g,'');
   return /미성년자(?:\([^)]*\))?는(?:공급)?신청할수없습니다[.]?단[,，]?[^.]{0,90}미성년자도(?:공급)?신청가능합니다/.test(quote);
  });
  if(adultWithException)return '성년자 신청 가능 · 일부 미성년자는 예외 허용';
  const brief=summarizeCondition(key,evidence,noticeTitle);
  for(const {text} of brief.items){
   const age=text.match(/(청년|고령자|신청자)[^\d]{0,12}?(만\s*)?(\d{1,2})\s*세\s*이상\s*(\d{1,2})\s*세\s*이하/);
   if(age)return `${age[1]}: ${age[2]?'만 ':''}${age[3]}~${age[4]}세`;
  }
  return '신청 대상에 따라 나이 기준이 달라요';
 }
 if(key==='house'){
  if(/무주택.{0,12}완화/.test(noticeTitle)||/무주택.{0,20}(완화|배제|미적용)/.test(context))return '집 소유 기준의 완화 대상을 확인해요';
  if(/무주택세대구성원/.test(context)&&/무주택자(?!산)/.test(context))return '본인에게 집이 없어야 해요. 대상에 따라 가족도 포함돼요.';
  if(/무주택세대구성원/.test(context))return '본인과 해당 가족에게 집이 없어야 해요';
  if(/무주택자/.test(context))return '신청자 본인에게 집이 없어야 해요';
  return '집 소유 기준을 원문에서 확인해주세요';
 }
 if(key==='income'){
  if(/(소득|자산).{0,15}(배제|완화|미적용)/.test(noticeTitle)||/(소득|자산).{0,30}(배제|미적용|상관없이)/.test(context))return '소득·재산 기준의 완화 대상을 확인해요';
  if(/소득/.test(context)&&/가구원|가구당|맞벌이/.test(context))return '대상·가구원 수에 따라 소득 한도가 달라요';
  if(/소득/.test(context)&&/자산/.test(context))return '소득과 재산이 한도 이하인지 확인해요';
  if(/소득/.test(context))return '소득이 정해진 한도 이하인지 확인해요';
  if(/자산|자동차/.test(context))return '재산·자동차의 금액 한도를 확인해요';
  return '소득·재산 기준을 원문에서 확인해주세요';
 }
 if(key==='family'){
  const guide=familyConditionGuide(evidence,noticeTitle);
  if(guide.rows.length)return `${guide.rows[0].label}: ${guide.rows[0].text}`;
  return '가구원 범위·신청 대상은 아래 원문에서 확인해주세요';
 }
 return '대상별 세부 기준을 원문에서 확인해주세요';
}
