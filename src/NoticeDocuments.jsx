import React from 'react';
import {FileText,FolderOpen,ChevronDown,Check,ArrowUpRight,Info} from 'lucide-react';
import './noticeDocuments.css';
import {documentEvidenceSummary} from './documentEvidenceSummary.mjs';

function DocumentCard({doc,expanded,onExpand,onChoose,onDone,onGuide,cardRef,noticeUrl}){
 const open=expanded===doc.id;
 const sourceUrl=doc.sourceUrl||noticeUrl;
 const evidenceSummary=documentEvidenceSummary(doc);
 const location=doc.format==='.pdf'?`PDF ${doc.page}쪽${['left','왼쪽'].includes(doc.region)?' 왼쪽':['right','오른쪽'].includes(doc.region)?' 오른쪽':''}`:'첨부 문서';
 return <article ref={open?cardRef:null} className={'document-card notice-document-card '+(open?'expanded':'')}>
  <button className="document-heading" aria-expanded={open} onClick={()=>onExpand(doc.id)}>
   <span className="icon-disc"><FileText size={23}/></span>
   <span className="document-heading-copy"><b>{doc.title}</b><small>{doc.desc}</small></span>
   <span className="document-heading-end"><span className={'tag '+(doc.included&&doc.done?'success':'attention')}>{doc.included&&doc.done?'준비 완료':doc.excluded?'제외':doc.requirement==='common'?'공통 제출':doc.included?'내 목록':'해당 확인'}</span><ChevronDown className={open?'rotate':''} size={20}/></span>
  </button>
  {open&&<div className="document-details">
   {doc.requirement==='legacy'?<p className="document-requirement-copy">이전에 체크한 기록을 보존했어요. 현재 공고의 제출 대상인지 다시 확인해주세요.</p>:<div className="document-evidence-summary"><h3>제출 근거 요약</h3><p>{evidenceSummary.purpose}</p><ul>{evidenceSummary.points.map(point=><li key={point}>{point}</li>)}</ul></div>}
   {doc.guide&&<button className="document-source-link" onClick={()=>onGuide(doc)}>발급 방법</button>}
   {sourceUrl&&<a className="document-source-link" href={sourceUrl} target="_blank" rel="noreferrer"><FileText size={17}/><span>{doc.sourceUrl?`제출서류 원문 보기 · ${location}`:'공고 원문 보기'}</span><ArrowUpRight size={16}/></a>}
   {!doc.included?<div className="document-choice-actions"><button onClick={()=>onChoose(doc.id,'include')}>내 준비 목록에 추가</button>{!doc.excluded&&<button onClick={()=>onChoose(doc.id,'exclude')}>해당 없음 · 제외</button>}</div>:<><label className={'doc-prepared-control'+(doc.done?' is-prepared':'')}><input type="checkbox" checked={doc.done} onChange={()=>onDone(doc.id)}/><span className="doc-prepared-mark" aria-hidden="true"><Check size={16}/></span><span className="doc-prepared-label">{doc.done?'준비 완료':'이 서류를 준비했어요'}</span></label><button className="document-exclude" onClick={()=>onChoose(doc.id,'exclude')}>면제·대체·해당 없음으로 목록에서 제외</button></>}
  </div>}
 </article>
}

export function NoticeDocuments({plan,notice,expanded,onExpand,onChoose,onDone,onGuide,cardRef,loading,error,onRetry}){
 const renderDoc=doc=><DocumentCard key={doc.id} doc={doc} expanded={expanded} onExpand={onExpand} onChoose={onChoose} onDone={onDone} onGuide={onGuide} cardRef={cardRef} noticeUrl={notice.url}/>;
 const groups=[...new Set(plan.pending.map(d=>d.group))];
 return <section className="notice-documents" aria-label="공고별 제출서류 준비">
  <section className="recorded-docs-summary" aria-labelledby="recorded-docs-title"><span className="summary-icon recorded-docs-folder" aria-hidden="true"><FolderOpen size={39} strokeWidth={1.4}/></span><h2 id="recorded-docs-title"><span>내 준비 목록 {plan.included.length}개 중</span><span><strong>{plan.count}개</strong> 준비</span></h2><div className="recorded-docs-progress"><span className="recorded-docs-count" aria-hidden="true"><b>{plan.count}</b><span>/ {plan.included.length}</span></span><div className="progress-track" role="progressbar" aria-label="내 목록의 서류 준비율" aria-valuemin={0} aria-valuemax={Math.max(plan.included.length,1)} aria-valuenow={plan.count} aria-valuetext={plan.included.length?`${plan.included.length}개 중 ${plan.count}개 준비`:'준비할 서류를 확인해주세요'}><i style={{width:100*plan.count/Math.max(plan.included.length,1)+'%'}}/></div></div></section>
  {!plan.source&&<p className="document-notice-note" role="status"><Info size={17}/><span>{loading?'공고별 제출서류를 불러오고 있어요.':error?'제출서류 자료를 불러오지 못했어요. 기존 완료 기록은 유지됩니다.':'확인되지 않은 서류를 필수로 만들지 않아요. 공고 원문에서 제출 목록을 확인해주세요. 기존 완료 기록은 아래에 유지됩니다.'}</span></p>}
  {error&&<button className="document-source-link" onClick={onRetry}>제출서류 다시 불러오기</button>}
  <h2 className="document-section-title">내 서류 기록 <small>{plan.included.length}개</small></h2>
  {plan.source?.note&&<details className="document-help-disclosure" key={notice.id+"-note"}><summary><Info size={16} aria-hidden="true"/><span>제출 대상·면제 안내</span><ChevronDown size={17} aria-hidden="true"/></summary><p>{plan.source.note}</p></details>}
  <div className="documents">{plan.included.map(renderDoc)}</div>
  {!plan.included.length&&<p className="document-empty">{plan.source?'아래에서 내게 필요한 서류를 확인하고 준비 목록에 추가해요.':'기록한 서류가 없어요.'}</p>}
  {plan.pending.length>0&&<section className="document-review-section"><h2 className="document-section-title">해당 여부 확인 <small>{plan.pending.length}개</small></h2><details className="document-help-disclosure" key={notice.id+"-candidates"}><summary><Info size={16} aria-hidden="true"/><span>서류 후보 안내</span><ChevronDown size={17} aria-hidden="true"/></summary><p>공고에 나온 서류 후보예요. 모든 서류가 필수는 아니며, 가점·대리 신청·계약 때만 필요한 항목도 포함돼요.</p></details>{groups.map(group=><details className="document-review-group" key={group}><summary><span>{group}</span><span>{plan.pending.filter(d=>d.group===group).length}개 <ChevronDown size={17}/></span></summary><div className="documents">{plan.pending.filter(d=>d.group===group).map(renderDoc)}</div></details>)}</section>}
  {plan.excluded.length>0&&<details className="document-review-group excluded-documents"><summary><span>내가 제외한 서류</span><span>{plan.excluded.length}개 <ChevronDown size={17}/></span></summary><p className="document-review-help">제외해도 이전 완료 기록은 보존돼요. 필요하면 다시 추가할 수 있어요.</p><div className="documents">{plan.excluded.map(renderDoc)}</div></details>}
  <p className="document-review-help">신청 자격이나 필수 서류가 자동 확정되는 것은 아니에요. 정정공고와 최종 제출 요건은 공식 원문을 확인해주세요.</p>
 </section>
}
