package com.jibro.api.member;

import java.time.Clock;
import java.util.*;
import java.util.concurrent.Executor;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.annotation.*;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.annotation.Transactional;
import static com.jibro.api.member.MemberRateLimiter.hash;

@Service
public class AccountMailService {
    final MemberRepository repo;final MemberPasswords passwords;final AccountSettings settings;final Clock clock;final AccountMailSender sender;final TransactionTemplate tx;
    private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(AccountMailService.class);
    public AccountMailService(MemberRepository repo,MemberPasswords passwords,AccountSettings settings,Clock clock,AccountMailSender sender,PlatformTransactionManager manager){this.repo=repo;this.passwords=passwords;this.settings=settings;this.clock=clock;this.sender=sender;tx=new TransactionTemplate(manager);}
    public void requireAvailable(){if(!settings.mailAvailable())throw new AccountError(503,"email_unavailable","이메일 발송 기능을 준비 중이에요. 연결이 완료되면 이용할 수 있어요.");}
    @Async("accountMailExecutor")
    public void request(String email,String kind){
        String token=NotebookCipher.randomToken(32);
        try{
            Boolean found=tx.execute(status->{
                var m=repo.byEmail(email,true);if(m==null||m.test()||(kind.equals("verify")&&m.verified()))return false;
                repo.jdbc().update("DELETE FROM jibro_mail_tokens WHERE member_id=? AND kind=?",m.id(),kind);
                repo.jdbc().update("INSERT INTO jibro_mail_tokens(token_hash,member_id,kind,expires_at) VALUES(?,?,?,?)",hash(token),m.id(),kind,clock.millis()+30*60*1000);return true;
            });
            if(Boolean.TRUE.equals(found))sender.send(email,token,kind);
        }catch(Exception e){repo.jdbc().update("DELETE FROM jibro_mail_tokens WHERE token_hash=?",hash(token));log.warn("Account email delivery failed ({})",kind);}
    }
    @Transactional
    public void consume(String token,String kind,String newPassword){
        if(token==null||!token.matches("[A-Za-z0-9_-]{43}"))throw invalid();
        if(kind.equals("reset"))passwords.requireNew(newPassword);
        String digest=hash(token);
        var ids=repo.jdbc().queryForList("SELECT member_id FROM jibro_mail_tokens WHERE token_hash=? AND kind=?",String.class,digest,kind);
        if(ids.isEmpty())throw invalid();
        // Lock the member first, matching password changes and session creation.
        var member=repo.byId(ids.get(0),true);if(member==null||member.test())throw invalid();
        int removed=repo.jdbc().update("DELETE FROM jibro_mail_tokens WHERE token_hash=? AND kind=? AND expires_at>?",digest,kind,clock.millis());
        if(removed!=1)throw invalid();
        if(kind.equals("verify"))repo.jdbc().update("UPDATE jibro_members SET email_verified=TRUE WHERE id=?",member.id());
        else{
            repo.jdbc().update("UPDATE jibro_members SET password_hash=? WHERE id=?",passwords.encode(newPassword),member.id());
            repo.jdbc().update("DELETE FROM jibro_sessions WHERE member_id=?",member.id());
        }
        repo.jdbc().update("DELETE FROM jibro_mail_tokens WHERE member_id=?",member.id());
    }
    private AccountError invalid(){return new AccountError(400,"invalid_token","링크가 만료되었거나 사용할 수 없어요. 새 메일을 요청해주세요.");}
    @Scheduled(fixedDelay=600000,initialDelay=600000)
    public void cleanExpired(){long now=clock.millis();repo.jdbc().update("DELETE FROM jibro_sessions WHERE expires_at<=?",now);repo.jdbc().update("DELETE FROM jibro_mail_tokens WHERE expires_at<=?",now);repo.jdbc().update("DELETE FROM jibro_rate_limits WHERE until_ms<=?",now);}
    @Configuration @EnableAsync
    static class MailTasks{
        @Bean(name="accountMailExecutor") Executor executor(){ThreadPoolTaskExecutor executor=new ThreadPoolTaskExecutor();executor.setCorePoolSize(2);executor.setMaxPoolSize(2);executor.setQueueCapacity(64);executor.setThreadNamePrefix("account-mail-");executor.initialize();return executor;}
    }
}
