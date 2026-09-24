import React,{useState} from 'react';
import {Bell,UserRound,ChevronRight,ChevronLeft} from 'lucide-react';
import './settingsSheets.css';

const regions=['전국','서울특별시','부산광역시','대구광역시','인천광역시','광주광역시','대전광역시','울산광역시','세종특별자치시','경기도','강원특별자치도','충청북도','충청남도','전북특별자치도','전라남도','경상북도','경상남도','제주특별자치도'];

function SettingsBack({onBack}){return <button type="button" className="settings-back" onClick={onBack}><ChevronLeft size={18} aria-hidden="true"/>설정으로</button>}

export function SettingsMenu({onNotifications,onProfile}){
 return <section className="settings-panel"><h2 tabIndex={-1} data-settings-focus>설정</h2><div className="settings-options"><button type="button" onClick={onNotifications}><Bell size={22} aria-hidden="true"/><span><b>알림 설정</b><small>앱 내 준비 알림을 설정해요</small></span><ChevronRight size={18} aria-hidden="true"/></button><button type="button" onClick={onProfile}><UserRound size={22} aria-hidden="true"/><span><b>내 정보 설정</b><small>이름과 관심 지역을 변경해요</small></span><ChevronRight size={18} aria-hidden="true"/></button></div></section>
}

export function NotificationSettings({enabled,onSave,onBack}){
 const [checked,setChecked]=useState(enabled),[saving,setSaving]=useState(false);
 return <form className="settings-panel" onSubmit={async e=>{e.preventDefault();setSaving(true);try{await onSave(checked)}finally{setSaving(false)}}}><SettingsBack onBack={onBack}/><h2 tabIndex={-1} data-settings-focus>알림 설정</h2><label className="settings-toggle"><span><b>앱 내 준비 알림</b><small>준비 안내와 알림 표시점을 보여줘요</small></span><input type="checkbox" role="switch" checked={checked} onChange={e=>setChecked(e.target.checked)} aria-label="앱 내 준비 알림"/><span className="settings-switch" aria-hidden="true"/></label><p className="settings-help">앱을 열었을 때 확인하는 알림이에요. 휴대폰 푸시·문자 알림은 보내지 않아요.</p><button className="primary" type="submit" disabled={saving}>{saving?'저장 중…':'저장하기'}</button></form>
}

export function ProfileSettings({name,region,onSave,onBack}){
 const [saving,setSaving]=useState(false);
 const options=regions.includes(region)?regions:[region,...regions].filter(Boolean);
 return <form className="settings-panel" onSubmit={async e=>{e.preventDefault();const data=new FormData(e.currentTarget),name=String(data.get('name')||'').trim();if(!name){e.currentTarget.elements.name.setCustomValidity('이름을 입력해주세요.');e.currentTarget.reportValidity();return}setSaving(true);try{await onSave({name,region:data.get('region')})}finally{setSaving(false)}}}><SettingsBack onBack={onBack}/><h2 tabIndex={-1} data-settings-focus>내 정보 설정</h2><label className="field-label">이름<input name="name" defaultValue={name} maxLength={16} required autoComplete="given-name" onInput={e=>e.currentTarget.setCustomValidity('')}/></label><label className="field-label">관심 지역<select name="region" defaultValue={region}>{options.map(value=><option key={value}>{value}</option>)}</select></label><button className="primary" type="submit" disabled={saving}>{saving?'저장 중…':'저장하기'}</button></form>
}
