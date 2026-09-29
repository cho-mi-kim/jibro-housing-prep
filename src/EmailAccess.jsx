import React,{useEffect,useRef,useState} from 'react';
import {Mail,ChevronLeft,Check,ArrowRight} from 'lucide-react';
import {accountRequest} from './accountClient.mjs';

export function readEmailLink(){
 const params=new URLSearchParams(window.location.hash.slice(1)),action=params.get('action'),token=params.get('token');
 return window.location.pathname==='/auth/complete'&&['verify','reset'].includes(action)?{action,token:typeof token==='string'&&token.length<=2048?token:null}:null;
}
export function EmailAccess({flow,available,loading,onBack,onVerified,PasswordField}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false),heading=useRef(null);
 const action=flow?.action||'forgot',isLink=['verify','reset'].includes(action),validLink=!isLink||!!flow?.token;
 const title=done?(action==='forgot'?'메일함을 확인해주세요':action==='verify'?'이메일 확인 완료':'비밀번호 변경 완료'):action==='verify'?'이메일을 확인해주세요':action==='reset'?'새 비밀번호를 정해주세요':'비밀번호를 잊으셨나요?';
 useEffect(()=>{heading.current?.focus();},[done]);
 async function submit(e){
  e.preventDefault();setError('');const data=new FormData(e.currentTarget);
  if(action==='reset'&&data.get('newPassword')!==data.get('confirmation')){setError('새 비밀번호가 서로 달라요.');return;}
  setBusy(true);
  try{
   if(action==='forgot')await accountRequest('/api/account/request-password-reset',{method:'POST',body:JSON.stringify({email:data.get('email')})});
   else if(action==='verify'){await accountRequest('/api/account/verify-email',{method:'POST',body:JSON.stringify({token:flow.token})});await onVerified?.();}
   else {await accountRequest('/api/account/reset-password',{method:'POST',body:JSON.stringify({token:flow.token,newPassword:data.get('newPassword')})});await onVerified?.();}
   setDone(true);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <section className="account-page" aria-labelledby="email-access-title">
  <button className="account-back" type="button" onClick={onBack} disabled={busy}><ChevronLeft size={18} aria-hidden="true"/>로그인으로 돌아가기</button>
  <span className="account-symbol">{done?<Check size={28} aria-hidden="true"/>:<Mail size={28} aria-hidden="true"/>}</span>
  <h1 id="email-access-title" ref={heading} tabIndex={-1}>{title}</h1>
  {done?<><p className="account-lead" role="status">{action==='forgot'?'가입된 이메일이라면 재설정 안내가 도착해요. 스팸함도 확인해주세요. 메일이 오지 않으면 잠시 후 다시 요청해주세요.':action==='verify'?'내 정보 설정에서 인증 상태를 확인할 수 있어요.':'새 비밀번호로 다시 로그인해주세요. 다른 기기의 로그인도 해제했어요.'}</p><button className="primary account-submit" onClick={onBack}>로그인으로 이동<ArrowRight size={18} aria-hidden="true"/></button></>:<>
   <p className="account-lead">{action==='forgot'?'가입할 때 사용한 이메일을 입력해주세요.':action==='verify'?'아래 버튼을 누르면 이 이메일의 소유를 확인해요.':'12자 이상의 비밀번호를 입력해주세요.'}</p>
   {!validLink?<p className="account-error" role="alert">인증 링크를 확인할 수 없어요. 이메일에 있는 링크를 다시 열어주세요.</p>:<form className="account-form" onSubmit={submit} aria-busy={busy}>
    {action==='forgot'&&<label className="account-field">이메일<input name="email" type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false}/></label>}
    {action==='reset'&&<><PasswordField label="새 비밀번호" name="newPassword" autoComplete="new-password" minLength={12}/><PasswordField label="새 비밀번호 확인" name="confirmation" autoComplete="new-password" minLength={12}/><p className="account-help">변경하면 모든 기기에서 다시 로그인해야 해요.</p></>}
    {action==='forgot'&&!loading&&!available&&<p className="account-error" role="status">이메일 발송 기능을 준비 중이에요. 연결이 완료되면 이용할 수 있어요.</p>}
    {error&&<p className="account-error" role="alert">{error}</p>}
    <button className="primary account-submit" disabled={busy||loading||(action==='forgot'&&!available)}>{busy?'처리 중…':action==='forgot'?'재설정 메일 요청':action==='verify'?'이메일 확인하기':'비밀번호 저장'}<ArrowRight size={18} aria-hidden="true"/></button>
   </form>}
  </>}
 </section>;
}
export function EmailVerification({user,available,onVerified}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[cooldown,setCooldown]=useState(0);
 useEffect(()=>{if(!cooldown)return;const t=setTimeout(()=>setCooldown(n=>n-1),1000);return()=>clearTimeout(t)},[cooldown]);
 if(!user||user.id==='site-test-admin'||user.email==='admin@jibro.local.test')return null;
 async function send(){setBusy(true);setError('');try{await accountRequest('/api/account/send-verification',{method:'POST',body:JSON.stringify({email:user.email})});setMessage('인증 메일을 요청했어요. 메일함과 스팸함을 확인해주세요.');setCooldown(60);}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="email-verification"><span className={'email-status '+(user.emailVerified?'is-verified':'')}>{user.emailVerified?'이메일 인증 완료':'이메일 미인증'}</span>{!user.emailVerified&&<>
  <p className="account-help">{available?'메일의 링크를 열어 이메일 주소를 확인해주세요.':'이메일 발송 연결을 준비 중이에요.'}</p>
  <div className="email-verification-actions"><button className="secondary" type="button" disabled={!available||busy||!!cooldown} onClick={send}>{cooldown?`${cooldown}초 후 재요청`:busy?'요청 중…':'인증 메일 요청'}</button><button className="text-button" type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await onVerified();setMessage('인증 상태를 새로 확인했어요.')}catch(e){setError(e.message)}finally{setBusy(false)}}}>인증 상태 확인</button></div>
 </>}{message&&<p className="account-help" role="status">{message}</p>}{error&&<p className="account-error" role="alert">{error}</p>}</div>;
}
