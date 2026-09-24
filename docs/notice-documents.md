# 공고별 서류 자료

2026-09-24에 현재 표시된 85개 공고의 공고문·첨부 양식에서 찾은 증빙 후보입니다. 개인별 필수 판정 엔진이나 실시간 수집 API가 아닙니다.

- `public/notice-documents/<noticeId>.json`: 공고별 근거 스냅샷. 선택한 공고의 파일만 로드합니다.
- `src/noticeDocumentIndex.json`: 자료가 있는 공고 ID. 새 공고는 확인된 파일과 함께 추가합니다.
- `src/noticeDocuments.mjs`: 공고별 준비 목록과 기존 완료 기록 병합. 필수 미확인 후보는 자동으로 진행률에 포함하지 않습니다.
- `src/NoticeDocuments.jsx`: 목록 추가·제외·준비 체크, 제출 근거 요약과 공식 첨부 연결.

`requirement: common`은 원문의 제출 표에서 공통임을 대조한 항목만 사용합니다. 현재 5개 대표 공고에만 검증된 공통 항목이 있습니다. 나머지 항목은 `check`이며, 문서에 등장한다는 이유만으로 필수로 승격하지 않습니다. 표 안의 순위·세대·면제·대체 조건을 함께 검토해야 합니다. `sourceUrl`, `sourceName`, `page`, `region`, `excerpt`, `checkedAt`을 근거와 함께 갱신하세요. PDF 페이지는 물리적 페이지이며, 좌우 두 면으로 된 파일은 `region`을 유지합니다.

상태는 기존 `noticeData[activeNoticeId]`에 `documentChoices[id] = include | exclude`로 저장합니다. 제외해도 `done`을 지우지 않습니다. 기존 `resident`, `family`, `consent`, `asset` ID는 유지하고, 대응하지 않는 완료 기록은 이전 기록으로 보존합니다. 서류 후보 전체 개수는 준비율의 분모가 아닙니다. 홈·여정·마이도 포함한 목록으로 계산합니다.

검증: `node --test src/noticeDocuments.test.mjs`. 85개 자료의 출처·ID, 순위별 조건부 서류, 이전 기록 보존, 공고별 선택 분리, 미확인 공고의 빈 목록을 확인합니다.

## 제출 근거 요약

`src/documentEvidenceSummary.mjs`는 보관된 85개 공고·2,902개 항목에 공통 적용합니다. 서류의 용도와 근거에서 확인 가능한 제출 조건을 짧게 보여주고 화면 내 원문 발췌는 표시하지 않고 공식 PDF·첨부 문서로 연결합니다. 원문 데이터는 요약 근거로 보존합니다. 별도 API 호출이나 사용자 정보가 필요하지 않습니다.

- `reviewed`: 전체 제출 표에서 대조한 예외. 첨부 파일 ID에 한정하므로 다른 공고로 전달되지 않습니다. 정정 파일 ID가 달라지면 다시 검토해야 합니다.
- `context`: 발췌에서 확인되는 문맥 또는 공통 제출 상태에 따른 설명. 개인별 필수 판정이 아닙니다.
- `lookup`: 행정정보 필드 목록. 직접 발급·업로드가 필요하다고 단정하지 않습니다.
- `unverified`: 제출 대상을 판단할 근거가 부족해 서류 용도와 확인 필요 상태만 표시합니다.

용도 설명은 서류 종류에 따른 안내이며, 공고의 제출 의무와 구분합니다. 새 공고에 순위·면제 예외가 있으면 원문의 해당 표 전체를 확인해 파일별 규칙을 보완하세요. 요약을 근거로 `requirement`, 포함 여부, 완료 기록을 변경하지 않습니다. 파일 안에 등장하는 모든 후보를 필수로 승격해서는 안 됩니다.

전체 자료 점검: `node scripts/audit-document-summaries.mjs <보고서.json>`.
회귀 검증: `node --test src/noticeDocuments.test.mjs src/documentEvidenceSummary.test.mjs`.
이 점검은 저장된 근거 전체를 대상으로 하며 공식 사이트의 정정 여부를 재수집한 검증은 아닙니다.
