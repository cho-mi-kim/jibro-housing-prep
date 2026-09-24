# JIBRO · 주거지원 준비노트

주거지원 공고를 확인하고 공고별 조건·서류·일정을 기록하는 한국어 모바일 웹 앱입니다. 신청 접수나 자격 심사를 대신하지 않습니다.

## 빠른 시작

Node.js 22.12 이상과 npm 10.9 이상을 사용합니다.

```sh
git clone https://github.com/cho-mi-kim/jibro-housing-prep.git
cd jibro-housing-prep
npm ci
npm run dev
```

기본 주소는 `http://localhost:5173`입니다. 환경 변수를 설정하지 않으면 준비 기록은 현재 브라우저에 저장되고, 공고문 발췌·서류·일정은 저장소에 포함된 스냅샷을 사용합니다. 다른 기기와 자동 동기화되지 않습니다.

```sh
npm test
npm run build
npm run preview
```

빌드 결과는 `dist/`에 생성합니다. `node_modules/`, `dist/`, 개인 환경 설정은 커밋하지 않습니다. 예전 소스 ZIP은 자동 갱신되지 않으므로 협업할 때는 Git 브랜치의 소스 파일을 기준으로 사용하세요.

## 화면과 데이터

| 영역 | 내용 |
| --- | --- |
| 홈 | 현재 공고의 준비도, 벽돌집 진행률, 다음 일정 |
| 공고 | 검색·지역/대상 필터·관심 공고·상세·조건 발췌 |
| 내 준비 | 공고별 서류 기록과 신청 일정 |
| 가이드 | 주제별 안내, 검색, 접는 도움말, 공식 문의처 |
| 마이 | 준비 현황, 알림·프로필 설정, 서비스 안내·문의 |

- 상세 열람과 준비 시작은 별도입니다. 시작 버튼을 누를 때 현재 준비 공고를 바꿉니다.
- 완료 체크와 준비도는 사용자의 기록이며 자격 충족 여부나 당첨 가능성을 뜻하지 않습니다.
- `src/lhNotices.js`, `public/notice-evidence.json`, `public/notice-schedules.json`, `public/notice-documents/`는 수집 당시 자료입니다. 실시간 정정 여부를 보장하지 않습니다.
- 서류 후보에는 해당자·가점·계약 단계용 항목이 포함됩니다. 모든 후보가 필수는 아닙니다. 포함한 목록과 검증된 공통 항목을 기준으로 진행률을 계산합니다.
- 화면의 요약은 원문 조건·예외 전체를 대체하지 않습니다. 최종 자격과 제출 목록은 공식 공고에서 확인합니다.

## Spring API 실행

Java 17이 필요합니다. Gradle Wrapper 8.14.3과 배포본 체크섬을 포함하므로 Gradle을 따로 설치하지 않아도 됩니다.

```sh
cd backend
# macOS / Linux
sh ./gradlew test bootJar
sh ./gradlew bootRun
```

Windows에서는 `gradlew.bat test bootJar`, `gradlew.bat bootRun`을 사용합니다.

루트 `.env.example`을 `.env.local`로 복사하고 필요한 연결만 설정한 뒤 프론트엔드를 다시 실행합니다.

| 변수 | 역할 |
| --- | --- |
| `VITE_API_BASE` | 준비 기록과 공고 API의 기본 주소. 예: `http://localhost:8080` |
| `VITE_NOTICES_API_BASE` | LH 목록 수집·URL 가져오기만 연결. 준비 기록은 로컬에 유지 가능 |
| `VITE_NOTICE_EVIDENCE_API_BASE` | PDF·HWPX 조건 발췌 API. 준비 기록 저장 방식과 독립적으로 연결 |

`VITE_` 변수는 브라우저에 공개됩니다. 비밀 키를 넣지 마세요. 다른 프론트엔드 주소는 서버의 `JIBRO_CORS_ALLOWED_ORIGINS`에 쉼표로 구분해 명시하세요. 기본은 localhost/127.0.0.1의 5173·4173 포트와 기존 chatgpt.site 주소입니다.

**운영 배포 제한:** 준비 기록 API는 로그인 인증 대신 기기 식별자별 JSON 파일 저장 방식입니다. 인증·권한 확인·데이터베이스를 갖춘 공개 서비스가 아닙니다. LH 목록 크롤러와 화면 연결은 검증했습니다. 수집 대상·마감일 의미·재검증 방법은 [크롤러 안내](backend/README.md)를 참고하세요.

PDF·HWPX 발췌 API는 구현됐지만 바이너리 HWP, OCR이 필요한 이미지 PDF, 모든 복합 표 해석은 지원하지 않습니다. 시간·크기·대상 주소 제한과 원문 식별 검사를 적용합니다. 정적 호스팅만으로 Java API가 실행되지는 않습니다.

## 공고 자료 유지보수

웹 앱 실행에는 Python이 필요하지 않습니다. 스냅샷을 재생성하거나 분석 도구를 검증할 때만 Python 3.10 이상과 다음 환경을 사용합니다.

```sh
python -m venv .venv
# macOS / Linux
.venv/bin/python -m pip install -r backend/scripts/requirements.txt
.venv/bin/python -m unittest discover -s backend/scripts -p 'test_*.py'
```

Windows에서는 `.venv/Scripts/python.exe`를 사용합니다. 명령은 저장소 루트에서 실행합니다.

- [발췌·소득 요약·일정 수집](backend/EVIDENCE.md)
- [공고별 서류 후보와 근거](docs/notice-documents.md)
- 저장된 전체 서류 근거 점검: `node scripts/audit-document-summaries.mjs`

새 자료를 갱신할 때 공고 식별자·공식 첨부 URL·확인 시각·페이지·SHA-256을 보존하세요. 날짜나 대상별 기준이 모호하면 추측하지 않습니다. 자동 테스트는 저장된 자료와 고정 사례 검증이며 모든 최신 공고를 실시간 재검토하는 것은 아닙니다.

## 협업

[CONTRIBUTING.md](CONTRIBUTING.md)와 [agent.md](agent.md)를 읽고 최신 `main`에서 작업 브랜치를 만듭니다. `AGENTS.md`는 AI 도구용 진입점입니다.

```sh
git switch main
git pull --ff-only
git switch -c codex/작업이름
```

작업 브랜치를 Push하고 PR로 검토합니다. CI는 프론트엔드 테스트·빌드, 백엔드 테스트·빌드, Python 스냅샷 파서 테스트를 실행합니다. 백엔드 의존성 수정 시 이미 반영된 `jsoup 1.23.2`를 이전 버전으로 되돌리지 않습니다.

GitHub 업로드와 사이트 배포는 별개입니다. 이 저장소에 Push해도 기존 chatgpt.site가 자동으로 변경되지는 않습니다. 자동 배포 연결과 `main` 보호 규칙은 계정의 실제 설정을 확인해야 합니다.
