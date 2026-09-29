package com.jibro.api;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.Pattern;

/** Only a canonical official notice can trigger an outbound request. */
@Component
public class LhNoticeImporter {
    private final LhNoticeCrawler.PageFetcher fetcher;
    public LhNoticeImporter() {
        this(url -> Jsoup.connect(url).followRedirects(false).timeout(15000)
            .maxBodySize(4 * 1024 * 1024).userAgent("JIBRO/1.0 public-notice-reader").get());
    }
    LhNoticeImporter(LhNoticeCrawler.PageFetcher fetcher) { this.fetcher = fetcher; }

    NoticeController.ImportedNotice read(String raw, List<NoticeController.Notice> known) {
        URI uri;
        try { uri = URI.create(raw); } catch (RuntimeException e) { throw new IllegalArgumentException("공고 URL을 확인해주세요."); }
        if (!Set.of("http", "https").contains(Objects.toString(uri.getScheme(), "")) || uri.getHost() == null || uri.getUserInfo() != null)
            throw new IllegalArgumentException("공고 URL을 확인해주세요.");
        String title = "공고 링크만 저장됨", region = "공고 원문 확인 필요", type = "공고 유형 확인 필요";
        String deadline = null, posted = null;
        boolean parsed = false;
        try {
            String canonical = NoticeEvidenceService.canonicalUrl(raw);
            String panId = Arrays.stream(URI.create(canonical).getQuery().split("&")).filter(p -> p.startsWith("panId=")).findFirst().orElseThrow().substring(6);
            Document page = fetcher.fetch(canonical);
            var heading = page.selectFirst(".bbs_ViewA > h3");
            boolean sameNotice = Pattern.compile("(?:var\\s+panId\\s*=|panId\\s*:)\\s*'" + Pattern.quote(panId) + "'").matcher(page.html()).find();
            if (sameNotice && heading != null && !heading.text().isBlank()) {
                title = heading.text().trim(); parsed = true;
                for (var notice : known) if (NoticeEvidenceService.canonicalUrl(notice.url()).equals(canonical) && notice.title().equals(title)) {
                    region = notice.region(); type = notice.type(); deadline = notice.deadline(); posted = notice.posted(); break;
                }
            }
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            // Keep the link without inventing a title, agency or first-found date range.
        }
        return new NoticeController.ImportedNotice("imported-" + hash(raw), title,
            parsed ? "한국토지주택공사 (LH)" : "공고 원문 확인 필요", raw, region, type, deadline, posted,
            parsed ? "공고 정보 확인됨" : "링크 저장됨", parsed,
            parsed ? "공식 공고 제목을 확인했어요. 실제 신청 기간·자격·서류는 원문을 확인해주세요." : "공고 링크만 저장됨 · 세부 정보 확인 필요");
    }
    private static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))).substring(0,16); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
}
