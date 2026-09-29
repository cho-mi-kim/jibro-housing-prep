package com.jibro.api.member;

public class AccountError extends RuntimeException {
    public final int status;
    public final String code;
    public AccountError(int status, String code, String message) {
        super(message); this.status = status; this.code = code;
    }
    static AccountError credentials() { return new AccountError(401, "credentials", "이메일 또는 비밀번호를 확인해주세요."); }
    static AccountError unavailable() { return new AccountError(503, "unavailable", "계정 정보를 처리하지 못했어요. 잠시 후 다시 시도해주세요."); }
}
