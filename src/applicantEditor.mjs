import {signupFields} from './signupFlow.mjs';
import {optionLabel} from './applicantProfile.mjs';

export const editableFields=profile=>signupFields.filter(f=>!f.when||f.when(profile||{}));
const present=v=>v!==''&&v!=null;
export function applicantValue(field,profile){
 const value=profile?.[field.key];if(!present(value))return '미입력';
 if(field.type==='select')return optionLabel(field.key,value);
 if(field.type==='number')return new Intl.NumberFormat('ko-KR').format(value)+(field.unit||'');
 return value;
}
export function changedApplicantFields(original,draft){
 return signupFields.filter(f=>{
  const a=original?.[f.key],b=draft?.[f.key];
  return (present(a)?a:null)!==(present(b)?b:null);
 });
}
export function applicantDirty(original,draft){
 return !!original?.consent!==!!draft?.consent||changedApplicantFields(original,draft).length>0;
}
