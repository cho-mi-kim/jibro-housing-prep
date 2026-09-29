import React from 'react';
import {ChevronDown} from 'lucide-react';
import {catalogEntry,applicationStatus} from './noticeLifecycle.mjs';
import './noticeLifecycle.css';
export function ApplicationBadge({notice,catalog,today}){const status=notice.application||applicationStatus(notice,catalogEntry(notice,catalog),today);return <span className="application-state" data-state={status.code}>{status.label}</span>}
export function AnalysisStatus({notice,catalog}){
 const entry=catalogEntry(notice,catalog),analysis=entry?.analysis||{};
 const labels={conditions:analysis.conditions==='excerpt'?'조건: 원문 일부 발췌':analysis.conditions==='unavailable'?'조건: 발췌 실패 · 원문 확인':'조건: 분석 대기',documents:analysis.documents==='candidates'?'서류: 후보 목록 확인됨':'서류: 분석 대기',schedules:analysis.schedules==='available'?'일정: 확인된 날짜 있음':'일정: 확인 필요'};
 const outdated=notice.analysisOutdated||Object.values(entry?.stale||{}).some(Boolean);
 const incomplete=outdated||analysis.conditions!=='excerpt'||analysis.documents!=='candidates'||analysis.schedules!=='available';
 return <details className="notice-analysis"><summary>{incomplete?'확인이 필요한 공고 자료가 있어요':'공고 자료 확인 현황'}<ChevronDown size={16}/></summary>{outdated&&<p>공고 변경 뒤 아직 다시 분석하지 못한 자료가 있어요. 이전 발췌를 최신 기준으로 표시하지 않아요.</p>}<ul>{Object.entries(labels).map(([id,label])=><li key={id}>{label}{entry?.checkedAt[id]&&<time className="analysis-date">자료 확인 {new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(entry.checkedAt[id]))}</time>}</li>)}</ul>{Object.values(entry?.attempts||{}).some(a=>a.status==='failed')&&<p>최근 자료 갱신에 실패해 마지막으로 확인한 자료를 보존하고 있어요.</p>}<p>확인된 자료만 표시해요. 자동 수집 서버가 연결되기 전에는 신규·정정 공고를 즉시 반영하지 못해요.</p></details>
}
export function ReviewBanner({review,onOpen,onAcknowledge}){
 if(!review.cancelled&&!review.changed&&!review.oldConditions&&!review.oldDocuments)return null;
 return <aside className="notice-review-banner" role="status"><span><b>{review.cancelled?'취소된 공고예요':review.changed?'공고 자료가 바뀌었어요':'이전 확인 기록을 다시 확인해요'}</b><br/>{review.cancelled?'기존 준비 기록은 보존했어요. 공식 공고를 확인해주세요.':(review.oldConditions||review.oldDocuments)?'조건 '+review.oldConditions+'개 · 서류 '+review.oldDocuments+'개의 이전 기록은 최신 확인 수에 포함하지 않아요.':'새 일정과 공고 내용을 확인해주세요.'}</span>{onOpen&&<button onClick={onOpen}>내용 확인</button>}{review.changed&&onAcknowledge&&<button onClick={onAcknowledge}>변경 안내 확인</button>}</aside>
}
