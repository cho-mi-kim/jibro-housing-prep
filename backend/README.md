# LH 목록 수집 API

Java 17에서 `gradlew.bat bootRun`(Windows) 또는 `sh ./gradlew bootRun`(macOS/Linux)으로 실행합니다. 기본 포트는 8080입니다. 공식 API 키를 사용하는 방식이 아니라 LH 공개 목록 HTML을 읽습니다.

## 화면 연결

루트 `.env.local`에 아래 값을 설정한 뒤 화면을 다시 빌드합니다. 목록·가져오기·발췌만 Spring에 연결하며, 회원 기록은 별도의 Worker/D1 계정 서버를 사용합니다.

```dotenv
VITE_NOTICES_API_BASE=http://localhost:8080
VITE_NOTICE_EVIDENCE_API_BASE=http://localhost:8080
```

`VITE_API_BASE`는 공고 API 주소의 이전 공통 설정입니다. 현재 회원 앱의 저장 주소를 바꾸지 않습니다. Spring에 남아 있는 `/api/notebook`은 인증 없는 기기 헤더 방식의 이전 API이므로 공개 회원 서비스로 노출하지 않습니다. 계정 미리보기와 연결할 때 `JIBRO_CORS_ALLOWED_ORIGINS`에 `http://127.0.0.1:5190`을 추가하세요.

## 수집 범위와 날짜

- LH 임대주택 메뉴 코드 `061339`에서 `공고중`, `접수중`, `정정공고중`을 조회합니다. 조회 그룹에 같은 행이 중복될 수 있습니다.
- `currPage`로 실제 마지막 페이지까지 읽고 페이지 번호·건수·열 구조를 확인합니다. 반복 페이지, 도중 건수 변경, 불완전한 응답은 수집 실패로 처리합니다.
- 제목의 반복된 정정·취소 접두사를 정리한 뒤 제목·지역·유형이 같은 행의 최신 게시일을 우선합니다. 같은 날은 취소·정정 순으로 우선합니다. 제목 자체가 달라진 후속 공고의 관계까지 추정하지 않습니다.
- 취소·비활성 상태·한국 날짜 기준 마감된 공고를 제외합니다. 날짜를 읽지 못한 행은 조용히 날짜를 만들지 않습니다. 공란 마감일은 제외 건수로, 잘못된 형식은 전체 수집 실패로 처리합니다.
- `deadlineKind: "notice"`의 `deadline`은 **LH 목록의 공고 마감일**입니다. 실제 신청 접수 마감일을 보장하지 않습니다. 화면은 이를 `공고 마감`으로 표시하고, 별도로 확인한 공급일정이 없으면 신청 일정으로 재사용하지 않습니다.
- 전체 기관·분양·이미 마감된 공고 전체가 수집 범위는 아닙니다. 마감 시각이나 대상별 접수 기간은 공식 원문에서 확인해야 합니다.

## API와 실패 처리

| 요청 | 동작 |
| --- | --- |
| `GET /api/notices` | 마지막 완전 수집 결과. 처음 실행 후 미수집 상태이면 수집 시도 |
| `POST /api/notices/refresh` | 수집 재시도. 최소 1분 간격, 동시에 실행되지 않음 |
| `POST /api/notices/import` | `{ "url": "..." }`. 허용된 LH 상세 URL의 제목·공고 ID 확인 |

목록 응답에는 `items`, `status`, `lastCheckedAt`, `lastAttemptedAt`, `pagesFetched`, `sourceRows`, `unknownDeadlineCount`, `sources`가 있습니다.

- `ok`: 전체 수집 성공. 정상적인 빈 목록도 성공으로 갱신합니다.
- `stale`: 수집 실패. 마지막 성공 목록·성공 시각을 보존합니다.
- `error`: 성공한 수집이 없음. 최신 공고 수를 안다고 표시하지 않습니다.

목록 캐시는 파일과 이전 정상 백업에 저장하며 서버 재시작 시 복원합니다. 아래의 캐시 설정과 보관·재시도 항목을 참고하세요. 브라우저는 연결 실패 시 화면의 기존 결과와 실패 안내를 유지합니다. API 미연결 상태는 저장된 참고 목록으로 구분합니다.

요청당 20초 제한, 페이지 간 1초 간격을 둡니다. 전체 수집 시작 60초 이후에는 다음 페이지 요청을 중단하므로 진행 중인 마지막 요청까지 약 81초가 걸릴 수 있습니다. 화면은 90초에 대기를 끝내고 재시도를 허용합니다. 크기·페이지 한도 초과를 성공으로 반환하지 않습니다.

URL 가져오기는 HTTPS의 정확한 `apply.lh.or.kr` 상세 경로만 요청하며 리디렉션을 따라가지 않습니다. 확인된 제목이 목록과 일치할 때만 목록의 지역·유형·게시일·공고 마감일을 재사용합니다. 다른 URL·연결 실패·공고 ID 불일치는 `공고 링크만 저장됨`으로 반환합니다. 페이지의 첫 날짜 범위를 신청 기간으로 추정하지 않습니다.

## 설정

| Spring 설정 / 환경 변수 | 기본값·설명 |
| --- | --- |
| `jibro.notices.scheduling-enabled` / `JIBRO_NOTICES_SCHEDULING_ENABLED` | `true`. 검증 서버는 `false`로 설정 가능 |
| `jibro.notices.refresh-delay-ms` / `JIBRO_NOTICES_REFRESH_DELAY_MS` | `21600000` (6시간) |
| `jibro.notices.initial-delay-ms` / `JIBRO_NOTICES_INITIAL_DELAY_MS` | `1000` |
| `jibro.notices.cache-file` / `JIBRO_NOTICES_CACHE_FILE` | `${user.home}/.jibro/notices.json`. 공개 공고의 영속 캐시 경로 |
| `jibro.notices.schedule-tick-ms` / `JIBRO_NOTICES_SCHEDULE_TICK_MS` | `60000`. 다음 수집 시각 확인 간격 |
| `jibro.cors.allowed-origins` / `JIBRO_CORS_ALLOWED_ORIGINS` | 허용할 프론트엔드 Origin을 쉼표로 구분. 기본 localhost/127.0.0.1의 5173·4173 및 기존 chatgpt.site 주소 |
| `jibro.notebook.store` / `JIBRO_NOTEBOOK_STORE` | `${user.home}/.jibro/notebook-state.json`. 운영 시 쓰기 가능한 영속 볼륨 필요 |

준비 기록은 새 파일로 쓴 뒤 교체합니다. 저장 실패는 503으로 반환하고 기존 메모리 기록도 보존합니다. 깨진 저장 파일을 빈 기록으로 덮어쓰지 않습니다. 헤더 식별자는 인증·인가를 대신하지 않으며 다중 서버에서 하나의 파일을 함께 쓰는 구조는 지원하지 않습니다.

## 재검증

고정 사례 테스트는 LH 네트워크 없이 실행합니다.

```sh
sh ./gradlew test bootJar
```

실제 서버를 실행한 뒤 저장소 루트에서 아래를 실행합니다. `--compare-source`는 BeautifulSoup4가 필요하며 같은 시점의 공식 목록을 독립적으로 다시 읽어 모든 ID·제목·지역·유형·게시일·마감일·상태를 비교합니다.

```sh
python backend/scripts/verify_live.py --base-url http://localhost:8080
python backend/scripts/verify_live.py --base-url http://localhost:8080 --compare-source --output .sites-runtime/crawler-verification.json
```

수집 중 공식 목록이 변경되면 비교가 실패할 수 있습니다. 그 경우 재수집해 확인합니다. 실수집을 CI의 매 실행에 넣어 외부 서비스에 반복 요청하지 않습니다. 현재 검증 결과는 [2026-09-25 검증 기록](../docs/crawler-verification-2026-09-25.md)을 참고하세요.

목록 갱신만으로 서류·일정 스냅샷 전체를 다시 만들지는 않습니다. [발췌·스냅샷 안내](EVIDENCE.md)를 별도로 따르세요. 정적 호스팅은 Java 서버를 실행하지 않으므로 운영 API 배포와 환경 변수 연결은 별도 작업입니다.


## 수집 목록 보관과 재시도 (2026-09-26)

- 설정: jibro.notices.cache-file (기본 사용자 홈/.jibro/notices.json). 운영에서는 영속 볼륨 안의 경로로 지정하세요. 회원 정보와 분리된 공개 공고 캐시입니다.
- 정상 전체 목록만 파일에 저장합니다. 갱신 실패 시 메모리/디스크의 마지막 성공 시각과 목록을 유지하며 stale로 응답합니다. 재시작 때도 저장 목록부터 복원합니다.
- 이전 정상 파일은 .bak에 보관합니다. 주 파일이 손상됐으면 백업 복구를 시도하고 둘 다 읽을 수 없으면 로그에 남긴 뒤 새 수집을 시도합니다.
- jibro.notices.schedule-tick-ms 기본 60000: 실행할 시각을 확인하는 간격. 성공 후 다음 수집은 jibro.notices.refresh-delay-ms 기본 21600000(6시간). 실패 시 1·2·4·8·16·32·60분 간격으로 재시도합니다.
- 이 코드는 chatgpt.site Worker 안에서 실행되지 않습니다. 지속 실행할 Spring 서버와 영속 저장 경로를 배포하고 VITE_NOTICES_API_BASE를 연결해야 합니다.
- export_notice_evidence.py / export_notice_schedules.py는 실패 공고의 마지막 성공 자료를 보존하고 public/notice-analysis-attempts.json에 공고별 시도 상태를 기록합니다. 새 첨부의 모든 서류 후보·필수 여부를 자동 검증하는 파이프라인은 아직 아닙니다.
