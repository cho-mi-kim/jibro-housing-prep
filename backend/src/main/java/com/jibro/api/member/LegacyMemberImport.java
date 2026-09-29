package com.jibro.api.member;

import com.fasterxml.jackson.databind.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.file.*;
import java.time.Clock;
import java.util.*;
import static com.jibro.api.member.MemberRateLimiter.hash;

/** Offline-only migration. Never expose this service as an HTTP endpoint. */
@Service
public class LegacyMemberImport {
    final MemberRepository repo;final NotebookCipher cipher;final MemberPasswords passwords;final ObjectMapper json;final Clock clock;
    public LegacyMemberImport(MemberRepository repo,NotebookCipher cipher,MemberPasswords passwords,ObjectMapper json,Clock clock){this.repo=repo;this.cipher=cipher;this.passwords=passwords;this.json=json;this.clock=clock;}
    public record Report(boolean applied,int imported,int unchanged,int excludedTestAccounts){}
    record Planned(JsonNode user,String email,String password,JsonNode notebook,JsonNode state,String digest){}
    @Transactional(rollbackFor=Exception.class)
    public Report run(Path input,boolean apply)throws Exception{
        if(Files.size(input)>50_000_000)throw invalid();JsonNode export=json.readTree(Files.readAllBytes(input));
        if(!"jibro-member-export-v1".equals(export.path("format").asText())||!export.path("users").isArray()||!export.path("accounts").isArray()||!export.path("notebooks").isArray())throw invalid();
        Map<String,JsonNode> accounts=new HashMap<>(),notebooks=new HashMap<>();
        for(JsonNode a:export.path("accounts")){if(!a.path("provider_id").asText().equals("credential"))continue;if(accounts.put(a.path("user_id").asText(),a)!=null)throw invalid();}
        for(JsonNode n:export.path("notebooks"))if(notebooks.put(n.path("user_id").asText(),n)!=null)throw invalid();
        Set<String> ids=new HashSet<>(),emails=new HashSet<>();List<Planned> plan=new ArrayList<>();int unchanged=0,excluded=0;
        for(JsonNode u:export.path("users")){
            String id=u.path("id").asText(),email=AccountService.email(u.path("email").asText());
            if(!id.matches("[A-Za-z0-9_-]{1,128}")||!ids.add(id)||!emails.add(email))throw invalid();
            if(Set.of("site-test-admin","local-preview-admin").contains(id)||Set.of("admin@jibro.test","admin@jibro.local.test").contains(email)){excluded++;continue;}
            JsonNode a=accounts.get(id),n=notebooks.get(id);String password=a==null?"":a.path("password").asText();
            if(!passwords.legacy(password)||!u.path("name").isTextual()||u.path("name").asText().length()>64||!u.path("created_at").isIntegralNumber()
                ||!u.path("terms_version").isTextual()||u.path("terms_version").asText().length()>64||!u.path("privacy_version").isTextual()||u.path("privacy_version").asText().length()>64
                ||!u.path("accepted_at").isTextual()||u.path("accepted_at").asText().length()>64)throw invalid();
            JsonNode state=null;
            if(n!=null){
                if(!n.path("revision").isIntegralNumber()||n.path("revision").asLong()<1||n.path("revision").asLong()>=9007199254740991L||!n.path("payload").isTextual()||n.path("payload").asText().length()>500000||!n.path("updated_at").isTextual()||n.path("updated_at").asText().length()>64)throw invalid();
                state=cipher.open(id,n.path("payload").asText());
            }
            String digest=hash(json.writeValueAsString(List.of(u,a,n==null?json.nullNode():n)));
            var previous=repo.jdbc().queryForList("SELECT source_digest FROM jibro_member_imports WHERE source_member_id=?",String.class,id);
            if(!previous.isEmpty()){if(!digest.equals(previous.get(0)))throw new IllegalStateException("Previously imported source changed; refusing to overwrite member records");unchanged++;continue;}
            if(repo.byId(id,false)!=null||repo.byEmail(email,false)!=null)throw new IllegalStateException("Existing member conflicts with the import; no records were overwritten");
            plan.add(new Planned(u,email,password,n,state,digest));
        }
        if(!ids.containsAll(accounts.keySet())||!ids.containsAll(notebooks.keySet()))throw invalid();
        if(apply)for(Planned p:plan){
            JsonNode u=p.user();String id=u.path("id").asText();
            repo.insert(id,p.email(),u.path("name").asText(),p.password(),u.path("email_verified").asBoolean(false)||u.path("email_verified").asInt(0)==1,u.path("terms_version").asText(),u.path("privacy_version").asText(),u.path("accepted_at").asText(),u.path("created_at").asLong(),false);
            if(p.notebook()!=null)repo.jdbc().update("INSERT INTO jibro_notebooks(member_id,payload,revision,updated_at) VALUES(?,?,?,?)",id,cipher.seal(id,p.state()),p.notebook().path("revision").asLong(),p.notebook().path("updated_at").asText());
            repo.jdbc().update("INSERT INTO jibro_member_imports(source_member_id,source_digest,imported_at) VALUES(?,?,?)",id,p.digest(),clock.instant().toString());
        }
        return new Report(apply,plan.size(),unchanged,excluded);
    }
    private IllegalArgumentException invalid(){return new IllegalArgumentException("Invalid member export; no member data was changed");}
}
