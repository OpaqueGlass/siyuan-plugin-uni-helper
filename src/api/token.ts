let tokenProvider: (() => string) | null = null;

/**
 * 注入真实的 API Token 获取实现
 * 历史上 getToken() 始终返回空串，此处保留该默认行为，避免改变请求语义
 */
export function setTokenProvider(provider: () => string): void {
    tokenProvider = provider;
}

export function getToken(): string {
    if (tokenProvider == null) {
        return "";
    }
    return tokenProvider();
}
