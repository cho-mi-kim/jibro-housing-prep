import React,{useRef,useState} from 'react';
import {House,FileText,ClipboardList,CalendarDays,Phone,Users,Search,ChevronRight,ChevronDown,Check,X,ExternalLink} from 'lucide-react';
import {guideTopics,guideArticles} from './guideContent.mjs';
import './guide.css';
const icons={house:House,terms:ClipboardList,file:FileText,calendar:CalendarDays,phone:Phone,users:Users};
export function GuidePage(){
  const [query,setQuery]=useState('');
  const [topic,setTopic]=useState('');
  const [all,setAll]=useState(false);
  const [opened,setOpened]=useState(null);
  const resultsRef=useRef(null),searchRef=useRef(null);
  const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches=guideArticles.filter(a=>(!topic||a.topic===topic)&&words.every(w=>[a.title,...a.answer,guideTopics.find(t=>t.id===a.topic).title].join(' ').toLocaleLowerCase().includes(w)));
  const filtered=words.length>0||!!topic||all;
  const articles=filtered?matches:guideArticles.slice(0,3);
  function showTopic(id){setTopic(id);setQuery('');setAll(true);setOpened(null);requestAnimationFrame(()=>{resultsRef.current?.focus({preventScroll:true});resultsRef.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})});}
  function showOverview(){setTopic('');setQuery('');setAll(false);setOpened(null);requestAnimationFrame(()=>{searchRef.current?.focus({preventScroll:true});searchRef.current?.scrollIntoView({block:'center',behavior:'instant'})});}
  return <div className="guide-page">
    <div className="guide-search" role="search"><Search size={21} aria-hidden="true"/><input ref={searchRef} aria-label="가이드 검색" type="search" placeholder="궁금한 내용을 검색하세요" value={query} onChange={e=>{setQuery(e.target.value);setTopic('');setOpened(null)}}/>{query&&<button aria-label="검색어 지우기" onClick={()=>{setQuery('');searchRef.current?.focus()}}><X size={18}/></button>}</div>
    {!words.length&&<section aria-labelledby="guide-topics-heading"><div className="guide-section-heading"><h2 id="guide-topics-heading">주제별 가이드</h2></div>
      <div className="guide-topics">{guideTopics.map((t,i)=>{const Icon=icons[t.icon];const selected=topic===t.id;return <button key={t.id} className={'guide-topic '+(i>2?'guide-topic-wide ':'')+(selected?'is-selected':'')} aria-pressed={selected} onClick={()=>showTopic(t.id)}><span className="guide-icon"><Icon size={23} aria-hidden="true"/></span><span>{t.title}</span>{selected?<Check className="guide-topic-arrow" size={17} aria-hidden="true"/>:<ChevronRight className="guide-topic-arrow" size={17} aria-hidden="true"/>}</button>})}</div>
    </section>}
    <section className="guide-help" aria-labelledby="guide-help-heading"><div className="guide-section-heading"><h2 id="guide-help-heading" ref={resultsRef} tabIndex={-1}>{words.length?'검색 결과':topic?guideTopics.find(t=>t.id===topic).title:all?'전체 도움말':'많이 찾는 도움말'}</h2>{!filtered?<button className="guide-view-all" onClick={()=>showTopic('')}>전체보기<ChevronRight size={16}/></button>:<button className="guide-view-all" onClick={showOverview}>가이드 홈</button>}</div>
      {filtered&&<p className="guide-result-count" role="status">{matches.length}개의 도움말</p>}
      <div className="guide-articles">{articles.map(a=>{const Icon=icons[a.icon];const expanded=opened===a.id;return <article className={'guide-article '+(expanded?'is-open':'')} key={a.id}><h3><button id={'guide-question-'+a.id} aria-expanded={expanded} aria-controls={'guide-answer-'+a.id} onClick={()=>setOpened(expanded?null:a.id)}><span className="guide-icon"><Icon size={22} aria-hidden="true"/></span><span>{a.title}</span><ChevronDown className="guide-disclosure" size={18} aria-hidden="true"/></button></h3><div className="guide-answer" id={'guide-answer-'+a.id} role="region" aria-labelledby={'guide-question-'+a.id} hidden={!expanded}>{a.answer.map(p=><p key={p}>{p}</p>)}<div className="guide-source-links">{a.links.map(l=><a key={l.url} href={l.url} target={l.url.startsWith('https:')?'_blank':undefined} rel={l.url.startsWith('https:')?'noopener noreferrer':undefined}>{l.label}{l.url.startsWith('https:')&&<><ExternalLink size={14} aria-hidden="true"/><span className="guide-sr-only"> (새 창)</span></>}</a>)}</div></div></article>})}</div>
      {!articles.length&&<div className="guide-empty"><Search size={28} aria-hidden="true"/><p>검색 결과가 없어요.</p><span>‘등본’, ‘가구원’, ‘신청’처럼 짧은 단어로 찾아보세요.</span><button onClick={()=>{setQuery('');setTopic('');setAll(true);searchRef.current?.focus()}}>전체 도움말 보기</button></div>}
    </section>
    <p className="guide-footnote">일반적인 준비 안내예요. 정확한 자격과 일정은 해당 공고를 확인해주세요.</p>
  </div>
}
