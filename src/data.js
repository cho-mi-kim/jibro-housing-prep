export const notices = [
 {id:'lh',title:'LH 청년 매입임대',region:'서울특별시',type:'청년주택',agency:'한국토지주택공사 (LH)',deadline:'2026-09-28',url:'https://apply.lh.or.kr',description:'LH가 매입한 주택을 청년에게 저렴한 임대료로 제공하는 주거지원 사업이에요. 실제 모집 지역과 자격은 해당 공고문에서 확인해주세요.'},
 {id:'sh',title:'SH 청년안심주택',region:'서울특별시',type:'공공임대',agency:'서울주택도시개발공사 (SH)',deadline:'2026-10-08',url:'https://www.i-sh.co.kr',description:'대중교통 이용이 편리한 지역의 청년 주거를 지원해요. 공공임대와 민간임대의 자격 및 임대 조건이 다르므로 모집 공고 확인이 필요해요.'},
 {id:'gg',title:'경기 청년 전세임대',region:'경기도',type:'청년주택',agency:'경기주택도시공사 (GH)',deadline:'2026-10-15',url:'https://www.gh.or.kr',description:'청년의 안정적인 주거 생활을 위한 전세임대 지원이에요. 지원 한도, 부담금, 신청 자격은 실제 모집 공고를 확인해주세요.'},
 {id:'rent',title:'청년 월세지원',region:'서울특별시',type:'주거비 지원',agency:'서울주거포털',deadline:'2026-09-27',url:'https://housing.seoul.go.kr',description:'청년의 월세 부담을 덜어주는 주거비 지원이에요. 지원 기간과 소득·재산 기준은 실제 공고에서 확인해주세요.'}
];
export const documents = [
 {id:'resident',title:'주민등록등본',desc:'세대 구성원 정보 확인용',issuer:'정부24',url:'https://www.gov.kr',icon:'file',guide:'정부24에서 주민등록표 등본 발급을 검색하세요. 공고에서 요구하는 주소 변동 이력과 세대 구성 정보의 포함 여부를 확인해주세요.'},
 {id:'family',title:'가족관계증명서',desc:'가족 관계 확인용',issuer:'대법원 전자가족관계등록시스템',url:'https://efamily.scourt.go.kr',icon:'users',guide:'가족관계증명서를 선택한 뒤 본인 인증을 진행하세요. 일반·상세 구분과 주민등록번호 공개 범위는 공고문을 기준으로 선택해주세요.'},
 {id:'income',title:'소득 증빙서류',desc:'신청 자격의 소득 요건 확인용',issuer:'홈택스',url:'https://www.hometax.go.kr',icon:'coins',guide:'홈택스에서 소득금액증명을 검색하세요. 소득이 없는 경우 필요한 대체 서류가 다를 수 있으므로 해당 공고의 제출서류 안내를 먼저 확인해주세요.'},
 {id:'consent',title:'개인정보 수집·이용 동의서',desc:'공고에 첨부된 서식 확인용',issuer:'모집기관 공고문',url:'https://apply.lh.or.kr',icon:'file',guide:'신청할 공고의 첨부 서식을 내려받아 작성하세요. 서명 대상자와 서명 누락 여부를 확인해주세요.'},
 {id:'asset',title:'자산 보유 사실확인서',desc:'보유 자산 확인용',issuer:'모집기관 공고문',url:'https://apply.lh.or.kr',icon:'shield',guide:'공고에 첨부된 자산 보유 사실확인서 양식을 확인하고 본인에게 해당하는 항목을 작성해주세요.'}
];
export const initialState={name:'가나다',region:'서울특별시',saved:[],done:[],conditions:[],reminder:true};
export const conditionItems=[{id:'age',title:'연령 기준',desc:'공고의 연령 기준을 읽고 내 생년월일과 비교했어요.'},{id:'house',title:'무주택 기준',desc:'공고에서 정한 무주택 기준과 적용 대상을 확인했어요.'},{id:'income',title:'소득 기준',desc:'본인·가구 소득 산정 범위와 기준 금액을 확인했어요.'},{id:'family',title:'가구원 기준',desc:'가구원 범위와 함께 제출할 서류를 확인했어요.'}];
export const daysLeft = date => {
 if(!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const today=Date.UTC(Number(parts.find(p=>p.type==='year')?.value),Number(parts.find(p=>p.type==='month')?.value)-1,Number(parts.find(p=>p.type==='day')?.value));
 const [year,month,day]=date.split('-').map(Number);
 return Math.round((Date.UTC(year,month-1,day)-today)/86400000);
};
export const deadlineText = date => { const left=daysLeft(date); return left===null||Number.isNaN(left)?'공고 원문 확인':left<0?'접수 마감':left===0?'D-day':`D-${left}`; };
