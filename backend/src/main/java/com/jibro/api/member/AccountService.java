package com.jibro.api.member;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.dao.DuplicateKeyException;
import java.time.Clock;
import java.util.*;
import static com.jibro.api.member.MemberRateLimiter.hash;

@Service
public class AccountService {
    static final long SESSION_MS=7L*24*60*60*1000;
    final MemberRepository repo; final MemberPasswords passwords; final NotebookCipher cipher;
    final NotebookValidator validator; final AccountSettings settings; final Clock clock; final ObjectMapper json;
    private final String dummyHash;
    public record Login(MemberRepository.Member member, String token) {}
    public record Principal(String memberId, String sessionHash) {}
    public AccountService(MemberRepository repo,MemberPasswords passwords,NotebookCipher cipher,NotebookValidator validator,AccountSettings settings,Clock clock,ObjectMapper json){
        this.repo=repo;this.passwords=passwords;this.cipher=cipher;this.validator=validator;this.settings=settings;this.clock=clock;this.json=json;
        dummyHash=passwords.encode(NotebookCipher.randomToken(32));
    }
    static String text(JsonNode data,String key){JsonNode v=data.path(key);return v.isTextual()?v.asText():"";}
    public static String email(String value){String email=value.trim().toLowerCase(Locale.ROOT);if(email.length()>254||!email.matches("[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+"))throw new AccountError(400,"email","이메일 주소를 확인해주세요.");return email;}
    private boolean reserved(String email){return Set.of("admin@jibro.test","admin@jibro.local.test").contains(email);}
    @Transactional
    public Login register(JsonNode data){
        if(!data.path("terms").equals(BooleanNode.TRUE)||!data.path("privacy").equals(BooleanNode.TRUE)||!data.path("age").equals(BooleanNode.TRUE)||!AccountSettings.POLICY.equals(text(data,"policyVersion")))
            throw new AccountError(400,"consent","필수 동의 내용을 확인해주세요.");
        String email=email(text(data,"email"));if(reserved(email))throw new AccountError(400,"reserved","다른 이메일로 가입해주세요.");
        String password=passwords.requireNew(text(data,"password"));JsonNode profile=validator.profile(data.path("applicantProfile"));
        String nickname=text(data,"nickname").trim();if(nickname.isBlank())nickname="임시"+String.format("%06d",new java.security.SecureRandom().nextInt(1000000));
        if(nickname.length()>16)throw new AccountError(400,"nickname","닉네임은 16자 이내로 입력해주세요.");
        String id=UUID.randomUUID().toString();
        try{repo.insert(id,email,nickname,passwords.encode(password),false,AccountSettings.POLICY,AccountSettings.POLICY,clock.instant().toString(),clock.millis(),false);}
        catch(DuplicateKeyException e){throw new AccountError(400,"registration","가입 정보를 확인해주세요. 이미 가입한 이메일이라면 로그인해주세요.");}
        if(!profile.isNull()){
            ObjectNode initial=json.createObjectNode().put("name",nickname);initial.set("applicantProfile",profile);
            var state=validator.normalize(initial);
            repo.jdbc().update("INSERT INTO jibro_notebooks(member_id,payload,revision,updated_at) VALUES(?,?,1,?)",id,cipher.seal(id,state),clock.instant().toString());
        }
        return issue(repo.byId(id,false));
    }
    @Transactional
    public Login login(JsonNode data){
        String login=text(data,"email").trim().toLowerCase(Locale.ROOT),password=text(data,"password");
        if(login.equals("admin")){
            if(!settings.testLogin)throw AccountError.credentials();
            login="admin@jibro.local.test";
            if(repo.byEmail(login,false)==null && password.equals("admin"))
                repo.insert("local-preview-admin",login,"관리자 (테스트)",passwords.encode("admin"),false,"local-test","local-test",clock.instant().toString(),clock.millis(),true);
        }
        var member=repo.byEmail(login,true);
        boolean correct=passwords.matches(password,member==null?dummyHash:member.passwordHash());
        if(member==null||!correct||(member.test()&&!settings.testLogin))throw AccountError.credentials();
        if(passwords.legacy(member.passwordHash()))repo.jdbc().update("UPDATE jibro_members SET password_hash=? WHERE id=?",passwords.encode(password),member.id());
        return issue(member);
    }
    private Login issue(MemberRepository.Member member){
        String token=NotebookCipher.randomToken(32);
        repo.jdbc().update("DELETE FROM jibro_sessions WHERE member_id=? AND expires_at<=?",member.id(),clock.millis());
        repo.jdbc().update("INSERT INTO jibro_sessions(token_hash,member_id,expires_at) VALUES(?,?,?)",hash(token),member.id(),clock.millis()+SESSION_MS);
        return new Login(member,token);
    }
    public Principal authenticate(String token){
        if(token==null||!token.matches("[A-Za-z0-9_-]{43}"))return null;
        String digest=hash(token);
        var rows=repo.jdbc().query("SELECT s.member_id,m.test_account FROM jibro_sessions s JOIN jibro_members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_at>?",(r,n)->new Object[]{r.getString(1),r.getBoolean(2)},digest,clock.millis());
        if(rows.isEmpty()||((boolean)rows.get(0)[1]&&!settings.testLogin))return null;
        return new Principal((String)rows.get(0)[0],digest);
    }
    public MemberRepository.Member member(Principal p,boolean lock){
        if(p==null)throw new AccountError(401,"login_required","로그인 후 이용해주세요.");
        var m=repo.byId(p.memberId(),lock);
        if(m==null||(m.test()&&!settings.testLogin)||repo.jdbc().queryForObject("SELECT COUNT(*) FROM jibro_sessions WHERE token_hash=? AND member_id=? AND expires_at>?",Long.class,p.sessionHash(),p.memberId(),clock.millis())==0)
            throw new AccountError(401,"login_required","로그인 후 이용해주세요.");
        return m;
    }
    @Transactional public void logout(Principal p){if(p!=null)repo.jdbc().update("DELETE FROM jibro_sessions WHERE token_hash=?",p.sessionHash());}
    @Transactional public Login changePassword(Principal p,JsonNode data){
        var m=member(p,true);String next=passwords.requireNew(text(data,"newPassword"));
        if(!passwords.matches(text(data,"currentPassword"),m.passwordHash()))throw AccountError.credentials();
        repo.jdbc().update("UPDATE jibro_members SET password_hash=? WHERE id=?",passwords.encode(next),m.id());
        repo.jdbc().update("DELETE FROM jibro_sessions WHERE member_id=?",m.id());repo.jdbc().update("DELETE FROM jibro_mail_tokens WHERE member_id=?",m.id());
        return issue(m);
    }
    @Transactional public void delete(Principal p,JsonNode data){
        var m=member(p,true);
        if(!text(data,"confirm").equals("회원 탈퇴"))throw new AccountError(400,"confirmation","탈퇴 확인 문구를 입력해주세요.");
        if(!passwords.matches(text(data,"password"),m.passwordHash()))throw AccountError.credentials();
        repo.jdbc().update("DELETE FROM jibro_members WHERE id=?",m.id());
    }
    @Transactional public Map<String,Object> readNotebook(Principal p){
        var m=member(p,true);var rows=repo.jdbc().queryForList("SELECT payload,revision FROM jibro_notebooks WHERE member_id=?",m.id());
        if(rows.isEmpty()){var empty=new LinkedHashMap<String,Object>();empty.put("state",null);empty.put("revision",0);return empty;}
        var row=rows.get(0);String payload=(String)row.get("payload");long revision=((Number)row.get("revision")).longValue();JsonNode state=cipher.open(m.id(),payload);
        if(cipher.needsRotation(payload))repo.jdbc().update("UPDATE jibro_notebooks SET payload=? WHERE member_id=? AND revision=? AND payload=?",cipher.seal(m.id(),state),m.id(),revision,payload);
        return Map.of("state",state,"revision",revision);
    }
    @Transactional public Map<String,Object> writeNotebook(Principal p,JsonNode data){
        var m=member(p,true);JsonNode version=data.path("revision");
        if(!version.isIntegralNumber()||!version.canConvertToLong()||version.longValue()<0||version.longValue()>=9007199254740991L)throw new AccountError(400,"revision","기록 버전을 확인해주세요.");
        long revision=version.longValue();ObjectNode state=validator.normalize(data.path("state"));String payload=cipher.seal(m.id(),state);int changed;
        if(revision==0){
            if(repo.jdbc().queryForObject("SELECT COUNT(*) FROM jibro_notebooks WHERE member_id=?",Long.class,m.id())!=0)throw conflict();
            changed=repo.jdbc().update("INSERT INTO jibro_notebooks(member_id,payload,revision,updated_at) VALUES(?,?,1,?)",m.id(),payload,clock.instant().toString());
        }else changed=repo.jdbc().update("UPDATE jibro_notebooks SET payload=?,revision=revision+1,updated_at=? WHERE member_id=? AND revision=?",payload,clock.instant().toString(),m.id(),revision);
        if(changed!=1)throw conflict();return Map.of("state",state,"revision",revision+1);
    }
    private AccountError conflict(){return new AccountError(409,"conflict","다른 창에서 기록이 변경됐어요. 새로고침 후 다시 시도해주세요.");}
}
