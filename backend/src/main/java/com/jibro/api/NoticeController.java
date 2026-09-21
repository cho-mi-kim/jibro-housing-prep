package com.jibro.api;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import java.net.URI;
import java.security.MessageDigest;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/notices")
@CrossOrigin(origins={"http://localhost:5173","http://localhost:4173","https://jibro-housing-prep.understandingprocess.chatgpt.site"}, allowCredentials="true")
public class NoticeController {
    private static final String LH_LIST_URL="https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancList.do?ccrCnntSysDsCd=03&uppAisTpCd=13&aisTpCd=26&mi=1026";
    private static final DateTimeFormatter DATE=DateTimeFormatter.ISO_LOCAL_DATE;
    private final RestClient client=RestClient.builder().requestFactory(requestFactory()).build();
    private volatile NoticeSnapshot snapshot=new NoticeSnapshot(List.of(), null, "not_checked");

    @GetMapping(produces=MediaType.APPLICATION_JSON_VALUE)
    public NoticeSnapshot get(){
        if(snapshot.items().isEmpty() && snapshot.status().equals("not_checked")) refresh();
        return snapshot;
    }

    @PostMapping(path="/refresh", produces=MediaType.APPLICATION_JSON_VALUE)
    public synchronized NoticeSnapshot refresh(){
        try{
            LocalDate today=LocalDate.now(ZoneId.of("Asia/Seoul"));
            Map<String,Notice> latest=new LinkedHashMap<>();
            for(int page=1;page<=20;page++){
                String html=client.get().uri(LH_LIST_URL+"&pageNum="+page).accept(MediaType.TEXT_HTML).retrieve().body(String.class);
                Document doc=Jsoup.parse(Objects.requireNonNullElse(html,""));
                List<Element> rows=doc.select(".bbs_ListA tbody tr");
                if(rows.isEmpty()) break;
                for(Element row:rows){
                    Element link=row.selectFirst("a.wrtancInfoBtn");
                    List<String> cells=row.select("td").eachText();
                    if(link==null||cells.size()<8) continue;
                    String deadline=normalizeDate(cells.get(6));
                    if(deadline==null||LocalDate.parse(deadline,DATE).isBefore(today)) continue;
                    String status=cells.get(7).trim();
                    String title=cells.get(2).replaceAll("\\s+\\d+일전$","").trim();
                    if(!"공고중".equals(status)||title.matches("^\\s*\\[?취소공고\\]?.*")) continue;
                    String region=cells.get(3), type=cells.get(1), posted=normalizeDate(cells.get(5));
                    String key=title.replaceFirst("^\\[(정정|취소)공고\\]\\s*","").replaceAll("\\s+"," ")+"|"+region+"|"+type;
                    Map<String,String> q=new LinkedHashMap<>();
                    q.put("ccrCnntSysDsCd", data(link,"id2","03")); q.put("panId",data(link,"id1",""));
                    q.put("aisTpCd",data(link,"id4","")); q.put("uppAisTpCd",data(link,"id3","")); q.put("mi","1026");
                    String url="https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?"+query(q);
                    Notice candidate=new Notice("lh-"+data(link,"id1",String.valueOf(latest.size())),title,region,type,"한국토지주택공사 (LH)",deadline,posted,status,url);
                    Notice previous=latest.get(key);
                    if(previous==null || (posted!=null && (previous.posted()==null || posted.compareTo(previous.posted())>0))) latest.put(key,candidate);
                }
            }
            List<Notice> items=new ArrayList<>(latest.values());
            items.sort(Comparator.comparing(n->LocalDate.parse(n.deadline(),DATE)));
            if(items.isEmpty()) return snapshot;
            snapshot=new NoticeSnapshot(items,Instant.now().toString(),"ok");
        }catch(Exception e){
            snapshot=new NoticeSnapshot(snapshot.items(),snapshot.lastCheckedAt(),"stale");
        }
        return snapshot;
    }

    @Scheduled(fixedDelay=21600000, initialDelay=1000)
    void refreshOnSchedule(){ refresh(); }

    @PostMapping(path="/import", produces=MediaType.APPLICATION_JSON_VALUE)
    public ImportedNotice importNotice(@RequestBody Map<String,String> body){
        String raw=Objects.requireNonNullElse(body.get("url"),"").trim();
        if(!raw.matches("https?://.*")) throw new IllegalArgumentException("공고 URL이 필요합니다.");
        URI uri=URI.create(raw);
        String host=Objects.requireNonNullElse(uri.getHost(),"").toLowerCase(Locale.ROOT);
        String id="imported-"+shortHash(raw);
        String title="공고 링크만 저장됨";
        String description="제목·지역·신청 기간은 공고 원문에서 확인해주세요.";
        boolean parsed=false;
        String deadline=null;
        if(host.endsWith("lh.or.kr")||host.endsWith("lh.or.kr.")){
            try{
                String html=client.get().uri(raw).accept(MediaType.TEXT_HTML).retrieve().body(String.class);
                Document doc=Jsoup.parse(Objects.requireNonNullElse(html,""));
                String meta=doc.select("meta[property=og:title]").attr("content");
                String pageTitle=meta.isBlank()?doc.title():meta;
                if(!pageTitle.isBlank()){title=pageTitle.trim();parsed=true;}
                String text=doc.text();
                java.util.regex.Matcher matcher=java.util.regex.Pattern.compile("(20\\d{2})[./-](\\d{1,2})[./-](\\d{1,2})\\s*[~\\-]\\s*(20\\d{2})[./-](\\d{1,2})[./-](\\d{1,2})").matcher(text);
                if(matcher.find()) deadline="%s-%02d-%02d".formatted(matcher.group(4),Integer.parseInt(matcher.group(5)),Integer.parseInt(matcher.group(6)));
                description=deadline==null?"공고 제목을 확인했어요. 신청 기간은 원문에서 확인해주세요.":"공고 제목과 마감일을 확인했어요. 자격·제출서류는 원문을 확인해주세요.";
            }catch(Exception ignored){
                description="공고 원문에 연결했지만 세부 정보를 읽지 못했어요. 원문에서 직접 확인해주세요.";
            }
        }
        String agency=parsed && (host.endsWith("lh.or.kr")||host.endsWith("lh.or.kr.")) ? "한국토지주택공사 (LH)" : "공고 원문 확인 필요";
        if(!parsed){ title="공고 링크만 저장됨"; deadline=null; }
        return new ImportedNotice(id,title,agency,raw,"공고 원문 확인 필요","공고 유형 확인 필요",deadline,null,parsed?"분석 완료":"링크 저장됨",parsed,description);
    }

    private static String data(Element el,String key,String fallback){String value=el.attr("data-"+key);return value.isBlank()?fallback:value;}
    private static String normalizeDate(String value){
        String cleaned=value==null?"":value.replace('.','-').replace('/','-').trim();
        if(cleaned.matches("\\d{4}-\\d{1,2}-\\d{1,2}")){
            String[] p=cleaned.split("-");return "%04d-%02d-%02d".formatted(Integer.parseInt(p[0]),Integer.parseInt(p[1]),Integer.parseInt(p[2]));
        }
        try{return LocalDate.parse(cleaned,DATE).toString();}catch(DateTimeParseException ignored){return null;}
    }
    private static String query(Map<String,String> values){return values.entrySet().stream().map(e->e.getKey()+"="+java.net.URLEncoder.encode(e.getValue(),java.nio.charset.StandardCharsets.UTF_8)).reduce((a,b)->a+"&"+b).orElse("");}
    private static SimpleClientHttpRequestFactory requestFactory(){SimpleClientHttpRequestFactory f=new SimpleClientHttpRequestFactory();f.setConnectTimeout(8000);f.setReadTimeout(12000);return f;}
    private static String shortHash(String value){try{byte[] digest=MessageDigest.getInstance("SHA-256").digest(value.trim().getBytes(java.nio.charset.StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte b:digest)out.append("%02x".formatted(b));return out.substring(0,16);}catch(Exception e){return Integer.toHexString(value.hashCode());}}

    public record Notice(String id,String title,String region,String type,String agency,String deadline,String posted,String status,String url){}
    public record ImportedNotice(String id,String title,String agency,String url,String region,String type,String deadline,String posted,String status,boolean parsed,String description){}
    public record NoticeSnapshot(List<Notice> items,String lastCheckedAt,String status){}
}

