package com.jibro.api;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Node;

/** Reads HWPX body sections, retaining paragraph and table row boundaries. */
final class HwpxTextExtractor {
    static final int ENTRY_LIMIT=16*1024*1024, TOTAL_LIMIT=64*1024*1024;
    record Section(int number,String text) {}

    static List<Section> extract(byte[] bytes) throws IOException {
        Map<Integer,byte[]> sections=new TreeMap<>();
        int total=0,count=0;boolean mime=false;
        try(var zip=new ZipInputStream(new ByteArrayInputStream(bytes))){
            ZipEntry entry;
            while((entry=zip.getNextEntry())!=null){
                if(++count>1000)throw new IOException("HWPX 항목 수 초과");
                byte[] data=zip.readNBytes(Math.min(ENTRY_LIMIT,TOTAL_LIMIT-total)+1);
                total+=data.length;
                if(data.length>ENTRY_LIMIT||total>TOTAL_LIMIT)throw new IOException("HWPX 압축 해제 용량 초과");
                String name=entry.getName();
                if(name.equals("mimetype"))mime=new String(data,StandardCharsets.UTF_8).strip().equals("application/hwp+zip");
                if(name.matches("Contents/section[0-9]{1,5}\\.xml")){
                    int number=Integer.parseInt(name.substring(16,name.length()-4));
                    if(sections.putIfAbsent(number,data)!=null)throw new IOException("중복 HWPX 본문");
                }
            }
        }
        if(!mime||sections.isEmpty())throw new IOException("HWPX 본문이 없는 파일");
        List<Section> result=new ArrayList<>();
        for(var section:sections.entrySet()){
            try{
                var factory=DocumentBuilderFactory.newInstance();factory.setNamespaceAware(true);
                factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING,true);
                factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);
                factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD,"");
                factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA,"");
                factory.setXIncludeAware(false);factory.setExpandEntityReferences(false);
                var builder=factory.newDocumentBuilder();
                builder.setErrorHandler(new org.xml.sax.helpers.DefaultHandler(){
                    @Override public void fatalError(org.xml.sax.SAXParseException e)throws org.xml.sax.SAXException{throw e;}
                });
                var root=builder.parse(new ByteArrayInputStream(section.getValue())).getDocumentElement();
                if(!"sec".equals(root.getLocalName())||!"http://www.hancom.co.kr/hwpml/2011/section".equals(root.getNamespaceURI()))throw new IOException("잘못된 HWPX 본문");
                StringBuilder text=new StringBuilder();append(root,text,0);
                result.add(new Section(section.getKey()+1,text.toString().strip()));
            }catch(IOException e){throw e;}catch(Exception e){throw new IOException("HWPX XML을 읽을 수 없습니다",e);}
        }
        return result;
    }

    private static void append(Node node,StringBuilder out,int depth)throws IOException{
        if(depth>128)throw new IOException("HWPX 구조 깊이 초과");
        String name=node.getLocalName();
        if(Set.of("header","footer","footNote","endNote").contains(name==null?"":name))return;
        if("t".equals(name)){out.append(node.getTextContent());return;}
        if("lineBreak".equals(name)){out.append('\n');return;}
        if("tab".equals(name)){out.append(' ');return;}
        if("tbl".equals(name))newline(out);
        if("tr".equals(name)){
            List<String> cells=new ArrayList<>();
            for(Node child=node.getFirstChild();child!=null;child=child.getNextSibling()){
                if(!"tc".equals(child.getLocalName()))continue;
                var cell=new StringBuilder();append(child,cell,depth+1);
                cells.add(cell.toString().strip());
            }
            out.append(String.join(" | ",cells));newline(out);return;
        }
        for(Node child=node.getFirstChild();child!=null;child=child.getNextSibling())append(child,out,depth+1);
        if("p".equals(name)||"tbl".equals(name))newline(out);
    }
    private static void newline(StringBuilder out){if(!out.isEmpty()&&out.charAt(out.length()-1)!='\n')out.append('\n');}
}
