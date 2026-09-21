package com.jibro.api;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
@SpringBootApplication @EnableScheduling public class JibroApplication { public static void main(String[] args){ SpringApplication.run(JibroApplication.class,args); } }
