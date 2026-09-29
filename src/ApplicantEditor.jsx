import React,{useEffect,useRef,useState} from 'react';
import {ArrowRight,ChevronLeft,ChevronRight,Check} from 'lucide-react';
import {ApplicantQuestion} from './ApplicantQuestion.jsx';
import {APPLICANT_CONSENT_VERSION,normalizeApplicantProfile} from './applicantProfile.mjs';
import {updateSignupProfile} from './signupFlow.mjs';
import {applicantDirty,applicantValue,changedApplicantFields,editableFields} from './applicantEditor.mjs';
import './applicantEditor.css';

export function ApplicantEditor({profile,savedProfile=profile,onSave,onBack,exitRef,Consent}){
 const [original]=useState(()=>savedProfile||null),[draft,setDraft]=useState(()=>profile?{...profile}:null);
 const [screen,setScreen]=useState(profile?.consent?'summary':'consent'),[sequential,setSequential]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[confirmation,setConfirmation]=useState(null);
 const heading=useRef(null),pendingExit=useRef(null),savingRef=useRef(false);
 const dirty=applicantDirty(original,draft),fields=editableFields(draft),field=fields.find(f=>f.key===screen),index=fields.indexOf(field),changed=changedApplicantFields(original,draft);
 const open=next=>{setError('');setScreen(next);};
 function requestExit(action){if(savingRef.current)return;if(dirty){pendingExit.current=action;setConfirmation('discard');setError('');}else action();}
 useEffect(()=>{if(exitRef)exitRef.current=requestExit;return()=>{if(exitRef)exitRef.current=null;};},[dirty,exitRef]);
 useEffect(()=>{heading.current?.closest('dialog')?.scrollTo({top:0,behavior:'instant'});heading.current?.focus({preventScroll:true});},[screen,confirmation]);
 useEffect(()=>{if(!dirty)return;const beforeUnload=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',beforeUnload);return()=>window.removeEventListener('beforeunload',beforeUnload);},[dirty]);
 function validate(){try{normalizeApplicantProfile(draft);return true;}catch(e){setError(e.message);return false;}}
 function advance(e){e.preventDefault();if(savingRef.current||!validate())return;open(sequential&&index<fields.length-1?fields[index+1].key:'summary');}
 async function save(next){
  if(savingRef.current)return;setError('');let normalized;
  try{normalized=next===null?null:normalizeApplicantProfile(next);}catch(e){setError(e.message);return;}
  savingRef.current=true;setSaving(true);
  try{if(!await onSave(normalized))setError('저장하지 못했어요. 수정한 내용은 유지돼요. 다시 시도해주세요.');}
  catch{setError('저장하지 못했어요. 수정한 내용은 유지돼요. 다시 시도해주세요.');}
  finally{savingRef.current=false;setSaving(false);}
 }
 function edit(key,all=false){setSequential(all);open(key);}
 function previous(){if(sequential&&index>0){if(validate())open(fields[index-1].key);}else open('summary');}
 const fieldButtons=()=>fields.map(f=><button className="applicant-edit-row" type="button" key={f.key} onClick={()=>edit(f.key)} disabled={saving} aria-label={`${f.label} 수정, ${applicantValue(f,draft)}`}><span><small>{f.label}{changed.some(c=>c.key===f.key)&&<em>수정됨</em>}</small><strong className={applicantValue(f,draft)==='미입력'?'empty':''}>{applicantValue(f,draft)}</strong></span><ChevronRight size={18} aria-hidden="true"/></button>);
 return <section className="applicant-editor" aria-labelledby="applicant-edit-title" aria-busy={saving}>
  {confirmation?<>
   <h2 ref={heading} tabIndex={-1} data-settings-focus id="applicant-edit-title">{confirmation==='discard'?'수정한 내용을 저장하지 않고 나갈까요?':'내 신청 조건을 삭제할까요?'}</h2>
   <p>{confirmation==='discard'?'기존에 저장한 조건은 그대로 유지돼요.':'저장·활용 동의를 철회하고 내 신청 조건을 삭제해요. 공고별 확인·서류 기록은 그대로 유지돼요.'}</p>
   {error&&<p className="account-error" role="alert">{error}</p>}
   <div className="applicant-edit-actions"><button className="primary" disabled={saving} type="button" onClick={()=>{setConfirmation(null);setError('');}}>{confirmation==='discard'?'계속 수정하기':'내 조건 유지하기'}</button><button className="applicant-edit-text danger" disabled={saving} type="button" onClick={()=>{if(confirmation==='discard'){const action=pendingExit.current;pendingExit.current=null;action?.();}else save(null);}}>{saving?'삭제 중…':confirmation==='discard'?'저장하지 않고 나가기':'동의 철회하고 조건 삭제'}</button></div>
  </>:<>
   <button type="button" className="settings-back" disabled={saving} onClick={()=>field?previous():requestExit(onBack)}><ChevronLeft size={18}/>{field?'이전':'내 정보 설정'}</button>
   {field&&<div className="applicant-edit-progress"><span>{sequential?`내 신청 조건 · ${index+1}/${fields.length}`:'선택한 항목 수정'}</span><button type="button" disabled={saving} onClick={()=>open('summary')}>목록</button></div>}
   <h2 ref={heading} tabIndex={-1} data-settings-focus id="applicant-edit-title">{field?field.title:screen==='consent'?'내 신청 조건을 입력해볼까요?':'내 신청 조건'}</h2>
   {screen==='consent'?<>
    <p>가입할 때 건너뛴 조건을 하나씩 입력할 수 있어요. 모르는 항목은 나중에 입력해도 돼요.</p>
    <Consent checked={draft?.consent===true} disabled={saving} onChange={checked=>setDraft(checked?{consent:true,consentVersion:APPLICANT_CONSENT_VERSION}:null)}/>
    {error&&<p className="account-error" role="alert">{error}</p>}
    <div className="applicant-edit-actions"><button className="primary" type="button" disabled={saving} onClick={()=>{if(!draft?.consent){setError('내 조건 저장·활용 동의를 확인해주세요.');return;}edit(fields[0].key,true);}}>내 조건 입력하기<ArrowRight size={18}/></button><button className="applicant-edit-text" type="button" disabled={saving} onClick={()=>requestExit(onBack)}>나중에 입력하기</button></div>
   </>:field?<form noValidate onSubmit={advance}>
    <p className="applicant-edit-saved">저장된 값 <strong>{applicantValue(field,original)}</strong></p>
    {field.help&&<p>{field.help}</p>}
    <ApplicantQuestion field={field} value={draft?.[field.key]} disabled={saving} onChange={value=>{setError('');setDraft(p=>updateSignupProfile(p,field.key,value));}}/>
    <button type="button" className="applicant-edit-text" disabled={saving||draft?.[field.key]==null||draft?.[field.key]===''} onClick={()=>{setDraft(p=>updateSignupProfile(p,field.key,''));setError('');}}>이 항목 비우기</button>
    {error&&<p className="account-error" role="alert">{error}</p>}
    <div className="applicant-edit-actions"><p>마지막에 ‘변경사항 저장하기’를 눌러 반영해요.</p><button className="primary" disabled={saving} type="submit">{sequential&&index<fields.length-1?'다음':'수정 내용 확인'}<ArrowRight size={18}/></button></div>
   </form>:<>
    <p>{dirty?'수정한 내용을 확인하고 저장해주세요.':'바꿀 항목을 고르거나, 저장한 조건을 하나씩 확인해보세요.'}</p>
    <button type="button" className={dirty?'secondary full':'primary'} disabled={saving} onClick={()=>edit(fields[0].key,true)}>하나씩 확인하기<ArrowRight size={18}/></button>
    {dirty&&<div className="applicant-edit-status" role="status"><Check size={16}/><span>아직 저장 전이에요{changed.length>0?` · ${changed.length}개 항목 변경`:''}</span></div>}
    {changed.some(f=>!fields.some(v=>v.key===f.key))&&<p className="applicant-edit-dependents">현재 답변에 해당하지 않는 {changed.filter(f=>!fields.some(v=>v.key===f.key)).map(f=>f.label).join(' · ')} 정보도 저장 시 비워져요.</p>}
    {error&&<p className="account-error" role="alert">{error}</p>}
    {dirty&&<div className="applicant-edit-actions"><button className="primary" type="button" disabled={saving} onClick={()=>save(draft)}>{saving?'저장 중…':'변경사항 저장하기'}<Check size={18}/></button></div>}
    <div className="applicant-edit-list">{fieldButtons()}</div>
    <details className="applicant-edit-privacy"><summary>조건 정보·동의 관리</summary><p>입력한 조건은 공고 기준을 읽는 데만 사용해요. 신청 자격은 공식 공고에서 확인해주세요.</p>{original?.consent?<button className="applicant-edit-text danger" type="button" disabled={saving} onClick={()=>{setError('');setConfirmation('withdraw');}}>내 조건 삭제 및 동의 철회</button>:<p>저장 전에는 계정에 반영되지 않아요.</p>}</details>
   </>}
  </>}
 </section>;
}
