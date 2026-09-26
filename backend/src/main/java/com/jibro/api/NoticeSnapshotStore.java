package com.jibro.api;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.*;
import java.time.Instant;
/** Last complete public feed, independent of member data. Mount this directory persistently. */
final class NoticeSnapshotStore {
 private final Path file;
 private final ObjectMapper mapper=new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,false);
 NoticeSnapshotStore(Path file){this.file=file.toAbsolutePath().normalize();}
 private Path backup(){return file.resolveSibling(file.getFileName()+".bak");}
 NoticeController.NoticeSnapshot load() throws IOException {
  if(!Files.exists(file)&&!Files.exists(backup()))return null;
  try{return read(file);}catch(IOException invalid){try{return read(backup());}catch(IOException backupInvalid){invalid.addSuppressed(backupInvalid);throw invalid;}}
 }
 private NoticeController.NoticeSnapshot read(Path path) throws IOException {
  if(Files.size(path)>20_000_000)throw new IOException("Oversized notice cache");
  var result=mapper.readValue(Files.readString(path),NoticeController.NoticeSnapshot.class);
  try{
   if(!"ok".equals(result.status())||result.lastCheckedAt()==null||result.items()==null||result.items().size()>20000||result.sources()==null)throw new IllegalArgumentException();
   Instant.parse(result.lastCheckedAt());
   for(var n:result.items())if(n.id()==null||!n.id().matches("lh-[0-9]+")||n.title()==null||n.url()==null)throw new IllegalArgumentException();
  }catch(RuntimeException e){throw new IOException("Invalid complete notice cache",e);}
  return result;
 }
 void save(NoticeController.NoticeSnapshot value) throws IOException {
  Files.createDirectories(file.getParent());
  Path temporary=Files.createTempFile(file.getParent(),"notice-cache-",".tmp");
  try{
   Files.writeString(temporary,mapper.writeValueAsString(value));read(temporary);
   if(Files.exists(file)){boolean valid=true;try{read(file);}catch(IOException invalid){valid=false;}if(valid)Files.copy(file,backup(),StandardCopyOption.REPLACE_EXISTING);}
   try{Files.move(temporary,file,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}
   catch(AtomicMoveNotSupportedException e){Files.move(temporary,file,StandardCopyOption.REPLACE_EXISTING);}
  }finally{Files.deleteIfExists(temporary);}
 }
}
