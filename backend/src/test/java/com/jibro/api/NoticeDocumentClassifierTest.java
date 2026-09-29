package com.jibro.api;

import org.junit.jupiter.api.Test;
import org.jsoup.Jsoup;
import static org.junit.jupiter.api.Assertions.*;

class NoticeDocumentClassifierTest {
    private final String body="양산시 국민임대주택 예비입주자 완화 모집\n입주자 모집공고일 2026.09.15\n신청자격\n무주택세대구성원으로 소득 기준을 충족하는 사람\n신청기간은 다음과 같습니다.";
    @Test void verifiesContentAndNoticeIdentityWithoutFilename(){
        assertTrue(NoticeDocumentClassifier.isNotice(body,"[정정공고]양산시 국민임대주택 예비입주자 완화 모집"));
        assertFalse(NoticeDocumentClassifier.isNotice(body,"철원갈말 영구임대 예비입주자 모집공고"));
        assertFalse(NoticeDocumentClassifier.isNotice(body,""));
        assertFalse(NoticeDocumentClassifier.isNotice("양산시 임대주택 모집 안내\n평면도와 단지 조경 소개","양산시 국민임대 모집공고"));
    }
    @Test void genericFormsCannotBecomeEvidenceByQuotingNoticeKeywords(){
        assertFalse(NoticeDocumentClassifier.isNotice("개인정보 수집 이용 동의서\n"+body,"양산시 국민임대 모집공고"));
        assertFalse(NoticeDocumentClassifier.isNotice("주택 공급신청서\n"+body,"양산시 국민임대 모집공고"));
        assertFalse(NoticeDocumentClassifier.isNotice("위임장\n"+body,"양산시 국민임대 모집공고"));
        assertFalse(NoticeDocumentClassifier.isNotice("양산시 국민임대주택 선착순동호지정 신청서\n공고명\n"+body,"양산시 국민임대 모집공고"));
    }
    @Test void districtAndProjectNamesMayDifferInAdministrativeSuffix(){
        assertTrue(NoticeDocumentClassifier.isNotice(body.replace("양산시","보성운곡"),"보성군·순천시·광양시 국민임대주택 예비입주자 모집"));
        assertTrue(NoticeDocumentClassifier.isNotice(body.replace("양산시","고령군")+"\n"+"공급 안내 ".repeat(100)+"\n공급 단지: 고령다산2","대구서부권 고령다산2 국민임대 입주자격완화 모집공고"));
    }
    @Test void allOfficialPdfAndHwpxCandidatesSurviveAndNoticeNamesRankFirst(){
        var doc=Jsoup.parse("<a href=\"javascript:fileDownLoad('1')\">양식.pdf</a><a href=\"javascript:fileDownLoad('2')\">첨부자료.pdf</a><a href=\"javascript:fileDownLoad('3')\">양산시완화모집.pdf</a><a href=\"javascript:fileDownLoad('4')\">양산시완화모집.hwpx</a><a href=\"https://evil.test/f.pdf\">공고.pdf</a>");
        var files=NoticeEvidenceService.attachments(doc);
        assertEquals(java.util.List.of("3","2","1"),files.stream().map(NoticeEvidenceService.Source::id).toList());
    }
}
