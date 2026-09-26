import {ApplicantQuestion} from './ApplicantQuestion.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {ArrowRight,Check,ChevronLeft} from 'lucide-react';
import {ApplicantConsent} from './ApplicantProfile.jsx';
import {APPLICANT_CONSENT_VERSION,normalizeApplicantProfile} from './applicantProfile.mjs';
import {signupFields,signupNickname,signupSteps,temporaryNickname,updateSignupProfile,validateSignupStep} from './signupFlow.mjs';
import './signupWizard.css';

export function SignupWizard({onRegister,onLogin,onBack,onLegal,busy,error,pendingNotice,PasswordField}){
 const [temporary]=useState(temporaryNickname),[account,setAccount]=useState(()=>({nickname:temporary,email:'',password:'',confirmation:''}));
 const [automatic,setAutomatic]=useState(true),[step,setStep]=useState('nickname'),[opted,setOpted]=useState(null),[profileConsent,setProfileConsent]=useState(false),[profile,setProfile]=useState({}),[agreements,setAgreements]=useState({terms:false,privacy:false,age:false}),[localError,setLocalError]=useState('');
 const heading=useRef(null),submitting=useRef(false);
 const steps=signupSteps(opted,profile),index=steps.indexOf(step),field=signupFields.find(f=>f.key===step),final=step==='agreements';
 const phase=['nickname','email','password'].includes(step)?1:final?3:2;
 const titles={nickname:'어떤 이름으로 불러드릴까요?',email:'로그인에 사용할 이메일을 알려주세요',password:'비밀번호를 설정해주세요','profile-choice':'내 조건에 맞춰 공고를 볼까요?',agreements:'마지막으로 동의 내용을 확인해주세요'};
 const descriptions={nickname:'이름을 입력하지 않아도 임시 닉네임으로 시작할 수 있어요.',email:'이 이메일로 로그인할 수 있어요.',password:'12~128자로 입력하고, 한 번 더 확인해주세요.','profile-choice':'입력한 조건과 공고 기준을 나란히 보여드려요. 가입 후에도 입력하거나 수정할 수 있어요.',agreements:'필수 항목을 확인하면 가입이 완료돼요.'};
 useEffect(()=>{setLocalError('');window.scrollTo({top:0,behavior:'instant'});heading.current?.focus({preventScroll:true});},[step]);
 const setAccountField=(key,value)=>setAccount(a=>({...a,[key]:value}));
 const setProfileField=value=>setProfile(p=>updateSignupProfile(p,step,value));
 const goBack=()=>{if(index>0)setStep(steps[index-1]);else onBack();};
 async function submit(e){
  e.preventDefault();if(busy||submitting.current)return;
  const problem=validateSignupStep(step,account,profile,opted,profileConsent);
  if(problem){setLocalError(problem);return;}
  if(!final){setStep(steps[index+1]);return;}
  for(const key of ['email','password','profile-choice']){const message=validateSignupStep(key,account,profile,opted,profileConsent);if(message){setStep(key);setLocalError(message);return;}}
  if(!agreements.terms||!agreements.privacy||!agreements.age){setLocalError('필수 동의 내용을 모두 확인해주세요.');return;}
  let applicantProfile=null;try{if(opted)applicantProfile=normalizeApplicantProfile({...profile,consent:profileConsent,consentVersion:APPLICANT_CONSENT_VERSION});}catch(e){setLocalError(e.message);return;}
  submitting.current=true;
  try{await onRegister({nickname:signupNickname(account.nickname,temporary),email:account.email.trim(),password:account.password,...agreements,applicantProfile});}finally{submitting.current=false;}
 }
 function skip(){setProfileField('');setLocalError('');const next=signupSteps(opted,updateSignupProfile(profile,step,''));setStep(next[next.indexOf(step)+1]);}
 return <section className="account-page signup-wizard" aria-labelledby="signup-title">
  <div className="signup-top"><button type="button" className="account-back" onClick={goBack} disabled={busy} aria-label={index?'이전 단계':'가입 화면 나가기'}><ChevronLeft size={20}/>{index?'이전':'돌아가기'}</button><span>회원가입</span><button type="button" className="signup-login" disabled={busy} onClick={onLogin}>로그인</button></div>
  <div className="signup-progress" role="progressbar" aria-label="회원가입 진행" aria-valuemin={1} aria-valuemax={3} aria-valuenow={phase} aria-valuetext={`${phase}단계 · ${phase===1?'계정 정보':phase===2?'내 신청 조건':'동의 확인'}`}>
   {['계정 정보','내 신청 조건','동의 확인'].map((name,i)=><span key={name} className={phase>=i+1?'reached':''} aria-hidden="true"><i/>{name}</span>)}
  </div>
  <form className="signup-step-form" onSubmit={submit} noValidate aria-busy={busy}>
   <div className="signup-step-content" key={step}>
    {field&&<p className="signup-step-count">내 신청 조건 · {index-3}/{steps.length-5}</p>}
    <h1 id="signup-title" ref={heading} tabIndex={-1}>{field?.title||titles[step]}</h1>
    {(field?.help||descriptions[step])&&<p className="account-lead">{field?.help||descriptions[step]}</p>}
    <fieldset className="signup-inputs" disabled={busy}>
     <legend className="sr-only">{field?.label||titles[step]}</legend>
     {step==='nickname'&&<><label className="account-field">닉네임 <small>선택</small><input name="nickname" value={account.nickname} maxLength={16} autoComplete="nickname" placeholder="닉네임을 입력해주세요" onFocus={()=>{if(automatic){setAutomatic(false);setAccountField('nickname','');}}} onChange={e=>{setAutomatic(false);setAccountField('nickname',e.target.value);}}/></label><p className="account-help">미입력 시 <b>{temporary}</b>로 시작해요.</p></>}
     {step==='email'&&<><label className="account-field">이메일<input name="email" type="email" inputMode="email" required maxLength={254} value={account.email} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="name@example.com" onChange={e=>setAccountField('email',e.target.value)}/></label><p className="account-help">이메일 인증과 비밀번호 재설정 메일은 아직 제공하지 않아요. 주소를 정확히 입력해주세요.</p></>}
     {step==='password'&&<div className="signup-passwords"><PasswordField value={account.password} onChange={e=>setAccountField('password',e.target.value)} autoComplete="new-password" minLength={12}/><PasswordField label="비밀번호 확인" name="confirmation" value={account.confirmation} onChange={e=>setAccountField('confirmation',e.target.value)} autoComplete="new-password" minLength={12}/></div>}
     {step==='profile-choice'&&<><div className="signup-choices" role="radiogroup" aria-label="내 신청 조건 입력 여부">{[[true,'지금 입력할게요','내 가구에 관련된 공고 기준부터 확인해요'],[false,'나중에 입력할게요','가입부터 하고, 필요할 때 입력해요']].map(([value,label,description])=><label key={String(value)} className={opted===value?'chosen':''}><input type="radio" name="profileChoice" checked={opted===value} onChange={()=>{setOpted(value);setLocalError('');if(!value){setProfileConsent(false);setProfile({});}}}/><span><strong>{label}</strong><small>{description}</small></span><Check size={20} aria-hidden="true"/></label>)}</div>{opted===true&&<ApplicantConsent checked={profileConsent} onChange={setProfileConsent} disabled={busy}/>}</>}
     {field&&<ApplicantQuestion field={field} value={profile[step]} onChange={setProfileField} disabled={busy}/>}
     {final&&<><div className="signup-review"><div><span>닉네임<strong>{signupNickname(account.nickname,temporary)}</strong></span><button type="button" onClick={()=>setStep('nickname')}>수정</button></div><div><span>이메일<strong>{account.email}</strong></span><button type="button" onClick={()=>setStep('email')}>수정</button></div><div><span>내 신청 조건<strong>{opted?'입력한 조건으로 공고 보기':'가입 후 나중에 입력'}</strong></span><button type="button" onClick={()=>setStep('profile-choice')}>수정</button></div></div>
      <fieldset className="account-consents"><legend>가입에 필요한 동의</legend>{[['terms','이용약관 동의','이용약관 보기','terms'],['privacy','개인정보 수집·이용 동의','개인정보 수집·이용 안내 보기','privacy'],['age','만 14세 이상이에요']].map(([key,label,legalLabel,kind])=><div key={key}><label><input type="checkbox" name={key} checked={agreements[key]} onChange={e=>setAgreements(a=>({...a,[key]:e.target.checked}))}/><span><b>[필수]</b> {label}</span></label>{kind&&<button type="button" aria-label={legalLabel} onClick={()=>onLegal(kind)}>보기</button>}</div>)}</fieldset>
      {pendingNotice&&<details className="signup-pending"><summary>가입 후 이어갈 공고</summary><p>{pendingNotice.title}</p></details>}</>}
    </fieldset>
   </div>
   {(localError||(final&&error))&&<p className="account-error" role="alert">{localError||error}</p>}
   <div className="signup-step-actions">
    {field&&<button className="signup-skip" type="button" onClick={skip} disabled={busy}>이 항목은 나중에 입력</button>}
    <button className="primary account-submit" disabled={busy} type="submit">{busy?'가입 중…':final?'동의하고 가입하기':'다음'}<ArrowRight size={18} aria-hidden="true"/></button>
   </div>
  </form>
 </section>;
}
