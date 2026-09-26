import {evidenceNoticeKey} from './noticeEvidence.mjs';

// A source change invalidates saved numeric limits instead of reusing old amounts.
export function matchingIncomeGuide(data,guides){
 const key=evidenceNoticeKey(data?.noticeUrl),guide=key&&guides[key];
 if(!guide||evidenceNoticeKey(guide.noticeUrl)!==key)return null;
 if(!data.sources?.some(s=>s.id===guide.sourceId&&s.sha256===guide.sha256&&s.url===guide.sourceUrl))return null;
 if(!Array.isArray(guide.rows)||guide.rows.length!==4||!guide.rows.every((r,i)=>r.people===i+1&&Number.isSafeInteger(r.monthlyWon)&&r.monthlyWon>0))return null;
 if(![guide.totalAssetsWon,guide.carWon].every(n=>Number.isSafeInteger(n)&&n>0))return null;
 return guide;
}
export function moneyInWon(value){return new Intl.NumberFormat('ko-KR').format(value)+'원';}
export function assetInWon(value){
 if(value%10000)return moneyInWon(value);
 const billions=Math.floor(value/100000000),man=(value%100000000)/10000;
 return (billions?billions+'억 ':'')+(man?new Intl.NumberFormat('ko-KR').format(man)+'만':'')+'원';
}
