# Worker/D1 → Spring MVC 회원 이관

현재 구현은 코드·로컬 검증 단계입니다. 실제 chatgpt.site의 DB·계정·키·배포는 변경하지 않았습니다. 이관 대상은 회원 정보, 동의 기록, 비밀번호 해시와 암호화된 준비 기록입니다. 기존 세션과 인증/재설정 토큰은 가져오지 않으므로 전환 후 다시 로그인하고 필요한 메일을 재요청해야 합니다.

## 이관 전 준비

1. PostgreSQL과 HTTPS Spring/React 연결, 메일 발송을 먼저 준비합니다. 새 서비스의 회원 쓰기를 열기 전에 최종 이관합니다.
2. 기존 사이트의 쓰기를 잠시 중단하고 D1의 오프라인 SQLite 백업과 원본 `JIBRO_NOTEBOOK_KEYS`를 안전하게 확보합니다. 실제 데이터를 Git에 올리지 않습니다.
3. 원본 키를 모르면 암호화된 기록 이관은 중단합니다. 새 키를 만들어 대체할 수 없습니다. 이전 DB가 SQL 덤프라면 별도 오프라인 SQLite 복사본에 복원한 뒤 내보냅니다.
4. 대상 DB를 백업하고 충돌하는 회원이 없는지 확인합니다. 운영 DB와 키 접근은 제한된 담당자만 수행합니다.

## 내보내기

Node.js 24.19 이상에서 **오프라인 백업**에만 실행합니다.

```sh
node scripts/export-legacy-members.mjs /protected/backup.sqlite /protected/member-export.json
```

원본 DB는 읽기 전용으로 열며 기존 출력 파일을 덮어쓰지 않습니다. 내보내기에는 이메일·비밀번호 해시·암호문이 있으므로 민감 자료로 취급합니다. 명령 출력은 건수만 표시합니다. 기존 계정 삭제·백업 삭제·라이브 DB 접근을 수행하지 않습니다.

## Spring 검증 및 적용

대상 DB 환경 변수와 **원본 키가 포함된** `JIBRO_NOTEBOOK_KEYS`를 비밀 관리 도구로 주입합니다. 새 active 키와 원본 키를 함께 넣으면 가져올 때 새 키로 재암호화합니다. 아래 명령은 `backend/`에서 실행합니다.

```sh
# Windows: gradlew.bat bootJar
sh ./gradlew bootJar
# 기본: 검증만 수행. 서버 포트를 열지 않음.
java -jar build/libs/jibro-api.jar --spring.profiles.active=prod --spring.main.web-application-type=none --jibro.notices.scheduling-enabled=false --jibro.migration.input=/protected/member-export.json
# 같은 입력을 검토한 뒤 적용
java -jar build/libs/jibro-api.jar --spring.profiles.active=prod --spring.main.web-application-type=none --jibro.notices.scheduling-enabled=false --jibro.migration.input=/protected/member-export.json --jibro.migration.apply=true
```

검증 모드도 대상 DB의 Flyway 테이블/스키마는 생성할 수 있지만 회원 데이터를 넣지 않습니다. 회원 ID·이메일 중복, 형식 오류, 원본 키 누락·복호화 실패가 있으면 가져오기를 전체 실패 처리합니다. 적용은 하나의 트랜잭션이며 일부 회원만 저장한 채 끝내지 않습니다.

- 회원 ID, 닉네임, 동의 버전·시각, 이메일 인증 상태, 준비 기록 revision을 보존합니다.
- 기존 scrypt 해시로 로그인하고 첫 성공 시 Spring 형식으로 갱신합니다. 비밀번호를 평문으로 받거나 내보내지 않습니다.
- 기존 테스트 admin과 테스트 이메일은 제외합니다. 운영으로 약한 테스트 비밀번호를 옮기지 않습니다.
- 동일한 입력을 다시 적용하면 이관 기록을 보고 건너뜁니다. 이후 회원이 수정한 기록을 덮어쓰지 않습니다.
- 같은 회원의 원본이 달라졌거나 대상 DB에 동일 ID/이메일이 있으면 자동 병합하지 않습니다. 쓰기 중지 시점과 이관 대상부터 다시 점검합니다.
- 최대 50MB의 JSON을 처리합니다. 이를 넘는 실제 DB에는 별도 배치 설계가 필요합니다.

## 전환 확인

가상 계정으로 먼저 이전 비밀번호 로그인, 계정별 분리, 공고별 체크·선택 조건·알림 읽음, 새로고침, 비밀번호 변경·로그아웃을 확인합니다. 원본 DB와 키를 보관한 상태로 실제 전환 건수와 예외를 대조한 뒤 접근 경로를 바꿉니다. 새 서비스가 쓰기를 받기 시작한 뒤에는 옛 DB를 다시 단순 덮어쓰기하거나 프록시만 되돌리면 새 기록이 사라질 수 있으므로 복구 절차를 별도로 정합니다.

기존 개인 Site 운영을 중단하거나 공개 범위를 변경하는 작업은 이 브랜치에 포함하지 않습니다. 팀의 운영 서버·백업·키·배포 전환 준비가 남아 있습니다.
