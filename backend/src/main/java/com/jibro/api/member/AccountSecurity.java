package com.jibro.api.member;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import java.util.*;
import org.springframework.context.annotation.*;
import org.springframework.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
@org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication(type=org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication.Type.SERVLET)
public class AccountSecurity {
    static boolean accountPath(String p){return p.equals("/api/account")||p.startsWith("/api/account/")||p.equals("/api/member-notebook")||p.startsWith("/api/auth")||p.equals("/api/notebook");}
    static boolean write(HttpServletRequest r){return !Set.of("GET","HEAD","OPTIONS").contains(r.getMethod());}
    static String cookieName(AccountSettings s){return s.secure?"__Host-jibro_session":"jibro_session";}
    static void error(HttpServletResponse response,ObjectMapper json,int status,String code,String message)throws IOException{
        response.setStatus(status);response.setContentType("application/json;charset=UTF-8");response.setHeader("Cache-Control","private, no-store");json.writeValue(response.getOutputStream(),Map.of("error",code,"message",message));
    }
    @Bean CookieCsrfTokenRepository csrfRepository(AccountSettings settings){
        var repo=new CookieCsrfTokenRepository();repo.setCookieName(settings.secure?"__Host-jibro_csrf":"jibro_csrf");
        repo.setCookieCustomizer(c->c.httpOnly(true).secure(settings.secure).sameSite("Strict").path("/"));return repo;
    }
    @Bean SecurityFilterChain memberSecurity(HttpSecurity http,AccountService accounts,AccountSettings settings,ObjectMapper json,CookieCsrfTokenRepository csrf)throws Exception{
        http.securityMatcher("/api/**")
            .sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .requestCache(c->c.disable()).formLogin(f->f.disable()).httpBasic(b->b.disable()).logout(l->l.disable())
            .csrf(c->c.csrfTokenRepository(csrf).requireCsrfProtectionMatcher(r->accountPath(r.getRequestURI())&&write(r)))
            .exceptionHandling(e->e.authenticationEntryPoint((r,s,x)->error(s,json,401,"login_required","로그인 후 이용해주세요."))
                .accessDeniedHandler((r,s,x)->error(s,json,403,"csrf","요청 확인이 만료됐어요. 다시 시도해주세요.")))
            .authorizeHttpRequests(a->a.requestMatchers("/api/auth/**","/api/auth","/api/notebook").denyAll().requestMatchers("/api/member-notebook").authenticated().anyRequest().permitAll())
            .addFilterBefore(new MemberFilter(accounts,settings,json),UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
    static class MemberFilter extends OncePerRequestFilter {
        final AccountService accounts;final AccountSettings settings;final ObjectMapper json;
        MemberFilter(AccountService a,AccountSettings s,ObjectMapper j){accounts=a;settings=s;json=j;}
        @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws IOException,ServletException{
            if(!accountPath(request.getRequestURI())){chain.doFilter(request,response);return;}
            response.setHeader("Cache-Control","private, no-store");response.setHeader("Vary","Cookie");response.setHeader("Referrer-Policy","no-referrer");
            try{
                if(write(request)){
                    if((request.getHeader("Origin")==null||!settings.origins.contains(request.getHeader("Origin")))||"cross-site".equals(request.getHeader("Sec-Fetch-Site"))||!"1".equals(request.getHeader("X-Jibro-Request")))throw new AccountError(403,"origin","요청 출처를 확인할 수 없어요.");
                    if(request.getContentType()==null||!request.getContentType().toLowerCase(Locale.ROOT).startsWith("application/json"))throw new AccountError(415,"content_type","JSON 요청이 필요해요.");
                    byte[] body=request.getInputStream().readNBytes(250001);if(body.length>250000)throw new AccountError(413,"size","저장할 기록이 너무 커요.");
                    request=new BufferedRequest(request,body);
                }
                String token=null;if(request.getCookies()!=null)for(Cookie c:request.getCookies())if(cookieName(settings).equals(c.getName()))token=c.getValue();
                var p=accounts.authenticate(token);
                if(p!=null)SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(p,null,List.of()));
                chain.doFilter(request,response);
            }catch(AccountError e){error(response,json,e.status,e.code,e.getMessage());}
            catch(org.springframework.dao.DataAccessException e){error(response,json,503,"unavailable","계정 정보를 처리하지 못했어요. 잠시 후 다시 시도해주세요.");}
        }
    }
    static class BufferedRequest extends HttpServletRequestWrapper{
        private final byte[] body;
        BufferedRequest(HttpServletRequest req,byte[] body){super(req);this.body=body;}
        @Override public ServletInputStream getInputStream(){ByteArrayInputStream in=new ByteArrayInputStream(body);return new ServletInputStream(){public int read(){return in.read();}public boolean isFinished(){return in.available()==0;}public boolean isReady(){return true;}public void setReadListener(ReadListener listener){throw new UnsupportedOperationException();}};}
        @Override public BufferedReader getReader(){return new BufferedReader(new InputStreamReader(getInputStream(),java.nio.charset.StandardCharsets.UTF_8));}
    }
}
