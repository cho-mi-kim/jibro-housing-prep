package com.jibro.api;

import org.junit.jupiter.api.Test;
import org.jsoup.Jsoup;
import static org.junit.jupiter.api.Assertions.*;

class NoticeEvidenceServiceTest {
    private final NoticeEvidenceService.Source source=new NoticeEvidenceService.Source("123","모집공고.pdf","https://apply.lh.or.kr/lhapply/lhFile.do?fileid=123",null);
    @Test void rejectsNonOfficialAndArbitraryFetchTargets(){
        for(String url:new String[]{"http://localhost:8080/private","https://apply.lh.or.kr.evil.test/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020763","https://apply.lh.or.kr/lhapply/lhFile.do?fileid=1","https://apply.lh.or.kr:443/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020763"})assertThrows(IllegalArgumentException.class,()->NoticeEvidenceService.canonicalUrl(url));
    }
    @Test void canonicalIdentityKeepsNoticeAndIgnoresTracking(){
        String u="https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020763&aisTpCd=10&v=1";
        assertEquals(NoticeEvidenceService.canonicalUrl(u),NoticeEvidenceService.canonicalUrl(u.replace("v=1","v=2")));
        assertNotEquals(NoticeEvidenceService.canonicalUrl(u),NoticeEvidenceService.canonicalUrl(u.replace("20763","20764")));
    }
    @Test void collectsOfficialCandidatesForBodyVerification(){
        var doc=Jsoup.parse("<a href=\"javascript:fileDownLoad('1');\">입주자모집공고.pdf</a><a href=\"javascript:fileDownLoad('2');\">팜플렛공고.pdf</a><a href=\"javascript:fileDownLoad('3');\">모집공고.hwpx</a><a href=\"https://evil.test/file.pdf\">모집공고.pdf</a>");
        var files=NoticeEvidenceService.attachments(doc);assertEquals(3,files.size());assertEquals("1",files.get(0).id());
    }
    @Test void keepsExceptionsAndSourcePageWithEvidence(){
        var found=NoticeEvidenceService.extractPage("청년 계층 신청자격\n만 19세 이상 만 39세 이하인 사람\n단, 예외 대상은 다음 표를 확인해야 합니다.\n대학생은 별도 요건을 적용합니다.",source,7);
        var age=found.stream().filter(e->e.key().equals("age")).findFirst().orElseThrow();
        assertTrue(age.quote().contains("예외"));assertTrue(age.quote().contains("대학생"));assertEquals(7,age.page());assertEquals(source.url(),age.sourceUrl());
    }
    @Test void missingAndImageTextDoesNotGenerateEligibility(){
        assertTrue(NoticeEvidenceService.extractPage("",source,1).isEmpty());
        assertTrue(NoticeEvidenceService.extractPage("입주자 모집 안내\n접수 기간은 원문을 확인해주세요.",source,2).isEmpty());
    }
    @Test void doesNotDropRelaxedIncomeCondition(){
        var found=NoticeEvidenceService.extractPage("입주자격 완화\n소득 기준 및 총자산 요건을 배제합니다.\n신청자격에 관한 다른 요건은 계속 적용합니다.",source,3);
        assertTrue(found.stream().filter(e->e.key().equals("income")).anyMatch(e->e.quote().contains("배제")));
    }
    @Test void applicantAgeRanksAheadOfDependentAgeAndKeepsExactFocus(){
        var text="신청자는 민법상 성년자(만19세)이어야 합니다.\n단, 아래 예외를 적용합니다.\n안내\n안내\n안내\n안내\n만65세 이상의 직계존속을 부양하는 자\n별도 공급대상에 관한 조건입니다.";
        var age=NoticeEvidenceService.extractPage(text,source,3).stream().filter(e->e.key().equals("age")).max(java.util.Comparator.comparingInt(NoticeEvidenceService.Evidence::score)).orElseThrow();
        assertTrue(age.focus().startsWith("신청자는"));assertTrue(age.quote().contains("예외"));
    }
    @Test void readsAgeWithoutManPrefixAndRejectsBirthBonus(){
        var age=NoticeEvidenceService.extractPage("청년 계층\n19세 이상 39세 이하인 자\n사회초년생은 별도 조건을 적용합니다.",source,8);
        assertTrue(age.stream().anyMatch(e->e.key().equals("age")&&e.focus().contains("19세")));
        assertTrue(NoticeEvidenceService.extractPage("기준일 이전 출생한 기존 미성년자녀도 포함하여 최대 2자녀로 인정\n출산자녀 가산 기준을 적용합니다.",source,6).stream().noneMatch(e->e.key().equals("age")));
    }
    @Test void householdCountIsNotAnAge(){
        assertTrue(NoticeEvidenceService.extractPage("주택공급신청자가 속한 세대가 1세대만 소유하고 있는 경우\n주택소유 여부의 확인 기준입니다.",source,25).stream().noneMatch(e->e.key().equals("age")));
    }
    @Test void onsiteApplicationHelpIsNotAnAgeEligibilityRule(){
        var help=NoticeEvidenceService.extractPage("현장 신청자(65세 이상 고령자, 장애인 등으로 인터넷 신청이 어려운 경우) : 접수장소에 방문하여 신청하여야 합니다.\n인터넷 신청자는 청약플러스를 이용해주세요.",source,18);
        assertTrue(help.stream().noneMatch(e->e.key().equals("age")));
        var rule=NoticeEvidenceService.extractPage("고령자 계층\n현재 무주택세대구성원으로서 아래 요건을 갖춘 65세 이상인 자\n소득요건 배제",source,15);
        assertTrue(rule.stream().anyMatch(e->e.key().equals("age")));
    }
    @Test void youthEligibilityRanksAheadOfChildAgeTable(){
        var child=NoticeEvidenceService.extractPage("자녀의 연령 6세이하 9세이하\n한부모가족의 자녀 기준을 적용합니다.",source,2).stream().filter(e->e.key().equals("age")).findFirst().orElseThrow();
        var youth=NoticeEvidenceService.extractPage("청년 : 19세 이상 39세 이하인 사람\n공고일 기준으로 적용합니다.",source,2).stream().filter(e->e.key().equals("age")).findFirst().orElseThrow();
        assertTrue(youth.score()>child.score());
    }
    @Test void dependentPointsAndConsentAgesAreNotApplicantEligibility(){
        var text="신청자의 65세 이상 직계존속 부양여부에 따라 1점\n세대원으로 등록된 경우 적용합니다.\n14세 미만 세대원은 보호자(법정대리인)가 서명합니다.";
        assertTrue(NoticeEvidenceService.extractPage(text,source,6).stream().noneMatch(e->e.key().equals("age")));
    }
    @Test void incomeHeaderDoesNotHideEligibilityThreshold(){
        var rent=NoticeEvidenceService.extractPage("■ 임대조건\n가구당 월평균소득의 80% 금액 기준표\n임대료 산정에 사용하는 기준입니다.",source,3);
        var eligibility=NoticeEvidenceService.extractPage("■ 소득 · 자산 기준\n순위 소득기준 자산기준\n전년도 도시근로자 가구원수별 월평균소득의 130% 이하\n본인 및 배우자 모두 소득이 있는 경우 200% 이하\n총자산 36,200만원 이하",source,5);
        var best=eligibility.stream().filter(e->e.key().equals("income")).max(java.util.Comparator.comparingInt(NoticeEvidenceService.Evidence::score)).orElseThrow();
        assertTrue(best.focus().contains("130%"));assertTrue(best.quote().contains("200%"));assertTrue(best.quote().contains("36,200"));
        assertTrue(rent.stream().filter(e->e.key().equals("income")).allMatch(e->e.score()<best.score()));
    }
    @Test void familyMemberAgeAndReferenceDateAreNotApplicantAgeRules(){
        var member=NoticeEvidenceService.extractPage("② 신청자의 형제·자매로서 세대별 주민등록표 상에 등재된 사람\n* 단, 민법상 미성년자 또는 60세 이상인 자에 한함",source,9);
        assertTrue(member.stream().noneMatch(e->e.key().equals("age")));
        var date=NoticeEvidenceService.extractPage("입주자 모집공고일은 신청자격, 나이, 세대구성원 등의 판단 기준일입니다.\n청년 : 19세 이상 39세 이하인 사람\n계층별 기준을 확인하세요.",source,1);
        var age=date.stream().filter(e->e.key().equals("age")).findFirst().orElseThrow();
        assertTrue(age.focus().startsWith("청년 :"));
    }
}
