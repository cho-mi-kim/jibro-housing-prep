package com.jibro.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.AtomicMoveNotSupportedException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Anonymous device-scoped storage until account authentication is introduced. */
@RestController
@RequestMapping("/api/notebook")
public class NotebookController {
 private static final String DEVICE_HEADER="X-Jibro-Device";
 private final ObjectMapper mapper=new ObjectMapper();
 private final Map<String,Map<String,Object>> states=new ConcurrentHashMap<>();
 private final Path store;
 public NotebookController(@org.springframework.beans.factory.annotation.Value("${jibro.notebook.store:${user.home}/.jibro/notebook-state.json}") String location){store=Paths.get(location).toAbsolutePath();}
 @PostConstruct void load(){try{if(Files.exists(store))states.putAll(mapper.readValue(Files.readString(store),new TypeReference<>(){}));}catch(IOException e){throw new IllegalStateException("준비 기록 파일을 읽지 못했습니다. 기존 파일을 확인해주세요.",e);}}
 @GetMapping public Map<String,Object> get(@RequestHeader(value=DEVICE_HEADER,defaultValue="anonymous") String device){return states.computeIfAbsent(device,k->defaults());}
 @PutMapping public synchronized Map<String,Object> update(@RequestHeader(value=DEVICE_HEADER,defaultValue="anonymous") String device,@RequestBody Map<String,Object> next){Map<String,Object> value=new LinkedHashMap<>(defaults());value.putAll(next);var proposed=new LinkedHashMap<>(states);proposed.put(device,value);persist(proposed);states.put(device,value);return value;}
 private Map<String,Object> defaults(){return new LinkedHashMap<>(Map.of("name","가나다","region","서울특별시","saved",java.util.List.of(),"done",java.util.List.of(),"conditions",java.util.List.of(),"reminder",true));}
 private void persist(Map<String,Map<String,Object>> proposed){
  Path temporary=null;
  try{
   Files.createDirectories(store.getParent());
   temporary=Files.createTempFile(store.getParent(),"notebook-",".tmp");
   Files.writeString(temporary,mapper.writeValueAsString(proposed));
   try{Files.move(temporary,store,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}
   catch(AtomicMoveNotSupportedException e){Files.move(temporary,store,StandardCopyOption.REPLACE_EXISTING);}
  }catch(IOException e){throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"준비 기록을 저장하지 못했습니다.",e);}
  finally{if(temporary!=null)try{Files.deleteIfExists(temporary);}catch(IOException ignored){}}
 }
}
