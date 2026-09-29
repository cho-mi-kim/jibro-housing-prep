package com.jibro.api.member;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.*;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.*;
import org.springframework.http.HttpMethod;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.awaitility.Awaitility.await;

@SpringBootTest(properties={"spring.profiles.active=test","jibro.accounts.origin=https://jibro.example.test","jibro.accounts.mail-key=test-only-not-a-real-key","jibro.accounts.mail-from=account@example.test","jibro.notices.scheduling-enabled=false"})
@AutoConfigureMockMvc
class AccountIntegrationTest {
    @DynamicPropertySource static void config(DynamicPropertyRegistry r){
        r.add("spring.datasource.url",()->System.getenv().getOrDefault("JIBRO_TEST_DATABASE_URL","jdbc:h2:mem:membertest;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1"));
        r.add("spring.datasource.username",()->System.getenv().getOrDefault("JIBRO_TEST_DATABASE_USER","sa"));
        r.add("spring.datasource.password",()->System.getenv().getOrDefault("JIBRO_TEST_DATABASE_PASSWORD",""));
        r.add("jibro.accounts.keys",()->{try{return Files.readString(Path.of("src/test/resources/legacy-test-keys.json"));}catch(Exception e){throw new RuntimeException(e);}});
    }
    @TestConfiguration static class TimeConfig {@Bean @Primary TestClock testClock(){return new TestClock();}}
    static class TestClock extends Clock{volatile Instant now=Instant.parse("2026-09-29T00:00:00Z");public ZoneId getZone(){return ZoneOffset.UTC;}public Clock withZone(ZoneId z){return Clock.fixed(now,z);}public Instant instant(){return now;}}
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired JdbcTemplate db;@Autowired TestClock time;@Autowired NotebookCipher cipher;@Autowired AccountService service;@Autowired LegacyMemberImport importer;@Autowired MemberPasswords passwords;
    @MockBean AccountMailSender sender;
    final Queue<Mail> delivered=new ConcurrentLinkedQueue<>();
    record Mail(String email,String token,String kind){}
    static final String PASSWORD="Safe-local-passphrase-2026",ORIGIN="https://jibro.example.test";
    int nextIp;
    @BeforeEach void resetData()throws Exception{
        // Mail jobs are awaited in each test before this cleanup.
        db.update("DELETE FROM jibro_members");db.update("DELETE FROM jibro_rate_limits");time.now=Instant.parse("2026-09-29T00:00:00Z");delivered.clear();reset(sender);
        doAnswer(i->{delivered.add(new Mail(i.getArgument(0),i.getArgument(1),i.getArgument(2)));return null;}).when(sender).send(anyString(),anyString(),anyString());
    }
    class Client{
        final Map<String,Cookie> cookies=new HashMap<>();final String ip="192.0.2."+(++nextIp);
        MvcResult raw(String path,String method,JsonNode data,Map<String,String> headers)throws Exception{
            MockHttpServletRequestBuilder b=MockMvcRequestBuilders.request(HttpMethod.valueOf(method),path).with(r->{r.setRemoteAddr(ip);return r;});
            if(!cookies.isEmpty())b.cookie(cookies.values().toArray(Cookie[]::new));
            if(data!=null)b.content(json.writeValueAsBytes(data));headers.forEach(b::header);
            MvcResult result=mvc.perform(b).andReturn();
            for(String line:result.getResponse().getHeaders("Set-Cookie")){String[] pair=line.split(";",2)[0].split("=",2);if(pair.length==2){if(pair[1].isEmpty())cookies.remove(pair[0]);else cookies.put(pair[0],new Cookie(pair[0],pair[1]));}}
            return result;
        }
        MvcResult request(String path,String method,JsonNode data)throws Exception{
            Map<String,String> headers=new HashMap<>(Map.of("Origin",ORIGIN,"Content-Type","application/json","X-Jibro-Request","1"));
            if(!method.equals("GET")){JsonNode csrf=body(raw("/api/account/csrf","GET",null,Map.of()));headers.put(csrf.path("headerName").asText(),csrf.path("token").asText());}
            return raw(path,method,data,headers);
        }
        JsonNode signup(String email)throws Exception{return signup(email,null);}
        JsonNode signup(String email,JsonNode profile)throws Exception{
            ObjectNode data=registration(email);if(profile!=null)data.set("applicantProfile",profile);
            MvcResult r=request("/api/account/register","POST",data);assertEquals(200,r.getResponse().getStatus(),r.getResponse().getContentAsString());
            await().atMost(Duration.ofSeconds(5)).until(()->delivered.stream().anyMatch(m->m.email().equals(email)&&m.kind().equals("verify")));return body(r).path("user");
        }
    }
    ObjectNode registration(String email){return json.createObjectNode().put("email",email).put("password",PASSWORD).put("nickname","테스트").put("terms",true).put("privacy",true).put("age",true).put("policyVersion",AccountSettings.POLICY);}
    JsonNode body(MvcResult r)throws Exception{return json.readTree(r.getResponse().getContentAsByteArray());}
    ObjectNode credentials(String email,String password){return json.createObjectNode().put("email",email).put("password",password);}
    ObjectNode profile(){return json.createObjectNode().put("consent",true).put("consentVersion","2026-09-26").put("birthDate","1995-01-01").put("householdSize",3).put("monthlyIncome",3000000);}
    ObjectNode state()throws Exception{return (ObjectNode)json.readTree("{\"name\":\"테스트\",\"activeNoticeId\":\"lh-one\",\"saved\":[\"lh-one\"],\"notificationReads\":[\"event-1\"],\"noticeData\":{\"lh-one\":{\"done\":[\"resident\"],\"conditions\":[\"age\"],\"conditionVersions\":{\"age\":\"c1\"},\"documentVersions\":{\"resident\":\"d1\"},\"documentChoices\":{\"extra\":\"exclude\"}}},\"noticeSnapshots\":{\"lh-one\":{\"title\":\"공고\",\"url\":\"https://apply.lh.or.kr/\"}}}");}
    ObjectNode write(JsonNode state,long revision){ObjectNode data=json.createObjectNode().put("revision",revision);data.set("state",state);return data;}
    @Test void consentValidationPasswordsAndNickname()throws Exception{
        Client c=new Client();assertEquals(400,c.request("/api/account/register","POST",registration("a@example.test").put("terms",false)).getResponse().getStatus());
        assertEquals(400,c.request("/api/account/register","POST",registration("a@example.test").put("password","short")).getResponse().getStatus());
        ObjectNode invalid=registration("a@example.test");invalid.set("applicantProfile",profile().put("consent",false));assertEquals(400,c.request("/api/account/register","POST",invalid).getResponse().getStatus());assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM jibro_members",Integer.class));
        MvcResult result=c.request("/api/account/register","POST",registration("a@example.test").put("nickname",""));assertEquals(200,result.getResponse().getStatus());assertTrue(body(result).path("user").path("nickname").asText().matches("임시\\d{6}"));
        await().atMost(Duration.ofSeconds(5)).until(()->!delivered.isEmpty());String hash=db.queryForObject("SELECT password_hash FROM jibro_members",String.class);assertTrue(hash.startsWith("{scrypt}"));assertFalse(hash.contains(PASSWORD));
        assertTrue(result.getResponse().getHeaders("Set-Cookie").stream().anyMatch(v->v.contains("HttpOnly")&&v.contains("Secure")&&v.contains("SameSite=Lax")));
        assertEquals(400,c.request("/api/account/register","POST",registration("a@example.test")).getResponse().getStatus());
    }
    @Test void csrfOriginAndSizeAreEnforced()throws Exception{
        Client c=new Client();assertEquals(403,c.raw("/api/account/register","POST",registration("x@example.test"),Map.of("Origin",ORIGIN,"Content-Type","application/json","X-Jibro-Request","1")).getResponse().getStatus());
        JsonNode csrf=body(c.raw("/api/account/csrf","GET",null,Map.of()));Map<String,String> headers=new HashMap<>(Map.of("Origin","https://evil.example","Content-Type","application/json","X-Jibro-Request","1",csrf.path("headerName").asText(),csrf.path("token").asText()));
        assertEquals(403,c.raw("/api/account/register","POST",registration("x@example.test"),headers).getResponse().getStatus());headers.put("Origin",ORIGIN);headers.put("Content-Type","text/plain");assertEquals(415,c.raw("/api/account/register","POST",registration("x@example.test"),headers).getResponse().getStatus());
        headers.put("Content-Type","application/json");assertEquals(413,c.raw("/api/account/register","POST",json.createObjectNode().put("large","x".repeat(250001)),headers).getResponse().getStatus());
        assertEquals(401,c.request("/api/auth/sign-up/email","POST",registration("x@example.test")).getResponse().getStatus());assertEquals(401,c.request("/api/notebook","GET",null).getResponse().getStatus());
    }
    @Test void encryptedNotebooksAreSeparatedAndStaleWritesCannotOverwrite()throws Exception{
        Client a=new Client(),b=new Client();String id=a.signup("a@example.test",profile()).path("id").asText();b.signup("b@example.test");
        assertEquals(1,body(a.request("/api/member-notebook","GET",null)).path("revision").asInt());assertTrue(body(b.request("/api/member-notebook","GET",null)).path("state").isNull());
        ObjectNode state=state();state.set("applicantProfile",profile());assertEquals(200,a.request("/api/member-notebook","PUT",write(state,1)).getResponse().getStatus());
        String payload=db.queryForObject("SELECT payload FROM jibro_notebooks WHERE member_id=?",String.class,id);assertTrue(payload.startsWith(NotebookCipher.PREFIX));assertFalse(payload.contains("1995-01-01"));assertFalse(payload.contains("monthlyIncome"));
        assertEquals(409,a.request("/api/member-notebook","PUT",write(state,1)).getResponse().getStatus());
        JsonNode stored=body(a.request("/api/member-notebook","GET",null)).path("state");assertEquals("c1",stored.path("noticeData").path("lh-one").path("conditionVersions").path("age").asText());assertEquals("event-1",stored.path("notificationReads").get(0).asText());
        assertTrue(body(b.request("/api/member-notebook","GET",null)).path("state").isNull());
        state.putNull("applicantProfile");assertEquals(200,a.request("/api/member-notebook","PUT",write(state,2)).getResponse().getStatus());assertTrue(body(a.request("/api/member-notebook","GET",null)).path("state").path("applicantProfile").isNull());
        db.update("UPDATE jibro_notebooks SET payload=? WHERE member_id=?",payload.substring(0,payload.length()-5)+"AAAAA",id);assertEquals(503,a.request("/api/member-notebook","GET",null).getResponse().getStatus());assertEquals(1,db.queryForObject("SELECT COUNT(*) FROM jibro_notebooks WHERE member_id=?",Integer.class,id));
    }
    @Test void sessionsLogoutPasswordChangeAndDeleteRevokeAccess()throws Exception{
        Client a=new Client(),b=new Client();a.signup("a@example.test");assertEquals(200,b.request("/api/account/login","POST",credentials("a@example.test",PASSWORD)).getResponse().getStatus());
        assertEquals(401,b.request("/api/account/login","POST",credentials("a@example.test","wrong")).getResponse().getStatus());
        assertEquals(200,a.request("/api/account/password","POST",json.createObjectNode().put("currentPassword",PASSWORD).put("newPassword",PASSWORD+"!" )).getResponse().getStatus());assertEquals(401,b.request("/api/member-notebook","GET",null).getResponse().getStatus());
        assertEquals(200,a.request("/api/member-notebook","PUT",write(state(),0)).getResponse().getStatus());
        assertEquals(401,a.request("/api/account","DELETE",json.createObjectNode().put("confirm","회원 탈퇴").put("password","wrong")).getResponse().getStatus());
        assertEquals(200,a.request("/api/account","DELETE",json.createObjectNode().put("confirm","회원 탈퇴").put("password",PASSWORD+"!")).getResponse().getStatus());assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM jibro_notebooks",Integer.class));assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM jibro_sessions",Integer.class));
        Client c=new Client();c.signup("c@example.test");Map<String,Cookie> old=new HashMap<>(c.cookies);assertEquals(200,c.request("/api/account/logout","POST",json.createObjectNode()).getResponse().getStatus());c.cookies.putAll(old);assertEquals(401,c.request("/api/member-notebook","GET",null).getResponse().getStatus());
    }
    @Test void expiryRateLimitsAndProductionAdminAreEnforced()throws Exception{
        Client c=new Client();c.signup("a@example.test");time.now=time.now.plus(Duration.ofDays(8));assertEquals(401,c.request("/api/member-notebook","GET",null).getResponse().getStatus());
        for(int i=0;i<8;i++)assertEquals(401,c.request("/api/account/login","POST",credentials("missing@example.test","wrong")).getResponse().getStatus());assertEquals(429,c.request("/api/account/login","POST",credentials("missing@example.test","wrong")).getResponse().getStatus());
        assertEquals(401,new Client().request("/api/account/login","POST",credentials("admin","admin")).getResponse().getStatus());assertFalse(body(c.request("/api/account","GET",null)).path("testLoginAvailable").asBoolean());
    }
    @Test void emailVerificationAndResetAreOneTimeAndResetRevokesSessions()throws Exception{
        Client a=new Client();a.signup("a@example.test");String verify=delivered.stream().filter(m->m.kind().equals("verify")).findFirst().orElseThrow().token();
        assertEquals(200,a.request("/api/account/verify-email","POST",json.createObjectNode().put("token",verify)).getResponse().getStatus());assertTrue(body(a.request("/api/account","GET",null)).path("user").path("emailVerified").asBoolean());assertEquals(400,a.request("/api/account/verify-email","POST",json.createObjectNode().put("token",verify)).getResponse().getStatus());
        Client anon=new Client();JsonNode unknown=body(anon.request("/api/account/request-password-reset","POST",json.createObjectNode().put("email","unknown@example.test")));JsonNode known=body(anon.request("/api/account/request-password-reset","POST",json.createObjectNode().put("email","a@example.test")));assertEquals(unknown,known);
        await().atMost(Duration.ofSeconds(5)).until(()->delivered.stream().anyMatch(m->m.kind().equals("reset")));String token=delivered.stream().filter(m->m.kind().equals("reset")).findFirst().orElseThrow().token();
        assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM jibro_mail_tokens WHERE token_hash=?",Integer.class,token));
        assertEquals(400,anon.request("/api/account/reset-password","POST",json.createObjectNode().put("token",token).put("newPassword","short")).getResponse().getStatus());
        assertEquals(200,anon.request("/api/account/reset-password","POST",json.createObjectNode().put("token",token).put("newPassword",PASSWORD+"!")).getResponse().getStatus());assertEquals(401,a.request("/api/member-notebook","GET",null).getResponse().getStatus());
        assertEquals(400,anon.request("/api/account/reset-password","POST",json.createObjectNode().put("token",token).put("newPassword",PASSWORD+"!")).getResponse().getStatus());assertEquals(200,anon.request("/api/account/login","POST",credentials("a@example.test",PASSWORD+"!")).getResponse().getStatus());
    }
    @Test void expiredMailNeverReportsVerificationSuccess()throws Exception{
        Client a=new Client();a.signup("a@example.test");String token=delivered.peek().token();time.now=time.now.plus(Duration.ofMinutes(31));assertEquals(400,a.request("/api/account/verify-email","POST",json.createObjectNode().put("token",token)).getResponse().getStatus());assertFalse(body(a.request("/api/account","GET",null)).path("user").path("emailVerified").asBoolean());
    }
    @Test void importedBetterAuthPasswordAndEncryptedRecordsStayUsableAndRerunsDoNotOverwrite()throws Exception{
        Path source=Path.of("src/test/resources/legacy-member-export.json");var dry=importer.run(source,false);assertEquals(1,dry.imported());assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM jibro_members",Integer.class));
        assertEquals(1,importer.run(source,true).imported());assertEquals(1,importer.run(source,true).unchanged());Client a=new Client();assertEquals(200,a.request("/api/account/login","POST",credentials("legacy@example.test","Legacy-passphrase-2026")).getResponse().getStatus());
        assertTrue(db.queryForObject("SELECT password_hash FROM jibro_members WHERE id='legacy-member-A'",String.class).startsWith("{scrypt}"));JsonNode current=body(a.request("/api/member-notebook","GET",null));assertEquals(7,current.path("revision").asInt());assertEquals(3,current.path("state").path("applicantProfile").path("householdSize").asInt());
        ObjectNode state=(ObjectNode)current.path("state");state.put("name","새 기록");assertEquals(200,a.request("/api/member-notebook","PUT",write(state,7)).getResponse().getStatus());assertEquals(1,importer.run(source,true).unchanged());assertEquals("새 기록",body(a.request("/api/member-notebook","GET",null)).path("state").path("name").asText());
    }
    @Test void simultaneousSavesHaveExactlyOneWinner()throws Exception{
        Client a=new Client(),b=new Client();a.signup("race@example.test");assertEquals(200,b.request("/api/account/login","POST",credentials("race@example.test",PASSWORD)).getResponse().getStatus());
        ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch start=new CountDownLatch(1);
        try{
            var first=pool.submit(()->{start.await();return a.request("/api/member-notebook","PUT",write(state().put("name","first"),0)).getResponse().getStatus();});
            var second=pool.submit(()->{start.await();return b.request("/api/member-notebook","PUT",write(state().put("name","second"),0)).getResponse().getStatus();});
            start.countDown();var statuses=new ArrayList<>(List.of(first.get(10,TimeUnit.SECONDS),second.get(10,TimeUnit.SECONDS)));Collections.sort(statuses);assertEquals(List.of(200,409),statuses);assertEquals(1,body(a.request("/api/member-notebook","GET",null)).path("revision").asInt());
        }finally{pool.shutdownNow();}
    }
    @Test void badMigrationKeysAndExistingMembersCannotOverwriteAnything()throws Exception{
        ObjectNode export=(ObjectNode)json.readTree(Files.readString(Path.of("src/test/resources/legacy-member-export.json")));ObjectNode note=(ObjectNode)export.path("notebooks").get(0);note.put("payload",note.path("payload").asText().replace("legacy-test:","missing-key:"));Path file=Files.createTempFile("synthetic-migration-",".json");
        try{Files.writeString(file,json.writeValueAsString(export));assertThrows(AccountError.class,()->importer.run(file,true));assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM jibro_members",Integer.class));}finally{Files.delete(file);}
        new Client().signup("legacy@example.test");assertThrows(IllegalStateException.class,()->importer.run(Path.of("src/test/resources/legacy-member-export.json"),true));assertEquals(1,db.queryForObject("SELECT COUNT(*) FROM jibro_members",Integer.class));
    }
}
