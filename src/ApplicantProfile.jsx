import {ApplicantEditor} from './ApplicantEditor.jsx';
import React,{useState} from 'react';
import {ChevronRight,ChevronLeft,UserRound,ExternalLink} from 'lucide-react';
import {APPLICANT_CONSENT_VERSION,profileOptions,normalizeApplicantProfile,koreaDate,profileSummary,personalCondition} from './applicantProfile.mjs';
import {evidenceSourceLink} from './noticeEvidence.mjs';
import './applicantProfile.css';

export function ApplicantFields({value={},onChange,disabled=false}){
 const set=(key,val)=>onChange({...value,[key]:val});
 const select=(key,label)=> <label className="applicant-field" key={key}>{label}<select value={value[key]||''} onChange={e=>set(key,e.target.value)}><option value="">모르겠어요 / 나중에 입력</option>{profileOptions[key].map(([id,text])=><option key={id} value={id}>{text}</option>)}</select></label>;
 const date=(key,label)=> <label className="applicant-field" key={key}>{label}<input type="date" min="1900-01-01" max={koreaDate()} value={value[key]||''} onChange={e=>set(key,e.target.value)}/></label>;
 const number=(key,label,max,unit='명',money=false)=> <label className="applicant-field" key={key}>{label}<span className="applicant-number"><input type="number" inputMode="numeric" min={key==='householdSize'?1:0} max={max} step="1" value={value[key]??''} onChange={e=>set(key,e.target.value===''?'':Number(e.target.value))} placeholder="모르면 비워두세요"/><span>{unit}</span></span>{money&&value[key]!==''&&value[key]!=null&&<small>{new Intl.NumberFormat('ko-KR').format(value[key])}원</small>}</label>;
 return <fieldset className="applicant-fields" disabled={disabled}><legend>공고를 볼 때 사용할 내 조건</legend><p>모르는 항목은 비워두세요. 저장한 조건은 언제든 수정할 수 있어요.</p>
  <div className="applicant-grid">{date('birthDate','생년월일 · 만 나이 계산')}{select('targetGroup','먼저 볼 신청 대상')}{select('selfHome','본인 주택·분양권 보유 여부')}{select('householdHome','해당 세대원의 주택·분양권 보유 여부')}{number('householdSize','공고 기준 가구원 수',20)}{select('maritalStatus','혼인 상태')}</div>
  <p className="applicant-help">가구원은 단순 동거 인원과 달라요. 공고의 세대구성원 범위를 확인해주세요.</p>
  <details className="applicant-more"><summary>가족·자녀 정보</summary><div className="applicant-grid">{value.maritalStatus==='married'&&<>{date('marriageDate','혼인신고일')}{select('dualIncome','본인과 배우자 모두 소득이 있나요?')}</>}{number('childrenCount','미성년 자녀 수',20)}{value.childrenCount!==0&&date('youngestChildBirthDate','막내 자녀 생년월일')}{select('householdRole','세대주 여부')}</div><p className="applicant-help">입양·태아, 한부모 인정 범위와 예외는 해당 공고에서 확인해요. 가족의 이름이나 주민등록번호는 입력하지 않아요.</p></details>
  <details className="applicant-more"><summary>소득·자산 정보</summary><div className="applicant-grid">{select('incomeScope','입력 금액의 합산 범위')}{number('monthlyIncome','세전 월평균 소득',10000000000,'원',true)}{number('totalAssets','총자산 가액',1000000000000,'원',true)}{number('carValue','자동차 가액',10000000000,'원',true)}</div><p className="applicant-help">모르면 비워두세요. 0원을 입력하면 소득·자산이 없는 것으로 기록해요. 구매 가격과 공고의 자산 산정 가액은 다를 수 있어요.</p></details>
  <details className="applicant-more"><summary>거주·청약 정보</summary><div className="applicant-grid">{select('residenceRegion','현재 주민등록 지역')}{date('residenceSince','현재 지역 전입일')}{number('subscriptionCount','청약통장 인정 납입 횟수',1200,'회')}</div><p className="applicant-help">지역 우선순위·거주 기간·납입 인정 기준은 공고 원문과 비교해서 확인해요.</p></details>
 </fieldset>;
}
export function ApplicantConsent({checked,onChange,disabled=false}){return <div className="applicant-consent"><label><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} disabled={disabled}/><span><b>[선택] 내 조건 저장·활용에 동의해요</b></span></label><p>생년월일, 주택·가구·혼인·자녀, 소득·자산, 거주·청약 정보 중 직접 입력한 항목을 공고 기준 안내에 사용해요. 내 계정에 보관하며 동의 철회 또는 회원 탈퇴 시 삭제해요. 동의하지 않아도 가입과 공고 열람이 가능해요.</p></div>}
export function ApplicantSignup({value,onChange,disabled}){
 const opted=value?.consent===true;
 return <section className="applicant-signup"><h2>내 조건에 맞춰 공고 보기 <small>선택</small></h2><p>생년월일과 가구 정보를 입력하면 내 조건과 공고 기준을 나란히 볼 수 있어요.</p><ApplicantConsent checked={opted} disabled={disabled} onChange={checked=>onChange(checked?{consent:true,consentVersion:APPLICANT_CONSENT_VERSION}:null)}/>{opted&&<ApplicantFields value={value} onChange={onChange} disabled={disabled}/>}</section>;
}
export function ApplicantSettings(props){return <ApplicantEditor {...props} Consent={ApplicantConsent}/>;}
export function ApplicantBanner({profile,onEdit}){return <button type="button" className="applicant-banner" onClick={onEdit}><UserRound size={21} aria-hidden="true"/><span><b>{profile?'내 조건으로 기준 확인':'내 신청 조건 입력하기'}</b><small>{profileSummary(profile)}</small></span><ChevronRight size={18} aria-hidden="true"/></button>}
export function PersonalCriterion(props){
 const view=personalCondition(props);if(!view)return null;
 return <section className="personal-criterion" aria-label="내 조건 참고"><span className="personal-label">내 입력 정보</span><p>{view.entered.join(' · ')||'아직 입력하지 않았어요'}</p>{view.focused.length>0&&<div className="personal-matches"><b>먼저 확인할 공고 기준</b>{view.focused.map((r,i)=><div key={r.label+i}><span>{r.label}</span><strong>{r.text}</strong>{evidenceSourceLink(r.evidence?.sourceUrl,r.evidence?.page)&&<a href={evidenceSourceLink(r.evidence.sourceUrl,r.evidence.page)} target="_blank" rel="noreferrer" aria-label={`${r.label} 근거 원문 보기`}>근거 원문<ExternalLink size={13}/></a>}</div>)}</div>}<details><summary>추가로 확인할 점</summary>{view.notes.map(n=><p key={n}>{n}</p>)}</details></section>;
}
