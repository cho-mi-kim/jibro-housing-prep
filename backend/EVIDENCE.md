# 공고문 조건 발췌

`GET /api/notice-evidence?url=<LH 공고 상세 URL>`

별도 AI API 키 없이 LH의 공개 모집공고 PDF·HWPX에서 연령, 무주택, 소득·자산, 가구원 관련 문구를 발췌한다. **자격 판정이나 전체 요건을 대체하는 생성형 요약은 아니다.** 개인의 서류·프로필·준비 기록은 요청에 보내지 않는다.

## 실행과 배포 연결

JDK 17과 포함된 Gradle Wrapper를 사용한다. `gradlew.bat test bootJar`(Windows) 또는 `sh ./gradlew test bootJar`로 테스트와 빌드를 실행한다.

```sh
java -jar build/libs/jibro-api-0.0.1-SNAPSHOT.jar --server.port=8081
```

현재 chatgpt.site는 정적 배포다. Java 프로세스를 함께 실행하지 않는다. Railway 등 Java 호스팅에 배포한 **HTTPS 서버 주소**를 프론트엔드 빌드 시 `VITE_NOTICE_EVIDENCE_API_BASE`로 설정해야 최신 자료를 요청할 수 있다. 기존 `VITE_API_BASE`와 독립적이므로 준비 기록 저장 서버를 임의로 바꾸지 않는다. Railway 실행 명령에서는 `--server.port=$PORT`를 지정한다.

기본 허용 출처는 localhost:5173, 127.0.0.1:5174, 기존 JIBRO chatgpt.site다. 다른 프론트엔드 도메인을 연결할 때는 NoticeEvidenceController의 허용 출처에 정확한 도메인을 추가한다. 브라우저가 임의 서버 주소를 입력하는 기능은 제공하지 않는다.

## 결과와 신뢰 범위

- `noticeUrl`: 추적 파라미터를 제외한 공고 식별 URL. UI는 현재 공고와 일치하는 응답만 사용한다.
- `checkedAt`: 실제 조회 시각. 저장된 배포 시점 자료와 실시간 응답을 구분해서 표시한다.
- `sources`: 공식 파일명, 다운로드 주소, SHA-256.
- `criteria[].evidence`: 인접 문맥을 포함한 발췌, **PDF 뷰어의 물리적 페이지 번호**, 두 쪽 모아찍기는 좌/우 위치. 인쇄된 문서 쪽수와 다를 수 있다. HWPX는 물리적 페이지를 추측하지 않고 `page=0`, `region=본문 N구역`으로 표시한다.
- `status=partial`: 근거를 일부 찾음. 모든 조건·예외를 분석했다는 뜻이 아니다.
- `status=unavailable` 또는 개별 `not_found`: 읽지 못했거나 관련 문구를 못 찾음. 자격 제한이 없다는 뜻이 아니다.
- 체크 표시는 사용자의 열람 기록이며 분석 결과와 별도다. 상세만 열어서는 기록이나 현재 준비 공고를 바꾸지 않는다.

## 제한

공식 다운로드 ID를 가진 PDF·HWPX를 후보로 수집한다. 파일명의 `공고` 유무는 필수 조건이 아니다. 모집·공고 파일을 먼저, 이름이 불명확한 자료를 다음으로, 양식·팸플릿을 마지막으로 확인한다. 같은 이름의 PDF/HWPX 쌍은 PDF를 우선한다.

본문 첫 부분의 주택 모집 안내, 신청·입주 자격, 모집·접수 일정과 공식 상세 제목의 지역·단지 식별 정보를 함께 확인한 문서만 발췌한다. 단지명이 공급표에만 있는 경우도 확인한다. 불확실하거나 다른 공고·서식으로 판별된 첨부는 발췌에 섞지 않고 경고로 남긴다. 이 규칙은 보수적인 휴리스틱이며 모든 문서 형태의 정확한 분류를 보장하지 않는다.

최대 12개 후보에서 검증된 공고문 3개/각 48MB/PDF 150쪽까지 읽으며 초과 또는 일부 실패는 경고를 표시한다. HWPX는 ZIP 내부 XML의 본문·표 문단을 읽고 머리말·꼬리말을 제외한다. 외부 XML 엔터티를 금지하고 압축 해제 용량·항목 수·구조 깊이를 제한한다. 기존 바이너리 HWP, 암호화·스캔 PDF/OCR, 복잡한 병합 표의 의미 해석은 지원하지 않는다. 다중 공급대상 공고는 여러 대상의 문구가 포함될 수 있으므로 대상별 확정 기준으로 표시하지 않는다.

원격 주소는 HTTPS `apply.lh.or.kr`의 공고 상세 경로와 공식 파일 ID로 제한하고 리디렉션은 따라가지 않는다. 동시 분석 1건, 공고별 재요청 60초, 성공/불가 결과 캐시 6시간(최대 100개)이다. 캐시는 메모리이며 재시작 시 비워진다. 신규 대규모 서비스에 연결할 때는 별도 요청량 제한과 작업 큐를 운영 환경에 추가한다.

## 분석 도구 설치

Python 3.10 이상에서 저장소 루트의 가상환경에 `python -m pip install -r backend/scripts/requirements.txt`로 의존성을 설치한다. 개인 PC의 임시 라이브러리 경로가 필요하지 않다. 가상환경 생성과 OS별 명령은 루트 README를 참고한다.

## 정적 사이트용 스냅샷

서버를 아직 연결하지 않은 사이트도 `public/notice-evidence.json`의 실제 발췌를 읽을 수 있다. 화면은 저장된 자료임과 확인 시각을 명시한다. 새 공고나 정정 자료를 자동 갱신하는 기능은 서버 연결 후 동작한다.

루트에서 실행:

```sh
python backend/scripts/export_notice_evidence.py --api http://127.0.0.1:8081
node --test src/noticeEvidence.test.mjs
```

내보내기는 기존 목록의 기한이 남은 공고만 순차 조회한다. 새로운 문구를 생성하거나 날짜·소득 기준을 추측하지 않는다. 배포 전에 `.sites-runtime/evidence-export-report.json`의 실패 건수 및 대표 공고의 원문 근거를 확인한다.


## 1~4인 소득·자산 금액 안내

`python backend/scripts/export_income_guides.py`를 발췌 스냅샷 갱신 후 실행한다(PyMuPDF 필요). 공식 첨부의 SHA-256이 발췌 자료와 같을 때만 `src/incomeGuides.json`을 생성한다. 현재 지원 범위는 완화·배제 공고가 아닌 국민임대의 표준 70/80/90% 표이며, 1인 20%p·2인 10%p 가산 문구, 세전 가구 합산, 1~4인 모든 행과 자산·자동차 금액을 함께 확인한다. 1인 90%, 2인 80%, 3·4인 70%를 사용하고 출산자녀 추가 가산 전 기본 한도임을 표시한다. 표 원문·파일·PDF 페이지를 함께 저장한다.

다중 첨부, 지원하지 않는 표, 완화 공고, 변경된 파일은 값을 추측하지 않는다. 다른 공고의 금액을 재사용하지 않으며 화면에는 원문 확인 필요를 표시한다. `noticeUrl`과 파일 ID·SHA-256·주소가 하나라도 달라지면 저장된 금액 안내는 사용하지 않는다. API나 공고문 갱신 후에는 스냅샷과 금액표를 다시 내보내야 한다. `.sites-runtime/income-guides-report.json`에서 지원·실패 결과를 확인한다.


## 공고 유형별 짧은 요약

`python backend/scripts/read_condition_pages.py` → `node backend/scripts/export_readable_guides.mjs` 순서로 실행하면 검증된 원문 페이지에서 `src/readableGuides.json`을 갱신한다. PDF 파일 SHA-256을 기존 발췌와 대조한 뒤, 두 쪽 모아찍기는 좌우로 나누어 읽는다. HWPX나 PDF를 읽지 못한 경우 기존 검증 발췌를 공통 파서에 전달한다. `src/readableConditions.mjs`는 저장된 안내가 없거나 소스가 바뀐 경우 API 발췌에도 동일하게 적용된다.

연령의 대상·예외, 가족의 범위·혼인·자녀 조건, 소득 배제와 자동차 예외를 구분한다. 신혼 매입임대 70/90 또는 130/200% 표는 1~4인 열 순서, 소득 적용 문장, 소가구 가산 설명을 함께 확인한 경우에만 일반·맞벌이 금액을 표시한다. 청년은 부모 합산 2순위와 본인 3순위를 구분하고 없는 4인 금액을 만들어내지 않는다. 국민임대 표준 금액표는 기존 `export_income_guides.py`로 별도 생성한다.

각 요약에 정확한 근거 발췌·파일·페이지를 보존하며, 대상별 문구가 충돌하거나 근거가 없으면 해당 요약을 생략한다. 모든 공고가 네 기준 전체를 자동 분석했다는 뜻은 아니다. `.sites-runtime/readable-guide-audit.json`에서 공고별 생성 항목과 미지원 항목을 확인하고, 배포 전 `node --test src/readableConditions.test.mjs src/incomeGuide.test.mjs`를 실행한다.


## 신청 일정 수집

`python backend/scripts/export_notice_schedules.py`는 현재 목록의 기한이 남은 공고에 대해 LH 공식 상세의 공급일정을 수집해 `public/notice-schedules.json`을 만듭니다. BeautifulSoup4와 PyMuPDF가 필요합니다. `--cached`는 `.sites-runtime/schedule-html`에 저장된 상세 페이지로 재분석하며 확인 시각도 원래 수집 시각을 유지합니다. 사이트에는 자동 실시간 수집 대신 이 저장된 자료와 확인 시각을 표시합니다. 새 목록·정정공고를 배포할 때 다시 수집해야 합니다.

공식 상세의 접수 기간, 서류 대상자 발표, 서류 접수 기간을 읽습니다. 단지별 날짜가 다르면 하나로 합치지 않습니다. 당첨자 발표와 당첨자 서류 제출은 서류 대상자 발표와 별개 이름으로 표시합니다. 공고 식별자와 URL이 맞는 자료만 연결하며, 선택한 세부 일정의 빈 날짜를 다른 단지·순위의 날짜로 채우지 않습니다.

첨부 발췌는 기존 검증 자료의 파일 ID와 SHA-256이 같은 PDF만 사용합니다. 명확한 신청접수 표는 순위·주택형별 접수 날짜를 별도 선택 항목으로 제공합니다. 연도가 없거나 날짜 해석이 모호한 셀, 지원하지 않는 병합표, 스캔 문서는 자동 날짜로 확정하지 않습니다. 원문 발췌·파일·페이지를 함께 제공하고 기존 저장된 첨부 자료임을 구분합니다. HWPX의 일정 표 자동 해석은 아직 지원하지 않습니다.

검증: `python -m unittest discover -s backend/scripts -p test_notice_schedules.py` 및 `node --test src/scheduleTimeline.test.mjs`. 수집 실패는 `.sites-runtime/schedule-report.json`에 남습니다. 신규 공고 전부의 모든 일정이 확보됐다는 의미는 아니며, 알 수 없는 단계는 원문 확인을 안내합니다.
