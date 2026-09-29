package com.jibro.api;

import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import static org.junit.jupiter.api.Assertions.*;

class NoticeSnapshotControllerTest {
    @Test void selectsOnlyTheRequestedNoticeAndRejectsUntrustedUrls() throws Exception {
        var json=new ObjectMapper();var controller=new NoticeSnapshotController(json);
        try(var in=new ClassPathResource("snapshots/notice-evidence.json").getInputStream()){
            var source=json.readTree(in);String key=source.path("summaries").fieldNames().next();
            var response=controller.get("evidence",key);assertEquals(200,response.getStatusCode().value());
            JsonNode data=(JsonNode)response.getBody();assertEquals(1,data.path("summaries").size());assertEquals(source.path("summaries").path(key),data.path("summaries").path(key));
        }
        assertEquals(400,controller.get("evidence","http://127.0.0.1/private").getStatusCode().value());
        assertEquals(400,controller.get("schedules","https://apply.lh.or.kr.evil.test/").getStatusCode().value());
        var missing=controller.get("schedules","https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=99999999999999");
        assertEquals(200,missing.getStatusCode().value());assertEquals(0,((JsonNode)missing.getBody()).path("schedules").size());
    }
}
