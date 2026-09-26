package com.jibro.api;

import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class LhNoticeImporterTest {
    static final String URL="https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020810&aisTpCd=07&ccrCnntSysDsCd=03&uppAisTpCd=06&mi=1026";
    @Test void unsupportedHostsPathsAndSchemesNeverTriggerRequests() {
        AtomicInteger requests=new AtomicInteger();
        var importer=new LhNoticeImporter(url->{requests.incrementAndGet();return Jsoup.parse("");});
        for (String url:List.of("http://127.0.0.1/private","https://evil-lh.or.kr/","https://apply.lh.or.kr/other",URL.replace("https:","http:"),URL.replace("lh.or.kr/","lh.or.kr:8443/"))) {
            var result=importer.read(url,List.of()); assertFalse(result.parsed()); assertNull(result.deadline()); assertEquals("공고 원문 확인 필요",result.agency());
        }
        assertEquals(0,requests.get());
        assertThrows(IllegalArgumentException.class,()->importer.read("file:///private",List.of()));
    }
    @Test void genericTitleOrWrongIdentityCannotBecomeVerifiedNotice() {
        for (String html:List.of("<title>LH청약플러스</title>","<div class='bbs_ViewA'><h3>다른 공고</h3></div><script>var panId = '9999999999'</script>")) {
            var result=new LhNoticeImporter(url->Jsoup.parse(html)).read(URL,List.of());
            assertFalse(result.parsed()); assertEquals("공고 링크만 저장됨",result.title());
        }
    }
    @Test void verifiedHeadingDoesNotTurnArbitraryDateRangeIntoApplicationDeadline() {
        var importer=new LhNoticeImporter(url->Jsoup.parse("<div class='bbs_ViewA'><h3>실제 공고</h3></div><script>var panId = '2015122300020810';</script><p>계약기간 2026.01.01 ~ 2028.01.01</p>"));
        var result=importer.read(URL,List.of());
        assertTrue(result.parsed());assertEquals("실제 공고",result.title());assertNull(result.deadline());
        var known=new NoticeController.Notice("lh-2015122300020810","실제 공고","경북","국민임대","LH","2026-09-28","2026-09-15","공고중",URL);
        result=importer.read(URL,List.of(known));assertEquals("경북",result.region());assertEquals("notice",result.deadlineKind());assertEquals("2026-09-28",result.deadline());
    }
}
