package com.jibro.api;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class NotebookControllerTest {
    @TempDir Path directory;
    @Test void deviceRecordsStaySeparateAndSurviveRestart(){
        var file=directory.resolve("state.json");var server=new NotebookController(file.toString());server.load();
        var a=Map.<String,Object>of("activeNoticeId","lh-A","noticeData",Map.of("lh-A",Map.of("conditions",List.of("age"))));
        server.update("test-a",a);server.update("test-b",Map.of("activeNoticeId","lh-B"));
        var restarted=new NotebookController(file.toString());restarted.load();
        assertEquals("lh-A",restarted.get("test-a").get("activeNoticeId"));
        assertEquals(a.get("noticeData"),restarted.get("test-a").get("noticeData"));
        assertEquals("lh-B",restarted.get("test-b").get("activeNoticeId"));
        assertFalse(restarted.get("test-b").containsKey("noticeData"));
    }
    @Test void diskFailureReturns503WithoutChangingSuccessfulRecord() throws Exception {
        Path parent=directory.resolve("records"),file=parent.resolve("state.json");
        var server=new NotebookController(file.toString());server.update("test",Map.of("activeNoticeId","lh-A"));
        Files.delete(file);Files.delete(parent);Files.writeString(parent,"blocking file");
        var error=assertThrows(ResponseStatusException.class,()->server.update("test",Map.of("activeNoticeId","lh-B")));
        assertEquals(503,error.getStatusCode().value());assertEquals("lh-A",server.get("test").get("activeNoticeId"));
    }
    @Test void corruptedStoreDoesNotSilentlyBecomeEmpty() throws Exception {
        Path file=directory.resolve("broken.json");Files.writeString(file,"not json");
        assertThrows(IllegalStateException.class,()->new NotebookController(file.toString()).load());
    }
}
