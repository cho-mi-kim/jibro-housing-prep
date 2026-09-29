package com.jibro.api;

import java.text.Normalizer;
import java.util.Set;

/** Conservative document gate; keywords in a filename alone never prove eligibility provenance. */
final class NoticeDocumentClassifier {
    private static final Set<String> GENERIC=Set.of("정정공고","수정공고","공고","모집공고","모집","예비입주자","입주자","예비자","주택","국민임대","국민임대주택","영구임대","영구임대주택","행복주택","공공임대","입주자격완화","완화","상시","선착순","청년","신혼","신생아","전세형","매입임대","매입임대주택");
    static int priority(String filename){
        if(filename.matches(".*(팸플릿|팜플렛|팜플릿|브로슈어|양식|서식|동의서|신청서|위임장|각서|확인서|샘플|작성예).*"))return 2;
        return filename.matches(".*(모집|공고|입주자).*")?0:1;
    }
    static boolean isNotice(String text,String noticeTitle){
        String normalized=Normalizer.normalize(text,Normalizer.Form.NFKC);
        String compact=normalized.replaceAll("\\s+","");
        String heading=compact.substring(0,Math.min(350,compact.length()));
        if(!heading.matches("(?s).*(주택|임대|입주).*(모집|공고).*"))return false;
        // Standalone forms may quote the notice title and criteria in their fine print.
        String first=heading.substring(0,Math.min(100,heading.length()));
        if(first.matches("(?s).*(개인정보.*동의서|금융정보.*동의서|신청서|위임장|세대구성확인서|작성예시).*"))return false;
        if(!compact.matches("(?s).*(신청자격|입주자격).*"))return false;
        if(!compact.matches("(?s).*(신청기간|모집일정|접수일정|신청접수|신청일시|공급일정|모집공고일).*"))return false;
        // Compare identifying place/project words in the official page title with the document heading.
        // Administrative suffixes differ (e.g. 보성군 vs 보성운곡), so require the place stem.
        String title=Normalizer.normalize(noticeTitle,Normalizer.Form.NFKC);
        for(String token:title.split("[^가-힣a-zA-Z0-9]+")){
            if(token.length()<2||GENERIC.contains(token)||!token.matches("[가-힣].*"))continue;
            if(token.matches("(소득|자산|무주택|계약금|요건|분양전환|예비입주|추가모집|상시모집|모집공고|입주자격|선계약|선착순|동호지정).*"))continue;
            String stem=token.replaceFirst("(특별자치도|특별자치시|광역시|특별시|지역본부|지역|시|군|구)$","");
            if(stem.length()>=2&&heading.contains(stem))return true;
            // A county-wide document may name the particular complex only in its supply table.
            if(stem.length()>=4&&compact.contains(stem))return true;
        }
        return false;
    }
}
