package com.jibro.api;

import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api/notices")
public class NoticeController {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(NoticeController.class);
    private final LhNoticeImporter importer;
    private final LhNoticeCrawler crawler;
    private final Clock clock;
    private final Duration cooldown;
    private volatile NoticeSnapshot snapshot = new NoticeSnapshot(List.of(), null, "not_checked", null, null, 0, 0, 0, List.of());

    @org.springframework.beans.factory.annotation.Autowired
    public NoticeController(LhNoticeCrawler crawler, LhNoticeImporter importer) {
        this(crawler, Clock.system(ZoneId.of("Asia/Seoul")), Duration.ofMinutes(1), importer);
    }

    NoticeController(LhNoticeCrawler crawler, Clock clock, Duration cooldown) {
        this(crawler, clock, cooldown, new LhNoticeImporter());
    }

    NoticeController(LhNoticeCrawler crawler, Clock clock, Duration cooldown, LhNoticeImporter importer) {
        this.importer = importer;
        this.crawler = crawler;
        this.clock = clock;
        this.cooldown = cooldown;
    }

    @GetMapping(produces=MediaType.APPLICATION_JSON_VALUE)
    public NoticeSnapshot get() {
        if (snapshot.status().equals("not_checked")) return refresh();
        return snapshot;
    }

    @PostMapping(path="/refresh", produces=MediaType.APPLICATION_JSON_VALUE)
    public synchronized NoticeSnapshot refresh() {
        Instant attempt = clock.instant();
        if (snapshot.lastAttemptedAt() != null && attempt.isBefore(Instant.parse(snapshot.lastAttemptedAt()).plus(cooldown))) return snapshot;
        try {
            var result = crawler.collect(LocalDate.now(clock));
            snapshot = new NoticeSnapshot(result.items(), clock.instant().toString(), "ok", attempt.toString(), null,
                result.pagesFetched(), result.sourceRows(), result.unknownDeadlineCount(), result.sources());
            log.info("LH collection complete: {} pages, {} source rows, {} active notices", result.pagesFetched(), result.sourceRows(), result.items().size());
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            log.warn("LH collection failed; preserving last complete result", e);
            snapshot = new NoticeSnapshot(snapshot.items(), snapshot.lastCheckedAt(), snapshot.lastCheckedAt() == null ? "error" : "stale",
                attempt.toString(), "LH 목록 수집에 실패했습니다. 마지막 성공 시각과 공고 원문을 확인해주세요.",
                snapshot.pagesFetched(), snapshot.sourceRows(), snapshot.unknownDeadlineCount(), snapshot.sources());
        }
        return snapshot;
    }

    @org.springframework.beans.factory.annotation.Value("${jibro.notices.scheduling-enabled:true}")
    private boolean schedulingEnabled;

    @Scheduled(fixedDelayString="${jibro.notices.refresh-delay-ms:21600000}", initialDelayString="${jibro.notices.initial-delay-ms:1000}")
    void refreshOnSchedule() { if (schedulingEnabled) refresh(); }

    @PostMapping(path="/import", produces=MediaType.APPLICATION_JSON_VALUE)
    public ImportedNotice importNotice(@RequestBody Map<String,String> body){
        String raw=Objects.requireNonNullElse(body.get("url"), "").trim();
        try { return importer.read(raw, snapshot.items()); }
        catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage()); }
    }

    public record Notice(String id,String title,String region,String type,String agency,String deadline,String posted,String status,String url){
        @com.fasterxml.jackson.annotation.JsonProperty public String deadlineKind() { return "notice"; }
    }
    public record ImportedNotice(String id,String title,String agency,String url,String region,String type,String deadline,String posted,String status,boolean parsed,String description){
        @com.fasterxml.jackson.annotation.JsonProperty public String deadlineKind() { return "notice"; }
    }
    public record NoticeSnapshot(List<Notice> items, String lastCheckedAt, String status,
        String lastAttemptedAt, String error, int pagesFetched, int sourceRows, int unknownDeadlineCount,
        List<LhNoticeCrawler.SourceCount> sources) {}
}

