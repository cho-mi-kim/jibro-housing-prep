package com.jibro.api.member;

import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.*;

@RestController
@org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication(type=org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication.Type.SERVLET)
public class AccountController {
    final AccountService service;final AccountSettings settings;final MemberRateLimiter rates;final AccountMailService mail;final CookieCsrfTokenRepository csrf;
    public AccountController(AccountService service,AccountSettings settings,MemberRateLimiter rates,AccountMailService mail,CookieCsrfTokenRepository csrf){this.service=service;this.settings=settings;this.rates=rates;this.mail=mail;this.csrf=csrf;}
    private AccountService.Principal principal(Authentication auth){return auth!=null&&auth.getPrincipal() instanceof AccountService.Principal p?p:null;}
    private void rate(HttpServletRequest request,String action,int limit,long ms){rates.take(action+":ip:"+request.getRemoteAddr(),limit,ms);}
    private void session(HttpServletResponse response,String token){response.addHeader("Set-Cookie",ResponseCookie.from(AccountSecurity.cookieName(settings),token).httpOnly(true).secure(settings.secure).sameSite("Lax").path("/").maxAge(token.isEmpty()?0:AccountService.SESSION_MS/1000).build().toString());}
    private Map<String,Object> logged(AccountService.Login login,HttpServletResponse response){session(response,login.token());return Map.of("ok",true,"user",login.member().publicView());}
    @GetMapping("/api/account/csrf") Map<String,String> csrf(CsrfToken token){return Map.of("token",token.getToken(),"headerName",token.getHeaderName());}
    @GetMapping("/api/account") Map<String,Object> account(Authentication auth){
        var result=new LinkedHashMap<String,Object>();var p=principal(auth);result.put("user",p==null?null:service.member(p,false).publicView());
        result.put("testLoginAvailable",settings.testLogin);result.put("emailAvailable",settings.mailAvailable());result.put("policyVersion",AccountSettings.POLICY);return result;
    }
    @PostMapping("/api/account/register") Map<String,Object> register(@RequestBody JsonNode data,HttpServletRequest request,HttpServletResponse response){
        rate(request,"register",10,3600000);var login=service.register(data);if(settings.mailAvailable())try { mail.request(login.member().email(),"verify"); } catch(org.springframework.core.task.TaskRejectedException ignored) { /* Registration has committed. A resend remains available. */ }return logged(login,response);
    }
    @PostMapping("/api/account/login") Map<String,Object> login(@RequestBody JsonNode data,HttpServletRequest request,HttpServletResponse response){
        rate(request,"login",60,60000);rates.take("login:email:"+AccountService.text(data,"email").trim().toLowerCase(Locale.ROOT),8,60000);return logged(service.login(data),response);
    }
    @PostMapping("/api/account/logout") Map<String,Object> logout(Authentication auth,HttpServletRequest request,HttpServletResponse response){service.logout(principal(auth));session(response,"");csrf.saveToken(null,request,response);return Map.of("ok",true);}
    @PostMapping("/api/account/password") Map<String,Object> password(@RequestBody JsonNode data,Authentication auth,HttpServletRequest request,HttpServletResponse response){rate(request,"password",5,60000);return logged(service.changePassword(principal(auth),data),response);}
    @DeleteMapping("/api/account") Map<String,Object> delete(@RequestBody JsonNode data,Authentication auth,HttpServletRequest request,HttpServletResponse response){rate(request,"delete",5,60000);service.delete(principal(auth),data);session(response,"");csrf.saveToken(null,request,response);return Map.of("ok",true);}
    @GetMapping("/api/member-notebook") Map<String,Object> notebook(Authentication auth){return service.readNotebook(principal(auth));}
    @PutMapping("/api/member-notebook") Map<String,Object> notebook(@RequestBody JsonNode data,Authentication auth,HttpServletRequest request){rate(request,"notebook",120,60000);return service.writeNotebook(principal(auth),data);}
    @PostMapping({"/api/account/request-password-reset","/api/account/send-verification"}) Map<String,Object> requestMail(@RequestBody JsonNode data,Authentication auth,HttpServletRequest request){
        rate(request,"mail",20,3600000);mail.requireAvailable();String email=AccountService.email(AccountService.text(data,"email"));rates.take("mail:email:"+email,5,3600000);
        if(Set.of("admin@jibro.local.test","admin@jibro.test").contains(email))throw new AccountError(400,"test_account","테스트 계정은 이메일 인증·복구 대상이 아니에요.");
        boolean verify=request.getRequestURI().endsWith("send-verification");
        if(verify&&!service.member(principal(auth),false).email().equals(email))throw new AccountError(403,"member","로그인된 이메일만 인증할 수 있어요.");
        mail.request(email,verify?"verify":"reset");return Map.of("ok",true);
    }
    @PostMapping({"/api/account/verify-email","/api/account/reset-password"}) Map<String,Object> consume(@RequestBody JsonNode data,HttpServletRequest request){
        rate(request,"token",10,60000);mail.consume(AccountService.text(data,"token"),request.getRequestURI().endsWith("verify-email")?"verify":"reset",AccountService.text(data,"newPassword"));return Map.of("ok",true);
    }
    @RestControllerAdvice(assignableTypes=AccountController.class)
    static class Errors{
        @ExceptionHandler(AccountError.class) ResponseEntity<?> expected(AccountError e){return ResponseEntity.status(e.status).cacheControl(CacheControl.noStore()).body(Map.of("error",e.code,"message",e.getMessage()));}
        @ExceptionHandler(HttpMessageNotReadableException.class) ResponseEntity<?> malformed(){return ResponseEntity.badRequest().body(Map.of("error","json","message","요청 내용을 확인해주세요."));}
        @ExceptionHandler(Exception.class) ResponseEntity<?> unexpected(){return ResponseEntity.status(503).body(Map.of("error","unavailable","message","계정 정보를 처리하지 못했어요. 잠시 후 다시 시도해주세요."));}
    }
}
