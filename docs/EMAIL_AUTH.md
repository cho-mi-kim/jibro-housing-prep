# Spring 회원·이메일 API

React의 같은 출처 `/api` 요청을 Java 17 Spring MVC가 처리합니다. 운영 저장소는 PostgreSQL, 로컬은 파일 H2입니다. 이전 Worker/D1 코드는 `migration/legacy-worker/`에 이관 참고용으로 남겨두었습니다.

## 로컬 실행

루트에서 `npm ci`, `npm run preview:account`를 실행하고 `http://127.0.0.1:5173`을 엽니다. Java 17 JDK와 `JAVA_HOME`이 필요합니다. `backend/.local-data/`에 DB와 키가 유지됩니다. `admin/admin`은 local 프로필의 일반 테스트 회원이고 관리자 권한이 없습니다. 비밀번호를 바꾸면 바뀐 값이 유지되며 로그인할 때 기본 비밀번호로 덮어쓰지 않습니다. `JIBRO_TEST_LOGIN_ENABLED=false`이면 기존 테스트 세션도 사용할 수 없습니다. prod 프로필은 이 변수가 true여도 테스트 로그인을 허용하지 않습니다.

로컬 테스트에는 가상 회원만 사용하세요. `npm run test:account`는 별도 임시 DB로 검증하며 로컬 회원 DB를 초기화하지 않습니다.

## API 계약

| 요청 | 동작 |
| --- | --- |
| GET `/api/account` | 회원 정보 또는 user:null, testLoginAvailable, emailAvailable, policyVersion |
| GET `/api/account/csrf` | 변경 요청용 마스킹 토큰과 headerName |
| POST `/api/account/register` | 이메일·비밀번호·닉네임·필수 동의·선택 신청 조건으로 가입 |
| POST `/api/account/login`, `/logout` | 로그인, 현재 세션 폐기 |
| POST `/api/account/password` | 현재 비밀번호 확인, 변경, 모든 이전 세션 폐기, 현재 요청에 새 세션 발급 |
| DELETE `/api/account` | 현재 비밀번호·탈퇴 문구 확인 후 회원·세션·준비 기록·토큰 삭제 |
| GET/PUT `/api/member-notebook` | 세션 회원의 준비 기록. PUT은 `{revision,state}`; 충돌은 409 |
| POST `/api/account/send-verification`, `/request-password-reset` | 인증 재요청·비밀번호 복구 메일 접수 |
| POST `/api/account/verify-email`, `/reset-password` | 30분 이내의 일회용 토큰 소비 |

변경 요청은 JSON, 정확한 `Origin`, `X-Jibro-Request: 1`, `X-XSRF-TOKEN`과 쿠키를 함께 보냅니다. `src/accountClient.mjs`가 처리합니다. `/api/auth` 직접 가입과 옛 `/api/notebook`은 차단됩니다. 브라우저가 보내는 회원 ID·기기 ID로 다른 사람의 기록에 접근할 수 없습니다.

비밀번호는 12~128자이며 NFKC 정규화 후 Spring Security scrypt 해시로 저장합니다. 기존 Better Auth 해시는 이관 후 첫 정상 로그인에 새 형식으로 바뀝니다. 32바이트 난수 세션의 SHA-256만 DB에 저장하고 7일 만료를 적용합니다. 운영 쿠키는 `__Host-`, HttpOnly, Secure, SameSite=Lax입니다. CSRF 쿠키는 HttpOnly·SameSite=Strict입니다. 회원 응답은 no-store입니다.

이메일·IP별 DB 요청 제한, 세션 재검사, 회원 행 잠금과 revision 비교로 무차별 시도·동시 덮어쓰기를 방지합니다. 프록시 헤더를 임의 신뢰하지 않습니다. 운영 프록시의 신뢰 범위와 IP 제한은 실제 배포 시 확인해야 합니다. 제한이 프록시 IP에 묶인 상태에서 임의로 전체 Forwarded 헤더 신뢰를 켜지 마세요.

## 서버 설정

`backend/.env.example`을 참고합니다. `preview:account`는 `backend/.env.local`을 읽습니다. Spring 단독 실행/호스팅은 환경 변수나 비밀 관리 도구로 주입합니다.

- `SPRING_PROFILES_ACTIVE=prod`: 운영. local과 동시 사용 금지.
- `JIBRO_DATABASE_URL`, `JIBRO_DATABASE_USER`, `JIBRO_DATABASE_PASSWORD`: PostgreSQL JDBC 연결. 공급자에 맞는 TLS 설정 포함.
- `JIBRO_APP_ORIGIN`: 브라우저가 사용하는 정확한 HTTPS 출처. 끝 슬래시·경로 없음.
- `JIBRO_NOTEBOOK_KEYS`: [암호화 키](NOTEBOOK_ENCRYPTION.md). 운영 필수.
- `JIBRO_RESEND_API_KEY`, `JIBRO_MAIL_FROM`: 발송 권한 키와 인증한 도메인의 이메일 주소. 표시 이름·괄호 없이 설정.

운영에서 React와 Spring을 같은 출처로 연결하고 `/api` 응답의 Set-Cookie를 그대로 전달해야 합니다. 메일 링크 `/auth/complete`는 React의 index.html로 연결합니다. 정적 화면만 올리면 회원 기능은 동작하지 않습니다.

## 이메일 연결과 검증

1. [Resend](https://resend.com)에 가입하고 직접 관리하는 발신 도메인을 인증합니다. 학교 주소를 발신자로 쓰려면 해당 도메인 관리자의 협조가 필요합니다.
2. 발송 전용 API 키와 발신 주소를 Spring 서버의 비밀 환경 변수에 넣습니다. Git·채팅·`VITE_` 변수에 넣지 않습니다.
3. 본인 테스트 메일로 가입 인증, 재요청, 비밀번호 재설정, 만료·재사용 실패를 확인합니다. 공급자 클릭 추적은 끕니다.

설정이 없으면 emailAvailable=false와 503 email_unavailable를 반환합니다. 메일 없이 가입·로그인은 가능하며 미인증 계정의 공개 서비스 사용 범위는 TODO에 남아 있습니다. 미인증 주소를 소유가 확인된 연락처로 취급하지 않습니다.

메일 작업은 제한된 비동기 큐에서 처리합니다. 비밀번호 찾기는 가입 여부와 관계없이 같은 접수 응답을 반환합니다. API 접수는 실제 수신을 보장하지 않습니다. 실패 로그에는 주소·토큰을 넣지 않습니다. 토큰은 SHA-256 해시만 DB에 보관하며 30분 만료·재요청 시 이전 토큰 폐기·사용 후 재사용 금지를 적용합니다. 비밀번호 재설정은 기존 로그인 세션을 모두 폐기합니다.

링크는 `/auth/complete#action=verify|reset&token=...` 형식입니다. React가 읽고 주소에서 제거하며 메일을 열기만 해서는 상태가 바뀌지 않습니다. POST 버튼을 눌러야 처리합니다. 테스트 admin은 메일 대상이 아닙니다. 자동화 테스트는 가짜 전송기를 사용하므로 실제 수신 검증을 대신하지 않습니다.

약관·개인정보 안내는 실제 운영 주체·위탁·국외 처리·보존 정책이 정해진 뒤 최종 확인해야 합니다. 문의처 `jibro@dankook.ac.kr`만으로 학교가 운영 주체라고 단정하지 않습니다.
