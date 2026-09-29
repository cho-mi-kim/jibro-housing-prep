package com.jibro.api.member;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.util.*;

@Repository
public class MemberRepository {
    final JdbcTemplate db;
    public MemberRepository(JdbcTemplate db) { this.db = db; }
    public JdbcTemplate jdbc() { return db; }
    public record Member(String id, String email, String nickname, String passwordHash, boolean verified, boolean test) {
        Map<String, Object> publicView() { return Map.of("id", id, "email", email, "nickname", nickname, "emailVerified", verified); }
    }
    private List<Member> select(String sql, Object... args) {
        return db.query(sql, (r, n) -> new Member(r.getString("id"), r.getString("email"), r.getString("nickname"), r.getString("password_hash"), r.getBoolean("email_verified"), r.getBoolean("test_account")), args);
    }
    public Member byEmail(String email, boolean lock) { return select("SELECT * FROM jibro_members WHERE email=?" + (lock ? " FOR UPDATE" : ""), email).stream().findFirst().orElse(null); }
    public Member byId(String id, boolean lock) { return select("SELECT * FROM jibro_members WHERE id=?" + (lock ? " FOR UPDATE" : ""), id).stream().findFirst().orElse(null); }
    public void insert(String id, String email, String nickname, String hash, boolean verified, String terms, String privacy, String accepted, long created, boolean test) {
        db.update("INSERT INTO jibro_members(id,email,nickname,password_hash,email_verified,terms_version,privacy_version,accepted_at,created_at,test_account) VALUES (?,?,?,?,?,?,?,?,?,?)", id,email,nickname,hash,verified,terms,privacy,accepted,created,test);
    }
}
