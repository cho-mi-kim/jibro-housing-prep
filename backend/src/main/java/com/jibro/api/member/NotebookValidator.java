package com.jibro.api.member;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.time.*;
import java.util.*;

@Component
public class NotebookValidator {
    private final ObjectMapper json;
    private final Clock clock;
    private static final Map<String, List<String>> OPTIONS = Map.ofEntries(
        Map.entry("targetGroup", List.of("general","youth","student","jobseeker","newlywed","engaged","newborn","singleParent","multiChild","senior")),
        Map.entry("selfHome", List.of("no","yes")), Map.entry("householdHome", List.of("no","yes")),
        Map.entry("maritalStatus", List.of("single","married","engaged")), Map.entry("dualIncome", List.of("no","yes")),
        Map.entry("householdRole", List.of("head","member")), Map.entry("incomeScope", List.of("household","self","parents")),
        Map.entry("residenceRegion", List.of("서울특별시","부산광역시","대구광역시","인천광역시","광주광역시","대전광역시","울산광역시","세종특별자치시","경기도","강원특별자치도","충청북도","충청남도","전북특별자치도","전라남도","경상북도","경상남도","제주특별자치도")));
    private static final Map<String, Long> MAX = Map.of("householdSize",20L,"childrenCount",20L,"monthlyIncome",10000000000L,"totalAssets",1000000000000L,"carValue",10000000000L,"subscriptionCount",1200L);
    public NotebookValidator(ObjectMapper json, Clock clock) { this.json = json; this.clock = clock; }
    private AccountError invalid() { return new AccountError(400,"applicant_profile","내 조건의 선택 동의와 입력 내용을 확인해주세요."); }
    public JsonNode profile(JsonNode input) {
        if (input == null || input.isNull() || input.isMissingNode()) return NullNode.instance;
        if (!input.isObject() || !input.path("consent").isBoolean() || !input.path("consent").booleanValue() || !AccountSettings.APPLICANT_POLICY.equals(input.path("consentVersion").asText())) throw invalid();
        ObjectNode p = json.createObjectNode().put("consent",true).put("consentVersion",AccountSettings.APPLICANT_POLICY);
        OPTIONS.forEach((k, options) -> { JsonNode v = input.path(k); if (empty(v)) return; if (!v.isTextual() || !options.contains(v.asText())) throw invalid(); p.set(k,v); });
        MAX.forEach((k,max) -> { JsonNode v = input.path(k); if (empty(v)) return; if (!v.isIntegralNumber() || !v.canConvertToLong() || v.longValue() < (k.equals("householdSize") ? 1 : 0) || v.longValue() > max) throw invalid(); p.set(k,v); });
        LocalDate today = LocalDate.now(clock.withZone(ZoneId.of("Asia/Seoul")));
        for (String key : List.of("birthDate","marriageDate","youngestChildBirthDate","residenceSince")) {
            JsonNode v = input.path(key); if (empty(v)) continue;
            try { LocalDate date = LocalDate.parse(v.asText()); if (!v.isTextual() || !v.asText().matches("\\d{4}-\\d{2}-\\d{2}") || date.isAfter(today) || date.isBefore(LocalDate.of(1900,1,1))) throw invalid(); p.set(key,v); }
            catch (DateTimeException e) { throw invalid(); }
        }
        if (p.has("birthDate") && Period.between(LocalDate.parse(p.path("birthDate").asText()),today).getYears()<14) throw invalid();
        if (!p.path("maritalStatus").asText().equals("married")) { p.remove("marriageDate"); p.remove("dualIncome"); }
        if (p.has("childrenCount") && p.path("childrenCount").asInt()==0) p.remove("youngestChildBirthDate");
        for (String date : List.of("marriageDate","youngestChildBirthDate")) if (p.has(date) && p.has("birthDate") && p.path(date).asText().compareTo(p.path("birthDate").asText())<0) throw invalid();
        return p.put("updatedAt",clock.instant().toString());
    }
    private boolean empty(JsonNode n) { return n.isNull() || n.isMissingNode() || (n.isTextual() && n.asText().isEmpty()); }
    private boolean noticeId(String id) { return id.matches("^(lh-|imported)[\\w-]{1,120}$"); }
    private String cut(JsonNode value,String fallback,int max) { String s=value.isTextual()&&!value.asText().isEmpty()?value.asText():fallback; return s.substring(0,Math.min(s.length(),max)); }
    private ArrayNode ids(JsonNode values) { ArrayNode out=json.createArrayNode(); Set<String> seen=new HashSet<>(); if(values.isArray()) for(JsonNode v:values) if(v.isTextual()&&v.asText().length()<180&&seen.add(v.asText())&&out.size()<1000)out.add(v);return out; }
    private ObjectNode versions(JsonNode values) { ObjectNode out=json.createObjectNode(); if(values.isObject())values.fields().forEachRemaining(e->{if(out.size()<1000&&e.getKey().length()<180&&e.getValue().isTextual()&&!e.getValue().asText().isEmpty()&&e.getValue().asText().length()<=2400)out.set(e.getKey(),e.getValue());});return out; }
    private ObjectNode record(JsonNode value) {
        ObjectNode out=json.createObjectNode();out.set("done",ids(value.path("done")));out.set("conditions",ids(value.path("conditions")));
        ObjectNode choices=json.createObjectNode(); if(value.path("documentChoices").isObject())value.path("documentChoices").fields().forEachRemaining(e->{if(choices.size()<1000&&e.getKey().length()<180&&Set.of("include","exclude").contains(e.getValue().asText()))choices.set(e.getKey(),e.getValue());});
        out.set("documentChoices",choices);out.set("conditionVersions",versions(value.path("conditionVersions")));out.set("documentVersions",versions(value.path("documentVersions")));
        JsonNode rev=value.path("noticeRevision");out.set("noticeRevision",rev.isTextual()&&rev.asText().length()<=2400?rev:NullNode.instance);
        if(value.path("rankProfile").isObject())out.set("rankProfile",value.path("rankProfile").deepCopy());return out;
    }
    public ObjectNode normalize(JsonNode input) {
        if(input==null||!input.isObject())throw new AccountError(400,"notebook","준비 기록 형식을 확인해주세요.");
        ObjectNode out=json.createObjectNode().put("name",cut(input.path("name"),"회원",16)).put("region",cut(input.path("region"),"전국",50)).put("reminder",!input.path("reminder").isBoolean()||input.path("reminder").asBoolean());
        out.set("saved",ids(input.path("saved")));out.set("notificationReads",ids(input.path("notificationReads")));out.set("applicantProfile",profile(input.path("applicantProfile")));
        ObjectNode data=json.createObjectNode(); if(input.path("noticeData").isObject())input.path("noticeData").fields().forEachRemaining(e->{if(data.size()<300&&noticeId(e.getKey()))data.set(e.getKey(),record(e.getValue()));});out.set("noticeData",data);
        String active=input.path("activeNoticeId").asText();if(noticeId(active))out.put("activeNoticeId",active);else out.putNull("activeNoticeId");out.setAll(record(data.path(active)));
        ObjectNode snapshots=json.createObjectNode();if(input.path("noticeSnapshots").isObject())input.path("noticeSnapshots").fields().forEachRemaining(e->{
            if(snapshots.size()>=300||!noticeId(e.getKey())||!e.getValue().isObject())return;
            try{URI uri=URI.create(e.getValue().path("url").asText());if(!("http".equals(uri.getScheme())||"https".equals(uri.getScheme()))||uri.getHost()==null||uri.getUserInfo()!=null)return;
                ObjectNode n=e.getValue().deepCopy();n.put("id",e.getKey()).put("title",cut(n.path("title"),"",700));snapshots.set(e.getKey(),n);
            }catch(IllegalArgumentException ignored){}
        });out.set("noticeSnapshots",snapshots);
        String imported=input.path("importedNotice").path("id").asText();if(snapshots.has(imported))out.set("importedNotice",snapshots.path(imported));return out;
    }
}
