package com.jibro.api.member;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.Map;
import java.util.List;

@Component
public class AccountMailSender {
    final AccountSettings settings;final ObjectMapper json;
    final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    public AccountMailSender(AccountSettings settings,ObjectMapper json){this.settings=settings;this.json=json;}
    public void send(String email,String token,String kind)throws Exception{
        String title=kind.equals("verify")?"이메일 주소 확인":"비밀번호 재설정";
        String link=settings.origin+"/auth/complete#action="+kind+"&token="+token;
        var data=Map.of("from","JIBRO <"+settings.mailFrom+">","to",List.of(email),"subject","[JIBRO] "+title,"text",title+"을 요청하셨나요?\n\n아래 링크를 열어 직접 확인해주세요. 링크는 30분 동안 유효해요.\n"+link+"\n\n요청하지 않았다면 이 메일을 무시해주세요. 비밀번호나 신청 조건을 회신하지 마세요.");
        var request=HttpRequest.newBuilder(URI.create("https://api.resend.com/emails")).timeout(Duration.ofSeconds(10)).header("Authorization","Bearer "+settings.mailKey).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(data))).build();
        var response=client.send(request,HttpResponse.BodyHandlers.ofString());
        if(response.statusCode()<200||response.statusCode()>=300||!json.readTree(response.body()).path("id").isTextual())throw new IllegalStateException("Mail delivery failed");
    }
}
