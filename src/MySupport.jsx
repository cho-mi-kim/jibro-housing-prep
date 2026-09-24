import React from 'react';
import {FileText,CircleHelp,ChevronRight,Mail} from 'lucide-react';
import './mySupport.css';

export function MySupport({onGuide,onContact}){
 return <nav className="my-support" aria-label="서비스 도움말"><button type="button" onClick={onGuide}><span className="my-support-icon"><FileText size={21} aria-hidden="true"/></span><span>서비스 안내</span><ChevronRight size={19} aria-hidden="true"/></button><button type="button" onClick={onContact}><span className="my-support-icon neutral"><CircleHelp size={21} aria-hidden="true"/></span><span>문의하기</span><ChevronRight size={19} aria-hidden="true"/></button></nav>
}

export function ServiceGuide({serverConnected}){
 return <section className="service-guide"><h2 tabIndex={-1} data-settings-focus>서비스 안내</h2><p>JIBRO는 주거지원 공고를 확인하고, 내 신청 준비를 기록하는 공간이에요.</p><ol><li><b>공고를 선택해요</b><span>공고를 살펴보고 준비할 공고를 정해요.</span></li><li><b>조건과 서류를 확인해요</b><span>공고별 기준을 읽고 내게 필요한 서류를 준비 목록에 추가해요.</span></li><li><b>준비 상태와 일정을 기록해요</b><span>준비한 서류를 체크하고 신청 일정을 확인해요.</span></li></ol><p className="service-guide-note">{serverConnected?'준비 기록은 연결된 서버에 저장돼요.':'준비 기록은 이 브라우저에 저장돼요. 다른 기기와 자동으로 공유되지 않으며, 브라우저 데이터를 지우면 기록도 삭제돼요.'}</p><p className="service-guide-note">실제 신청과 최종 자격 확인은 공식 모집기관에서 진행해주세요.</p></section>
}

export function ContactGuide(){
 return <section className="service-guide"><h2 tabIndex={-1} data-settings-focus>문의하기</h2><p>서비스 이용 중 궁금한 점이나 개선 의견을 보내주세요.</p><div className="service-contact-address"><Mail size={21} aria-hidden="true"/><span>문의 이메일<strong>jibro@dankook.ac.kr</strong></span></div><a className="primary" href={'mailto:jibro@dankook.ac.kr?subject='+encodeURIComponent('[JIBRO] 서비스 문의')}><Mail size={18} aria-hidden="true"/>이메일로 문의하기</a><p className="service-contact-help">메일 앱이 열리지 않으면 위 주소를 복사해 이용하는 이메일에서 보내주세요.</p></section>
}
