package com.jibro.api;

import org.jsoup.Jsoup;
import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class LhNoticeCrawlerTest {
    static final LocalDate TODAY = LocalDate.of(2026, 9, 23);
    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-09-22T15:01:00Z"), ZoneId.of("Asia/Seoul"));

    @Test void followsActualPageParameterBeyondTwentyAndIncludesAllActiveStatuses() throws Exception {
        List<String> requests = new ArrayList<>();
        var crawler = new LhNoticeCrawler(url -> {
            requests.add(url);
            var q = query(url);
            assertFalse(q.containsKey("pageNum"));
            assertEquals("2000-01-01", q.get("startDt"));
            assertEquals("061339", q.get("srchUppAisTpCd"));
            int page = Integer.parseInt(q.get("currPage"));
            assertEquals(page == 1 ? "Y" : "N", q.get("srchY"));
            assertEquals("100", q.get("prevListCo"));
            String status = q.get("panSs");
            int count = status.equals("공고중") ? 21 : 1;
            return Jsoup.parse(page(count, page, count, row(status + page, status + page, status, "2026.09.23", "2026.09.20")));
        }, 0);
        var result = crawler.collect(TODAY);
        assertEquals(23, result.items().size());
        assertEquals(23, result.pagesFetched());
        assertEquals(23, requests.size());
        assertTrue(result.items().stream().anyMatch(n -> n.status().equals("접수중")));
        assertTrue(result.items().stream().anyMatch(n -> n.status().equals("정정공고중")));
    }

    @Test void resolvesCorrectionsAndCancellationsBeforeDeadlineFiltering() throws Exception {
        String rows = row("1", "A", "공고중", "2026.09.30", "2026.09.01")
            + row("2", "[정정공고] A", "정정공고중", "2026.09.22", "2026.09.20")
            + row("3", "B", "공고중", "2026.09.30", "2026.09.20")
            + row("4", "[취소공고] B", "공고중", "2026.09.30", "2026.09.20")
            + row("5", "C", "공고중", "2026.09.30", "2026.09.20")
            + row("6", "[정정공고] C", "정정공고중", "2026.09.23", "2026.09.20")
            + row("7", "D", "접수마감", "2026.09.30", "2026.09.20");
        var result = onePage(rows, 7).collect(TODAY);
        assertEquals(List.of("lh-6"), result.items().stream().map(NoticeController.Notice::id).toList());
        assertEquals("2026-09-23", result.items().get(0).deadline());
    }

    @Test void rejectsIgnoredPaginationInsteadOfClaimingCompleteResult() {
        var crawler = new LhNoticeCrawler(url -> Jsoup.parse(page(2, 1, 2, row("1", "A", "공고중", "2026.09.30", "2026.09.20"))), 0);
        assertThrows(IOException.class, () -> crawler.collect(TODAY));
    }

    @Test void rejectsChangedMarkupAndIncompleteRowCounts() {
        assertThrows(IOException.class, () -> new LhNoticeCrawler(url -> Jsoup.parse("<html>점검 중</html>"), 0).collect(TODAY));
        assertThrows(IOException.class, () -> onePage(row("1", "A", "공고중", "2026.09.30", "2026.09.20"), 2).collect(TODAY));
    }

    @Test void rejectsInvalidDateRatherThanManufacturingDeadline() {
        assertThrows(IOException.class, () -> onePage(row("1", "A", "공고중", "2026.02.30", "2026.09.20"), 1).collect(TODAY));
    }

    @Test void acceptsActualSearchHeaderAndRemovesAgeLabelFromTitle() throws Exception {
        String html = page(1, 1, 1, row("1", "공고 제목", "공고중", "2026.09.30", "2026.09.20"))
            .replace("<th>분류</th>", "<th>유형</th>");
        var result = LhNoticeCrawler.parse(Jsoup.parse(html), 1);
        assertEquals("국민임대", result.items().get(0).type());
        assertEquals("공고 제목", result.items().get(0).title());
    }

    @Test void reportsMissingDeadlineWithoutInventingOne() throws Exception {
        var result = onePage(row("1", "A", "공고중", "-", "2026.09.20"), 1).collect(TODAY);
        assertEquals(0, result.items().size());
        assertEquals(1, result.unknownDeadlineCount());
    }

    @Test void validEmptyResultReplacesPreviousResultAndHasSuccessTimestamp() {
        AtomicBoolean empty = new AtomicBoolean(false);
        var crawler = new LhNoticeCrawler(url -> Jsoup.parse(query(url).get("panSs").equals("공고중") && !empty.get()
            ? page(1, 1, 1, row("1", "A", "공고중", "2026.09.30", "2026.09.20")) : page(0, 1, 0, "<tr><td colspan='9'>검색 결과가 없습니다.</td></tr>")), 0);
        var controller = new NoticeController(crawler, CLOCK, Duration.ZERO);
        assertEquals(1, controller.refresh().items().size());
        empty.set(true);
        var result = controller.refresh();
        assertEquals("ok", result.status());
        assertEquals(0, result.items().size());
        assertNotNull(result.lastCheckedAt());
    }

    @Test void midCollectionFailurePreservesWholePreviousSnapshot() {
        AtomicBoolean fail = new AtomicBoolean(false);
        var crawler = new LhNoticeCrawler(url -> {
            if (!query(url).get("panSs").equals("공고중")) {
                if (fail.get()) throw new IOException("simulated timeout");
                return Jsoup.parse(page(0, 1, 0, ""));
            }
            return Jsoup.parse(page(1, 1, 1, row(fail.get() ? "2" : "1", "A", "공고중", "2026.09.30", "2026.09.20")));
        }, 0);
        var controller = new NoticeController(crawler, CLOCK, Duration.ZERO);
        var good = controller.refresh(); fail.set(true);
        var failed = controller.refresh();
        assertEquals("stale", failed.status());
        assertEquals(good.items(), failed.items());
        assertEquals(good.lastCheckedAt(), failed.lastCheckedAt());
        assertNotNull(failed.error());
    }

    @Test void firstFailureIsErrorAndRepeatedRefreshIsRateLimited() {
        AtomicInteger calls = new AtomicInteger();
        var crawler = new LhNoticeCrawler(url -> { calls.incrementAndGet(); throw new IOException("unavailable"); }, 0);
        var controller = new NoticeController(crawler, CLOCK, Duration.ofMinutes(1));
        assertEquals("error", controller.get().status());
        assertNull(controller.get().lastCheckedAt());
        controller.refresh();
        assertEquals(1, calls.get());
    }

    @Test void repeatedCorrectionPrefixesAndNestedCancellationAreResolved() throws Exception {
        var result=onePage(row("1","A","공고중","2026.09.30","2026.09.20")
            +row("2","[정정공고][정정공고] A","공고중","2026.09.30","2026.09.20")
            +row("3","B","공고중","2026.09.30","2026.09.20")
            +row("4","[정정공고][취소공고] B","공고중","2026.09.30","2026.09.20"),4).collect(TODAY);
        assertEquals(List.of("lh-2"),result.items().stream().map(NoticeController.Notice::id).toList());
    }

    static LhNoticeCrawler onePage(String rows, int total) {
        return new LhNoticeCrawler(url -> Jsoup.parse(query(url).get("panSs").equals("공고중") ? page(total, 1, 1, rows) : page(0, 1, 0, "")), 0);
    }
    static Map<String, String> query(String url) {
        Map<String, String> q = new HashMap<>();
        for (String part : URI.create(url).getRawQuery().split("&")) {
            String[] pair = part.split("=", 2);
            q.put(pair[0], URLDecoder.decode(pair.length > 1 ? pair[1] : "", StandardCharsets.UTF_8));
        }
        return q;
    }
    static String page(int total, int current, int pages, String rows) {
        return "<p class='bbs_total'>전체 <strong>" + total + "</strong>건 &nbsp;<strong>" + current + "</strong>/" + pages + "페이지</p>"
            + "<table class='bbs_ListA'><thead><tr><th>번호</th><th>분류</th><th>공고명</th><th>지역</th><th>첨부</th><th>게시일</th><th>마감일</th><th>상태</th><th>조회</th></tr></thead><tbody>" + rows + "</tbody></table>";
    }
    static String row(String id, String title, String status, String deadline, String posted) {
        return "<tr><td>1</td><td>국민임대</td><td><a class='wrtancInfoBtn' data-id1='" + id + "' data-id2='03' data-id3='06' data-id4='07'>"
            + title + "<em class='day'>1일전</em></a></td><td>서울</td><td></td><td>" + posted + "</td><td>" + deadline + "</td><td>" + status + "</td><td>1</td></tr>";
    }
}
