# JIBRO · 주거지원 준비노트

주거지원 공고를 확인하고 회원별로 조건·서류·일정을 기록하는 한국어 모바일 웹 앱입니다. 신청 접수나 자격 심사를 대신하지 않습니다.

## 빠른 시작

Node.js 24.19 이상, npm 10.9 이상, **Java 17 JDK**가 필요합니다. 현재 전환 작업은 `codex/spring-member-api` 브랜치에서 검토합니다.

```sh
git clone --branch codex/spring-member-api https://github.com/cho-mi-kim/jibro-housing-prep.git
cd jibro-housing-prep
npm ci
npm run preview:account
```

`http://127.0.0.1:5173`에서 React 화면과 Spring 회원 API를 함께 확인합니다. 이 명령은 Gradle Wrapper로 Java 서버를 빌드하고, Spring(8080)과 Vite(5173)를 실행합니다. `JAVA_HOME`은 Java 17 JDK를 가리켜야 합니다. 최초 실행에는 의존성 다운로드가 필요합니다. 종료는 Ctrl+C이며 다른 서버가 포트를 사용하면 시작을 중단합니다.

로컬 전용 `admin / admin`은 관리자 권한 없는 일반 테스트 회원입니다. **로컬 계정·기록은 종료해도 남습니다.** `backend/.local-data/`의 H2 DB와 암호화 키를 함께 보관하세요. 실제 개인정보로 테스트하지 마세요. 운영 프로필에서는 테스트 로그인이 차단됩니다.

| 명령 | 용도 |
| --- | --- |
| `npm run preview:account` | React + Spring을 함께 실행. React 수정은 즉시 반영, Java 수정 후 재실행 |
| `npm run dev` | Vite만 실행. `/api`를 별도로 실행한 Spring 8080으로 전달 |
| `npm run build` | 카탈로그와 `dist/client` React 정적 파일 생성 |
| `npm run preview` | 빌드된 React를 4173에서 확인. `/api`는 Spring 8080으로 전달 |
| `npm test` | 화면 데이터·일정·조건·회원 요청 테스트 |
| `npm run test:account` | Spring 회원·암호화·이관·동시 저장 테스트. Java 17 필요 |
| `cd backend` → `sh ./gradlew build` | Spring 전체 테스트·실행 JAR 빌드. Windows는 `gradlew.bat build` |

GitHub 빌드에 개인 Sites 설정은 필요하지 않습니다. `node_modules/`, `dist/`, `.local-data/`, 비밀 환경 변수·실제 계정 내보내기는 커밋하지 않습니다. 예전 ZIP 대신 현재 Git 브랜치를 사용하세요.

## 화면과 데이터

- 홈·공고·내 준비·가이드·마이 화면과 JIBRO 로고, 벽돌집 진행률을 제공합니다.
- 공고 상세 열람과 준비 시작은 별도입니다. 비로그인 상태의 준비 시작은 로그인으로 연결합니다.
- 회원가입은 닉네임·이메일·비밀번호·선택적 신청 조건·동의 순서로 진행합니다. 가입 후에는 신청 조건을 항목별 또는 순서대로 수정할 수 있습니다.
- 조건·서류·신청 일정은 해당 공고의 확인 자료를 사용합니다. 개인 입력값에 관련된 기준과 서류 후보를 먼저 보여주지만 자격이나 필수 여부를 자동 확정하지 않습니다.
- 공고·근거 버전이 달라지면 기존 체크를 보존하면서 다시 확인하도록 안내합니다. 과거 체크를 새 자료의 완료 수에 그대로 포함하지 않습니다.
- 접수 전·접수 중·종료·대상별 일정·확인 필요를 구분합니다. 앱 알림은 현재/관심 공고의 확인된 일정에 연결하며 읽음 상태는 회원 기록에 저장합니다.
- `src/lhNotices.js`, `public/notice-evidence.json`, `public/notice-schedules.json`, `public/notice-documents/`는 수집 당시 자료입니다. 모든 최신 공고와 정정을 실시간으로 보장하지 않습니다.
- 준비도는 사용자의 확인 기록이며 합격 가능성이나 실제 신청 완료를 뜻하지 않습니다.

## React + Spring MVC 구조

| 구성 | 역할 |
| --- | --- |
| `src/`, `public/` | React 화면, 기존 공고·조건·일정·서류 자료 |
| `backend/` | Java 17 Spring MVC의 회원가입·로그인·세션·회원 기록·메일 인증, LH 수집·PDF/HWPX 발췌 |
| `backend/src/main/resources/db/migration/` | Flyway DB 변경. 로컬 H2 / 운영 PostgreSQL |
| `migration/legacy-worker/` | 이전 Worker/D1 구현의 이관 참고 자료. 현재 실행·빌드에는 사용하지 않음 |

비밀번호는 scrypt 단방향 해시, 신청 조건과 준비 기록은 AES-256-GCM 암호화로 저장합니다. 세션은 HttpOnly 쿠키와 DB의 토큰 해시를 사용합니다. 이메일·닉네임은 준비 기록의 추가 암호화 대상이 아닙니다. [회원 API](docs/EMAIL_AUTH.md), [키 관리](docs/NOTEBOOK_ENCRYPTION.md), [기존 계정 이관](docs/SPRING_MIGRATION.md)을 확인하세요.

화면과 같은 출처의 `/api/**`를 Spring으로 전달해야 합니다. 로컬에서는 Vite 프록시가 담당합니다. 운영은 HTTPS 프론트엔드와 Spring을 같은 출처로 연결하는 리버스 프록시/호스팅 rewrite가 필요합니다. 정적 화면만 배포하면 로그인은 작동하지 않습니다.

계정은 별도 설정 없이 로컬에서 실행됩니다. 메일 키와 운영 DB 설정은 `backend/.env.example`을 참고하세요. `preview:account`는 `backend/.env.local`을 읽지만 Java 단독 실행은 운영체제 환경 변수로 주입해야 합니다. `VITE_` 변수에는 비밀 키를 넣지 않습니다.

공고 수집·실시간 발췌 연결은 루트 `.env.example`을 `.env.local`로 복사해 설정합니다. 설정이 없으면 기존 공개 스냅샷을 사용합니다. [수집 범위·서버 설정](backend/README.md)을 확인하세요. Python은 자료 생성 도구에만 쓰며 로그인이나 서버 실행에 필요하지 않습니다.

**이 브랜치로 기존 chatgpt.site가 자동 변경되지 않습니다.** 현재 공개 서버가 없어 기존 Site의 Worker/D1과 실제 회원 데이터는 그대로 유지했습니다. 기존 계정을 옮기려면 원본 DB의 안전한 백업, 기존 암호화 키, 이관 검증과 배포 전환이 필요합니다. 새 로컬 DB에 기존 사이트 계정이 자동으로 나타나지는 않습니다.

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
