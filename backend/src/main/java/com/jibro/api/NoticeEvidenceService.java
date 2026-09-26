package com.jibro.api;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.PDFTextStripperByArea;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Service;
import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.regex.Pattern;

/** Extractive evidence, never an eligibility decision or an invented threshold. */
@Service
public class NoticeEvidenceService {
    static final String ORIGIN="https://apply.lh.or.kr";
    // Official correction notices can embed high-resolution plans (over 30 MB).
    static final int MAX_BYTES=48*1024*1024;
    static final String VERSION="evidence-v1";
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).followRedirects(HttpClient.Redirect.NEVER).build();
    private final LinkedHashMap<String,Summary> cache=new LinkedHashMap<>();
    private final java.util.concurrent.Semaphore capacity=new java.util.concurrent.Semaphore(1);
    private final Map<String,Instant> attempts=new HashMap<>();

    public Summary get(String url) throws IOException,InterruptedException {
        String canonical=canonicalUrl(url);
        synchronized(cache){var existing=cache.get(canonical);if(existing!=null&&Instant.parse(existing.checkedAt()).plus(Duration.ofHours(6)).isAfter(Instant.now()))return existing;}
        if(!capacity.tryAcquire())throw new BusyException();
        try {
            synchronized(attempts){var last=attempts.get(canonical);if(last!=null&&last.plusSeconds(60).isAfter(Instant.now()))throw new BusyException();attempts.put(canonical,Instant.now());if(attempts.size()>200)attempts.clear();}
            Summary result=collect(canonical);
            synchronized(cache){cache.put(canonical,result);while(cache.size()>100)cache.remove(cache.keySet().iterator().next());}
            return result;
        } finally {capacity.release();}
    }

    static String canonicalUrl(String raw) {
        try {
            URI u=URI.create(raw);
            if(!"https".equals(u.getScheme())||!"apply.lh.or.kr".equals(u.getHost())||u.getPort()!=-1||u.getRawUserInfo()!=null||!"/lhapply/apply/wt/wrtanc/selectWrtancInfo.do".equals(u.getPath()))throw new IllegalArgumentException();
            Map<String,String> q=new TreeMap<>();
            for(String pair:Objects.requireNonNullElse(u.getRawQuery(),"").split("&")){String[] p=pair.split("=",2);if(p.length==2)q.put(p[0],URLDecoder.decode(p[1],StandardCharsets.UTF_8));}
            if(!q.getOrDefault("panId","").matches("[0-9]{8,30}"))throw new IllegalArgumentException();
            List<String> params=new ArrayList<>();
            for(String k:List.of("panId","ccrCnntSysDsCd","aisTpCd","uppAisTpCd")){String v=q.get(k);if(v!=null){if(!v.matches("[0-9]{1,30}"))throw new IllegalArgumentException();params.add(k+"="+v);}}
            return ORIGIN+u.getPath()+"?"+String.join("&",params)+"&mi=1026";
        }catch(Exception e){throw new IllegalArgumentException("LH청약플러스 공고 상세 주소를 확인해주세요.");}
    }

    byte[] download(String url,int limit) throws IOException,InterruptedException {
        var request=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30)).header("User-Agent","JIBRO/1.0 public-notice-evidence").GET().build();
        var response=http.send(request,HttpResponse.BodyHandlers.ofInputStream());
        try(InputStream in=response.body()){
            if(response.statusCode()!=200)throw new IOException("공식 파일 응답 오류");
            if(response.headers().firstValueAsLong("Content-Length").orElse(0)>limit)throw new IOException("파일 용량 초과");
            byte[] bytes=in.readNBytes(limit+1);if(bytes.length>limit)throw new IOException("파일 용량 초과");return bytes;
        }
    }

    static List<Source> attachments(Document page){
        List<Source> all=new ArrayList<>();Set<String> ids=new HashSet<>();
        var idPattern=Pattern.compile("fileDownLoad\\('([0-9]+)'\\)");
        for(var a:page.select("a[href]")){
            var m=idPattern.matcher(a.attr("href"));String name=a.text();
            if(!m.find()||!name.toLowerCase(Locale.ROOT).matches(".*\\.(pdf|hwpx)"))continue;
            if(ids.add(m.group(1)))all.add(new Source(m.group(1),name,ORIGIN+"/lhapply/lhFile.do?fileid="+m.group(1),null));
        }
        // Keep every matching document's provenance; never substitute an unrelated first attachment.
        return all.stream().sorted(Comparator.comparingInt(file->NoticeDocumentClassifier.priority(file.name()))).filter(file->!file.name().toLowerCase(Locale.ROOT).endsWith(".hwpx")||all.stream().noneMatch(other->other.name().equalsIgnoreCase(file.name().substring(0,file.name().length()-5)+".pdf"))).toList();
    }

    Summary collect(String url) throws IOException,InterruptedException {
        Document page=Jsoup.parse(new String(download(url,4*1024*1024),StandardCharsets.UTF_8));
        List<Source> files=attachments(page);List<String> warnings=new ArrayList<>();List<Evidence> evidence=new ArrayList<>();List<Source> sources=new ArrayList<>();
        String noticeTitle=page.select(".bbs_ViewA > h3").text();
        if(files.size()>12)warnings.add("첨부파일이 많아 우선순위가 높은 12개를 확인합니다. 나머지 첨부는 원문에서 확인해주세요.");
        for(Source file:files.stream().limit(12).toList()){
            if(sources.size()>=3){warnings.add("모집공고문 3개를 읽었습니다. 나머지 첨부와 정정 내용은 원문에서 확인해주세요.");break;}
            List<Evidence> fileEvidence=new ArrayList<>();StringBuilder documentText=new StringBuilder();
            try{
                byte[] bytes=download(file.url(),MAX_BYTES);
                if(file.name().toLowerCase(Locale.ROOT).endsWith(".hwpx")){
                    var sections=HwpxTextExtractor.extract(bytes);
                    String body=sections.stream().map(HwpxTextExtractor.Section::text).collect(java.util.stream.Collectors.joining("\n"));
                    if(!NoticeDocumentClassifier.isNotice(body,noticeTitle)){warnings.add(file.name()+": 모집공고 본문과 공고 일치를 확인하지 못해 발췌에서 제외했습니다. 원문 확인이 필요합니다.");continue;}
                    for(var section:sections)for(Evidence e:extractPage(section.text(),file,0))
                        evidence.add(new Evidence(e.key(),e.sourceId(),e.sourceName(),e.sourceUrl(),0,e.quote(),e.score(),"본문 "+section.number()+"구역",e.focus()));
                    sources.add(new Source(file.id(),file.name(),file.url(),sha256(bytes)));
                    if(sections.stream().mapToInt(section->section.text().length()).sum()<100)warnings.add(file.name()+": 읽을 수 있는 본문이 부족합니다. 이미지 또는 원문을 확인해주세요.");
                    continue;
                }
                if(bytes.length<5||!new String(bytes,0,5,StandardCharsets.US_ASCII).equals("%PDF-"))throw new IOException("PDF가 아닌 응답");
                try(var doc=Loader.loadPDF(bytes)){
                    if(doc.getNumberOfPages()>150)throw new IOException("150쪽 초과 문서");
                    if(!doc.getCurrentAccessPermission().canExtractContent())throw new IOException("텍스트 추출 제한");
                    PDFTextStripper stripper=new PDFTextStripper();stripper.setSortByPosition(true);
                    int textSize=0;
                    for(int p=1;p<=doc.getNumberOfPages();p++){
                        var pdfPage=doc.getPage(p-1);var bounds=pdfPage.getCropBox();
                        if(pdfPage.getRotation()==0&&bounds.getWidth()>bounds.getHeight()*1.25){
                            // Public brochures often place two portrait pages on one landscape sheet.
                            // Extract each half independently instead of interleaving unrelated rows.
                            PDFTextStripperByArea areas=new PDFTextStripperByArea();areas.setSortByPosition(true);
                            float half=bounds.getWidth()/2;
                            areas.addRegion("왼쪽",new java.awt.geom.Rectangle2D.Float(0,0,half,bounds.getHeight()));
                            areas.addRegion("오른쪽",new java.awt.geom.Rectangle2D.Float(half,0,half,bounds.getHeight()));
                            areas.addRegion("gutter",new java.awt.geom.Rectangle2D.Float(half-10,0,20,bounds.getHeight()*.93f));
                            areas.extractRegions(pdfPage);
                            if(areas.getTextForRegion("gutter").isBlank()){
                                for(String side:List.of("왼쪽","오른쪽")){String text=areas.getTextForRegion(side);textSize+=text.length();documentText.append(text).append("\n");for(Evidence e:extractPage(text,file,p))fileEvidence.add(new Evidence(e.key(),e.sourceId(),e.sourceName(),e.sourceUrl(),e.page(),e.quote(),e.score(),side,e.focus()));}
                            }else{
                                stripper.setStartPage(p);stripper.setEndPage(p);String text=stripper.getText(doc);textSize+=text.length();documentText.append(text).append("\n");fileEvidence.addAll(extractPage(text,file,p));
                            }
                        }else{
                            stripper.setStartPage(p);stripper.setEndPage(p);String text=stripper.getText(doc);textSize+=text.length();documentText.append(text).append("\n");
                            fileEvidence.addAll(extractPage(text,file,p));
                        }
                    }
                    if(textSize>=100&&!NoticeDocumentClassifier.isNotice(documentText.toString(),noticeTitle)){warnings.add(file.name()+": 모집공고 본문과 공고 일치를 확인하지 못해 발췌에서 제외했습니다. 원문 확인이 필요합니다.");continue;}
                    if(textSize>=100){sources.add(new Source(file.id(),file.name(),file.url(),sha256(bytes)));evidence.addAll(fileEvidence);}
                    if(textSize<100)warnings.add(file.name()+": 이미지 PDF여서 내용을 읽지 못했습니다. OCR 또는 원문 확인이 필요합니다.");
                }
            }catch(IOException|RuntimeException e){warnings.add(file.name()+("파일 용량 초과".equals(e.getMessage())?": 자동 발췌 용량 한도(48MB)를 초과했습니다. 원문에서 확인해주세요.":": 파일을 읽지 못했습니다. 원문에서 확인해주세요."));}
        }
        if(files.isEmpty())warnings.add("텍스트를 읽을 수 있는 모집공고 PDF·HWPX를 찾지 못했습니다. HWP 또는 이미지 문서는 원문 확인이 필요합니다.");
        List<Criterion> criteria=new ArrayList<>();
        for(String key:List.of("age","house","income","family")){
            List<Evidence> found=evidence.stream().filter(e->e.key().equals(key)).sorted(Comparator.comparingInt(Evidence::score).reversed().thenComparingInt(Evidence::page)).collect(java.util.stream.Collectors.collectingAndThen(java.util.stream.Collectors.toMap(e->e.sourceId()+":"+e.page()+":"+e.quote(),e->e,(a,b)->a,LinkedHashMap::new),m->m.values().stream().limit(3).toList()));
            criteria.add(new Criterion(key,found.isEmpty()?"not_found":"excerpt",found));
        }
        long found=criteria.stream().filter(c->!c.evidence().isEmpty()).count();
        return new Summary(VERSION,url,Instant.now().toString(),found==0?"unavailable":"partial",sources,criteria,warnings);
    }

    static List<Evidence> extractPage(String text,Source file,int page){
        String[] lines=text.replaceAll("[\\p{Cc}&&[^\\n\\r\\t]]"," ").replace('\u00a0',' ').split("\\R");List<Evidence> result=new ArrayList<>();
        Map<String,Pattern> patterns=new LinkedHashMap<>();
        patterns.put("age",Pattern.compile("(?:만\\s*)?\\d{1,2}\\s*세(?!대)|연령|나이"));
        patterns.put("house",Pattern.compile("무주택|주택\\s*소유"));
        patterns.put("income",Pattern.compile("월평균\\s*소득|소득\\s*(기준|요건|금액)|총자산|자산\\s*(기준|가액|요건)|자동차\\s*가액"));
        patterns.put("family",Pattern.compile("세대구성원|가구원|혼인\\s*(기간|중|관계)|예비신혼|한부모"));
        for(var entry:patterns.entrySet()){
            for(int i=0;i<lines.length;i++){
                if(!entry.getValue().matcher(lines[i]).find())continue;
                if(entry.getKey().equals("age")){
                    if(!Pattern.compile("\\d{1,2}\\s*세(?!대)").matcher(lines[i]).find())continue;
                    String context=String.join(" ",Arrays.copyOfRange(lines,Math.max(0,i-2),i+1));
                    if(context.matches(".*(신청자의\\s*형제|신청자의\\s*자매).*"))continue;
                }
                if(entry.getKey().equals("age")&&lines[i].matches(".*(현장\\s*신청|현장\\s*접수|인터넷.*(어려|곤란)|정보취약|접수장소|방문\\s*신청).*"))continue;
                if(entry.getKey().equals("age")&&lines[i].matches(".*(직계존속|부양|서명|법정대리인).*"))continue;
                // A table header must not consume the numeric eligibility rows below it.
                if(entry.getKey().equals("income")&&!lines[i].matches(".*([0-9]|이하|이상|배제|완화|폐지|충족|제외).*"))continue;
                String section="";
                for(int j=i;j>=0;j--)if(lines[j].strip().startsWith("■")){section=lines[j];break;}
                int from=Math.max(0,i-2),to=Math.min(lines.length,i+5);
                String quote=String.join("\n",Arrays.copyOfRange(lines,from,to)).strip();
                if(quote.length()<25)continue;
                // Do not crop a table or sentence into an invented stand-alone numeric threshold.
                if(quote.length()>1800)continue;
                String line=lines[i];
                String focus=String.join("\n",Arrays.copyOfRange(lines,i,Math.min(lines.length,i+3))).strip();
                int score=1+(line.matches(".*(이하|이상|충족|해당|제외|완화|폐지|배제|이어야|갖춘).*" )?3:0);
                if(entry.getKey().equals("house")&&line.matches(".*무주택(세대구성원|자).*(로서|이어야|인 자|인 사람|요건).*"))score+=5;
                if(entry.getKey().equals("age")&&line.matches(".*\\d+세.*(이상|이하).*"))score+=5;
                if(entry.getKey().equals("age")&&line.matches(".*(신청자|성년자).*"))score+=12;
                if(entry.getKey().equals("age")&&line.matches(".*(자녀|직계존속|부양|증명서|확인서).*"))score-=10;
                if(entry.getKey().equals("income")&&line.matches(".*(퍼센트|%|만원|배제|완화|폐지).*"))score+=5;
                if(section.contains("입주자격")||section.contains("신청자격"))score+=8;
                if(entry.getKey().equals("income")&&section.matches(".*소득.*자산.*기준.*"))score+=12;
                if(entry.getKey().equals("family")&&line.matches(".*(혼인 중|혼인기간|혼인 기간|세대구성원.*(포함|범위)|가구원.*(포함|범위)).*"))score+=5;
                if(quote.matches("(?s).*(개인정보 수집|서명 또는 날인|제출서류|갱신계약|계약 갱신|재계약|거주하는 동안|거주 중|계속 거주).*"))score-=7;
                if(line.matches(".*(확인하시기|검증|조회|전산검색|공급대상별 상세기준).*"))score-=4;
                result.add(new Evidence(entry.getKey(),file.id(),file.name(),file.url(),page,quote,score,null,focus));i=to-1;
            }
        }
        return result;
    }
    private static String sha256(byte[] bytes){try{return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException(e);}}
    public static class BusyException extends RuntimeException {}
    public record Source(String id,String name,String url,String sha256){}
    public record Evidence(String key,String sourceId,String sourceName,String sourceUrl,int page,String quote,int score,String region,String focus){}
    public record Criterion(String id,String status,List<Evidence> evidence){}
    public record Summary(String version,String noticeUrl,String checkedAt,String status,List<Source> sources,List<Criterion> criteria,List<String> warnings){}
}
