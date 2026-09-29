const lh = {label:'LH 청약플러스',url:'https://apply.lh.or.kr/lhapply/apply/main.do'};
const gov = {label:'정부24 등본 발급 안내',url:'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000015&HighCtgCD=A1004'};
export const guideTopics = [
  {id:'housing',title:'지원제도 알아보기',icon:'house'},
  {id:'terms',title:'조건과 용어',icon:'terms'},
  {id:'documents',title:'서류 발급 안내',icon:'file'},
  {id:'steps',title:'신청 절차',icon:'calendar'},
  {id:'contact',title:'공식 문의처',icon:'phone'},
];
export const guideArticles = [
  {id:'eligibility',topic:'terms',icon:'terms',title:'신청 자격과 선정 순위는 어떻게 다른가요?',answer:['신청 자격은 신청할 수 있는 조건이고, 선정 순위는 신청자 중 누구를 먼저 선정할지 정하는 기준이에요.','공고의 ‘신청 자격’과 ‘입주자 선정 방법’을 각각 확인하세요. 자격을 충족해도 입주가 확정되는 것은 아니에요.'],links:[lh]},
  {id:'household',topic:'terms',icon:'users',title:'가구원 범위는 어떻게 확인하나요?',answer:['공고의 ‘세대구성원’ 또는 ‘무주택세대구성원’ 설명부터 확인하세요. 함께 사는 가족과 심사에 포함되는 가족의 범위가 다를 수 있어요.','배우자나 따로 사는 가족의 포함 여부는 모집 대상별 기준을 확인해야 해요. 등본만 보고 판단하기 어렵다면 공고에 적힌 문의처에 확인하세요.'],links:[lh]},
  {id:'resident',topic:'documents',icon:'file',title:'주민등록등본은 어디에서 발급하나요?',answer:['정부24에서 ‘주민등록표 등본(초본) 발급’을 찾아 신청할 수 있어요. 주민센터 방문 발급도 가능해요.','발급 전 공고에서 필요한 서류 종류, 발급일 기준, 세대원 정보와 주소 변동 이력 등의 표시 항목을 확인하세요.'],links:[gov]},
  {id:'find-housing',topic:'housing',icon:'house',title:'나에게 맞는 지원제도는 어떻게 찾나요?',answer:['LH 청약플러스의 임대가이드에서 주택 유형과 공급 대상을 살펴보세요. 관심 있는 유형을 찾았다면 실제 모집 공고를 확인해요.','JIBRO 공고 탭에서 지역·대상으로 좁혀 볼 수 있어요. 최종 자격은 해당 공고의 조건을 기준으로 확인하세요.'],links:[lh]},
  {id:'reserve',topic:'housing',icon:'house',title:'예비입주자로 선정되면 바로 입주하나요?',answer:['예비입주자는 빈집이 생기면 정해진 순서에 따라 입주 기회를 안내받는 경우예요. 선정 즉시 입주하는 것으로 생각하면 안 돼요.','입주 순서, 대기 기간, 예비자 자격 유지 조건은 해당 공고에서 확인하세요.'],links:[lh]},
  {id:'income',topic:'terms',icon:'users',title:'소득·자산은 어떤 기준으로 확인하나요?',answer:['공고에 있는 가구원 수별 소득표와 자산 기준을 함께 확인하세요. 같은 금액을 모든 공고에 적용할 수는 없어요.','심사에 포함되는 가족, 소득 산정 방법, 자산·자동차 기준과 예외를 확인한 뒤 내 상황과 비교하세요.'],links:[lh]},
  {id:'required-docs',topic:'documents',icon:'file',title:'목록에 있는 서류를 모두 준비해야 하나요?',answer:['공통 제출서류와 해당자만 내는 서류를 나눠 확인하세요. 가점·대리 신청·계약 단계에서만 필요한 서류도 있어요.','내 준비 탭은 준비 상태를 기록하는 곳이에요. 최종 제출 목록과 발급 기준은 공고의 제출서류 안내를 확인하세요.'],links:[lh]},
  {id:'apply-steps',topic:'steps',icon:'calendar',title:'신청은 어떤 순서로 진행하나요?',answer:['공고와 자격 확인 → 접수 → 서류 제출 대상자 확인 → 서류 제출 → 심사·결과 확인 순으로 준비해요. 이후 계약과 입주 안내를 확인하세요.','공고마다 절차와 일정이 달라요. 접수 마감과 서류 제출 마감을 구분하고, 실제 신청은 공고에 안내된 공식 접수처에서 진행하세요.'],links:[lh]},
  {id:'practice',topic:'steps',icon:'calendar',title:'온라인 신청을 미리 연습할 수 있나요?',answer:['LH 청약플러스의 ‘청약연습하기’에서 신청 화면과 입력 과정을 미리 살펴볼 수 있어요. 실제 접수에 사용할 기기로 연습해보세요.','연습은 실제 신청이 아니에요. 접수 기간에 공식 신청을 완료하고 접수 내역을 확인하세요.'],links:[{label:'LH 청약연습하기 안내',url:'https://apply.lh.or.kr/lhapply/cm/cntnts/cntntsView.do?cntntsId=1201411&mi=1201763'}]},
  {id:'lh-contact',topic:'contact',icon:'phone',title:'자격이나 제출서류는 어디에 문의하나요?',answer:['먼저 해당 공고에 적힌 담당 기관의 문의처를 확인하세요. LH 공고 관련 상담은 LH 콜센터 1600-1004에서도 안내받을 수 있어요.','공고명과 문의할 내용을 미리 정리하면 상담이 쉬워요. 앱 사용 문의는 아래 JIBRO 문의처를 이용해주세요.'],links:[{label:'LH 공식 콜센터 안내',url:'https://www.lh.or.kr/menu.es?mid=a10310000000'},{label:'1600-1004 전화하기',url:'tel:16001004'}]},
  {id:'app-contact',topic:'contact',icon:'phone',title:'JIBRO 사용 중 문제가 생겼어요.',answer:['문제가 생긴 화면과 공고명, 어떤 동작에서 문제가 발생했는지 적어 보내주세요.','주민등록번호, 인증서, 계좌 정보 등 민감한 개인정보는 보내지 마세요. 자격 심사와 실제 접수에 관한 문의는 공고 담당 기관에 확인해주세요.'],links:[{label:'jibro@dankook.ac.kr로 문의',url:'mailto:jibro@dankook.ac.kr'}]},
];
