package com.jibro.api;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import java.util.Map;

@RestController
@RequestMapping("/api/notice-evidence")
public class NoticeEvidenceController {
    private final NoticeEvidenceService service;
    public NoticeEvidenceController(NoticeEvidenceService service){this.service=service;}
    @GetMapping
    public ResponseEntity<?> get(@RequestParam String url){
        try{return ResponseEntity.ok(service.get(url));}
        catch(IllegalArgumentException e){return ResponseEntity.badRequest().body(Map.of("status","invalid_url","message",e.getMessage()));}
        catch(NoticeEvidenceService.BusyException e){return ResponseEntity.status(429).header("Retry-After","60").body(Map.of("status","busy","message","다른 공고문을 확인 중입니다. 잠시 후 다시 시도해주세요."));}
        catch(InterruptedException e){Thread.currentThread().interrupt();return unavailable();}
        catch(Exception e){return unavailable();}
    }
    private ResponseEntity<?> unavailable(){return ResponseEntity.status(502).body(Map.of("status","error","message","공고문을 불러오지 못했습니다. 공고 원문을 확인해주세요."));}
}
