package com.jibro.api.member;

import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import java.nio.file.Path;

@Component
@ConditionalOnProperty(name="jibro.migration.input")
public class MemberImportCommand implements ApplicationRunner {
    private final LegacyMemberImport importer;private final Environment env;private final ConfigurableApplicationContext context;
    public MemberImportCommand(LegacyMemberImport importer,Environment env,ConfigurableApplicationContext context){this.importer=importer;this.env=env;this.context=context;}
    @Override public void run(ApplicationArguments args){
        int code=0;
        try{
            var report=importer.run(Path.of(env.getRequiredProperty("jibro.migration.input")),env.getProperty("jibro.migration.apply",Boolean.class,false));
            System.out.printf("Member import %s: planned=%d, unchanged=%d, excluded-test=%d%n",report.applied()?"applied":"DRY RUN (no member writes)",report.imported(),report.unchanged(),report.excludedTestAccounts());
        }catch(Exception e){code=1;System.err.println("Member import failed; no import writes were committed. Check the export, original keys and member conflicts without publishing their contents.");}
        final int result=code;System.exit(SpringApplication.exit(context,()->result));
    }
}
