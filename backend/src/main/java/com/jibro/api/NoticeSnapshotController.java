package com.jibro.api;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.time.Instant;
import java.util.Set;

/** Committed source snapshots only. This route does not claim live collection. */
@RestController
@RequestMapping("/api/notice-snapshots")
public class NoticeSnapshotController {
    private final ObjectMapper json;
    private final JsonNode evidence, schedules;
    public NoticeSnapshotController(ObjectMapper json) throws IOException {
        this.json=json;
        try(var in=new ClassPathResource("snapshots/notice-evidence.json").getInputStream()){evidence=json.readTree(in);}
        try(var in=new ClassPathResource("snapshots/notice-schedules.json").getInputStream()){schedules=json.readTree(in);}
    }
    @GetMapping("/{kind:evidence|schedules}")
    public ResponseEntity<?> get(@PathVariable String kind,@RequestParam String url) {
        final String key;
        try{key=NoticeEvidenceService.canonicalUrl(url);}catch(IllegalArgumentException e){return ResponseEntity.badRequest().body(java.util.Map.of("error","invalid_notice"));}
        boolean isEvidence=kind.equals("evidence");String field=isEvidence?"summaries":"schedules";
        JsonNode source=isEvidence?evidence:schedules, selected=source.path(field).path(key);
        if(isEvidence&&!selected.isMissingNode()&&!valid(selected,key))return ResponseEntity.status(503).body(java.util.Map.of("error","invalid_snapshot"));
        ObjectNode result=json.createObjectNode().put("version",isEvidence?"evidence-v1":"schedule-v1");
        if(isEvidence)result.set("generatedAt",source.path("generatedAt"));
        ObjectNode items=result.putObject(field);if(!selected.isMissingNode())items.set(key,selected);
        return ResponseEntity.ok().header("Cache-Control","private, max-age=300").header("X-Content-Type-Options","nosniff").body(result);
    }
    private boolean valid(JsonNode value,String key){
        try{return value.path("version").asText().equals("evidence-v1")&&NoticeEvidenceService.canonicalUrl(value.path("noticeUrl").asText()).equals(key)&&value.path("criteria").isArray()&&value.path("sources").isArray()&&Set.of("ready","partial","unavailable").contains(value.path("status").asText())&&Instant.parse(value.path("checkedAt").asText())!=null;}catch(RuntimeException e){return false;}
    }
}
