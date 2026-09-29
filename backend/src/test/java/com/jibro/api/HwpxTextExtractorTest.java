package com.jibro.api;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class HwpxTextExtractorTest {
    private static String section(String text){return "<s:sec xmlns:s=\"http://www.hancom.co.kr/hwpml/2011/section\" xmlns:q=\"http://www.hancom.co.kr/hwpml/2011/paragraph\">"+text+"</s:sec>";}
    private static String p(String text){return "<q:p><q:run><q:t>"+text+"</q:t></q:run></q:p>";}
    private static byte[] zip(Map<String,String> entries)throws IOException{
        var bytes=new ByteArrayOutputStream();
        try(var zip=new ZipOutputStream(bytes)){
            for(var entry:entries.entrySet()){
                zip.putNextEntry(new ZipEntry(entry.getKey()));zip.write(entry.getValue().getBytes(StandardCharsets.UTF_8));zip.closeEntry();
            }
        }return bytes.toByteArray();
    }
    private static byte[] hwpx(String xml)throws IOException{return zip(Map.of("mimetype","application/hwp+zip","Contents/section0.xml",xml));}
    @Test void joinsSplitRunsAndKeepsTableLabelsWithValues()throws Exception{
        String xml=section("<q:header>"+p("머리말 제외")+"</q:header><q:p><q:run><q:t>무주택</q:t></q:run><q:run><q:t>세대구성원</q:t></q:run></q:p>"+
            "<q:tbl><q:tr><q:tc>"+p("소득 기준")+"</q:tc><q:tc>"+p("충족 여부와 상관없이 신청 가능합니다.")+"</q:tc></q:tr><q:tr><q:tc>"+p("신청자 나이")+"</q:tc><q:tc>"+p("만19세 이상의 성년자")+"</q:tc></q:tr></q:tbl><q:footer>"+p("꼬리말 제외")+"</q:footer>");
        String text=HwpxTextExtractor.extract(hwpx(xml)).get(0).text();
        assertEquals("무주택세대구성원\n소득 기준 | 충족 여부와 상관없이 신청 가능합니다.\n신청자 나이 | 만19세 이상의 성년자",text);
    }
    @Test void sectionsSortNumericallyAndNestedTablesAppearOnce()throws Exception{
        var entries=new LinkedHashMap<String,String>();entries.put("mimetype","application/hwp+zip");
        entries.put("Contents/section10.xml",section(p("열한 번째")));entries.put("Contents/section2.xml",section("<q:tbl><q:tr><q:tc>"+p("바깥")+"<q:tbl><q:tr><q:tc>"+p("안쪽")+"</q:tc></q:tr></q:tbl></q:tc></q:tr></q:tbl>"));
        var result=HwpxTextExtractor.extract(zip(entries));assertEquals(3,result.get(0).number());assertEquals(11,result.get(1).number());assertEquals("바깥\n안쪽",result.get(0).text());
    }
    @Test void rejectsNonHwpxAndExternalEntities()throws Exception{
        assertThrows(IOException.class,()->HwpxTextExtractor.extract(new byte[]{1,2,3}));
        assertThrows(IOException.class,()->HwpxTextExtractor.extract(zip(Map.of("Contents/section0.xml",section(p("본문"))))));
        var malicious=hwpx("<!DOCTYPE sec [<!ENTITY ext SYSTEM 'file:///private'>]>"+section(p("&ext;")));
        assertThrows(IOException.class,()->HwpxTextExtractor.extract(malicious));
    }
    @Test void rejectsZipExpansionBeyondBound()throws Exception{
        byte[] large=hwpx(section(p("가".repeat(HwpxTextExtractor.ENTRY_LIMIT/3+1))));
        assertThrows(IOException.class,()->HwpxTextExtractor.extract(large));
    }
    @Test void longTableBodyStillProducesEvidenceWithHwpxProvenance()throws Exception{
        String body=p("부산만덕5 공공임대주택 예비입주자 모집")+p("입주자 모집공고일 2026.09.03")+p("공급 안내 문구입니다.".repeat(10)).repeat(30)+p("■ 신청자격")+
            p("신청자는 만19세 이상의 성년자인 무주택세대구성원이어야 합니다.")+
            p("소득기준 및 자산기준 충족 여부와 상관없이 신청 가능합니다.")+p("한 세대에서 한 명만 신청할 수 있습니다.");
        byte[] file=hwpx(section("<q:tbl><q:tr><q:tc>"+body+"</q:tc></q:tr></q:tbl>"));
        var service=new NoticeEvidenceService(){
            @Override byte[] download(String url,int limit){
                return url.contains("lhFile.do")?file:"<div class=\"bbs_ViewA\"><h3>부산만덕5 공공임대주택 예비입주자 모집</h3></div><a href=\"javascript:fileDownLoad('123');\">모집공고.hwpx</a>".getBytes(StandardCharsets.UTF_8);
            }
        };
        var result=service.collect("https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=0000061163");
        assertEquals(1,result.sources().size());assertEquals(64,result.sources().get(0).sha256().length());
        assertTrue(result.warnings().isEmpty());
        for(var criterion:result.criteria()){
            assertFalse(criterion.evidence().isEmpty(),criterion.id());
            for(var evidence:criterion.evidence()){assertEquals(0,evidence.page());assertEquals("본문 1구역",evidence.region());}
        }
    }
    @Test void rejectedAttachmentsNeverLeakEvidenceOrConsumeTheThreeNoticeLimit()throws Exception{
        byte[] accepted=hwpx(section(p("양산시 국민임대주택 예비입주자 모집")+p("입주자 모집공고일 2026.09.15")+p("■ 신청자격")+p("신청자는 만19세 이상의 성년자인 무주택세대구성원이어야 합니다.")+p("소득기준 충족 여부와 상관없이 신청 가능합니다.")));
        byte[] rejected=hwpx(section(p("철원갈말 영구임대주택 예비입주자 모집")+p("입주자 모집공고일 2026.09.15")+p("■ 신청자격")+p("신청자는 만65세 이상이어야 합니다.")));
        var service=new NoticeEvidenceService(){
            @Override byte[] download(String url,int limit){
                if(url.contains("lhFile.do"))return url.endsWith("=4")?accepted:rejected;
                String html="<div class=\"bbs_ViewA\"><h3>양산시 국민임대주택 모집</h3></div>";
                for(int i=1;i<=4;i++)html+="<a href=\"javascript:fileDownLoad('"+i+"');\">첨부"+i+".hwpx</a>";
                return html.getBytes(StandardCharsets.UTF_8);
            }
        };
        var result=service.collect("https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=2015122300020796");
        assertEquals(java.util.List.of("4"),result.sources().stream().map(NoticeEvidenceService.Source::id).toList());
        assertEquals(3,result.warnings().size());
        var all=result.criteria().stream().flatMap(c->c.evidence().stream()).toList();
        assertFalse(all.isEmpty());assertTrue(all.stream().allMatch(e->e.sourceId().equals("4")));
        assertTrue(all.stream().noneMatch(e->e.quote().contains("65세")));
    }
}
