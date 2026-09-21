package com.jibro.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Anonymous device-scoped storage until account authentication is introduced. */
@RestController
@RequestMapping("/api/notebook")
@CrossOrigin(origins={"http://localhost:5173","http://localhost:4173","https://jibro-housing-prep.understandingprocess.chatgpt.site"}, allowCredentials="true")
public class NotebookController {
 private static final String DEVICE_HEADER="X-Jibro-Device";
 private final ObjectMapper mapper=new ObjectMapper();
 private final Map<String,Map<String,Object>> states=new ConcurrentHashMap<>();
 private final Path store=Paths.get(System.getProperty("user.home"),".jibro","notebook-state.json");
 @PostConstruct void load(){try{if(Files.exists(store))states.putAll(mapper.readValue(Files.readString(store),new TypeReference<>(){}));}catch(IOException ignored){}}
 @GetMapping public Map<String,Object> get(@RequestHeader(value=DEVICE_HEADER,defaultValue="anonymous") String device){return states.computeIfAbsent(device,k->defaults());}
 @PutMapping public synchronized Map<String,Object> update(@RequestHeader(value=DEVICE_HEADER,defaultValue="anonymous") String device,@RequestBody Map<String,Object> next){Map<String,Object> value=new LinkedHashMap<>(defaults());value.putAll(next);states.put(device,value);persist();return value;}
 private Map<String,Object> defaults(){return new LinkedHashMap<>(Map.of("name","가나다","region","서울특별시","saved",java.util.List.of(),"done",java.util.List.of(),"conditions",java.util.List.of(),"reminder",true));}
 private void persist(){try{Files.createDirectories(store.getParent());Files.writeString(store,mapper.writeValueAsString(states));}catch(IOException ignored){}}
}
