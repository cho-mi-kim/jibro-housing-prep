import {evidenceNoticeKey} from './noticeEvidence.mjs';

// Match complete, scoped clauses, and carry the exact source with every result.
// The same parser is used for live excerpts and for verified full-page exports.
export function readableConditions(evidence=[],title=''){
 const result={age:[],house:[],income:[],family:[]};
 const add=(key,label,text,e,proof)=>{
  if(!result[key].some(r=>r.label===label&&r.text===text))result[key].push({label,text,evidence:{...e,quote:proof}});
 };
 for(const e of evidence){
  const raw=e.quote||'',q=raw.replace(/\s/g,'');
  // Application forms and scoring tables must not become general requirements.
  if(/^\s*(?:\[별지|\[붙임|별지\s*제|서식\s*제)/.test(raw)||/공급신청서접수번호|개인정보수집.*동의서/.test(q))continue;
  const relaxed=/완화|배제|미적용/.test(title);
  const rule=(key,label,re,text)=>{
   const m=q.match(re);if(!m)return;
   if(key==='family'&&relaxed&&/\d/.test(m[0])&&!/완화조건/.test(m[0]))return;
   // Recover original whitespace for the evidence disclosure.
   let pos=0,start=-1,end=0;
   for(let i=0;i<raw.length;i++)if(!/\s/.test(raw[i])){if(pos===m.index)start=i;pos++;if(pos===m.index+m[0].length){end=i+1;break;}}
   add(key,label,typeof text==='function'?text(m):text,e,raw.slice(start,end));
  };
  rule('age','기본 연령',/(?:미성년자\([^)]*19세[^)]*\)는[^.]{0,30}(?:신청할|신청하실)수없습니다[.]?(?:단|다만)[^。]{0,160}?미성년자도(?:공급)?신청(?:이)?가능합니다|신청자는민법상성년자\([^)]*\)이어야합니다[.]단[^.]{0,50}미성년자도신청가능합니다)/,'성년자 신청 · 일부 미성년자는 예외 허용');
  rule('age','청년',/무주택자인미혼청년으로서[^①]{0,80}①(\d{1,2})세이상(\d{1,2})세이하인사람[^②]{0,80}②대학생\(입학[·ㆍ]복학예정자포함\)③취업준비생\([^)]*\)[*＊]①에해당되지않는사람만②또는③으로신청/,m=>`${m[1]}~${m[2]}세 · 나이 밖은 대학생·취업준비생 요건 확인`);
  rule('age','청년',/(?:청년[:：]|\(청년\)|【청년】)(만)?(\d{1,2})세이상(\d{1,2})세이하(?:인사람|이며혼인중이아닌사람)/,m=>`${m[1]||''}${m[2]}~${m[3]}세`);
  rule('age','고령자',/\(고령자\)[^①]{0,25}(만)?(\d{2})세이상인사람/,m=>`${m[1]||''}${m[2]}세 이상`);
  rule('age','일반공급',/■일반공급대상자[^①]{0,120}요건을모두갖춘(\d{2})세이상인자/,m=>`${m[1]}세 이상`);
  rule('age','거주지·연령 요건',/거주하는(만)?(\d{2})세이상의성년자인무주택세대구성원/,m=>`해당 공고의 거주지 요건 충족 · ${m[1]||''}${m[2]}세 이상 성년자`);
  rule('age','기숙사형 청년',/무주택자인미혼청년으로서소득기준을충족하는,①대학교및대학원재학생\(입학[·ㆍ]복학예정자포함\)②(\d{2})세이상(\d{2})세이하인사람[^*]{0,80}[*]②은3순위에한하여신청가능합니다/,m=>`대학·대학원생 · ${m[1]}~${m[2]}세는 3순위 신청`);
  rule('family','청년',/무주택자인미혼청년으로서소득및자산기준을충족하는/,'현재 혼인 중이 아닌 사람');
  rule('family','청년',/무주택자인미혼청년으로서소득기준을충족하는/,'현재 혼인 중이 아닌 사람');
  rule('family','청년 전세임대',/신청일현재본인이무주택자이면서혼인중이아닌대학생1\),취업준비생2\),(\d{2})[~∼](\d{2})세3\)로신청자격아래1순위유형중어느하나에해당하는자/,m=>`미혼 대학생·취업준비생 또는 ${m[1]}~${m[2]}세 · 1순위 요건 필요`);
  rule('family','신혼부부',/(?<!예비)신혼부부[:：]공고일현재혼인(\d{1,2})년이내\(혼인신고일[^)]*\)인사람/,m=>`혼인 ${m[1]}년 이내`);
  rule('family','예비신혼부부',/예비신혼부부[:：]공고일현재혼인예정인사람으로서입주일전일까지혼인신고를하는사람/,'입주일 전일까지 혼인신고');
  rule('family','예비신혼부부',/\(예비신혼부부\)혼인을계획중이며입주전까지혼인사실을증명할수있을것/,'입주 전까지 혼인 사실 증명');
  rule('family','한부모가족',/한부모가족[:：](\d{1,2})세이하자녀를둔모자가족또는부자가족\([^)]*태아\)/,m=>`${m[1]}세 이하 자녀 양육 · 태아 포함`);
  rule('family','한부모가족',/\(한부모가족\)(【완화조건】)?(만)?(\d{1,2})세이하자녀를둔한부모인자\(태아포함\)/,m=>`${m[2]||''}${m[3]}세 이하 자녀 양육 · 태아 포함${m[1]?' (완화)':''}`);
  rule('family','자녀가 있는 혼인가구',/유자녀혼인가구[:：](\d{1,2})세이하자녀가있는혼인가구\([^)]*태아\)/,m=>`${m[1]}세 이하 자녀 · 태아 포함`);
  rule('family','신생아 가구',/신생아가구[:：](\d{1,2})년이내출산한자녀가있는가구\([^)]*입양[^)]*태아\)/,m=>`${m[1]}년 이내 출산 · 해당 입양자녀·태아 포함`);
  rule('family','혼인가구',/⑥혼인가구[:：]공고일현재혼인한가구/,'공고일 현재 혼인한 가구');
  rule('family','다자녀 가구',/신청일현재무주택세대구성원으로서(\d+)명이상의직계비속\(태아를포함하며「민법」상(\d+)세미만미성년자로한정\)을양육하는가구/,m=>`${m[2]}세 미만 자녀 ${m[1]}명 이상 양육 · 태아 포함`);
  rule('family','함께 확인할 사람',/세대구성원(?:의범위)?(?:\(자격검증대상\))?비고[•·]신청자(?:및배우자|[^•]{0,100}[•·]신청자의배우자)/,'본인과 배우자(있는 경우)');
  rule('family','따로 사는 배우자',/신청자와(?:주민등록(?:표)?상)?세대분리되어있는배우자(?:도세대구성원에포함|\(이하[‘']분리배우자[’']\)포함)/,'세대가 분리되어 있어도 포함');
  if(!relaxed){
   rule('house','청년',/무주택자인미혼청년으로서소득및자산기준을충족하는/,'신청자 본인에게 집이 없어야 해요');
   rule('house','가구 기준',/무주택세대구성원[:：]아래표의세대구성원전원이주택\(분양권등포함\)을소유하고있지않은세대의구성원/,'본인과 해당 세대원 모두 무주택 · 분양권 등 포함');
  }
  rule('income','소득',/소득기준[:：]도시근로자가구원수별가구당월평균소득요건배제/,'소득 요건 적용 안 함');
  rule('income','소득',/【완화조건】소득요건배제/,'소득 요건 적용 안 함');
  rule('income','소득·자산',/소득및자산기준충족여부(?:등)?(?:과|와)관계없이신청(?:및계약이가능|가능)/,'소득·자산 기준 충족 여부와 관계없이 신청');
  rule('income','총자산·자동차',/【완화조건】총자산가액요건은배제하나,총자산중자동차가액은([\d,]+)만원이하일것/,m=>`총자산 요건 제외 · 자동차 ${m[1]}만원 이하`);
  rule('income','대학생 자산',/신청자본인의총자산가액합산기준이([\d,]+)만원이하이고,자동차가액산출대상자동차를소유하고있지않을것[^《]{0,30}《대학생계층/,m=>`본인 총자산 ${m[1]}만원 이하 · 자동차 소유 불가`);
  if(!relaxed){
   rule('income','청년 2순위',/본인과부모의월평균소득이전년도도시근로자가구원수별국민임대주택자산기준충족2순위가구당월평균소득의100%이하-총자산([\d,]+)만원이하,-\(1인\)([\d,]+)원,\(2인\)([\d,]+)원,\(3인\)([\d,]+)원자동차([\d,]+)만원이하/,m=>`본인·부모 합산 · 1인 ${m[2]}원 / 2인 ${m[3]}원 / 3인 ${m[4]}원 이하`);
   rule('income','청년 3순위',/본인의월평균소득이전년도도시근로자1인가구행복주택\(청년\)자산기준충족3순위월평균소득의100%이하-총자산([\d,]+)만원이하,-\(1인\)([\d,]+)원자동차([\d,]+)만원이하/,m=>`본인 소득 ${m[2]}원 · 총자산 ${m[1]}만원 · 자동차 ${m[3]}만원 이하`);
  }
  // These tables already include small-household allowances. Read actual cells;
  // never calculate missing cells or borrow another notice's annual amounts.
  if(!relaxed&&/신혼|신생아/.test(title)&&/소득[·žㆍ]?자산기준/.test(q)&&/구분1인가구2인가구3인가구4인가구/.test(q)&&/1인가구는20%p,2인가구는10%p가산/.test(q)){
   for(const [base,dual] of [[70,90],[130,200]]){
    if(!new RegExp('월평균소득의'+base+'%이하').test(q)||!new RegExp('본인(?:및|과)배우자모두소득이있는경우'+dual+'%이하').test(q))continue;
    const cells=percent=>[...raw.matchAll(new RegExp('(?:^|\\n)\\s*'+percent+'%\\s+([\\d,]+)원?\\s+([\\d,]+)원?\\s+([\\d,]+)원?\\s+([\\d,]+)원?','g'))];
    const basic=cells(base),working=cells(dual);
    if(basic.length!==1||working.length!==1)continue;
    const a=basic[0].slice(1),b=working[0].slice(1);
    if(!a.every((v,i)=>/^\d{1,3}(,\d{3}){2}$/.test(v)&&/^\d{1,3}(,\d{3}){2}$/.test(b[i])&&+v.replaceAll(',','')<+b[i].replaceAll(',','')))continue;
    const start=raw.search(/■\s*소득/),proof=raw.slice(start>=0?start:0);
    for(let i=0;i<4;i++)add('income',`${i+1}인 가구 월소득`,`일반 ${a[i]}원 · 맞벌이 ${b[i]}원 이하`,e,proof);
    rule('income','기본 총자산',/-총자산([\d,]+)만원이하/,m=>`${m[1]}만원 이하 · 출산자녀 가산 별도`);
    if(base===70)rule('income','기본 자동차',/자동차([\d,]+)만원이하/,m=>`${m[1]}만원 이하 · 출산자녀 가산 별도`);
    rule('income','검증 예외',/수급자,지원대상한부모가족,차상위계층은소득[·ㆍ]자산검증불필요\(예비신혼부부제외\)/,'수급자·지원대상 한부모·차상위는 검증 제외(예비신혼 제외)');
   }
  }
 }
 for(const key of Object.keys(result)){
  // Do not resolve contradictory versions of a rule by source order.
  result[key]=result[key].filter(r=>!result[key].some(other=>other.label===r.label&&other.text!==r.text));
 }
 if(result.family.some(r=>!['함께 확인할 사람','따로 사는 배우자'].includes(r.label)))result.family=result.family.filter(r=>!['함께 확인할 사람','따로 사는 배우자'].includes(r.label));
 return result;
}

export function matchingReadableGuide(data,guides){
 const key=evidenceNoticeKey(data?.noticeUrl),guide=guides?.[key];
 if(!guide||evidenceNoticeKey(guide.noticeUrl)!==key)return null;
 const rows=Object.values(guide.criteria).flat();
 if(!rows.length)return null;
 if(!rows.every(r=>data.sources?.some(s=>s.id===r.evidence.sourceId&&s.url===r.evidence.sourceUrl&&s.sha256===r.evidence.sha256)))return null;
 return guide.criteria;
}
