package com.jibro.api.member;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.util.*;

@Component
@DependsOnDatabaseInitialization
public class NotebookCipher {
    public static final String PREFIX = "jibro:encrypted:v1:";
    private final ObjectMapper json;
    private final Map<String, byte[]> keys = new HashMap<>();
    public final String active;
    private static final SecureRandom RANDOM = new SecureRandom();
    @org.springframework.beans.factory.annotation.Autowired
    public NotebookCipher(AccountSettings settings, ObjectMapper json, JdbcTemplate db) {
        this(loadKeys(settings, json, db), json);
    }
    NotebookCipher(String config, ObjectMapper json) {
        this.json = json;
        try {
            JsonNode parsed = json.readTree(config);
            active = parsed.path("active").asText();
            JsonNode values = parsed.path("keys");
            if (!validId(active) || !values.isObject() || values.size() < 1 || values.size() > 8) throw new Exception();
            var fields = values.fields();
            while (fields.hasNext()) {
                var e = fields.next(); byte[] bytes = decode(e.getValue().asText());
                if (!validId(e.getKey()) || bytes.length != 32) throw new Exception();
                keys.put(e.getKey(), bytes);
            }
            if (!keys.containsKey(active)) throw new Exception();
        } catch (Exception e) { throw new IllegalStateException("Notebook encryption key configuration is invalid"); }
    }
    private static String loadKeys(AccountSettings s, ObjectMapper json, JdbcTemplate db) {
        if (!s.keys.isBlank()) return s.keys;
        if (!s.local) throw new IllegalStateException("JIBRO_NOTEBOOK_KEYS is required; plaintext fallback is disabled");
        Path file = Path.of(s.keyFile).toAbsolutePath();
        try {
            if (!Files.exists(file)) {
                if (db.queryForObject("SELECT COUNT(*) FROM jibro_notebooks", Long.class) != 0)
                    throw new IllegalStateException("Existing records require the original encryption key; restore it instead of generating a new key");
                Files.createDirectories(file.getParent());
                String generated = json.writeValueAsString(Map.of("active", "local", "keys", Map.of("local", randomToken(32))));
                try {
                    if (Files.getFileStore(file.getParent()).supportsFileAttributeView("posix"))
                        Files.createFile(file, PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rw-------")));
                    else Files.createFile(file);
                    Files.writeString(file, generated, StandardOpenOption.WRITE);
                } catch (FileAlreadyExistsException ignored) { /* Another local process created the same key. */ }
            }
            return Files.readString(file);
        } catch (Exception e) { throw new IllegalStateException("Cannot load local notebook key; existing data was not changed", e); }
    }
    private static boolean validId(String id) { return id.matches("[A-Za-z0-9_-]{1,48}"); }
    public static String randomToken(int size) { byte[] b = new byte[size]; RANDOM.nextBytes(b); return encode(b); }
    private static String encode(byte[] b) { return Base64.getUrlEncoder().withoutPadding().encodeToString(b); }
    private static byte[] decode(String value) {
        if (!value.matches("[A-Za-z0-9_-]+")) throw new IllegalArgumentException();
        byte[] result = Base64.getUrlDecoder().decode(value);
        if (!encode(result).equals(value)) throw new IllegalArgumentException();
        return result;
    }
    private byte[] aad(String userId, String id) throws Exception {
        if (userId == null || userId.isBlank()) throw new IllegalArgumentException();
        return json.writeValueAsBytes(List.of("jibro-member-notebook", 1, id, userId));
    }
    public String seal(String userId, JsonNode value) {
        try {
            byte[] iv = new byte[12]; RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keys.get(active), "AES"), new GCMParameterSpec(128, iv));
            c.updateAAD(aad(userId, active));
            return PREFIX + active + ":" + encode(iv) + ":" + encode(c.doFinal(json.writeValueAsBytes(value)));
        } catch (Exception e) { throw AccountError.unavailable(); }
    }
    public JsonNode open(String userId, String payload) {
        try {
            if (!payload.startsWith(PREFIX)) throw new IllegalArgumentException();
            String[] parts = payload.substring(PREFIX.length()).split(":", -1);
            if (parts.length != 3 || !validId(parts[0]) || !keys.containsKey(parts[0])) throw new IllegalArgumentException();
            byte[] iv = decode(parts[1]), bytes = decode(parts[2]);
            if (iv.length != 12 || bytes.length < 16) throw new IllegalArgumentException();
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(keys.get(parts[0]), "AES"), new GCMParameterSpec(128, iv));
            c.updateAAD(aad(userId, parts[0]));
            JsonNode state = json.readTree(c.doFinal(bytes));
            if (!state.isObject()) throw new IllegalArgumentException();
            return state;
        } catch (Exception e) { throw AccountError.unavailable(); }
    }
    public boolean needsRotation(String payload) { return !payload.startsWith(PREFIX + active + ":"); }
}
