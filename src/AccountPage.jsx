import React,{useState,useEffect,useRef} from 'react';
import {ArrowRight,ChevronLeft,UserRound,Check,LogOut,Trash2,KeyRound,Eye,EyeOff} from 'lucide-react';
import './account.css';
import {EmailAccess,EmailVerification} from './EmailAccess.jsx';
import {SignupWizard} from './SignupWizard.jsx';
function PasswordField({label='비밀번호',name='password',autoComplete='current-password',minLength=1,value,onChange}){
 const [visible,setVisible]=useState(false);
 return <label className="account-field">{label}<span className="account-password"><input aria-label={label} name={name} type={visible?'text':'password'} required minLength={minLength} maxLength={128} autoComplete={autoComplete} value={value} onChange={onChange}/><button type="button" onClick={()=>setVisible(v=>!v)} aria-label={label+(visible?' 숨기기':' 표시')} aria-pressed={visible}>{visible?<EyeOff size={19}/>:<Eye size={19}/>}</button></span></label>
}
export function AccountPage({mode='login',pendingNotice,onLogin,onRegister,onMode,onBack,onLegal,busy,error,testLoginAvailable=false,emailFlow,emailAvailable,onVerified}){
 const titleRef=useRef(null),localPreview=['127.0.0.1','localhost','[::1]'].includes(window.location.hostname)||testLoginAvailable;
 useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});titleRef.current?.focus({preventScroll:true});},[mode]);
 if(mode==='forgot'||mode==='email-link')return <EmailAccess key={mode} flow={mode==='email-link'?emailFlow:null} available={emailAvailable} loading={busy} onBack={()=>onMode('login')} onVerified={onVerified} PasswordField={PasswordField}/>;
 if(mode==='signup')return <SignupWizard pendingNotice={pendingNotice} onRegister={onRegister} onLogin={()=>onMode('login')} onBack={onBack} onLegal={onLegal} busy={busy} error={error} PasswordField={PasswordField}/>;
 return <section className="account-page" aria-labelledby="account-title">
  <button className="account-back" onClick={onBack} disabled={busy}><ChevronLeft size={18} aria-hidden="true"/>돌아가기</button>
  <span className="account-symbol"><UserRound size={28} aria-hidden="true"/></span>
  <h1 id="account-title" ref={titleRef} tabIndex={-1}>로그인</h1><p className="account-lead">내 준비노트를 이어서 확인해요.</p>
  {pendingNotice&&<div className="account-pending"><span>로그인 후 이어갈 공고</span><strong>{pendingNotice.title}</strong><small>선택한 공고로 준비를 시작할 수 있어요.</small></div>}
  <form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);onLogin({email:data.get('email'),password:data.get('password')});}} className="account-form" aria-busy={busy}>
   <label className="account-field">이메일 또는 아이디<input name="email" type="text" required maxLength={254} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder={localPreview?'이메일 또는 admin':'이메일 또는 아이디'}/></label>
   {localPreview&&<p className="account-help">테스트 계정: 아이디 admin · 비밀번호 admin</p>}<PasswordField/>
   {error&&<p className="account-error" role="alert">{error}</p>}
   <button className="primary account-submit" disabled={busy}>{busy?'처리 중…':'로그인'}<ArrowRight size={18} aria-hidden="true"/></button>
   <button className="text-button account-recovery-link" type="button" disabled={busy} onClick={()=>onMode('forgot')}>비밀번호를 잊으셨나요?</button>
  </form>
  <div className="account-switch"><span>처음 이용하나요?</span><button disabled={busy} onClick={()=>onMode('signup')}>회원가입</button></div>
  <div className="account-legal-links"><button onClick={()=>onLegal('terms')}>이용약관</button><button onClick={()=>onLegal('privacy')}>개인정보 처리방침</button></div>
 </section>
}
export function AccountControls({user,onLogin,onLogout,onDelete,onPassword,onLegal,busy,children,emailAvailable,onVerified}){
 return <section className="account-controls" aria-label="계정 관리">{user&&<div className="account-identity"><UserRound size={20} aria-hidden="true"/><span>로그인된 계정<strong>{user.email}</strong></span></div>}<EmailVerification user={user} available={emailAvailable} onVerified={onVerified}/>{children}{user?<><button type="button" onClick={onPassword} disabled={busy}><KeyRound size={18} aria-hidden="true"/>비밀번호 변경</button><button type="button" onClick={onLogout} disabled={busy}><LogOut size={18} aria-hidden="true"/>로그아웃</button><button type="button" onClick={onDelete} className="account-delete" disabled={busy}><Trash2 size={18} aria-hidden="true"/>회원 탈퇴</button></>:<button type="button" className="primary" onClick={onLogin}>로그인 / 회원가입<ArrowRight size={18} aria-hidden="true"/></button>}<div className="account-legal-links"><button type="button" onClick={()=>onLegal('terms')}>이용약관</button><button type="button" onClick={()=>onLegal('privacy')}>개인정보 처리방침</button></div></section>
}
export function PasswordChange({onSave,busy,error}){const [mismatch,setMismatch]=useState('');return <form className="account-form" onSubmit={e=>{e.preventDefault();const d=new FormData(e.currentTarget);setMismatch('');if(d.get('newPassword')!==d.get('confirmation')){setMismatch('새 비밀번호가 서로 달라요.');return;}onSave({currentPassword:d.get('password'),newPassword:d.get('newPassword')});}}><h2 tabIndex={-1} data-settings-focus>비밀번호 변경</h2><PasswordField label="현재 비밀번호"/><PasswordField label="새 비밀번호 · 12자 이상" name="newPassword" autoComplete="new-password" minLength={12}/><PasswordField label="새 비밀번호 확인" name="confirmation" autoComplete="new-password" minLength={12}/><p className="account-help">변경하면 다른 기기에서는 다시 로그인해야 해요.</p>{(mismatch||error)&&<p className="account-error" role="alert">{mismatch||error}</p>}<button className="primary" disabled={busy}>{busy?'변경 중…':'비밀번호 변경하기'}</button></form>}
export function LocalRecordImport({onImport,busy,error}){return <section className="account-import"><span className="account-symbol"><Check size={22} aria-hidden="true"/></span><div><h2>이 기기에 이전 준비 기록이 있어요</h2><p>내 기록이 맞다면 계정으로 가져올 수 있어요. 같은 공고의 계정 기록은 유지해요.</p><button className="secondary" onClick={onImport} disabled={busy}>{busy?'가져오는 중…':'내 기기 기록 가져오기'}</button>{error&&<p className="account-error" role="alert">{error}</p>}</div></section>}
