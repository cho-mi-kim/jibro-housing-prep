package com.jibro.api;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.jsoup.Jsoup;
import java.nio.file.*;
import java.time.*;
import java.io.IOException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class NoticeSnapshotStoreTest {
 @TempDir Path dir;
 NoticeController.NoticeSnapshot snapshot(String title){return new NoticeController.NoticeSnapshot(List.of(new NoticeController.Notice("lh-12345678",title,"서울","국민임대","LH","2026-10-01","2026-09-01","공고중","https://apply.lh.or.kr/?panId=12345678")),"2026-09-26T00:00:00Z","ok","2026-09-26T00:00:00Z",null,1,1,0,List.of());}
 @Test void restartRestoresCompleteSnapshotAndRefreshFailureKeepsIt() throws Exception {
  var path=dir.resolve("feed.json");new NoticeSnapshotStore(path).save(snapshot("공고 A"));
  var restored=new NoticeSnapshotStore(path);assertEquals("공고 A",restored.load().items().get(0).title());
  var crawler=new LhNoticeCrawler(url->{throw new IOException("offline");},0);
  var controller=new NoticeController(crawler,Clock.fixed(Instant.parse("2026-09-26T01:00:00Z"),ZoneId.of("Asia/Seoul")),Duration.ZERO);
  controller.setStoreForTest(restored);assertEquals("stale",controller.get().status());
  assertEquals("공고 A",controller.refresh().items().get(0).title());assertEquals("2026-09-26T00:00:00Z",controller.get().lastCheckedAt());
 }
 @Test void corruptPrimaryUsesLastValidBackupWithoutOverwritingIt() throws Exception {
  var path=dir.resolve("feed.json");var store=new NoticeSnapshotStore(path);store.save(snapshot("A"));store.save(snapshot("B"));Files.writeString(path,"corrupt");assertEquals("A",store.load().items().get(0).title());
  store.save(snapshot("C"));Files.writeString(path,"corrupt");assertEquals("A",store.load().items().get(0).title());
 }
 @Test void corruptBothFailsAndValidEmptySnapshotCanBeSaved() throws Exception {
  var path=dir.resolve("feed.json");Files.writeString(path,"{}");assertThrows(IOException.class,()->new NoticeSnapshotStore(path).load());
  var empty=new NoticeController.NoticeSnapshot(List.of(),"2026-09-26T00:00:00Z","ok",null,null,1,0,0,List.of());new NoticeSnapshotStore(path).save(empty);assertTrue(new NoticeSnapshotStore(path).load().items().isEmpty());
 }
 @Test void storageFailureAndRetryPolicyAreExplicit() throws Exception {
  var parent=dir.resolve("not-a-directory");Files.writeString(parent,"x");assertThrows(IOException.class,()->new NoticeSnapshotStore(parent.resolve("feed.json")).save(snapshot("A")));
  assertEquals(60000,NoticeController.retryDelayMs(1));assertEquals(120000,NoticeController.retryDelayMs(2));assertEquals(3600000,NoticeController.retryDelayMs(20));
 }
}
