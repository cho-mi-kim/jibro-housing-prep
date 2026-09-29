package com.jibro.api.member;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.HexFormat;
import org.bouncycastle.crypto.generators.SCrypt;
import org.springframework.security.crypto.scrypt.SCryptPasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class MemberPasswords {
    private final SCryptPasswordEncoder encoder = SCryptPasswordEncoder.defaultsForSpringSecurity_v5_8();
    public String encode(String raw) { return "{scrypt}" + encoder.encode(normalize(raw)); }
    private String normalize(String raw) { return Normalizer.normalize(raw, Normalizer.Form.NFKC); }
    public boolean matches(String raw, String hash) {
        if (raw == null || raw.isEmpty() || raw.length() > 128 || hash == null) return false;
        try {
            if (hash.startsWith("{scrypt}")) return encoder.matches(normalize(raw), hash.substring(8));
            if (!legacy(hash)) return false;
            String[] parts = hash.split(":");
            byte[] key = SCrypt.generate(normalize(raw).getBytes(StandardCharsets.UTF_8), parts[0].getBytes(StandardCharsets.UTF_8), 16384, 16, 1, 64);
            return MessageDigest.isEqual(key, HexFormat.of().parseHex(parts[1]));
        } catch (RuntimeException e) { return false; }
    }
    public boolean legacy(String hash) { return hash != null && hash.matches("[0-9a-f]{32}:[0-9a-f]{128}"); }
    public String requireNew(String value) {
        if (value == null || value.length() < 12 || value.length() > 128)
            throw new AccountError(400, "password", "비밀번호는 12~128자여야 해요.");
        return value;
    }
}
