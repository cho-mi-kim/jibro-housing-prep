# 이전 Worker 회원 서버 · 이관 참고 전용

현재 앱은 `backend/`의 Java Spring MVC 회원 API를 사용합니다. 이 폴더는 이전 D1 스키마, 암호화 형식과 테스트를 대조하기 위한 기록이며 일반 빌드·실행·배포에 포함되지 않습니다. 실제 chatgpt.site는 별도 배포본이므로 이 폴더 이동으로 변경되지 않습니다.

기존 `scripts/`는 당시 배포 구조의 참고 자료입니다. 현재 루트에서 실행하지 마세요. 이전 버전 재현은 Git의 전환 전 커밋을 별도 체크아웃해서 수행합니다. Spring 이관에는 루트의 `scripts/export-legacy-members.mjs`와 [이관 절차](../../docs/SPRING_MIGRATION.md)를 사용합니다.

실제 회원 데이터·세션·키를 이 폴더에 넣지 않습니다. Java 테스트의 `legacy-member-export.json`과 `legacy-test-keys.json`은 이전 코드로 만든 합성 데이터이며 실제 사용자와 무관합니다.
