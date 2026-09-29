# JIBRO · 주거지원 준비노트

주거지원 공고를 확인하고 회원별로 조건·서류·일정을 기록하는 한국어 모바일 웹 앱입니다. 신청 접수나 자격 심사를 대신하지 않습니다.

## 빠른 시작

Node.js 24.19 이상과 npm 10.9 이상을 사용합니다. 이 변경은 `codex/sync-site-20260924` 브랜치에서 검토 중입니다. 병합 전에는 해당 브랜치를 받아 실행하세요.

```sh
git clone --branch codex/sync-site-20260924 https://github.com/cho-mi-kim/jibro-housing-prep.git
cd jibro-housing-prep
npm ci
npm run preview:account
```

`http://127.0.0.1:5190`에서 화면·회원가입·로그인·암호화된 준비 기록을 함께 확인합니다. 로컬 전용 일반 테스트 회원 `admin / admin`을 제공합니다. 관리자 권한은 없으며, 미리보기를 종료하면 계정·기록·암호화 키가 모두 폐기됩니다. 실제 회원 정보는 테스트에 사용하지 마세요.

| 명령 | 용도 |
| --- | --- |
| `npm run preview:account` | 앱 빌드 후 Worker/D1 호환 계정 미리보기 실행. 변경 후 다시 실행 |
| `npm run dev` | `http://localhost:5173`의 Vite 화면 개발. 이 서버만으로 로그인·저장은 동작하지 않음 |
| `npm run build` | 자료 카탈로그 생성, `dist/client` 화면과 `dist/server` Worker 빌드 |
| `npm run preview` | 빌드된 화면만 확인. 계정 기능은 `preview:account` 사용 |
| `npm test` | 화면 데이터 규칙과 기록·일정·요약 테스트 |
| `npm run test:account` | 계정·암호화·저장 충돌·메일 흐름 테스트 |

GitHub 코드의 빌드는 개인 Sites 설정 파일 없이 동작합니다. `node_modules/`, `dist/`, 비밀 환경 변수, 로컬 DB는 커밋하지 않습니다. 예전 소스 ZIP은 자동 갱신되지 않으므로 현재 Git 브랜치를 사용하세요.

## 화면과 데이터

- 홈·공고·내 준비·가이드·마이 화면과 JIBRO 로고, 벽돌집 진행률을 제공합니다.
- 공고 상세 열람과 준비 시작은 별도입니다. 비로그인 상태의 준비 시작은 로그인으로 연결합니다.
- 회원가입은 닉네임·이메일·비밀번호·선택적 신청 조건·동의 순서로 진행합니다. 가입 후에는 신청 조건을 항목별 또는 순서대로 수정할 수 있습니다.
- 조건·서류·신청 일정은 해당 공고의 확인 자료를 사용합니다. 개인 입력값에 관련된 기준과 서류 후보를 먼저 보여주지만 자격이나 필수 여부를 자동 확정하지 않습니다.
- 공고·근거 버전이 달라지면 기존 체크를 보존하면서 다시 확인하도록 안내합니다. 과거 체크를 새 자료의 완료 수에 그대로 포함하지 않습니다.
- 접수 전·접수 중·종료·대상별 일정·확인 필요를 구분합니다. 앱 알림은 현재/관심 공고의 확인된 일정에 연결하며 읽음 상태는 회원 기록에 저장합니다.
- `src/lhNotices.js`, `public/notice-evidence.json`, `public/notice-schedules.json`, `public/notice-documents/`는 수집 당시 자료입니다. 모든 최신 공고와 정정을 실시간으로 보장하지 않습니다.
- 준비도는 사용자의 확인 기록이며 합격 가능성이나 실제 신청 완료를 뜻하지 않습니다.

## 회원 서버와 Spring 수집 서버

두 서버는 역할과 저장소가 다릅니다.

| 구성 | 역할·저장소 |
| --- | --- |
| `server/`, `db/`, `drizzle/` | Better Auth 기반 이메일 계정, 세션, 회원별 준비 기록. Worker와 D1 사용 |
| `backend/` | Java 17 + Spring Boot의 LH HTML 수집·URL 가져오기·PDF/HWPX 발췌. 목록은 영속 파일과 백업에 보관 |

회원 준비 기록과 신청 조건은 서버에서 AES-256-GCM으로 암호화합니다. 비밀번호는 scrypt 해시를 사용합니다. 이메일·닉네임 등 인증 테이블 필드는 준비 기록의 추가 암호화와 별개입니다. 설정과 범위는 [계정 안내](docs/EMAIL_AUTH.md), [암호화·키 관리](docs/NOTEBOOK_ENCRYPTION.md)를 확인하세요.

회원 API는 화면과 같은 출처의 `/api/account*`, `/api/member-notebook`에서 제공해야 합니다. 정적 프론트엔드만 Vercel 등에 올리면 계정 기능은 동작하지 않습니다. 현재 D1 스키마를 PostgreSQL에서 그대로 실행할 수도 없습니다. 다른 호스팅과 DB를 선택하면 별도 연결·이관 작업이 필요합니다.

Java 17을 준비한 뒤 별도 터미널에서 수집 서버를 실행합니다. Gradle Wrapper 8.14.3과 체크섬을 포함합니다.

```sh
cd backend
# macOS / Linux
sh ./gradlew test bootJar
sh ./gradlew bootRun
# Windows: gradlew.bat test bootJar / gradlew.bat bootRun
```

루트 `.env.example`을 `.env.local`로 복사해 필요한 공고 API만 설정하고 화면을 다시 빌드합니다.

```dotenv
VITE_NOTICES_API_BASE=http://localhost:8080
VITE_NOTICE_EVIDENCE_API_BASE=http://localhost:8080
```

계정 미리보기에서 Spring을 연결할 때는 Spring의 `JIBRO_CORS_ALLOWED_ORIGINS`에 `http://127.0.0.1:5190`을 추가하세요. 기본 5173·4173 외의 주소는 명시해야 합니다. `VITE_API_BASE`는 공고 API의 이전 공통 설정이며 회원 인증·저장 주소를 바꾸지 않습니다. `VITE_` 변수에 비밀 키를 넣지 마세요.

Spring의 기존 `/api/notebook`은 인증 없는 기기 헤더 방식으로 남아 있습니다. 현재 회원 앱은 이를 사용하지 않으며 공개 회원 저장소로 노출하지 않습니다. 수집 서버도 운영 위치·영속 볼륨·접근 설정을 별도로 검증해야 합니다. [수집 범위와 실행 설정](backend/README.md)을 참고하세요.

## 공고 자료 유지보수

Python은 화면 실행에 필요하지 않습니다. 자료를 생성하거나 파서 테스트를 실행할 때 Python 3.10 이상을 사용합니다.

```sh
python -m venv .venv
# macOS / Linux; Windows는 .venv/Scripts/python.exe 사용
.venv/bin/python -m pip install -r backend/scripts/requirements.txt
.venv/bin/python -m unittest discover -s backend/scripts -p 'test_*.py'
```

- [발췌·소득 요약·일정 수집](backend/EVIDENCE.md)
- [공고별 서류 후보와 근거](docs/notice-documents.md)
- [신청 조건과 개인별 표시](docs/APPLICANT_PROFILE.md)
- [최근 검증 범위와 한계](docs/verification-2026-09-26.md)
- [남은 TODO](docs/TODO.md)

`npm run build`는 저장된 자료로 버전 카탈로그를 만듭니다. LH에서 새 공고 전체를 수집·분석하는 명령은 아닙니다. 생성 도구는 실패한 공고의 마지막 성공 자료를 보존합니다. 공고 ID·URL·확인 시각·페이지·SHA-256을 유지하고 모호한 기준·날짜를 추측하지 않습니다. 바이너리 HWP와 OCR이 필요한 PDF는 지원 범위 밖입니다.

## 협업과 공개 전 작업

[CONTRIBUTING.md](CONTRIBUTING.md)와 [agent.md](agent.md)를 읽고 작업 브랜치에서 수정한 뒤 PR을 만듭니다. 이번 동기화 브랜치가 병합되기 전에는 그 변경 위에서 작업할지 팀과 기준을 맞추세요. CI는 화면·계정·Java·Python 검증과 빌드를 실행합니다. Java 의존성의 `jsoup 1.23.2`를 이전 버전으로 되돌리지 않습니다.

GitHub Push, PR 병합, chatgpt.site 배포는 서로 별개입니다. 개인 Site의 프로젝트 설정·회원 데이터·비밀 키는 공유하지 않습니다. 실제 이메일 발송, 운영 호스팅·DB, 정기 수집, main 보호·자동 배포, 테스트 로그인 제거와 최종 정책 확인은 [TODO](docs/TODO.md)에 남겨두었습니다.
