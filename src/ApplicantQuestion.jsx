import React from 'react';
import {koreaDate,profileOptions} from './applicantProfile.mjs';
import './applicantQuestion.css';

export function ApplicantQuestion({field,value,onChange,disabled=false}){
 return <label className="applicant-field profile-question">{field.label}
  {field.type==='select'?<select disabled={disabled} name={field.key} value={value||''} onChange={e=>onChange(e.target.value)}><option value="">선택해주세요</option>{profileOptions[field.key].map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>:
   field.type==='date'?<input disabled={disabled} name={field.key} type="date" min="1900-01-01" max={koreaDate()} value={value||''} onChange={e=>onChange(e.target.value)}/>:
   <span className="applicant-number"><input disabled={disabled} name={field.key} type="number" inputMode="numeric" min={field.min} max={field.max} step="1" value={value??''} placeholder="숫자로 입력해주세요" onChange={e=>onChange(e.target.value===''?'':Number(e.target.value))}/><span>{field.unit}</span></span>}
  {field.money&&value!==''&&value!=null&&<small>{new Intl.NumberFormat('ko-KR').format(value)}원</small>}
 </label>;
}
