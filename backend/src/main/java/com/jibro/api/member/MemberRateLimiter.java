package com.jibro.api.member;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.HexFormat;
import org.springframework.stereotype.Component;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class MemberRateLimiter {
    private final JdbcTemplate db; private final Clock clock; private final TransactionTemplate tx;
    public MemberRateLimiter(JdbcTemplate db, Clock clock, PlatformTransactionManager manager) {
        this.db=db;this.clock=clock;tx=new TransactionTemplate(manager);tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    public static String hash(String value) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); } catch(Exception e) {throw new IllegalStateException(e);} }
    public void take(String key,int limit,long windowMs) {
        String bucket=hash(key);long now=clock.millis();
        for(int attempt=0;attempt<3;attempt++){
            try {
                boolean allowed=Boolean.TRUE.equals(tx.execute(status->{
                    var rows=db.queryForList("SELECT until_ms,hits FROM jibro_rate_limits WHERE bucket_key=? FOR UPDATE",bucket);
                    if(rows.isEmpty()){db.update("INSERT INTO jibro_rate_limits(bucket_key,until_ms,hits) VALUES(?,?,1)",bucket,now+windowMs);return true;}
                    var row=rows.get(0);long until=((Number)row.get("until_ms")).longValue();int hits=((Number)row.get("hits")).intValue();
                    if(until<=now){db.update("UPDATE jibro_rate_limits SET hits=1,until_ms=? WHERE bucket_key=?",now+windowMs,bucket);return true;}
                    if(hits>=limit)return false;
                    db.update("UPDATE jibro_rate_limits SET hits=hits+1 WHERE bucket_key=?",bucket);return true;
                }));
                if(!allowed)throw new AccountError(429,"rate_limit","시도가 많아요. 잠시 후 다시 시도해주세요.");return;
            }catch(DuplicateKeyException e){if(attempt==2)throw AccountError.unavailable();}
        }
    }
}
