package com.jibro.api.member;

import java.net.URI;
import java.time.Clock;
import java.util.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

@Configuration
public class AccountSettings {
    public static final String POLICY = "2026-09-29";
    public static final String APPLICANT_POLICY = "2026-09-26";
    public final boolean local, testLogin, secure;
    public final String origin, keys, keyFile, mailKey, mailFrom;
    public final Set<String> origins;
    public AccountSettings(Environment env) {
        local = env.acceptsProfiles(Profiles.of("local"));
        testLogin = local && env.getProperty("jibro.accounts.test-login", Boolean.class, false);
        origin = env.getRequiredProperty("jibro.accounts.origin");
        URI uri = URI.create(origin);
        secure = "https".equals(uri.getScheme());
        if (uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                || (uri.getRawPath() != null && !uri.getRawPath().isEmpty()) || (!secure && !local))
            throw new IllegalStateException("An exact HTTPS app origin is required outside local development");
        if (local && !Set.of("127.0.0.1", "localhost", "[::1]").contains(uri.getHost()))
            throw new IllegalStateException("Local profile must use a loopback app origin");
        if (env.acceptsProfiles(Profiles.of("prod")) && (!secure || local || !env.getRequiredProperty("spring.datasource.url").startsWith("jdbc:postgresql:")))
            throw new IllegalStateException("Production needs HTTPS and PostgreSQL, without the local profile");
        origins = local ? Set.copyOf(Arrays.asList(origin, "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173")) : Set.of(origin);
        keys = env.getProperty("jibro.accounts.keys", "");
        keyFile = env.getProperty("jibro.accounts.key-file", "./.local-data/notebook-keys.json");
        mailKey = env.getProperty("jibro.accounts.mail-key", "");
        mailFrom = env.getProperty("jibro.accounts.mail-from", "");
    }
    public boolean mailAvailable() { return !mailKey.isBlank() && mailFrom.matches("[^\\s<>@]+@[^\\s<>@]+\\.[^\\s<>@]+"); }
    @Bean Clock memberClock() { return Clock.systemUTC(); }
}
