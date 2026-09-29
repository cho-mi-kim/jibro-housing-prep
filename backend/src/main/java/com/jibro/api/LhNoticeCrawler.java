package com.jibro.api;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;

/** Collects the public LH rental housing list; no login or attachment downloads. */
@Component
public class LhNoticeCrawler {
    static final String LIST_URL = "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do";
    static final List<String> ACTIVE_STATUSES = List.of("공고중", "접수중", "정정공고중");
    private static final Pattern TOTAL = Pattern.compile("전체([\\d,]+)건(\\d+)/(\\d+)페이지");
    private static final Pattern PREFIX = Pattern.compile("^(?:\\[(?:정정|수정|변경|취소)(?:공고)?\\]|\\((?:정정|수정|변경|취소)(?:공고)?\\))\\s*");
    private final PageFetcher fetcher;
    private final long intervalMillis;

    public LhNoticeCrawler() {
        this(url -> Jsoup.connect(url).userAgent("JIBRO/1.0 (housing-notice-reader)")
            .followRedirects(false).timeout(20000).maxBodySize(4 * 1024 * 1024).get(), 1000);
    }

    LhNoticeCrawler(PageFetcher fetcher, long intervalMillis) {
        this.fetcher = fetcher;
        this.intervalMillis = intervalMillis;
    }

    public CrawlResult collect(LocalDate today) throws IOException, InterruptedException {
        long started = System.nanoTime();
        List<NoticeController.Notice> rows = new ArrayList<>();
        List<SourceCount> counts = new ArrayList<>();
        Set<String> fingerprints = new HashSet<>();
        int pagesFetched = 0;
        for (String status : ACTIVE_STATUSES) {
            int expectedTotal = -1;
            int pageCount = 1;
            int received = 0;
            for (int page = 1; page <= pageCount; page++) {
                if (System.nanoTime() - started > java.time.Duration.ofSeconds(60).toNanos()) throw new IOException("LH 수집 전체 시간 한도 초과");
                if (pagesFetched > 0 && intervalMillis > 0) Thread.sleep(intervalMillis);
                ParsedPage parsed = parse(fetcher.fetch(pageUrl(status, page, today)), page);
                pagesFetched++;
                if (expectedTotal < 0) {
                    expectedTotal = parsed.total();
                    pageCount = parsed.pages();
                    // A guard is an explicit failure, never a silently truncated success.
                    if (pageCount > 500) throw new IOException("LH 목록 페이지 수가 안전 한도를 초과했습니다.");
                } else if (parsed.total() != expectedTotal || parsed.pages() != pageCount) {
                    throw new IOException("수집 도중 LH 목록이 변경되었습니다. 다시 확인이 필요합니다.");
                }
                if (!parsed.items().isEmpty()) {
                    String fingerprint = status + ":" + parsed.items().stream().map(NoticeController.Notice::url).sorted().toList();
                    if (!fingerprints.add(fingerprint)) throw new IOException("LH가 같은 목록 페이지를 반복 반환했습니다.");
                }
                received += parsed.items().size();
                rows.addAll(parsed.items());
            }
            if (received != expectedTotal) throw new IOException("LH 목록 건수 불일치: " + status + " " + received + "/" + expectedTotal);
            counts.add(new SourceCount(status, received));
        }
        Map<String, NoticeController.Notice> latest = new LinkedHashMap<>();
        for (NoticeController.Notice n : rows) {
            String key = canonicalTitle(n.title()) + "|" + n.region() + "|" + n.type();
            latest.merge(key, n, LhNoticeCrawler::newer);
        }
        // Resolve corrections/cancellations BEFORE date filtering, so an old row cannot reappear.
        int unknownDeadlineCount = 0;
        Map<String, NoticeController.Notice> unique = new LinkedHashMap<>();
        for (NoticeController.Notice n : latest.values()) {
            if (isCancelled(n.title()) || !ACTIVE_STATUSES.contains(n.status())) continue;
            if (n.deadline() == null) { unknownDeadlineCount++; continue; }
            if (!LocalDate.parse(n.deadline()).isBefore(today)) unique.merge(n.id(), n, LhNoticeCrawler::newer);
        }
        List<NoticeController.Notice> items = unique.values().stream()
            .sorted(Comparator.comparing(NoticeController.Notice::deadline).thenComparing(NoticeController.Notice::id)).toList();
        return new CrawlResult(items, pagesFetched, rows.size(), unknownDeadlineCount, List.copyOf(counts));
    }

    static String pageUrl(String status, int page, LocalDate today) {
        Map<String, String> q = new LinkedHashMap<>();
        q.put("mi", "1026");
        q.put("srchY", page == 1 ? "Y" : "N");
        // LH's rental menu combines rental, purchased/leased rental and related housing codes.
        q.put("srchUppAisTpCd", "061339"); q.put("uppAisTpCd", "061339");
        q.put("aisTpCd", ""); q.put("srchAisTpCd", "");
        q.put("startDt", "2000-01-01"); q.put("endDt", today.toString());
        q.put("panStDt", "20000101"); q.put("panEdDt", today.format(DateTimeFormatter.BASIC_ISO_DATE));
        q.put("schTy", "0"); q.put("listCo", "100"); q.put("prevListCo", "100"); q.put("currPage", Integer.toString(page));
        q.put("panSs", status);
        return LIST_URL + "?" + query(q);
    }

    static ParsedPage parse(Document doc, int expectedPage) throws IOException {
        Element totalEl = doc.selectFirst(".bbs_total");
        var m = TOTAL.matcher(totalEl == null ? "" : totalEl.text().replaceAll("[\\s\\u00a0]", ""));
        if (!m.matches()) throw new IOException("LH 목록 건수/페이지 구조를 확인할 수 없습니다.");
        int total = Integer.parseInt(m.group(1).replace(",", ""));
        int current = Integer.parseInt(m.group(2));
        int pages = Math.max(1, Integer.parseInt(m.group(3)));
        if (current != expectedPage) throw new IOException("요청한 LH 페이지와 응답 페이지가 다릅니다.");
        Element table = doc.selectFirst(".bbs_ListA");
        if (table == null) throw new IOException("LH 공고 표를 찾지 못했습니다.");
        Map<String, Integer> columns = new HashMap<>();
        var headers = table.select("thead th");
        for (int i = 0; i < headers.size(); i++) columns.put(headers.get(i).text().replaceAll("\\s", ""), i);
        // LH labels this column differently on initial and searched lists.
        if (!columns.containsKey("분류") && columns.containsKey("유형")) columns.put("분류", columns.get("유형"));
        for (String label : List.of("분류", "공고명", "지역", "게시일", "마감일", "상태")) {
            if (!columns.containsKey(label)) throw new IOException("LH 공고 열이 변경되었습니다: " + label);
        }
        List<NoticeController.Notice> items = new ArrayList<>();
        for (Element row : table.select("tbody tr")) {
            Element a = row.selectFirst("a.wrtancInfoBtn");
            if (a == null && total == 0) continue;
            if (a == null || a.attr("data-id1").isBlank()) throw new IOException("공고 식별자를 읽지 못했습니다.");
            var cells = row.select("td");
            if (cells.size() <= Collections.max(columns.values())) throw new IOException("LH 공고 행이 불완전합니다.");
            Element titleEl = a.clone(); titleEl.select(".day,.new").remove();
            String title = titleEl.text().replaceAll("\\s+", " ").trim();
            if (title.isBlank()) throw new IOException("공고 제목을 읽지 못했습니다.");
            Map<String, String> q = new LinkedHashMap<>();
            for (var pair : Map.of("panId", "id1", "ccrCnntSysDsCd", "id2", "uppAisTpCd", "id3", "aisTpCd", "id4").entrySet()) {
                String value = a.attr("data-" + pair.getValue());
                if (value.isBlank()) throw new IOException("공고 원문 링크 정보가 불완전합니다.");
                q.put(pair.getKey(), value);
            }
            q.put("mi", "1026");
            items.add(new NoticeController.Notice("lh-" + a.attr("data-id1"), title,
                cells.get(columns.get("지역")).text(), cells.get(columns.get("분류")).text(), "한국토지주택공사 (LH)",
                date(cells.get(columns.get("마감일")).text()), date(cells.get(columns.get("게시일")).text()),
                cells.get(columns.get("상태")).text().trim(),
                "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?" + query(q)));
        }
        if (total > 0 && items.isEmpty()) throw new IOException("LH 공고 목록을 읽지 못했습니다.");
        return new ParsedPage(List.copyOf(items), total, pages);
    }

    private static String date(String value) throws IOException {
        String s = value.trim();
        if (s.isBlank() || s.equals("-")) return null;
        var m = Pattern.compile("(\\d{4})[./-](\\d{1,2})[./-](\\d{1,2})").matcher(s);
        try {
            if (m.matches()) return LocalDate.of(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3))).toString();
        } catch (RuntimeException e) { throw new IOException("LH 날짜가 유효하지 않습니다: " + s, e); }
        throw new IOException("LH 날짜 형식이 변경되었습니다: " + s);
    }

    static String canonicalTitle(String title) {
        String value = title.trim();
        while (PREFIX.matcher(value).find()) value = PREFIX.matcher(value).replaceFirst("").trim();
        return value.replaceAll("\\s+", " ").trim();
    }
    static boolean isCancelled(String title) {
        String value = title.trim();
        while (PREFIX.matcher(value).find()) {
            var match = PREFIX.matcher(value); match.find();
            if (match.group().contains("취소")) return true;
            value = match.replaceFirst("").trim();
        }
        return value.startsWith("취소공고");
    }
    private static int priority(NoticeController.Notice n) { return isCancelled(n.title()) ? 2 : PREFIX.matcher(n.title()).find() || n.status().equals("정정공고중") ? 1 : 0; }
    private static NoticeController.Notice newer(NoticeController.Notice a, NoticeController.Notice b) {
        int cmp = Objects.toString(a.posted(), "").compareTo(Objects.toString(b.posted(), ""));
        if (cmp != 0) return cmp > 0 ? a : b;
        if (priority(a) != priority(b)) return priority(a) > priority(b) ? a : b;
        return a.id().compareTo(b.id()) >= 0 ? a : b;
    }
    private static String query(Map<String, String> q) {
        return q.entrySet().stream().map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8)).reduce((a,b) -> a + "&" + b).orElse("");
    }
    @FunctionalInterface interface PageFetcher { Document fetch(String url) throws IOException; }
    record ParsedPage(List<NoticeController.Notice> items, int total, int pages) {}
    public record SourceCount(String status, int rows) {}
    public record CrawlResult(List<NoticeController.Notice> items, int pagesFetched, int sourceRows, int unknownDeadlineCount, List<SourceCount> sources) {}
}
