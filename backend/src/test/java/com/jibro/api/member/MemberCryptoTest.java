package com.jibro.api.member;

import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import java.nio.file.*;
import static org.junit.jupiter.api.Assertions.*;

class MemberCryptoTest {
    final ObjectMapper json=new ObjectMapper();
    @Test void keyRotationPreservesContentAndBindsCiphertextToItsOwner() throws Exception {
        String original=Files.readString(Path.of("src/test/resources/legacy-test-keys.json"));
        var config=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(original);config.put("active","next");((com.fasterxml.jackson.databind.node.ObjectNode)config.path("keys")).put("next",NotebookCipher.randomToken(32));
        var old=new NotebookCipher(original,json);var next=new NotebookCipher(config.toString(),json);
        var state=json.createObjectNode().put("name","개인 기록");String payload=old.seal("member-a",state);
        assertEquals(state,next.open("member-a",payload));assertTrue(next.needsRotation(payload));assertThrows(AccountError.class,()->next.open("member-b",payload));
        String rotated=next.seal("member-a",next.open("member-a",payload));assertFalse(next.needsRotation(rotated));assertEquals(state,next.open("member-a",rotated));
        ((com.fasterxml.jackson.databind.node.ObjectNode)config.path("keys")).remove("legacy-test");var retired=new NotebookCipher(config.toString(),json);assertThrows(AccountError.class,()->retired.open("member-a",payload));
        assertThrows(AccountError.class,()->old.open("member-a",state.toString()));assertNotEquals(payload,old.seal("member-a",state));assertThrows(IllegalStateException.class,()->new NotebookCipher("{}",json));
    }
    @Test void productionConfigurationRejectsInsecureOriginsAndLocalDatabases() {
        var env=new MockEnvironment().withProperty("jibro.accounts.origin","http://public.example.test").withProperty("spring.datasource.url","jdbc:h2:mem:bad");env.setActiveProfiles("prod");
        assertThrows(IllegalStateException.class,()->new AccountSettings(env));env.setProperty("jibro.accounts.origin","https://public.example.test");assertThrows(IllegalStateException.class,()->new AccountSettings(env));
        env.setProperty("spring.datasource.url","jdbc:postgresql://localhost/jibro");env.setProperty("jibro.accounts.test-login","true");assertFalse(new AccountSettings(env).testLogin);
    }
    @Test void normalizedUnicodePasswordsAndBadSnapshotsAreHandled() throws Exception {
        var passwords=new MemberPasswords();String encoded=passwords.encode("Ｐａｓｓｗｏｒｄ-test-2026");assertTrue(passwords.matches("Password-test-2026",encoded));assertFalse(passwords.matches("different",encoded));
        var validator=new NotebookValidator(json,java.time.Clock.systemUTC());var input=json.readTree("{\"noticeSnapshots\":{\"lh-bad\":{\"url\":\"relative-path\"}},\"notificationReads\":[\"event\",\"event\"]}");
        var result=validator.normalize(input);assertEquals(0,result.path("noticeSnapshots").size());assertEquals(1,result.path("notificationReads").size());
    }
}
