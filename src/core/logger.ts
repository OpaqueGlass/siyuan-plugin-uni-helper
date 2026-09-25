/**
 * 插件日志器
 * shortName / fullName 由 registerPlugin 注入，取代各插件各自维护的常量
 */

let g_DEBUG = 2;
let g_NAME = "ogplugin";
let g_FULLNAME = "OG Plugin";
let g_TRACE_ON_ERROR = false;

export interface LoggerOptions {
    shortName: string;
    fullName?: string;
    /** 默认日志等级，缺省 2 */
    defaultLevel?: number;
    /** errorPush 是否附带调用栈，缺省 false */
    traceOnError?: boolean;
}

/*
LEVEL 0 忽略所有
LEVEL 1 仅Error
LEVEL 2 Err + Warn
LEVEL 3 Err + Warn + Info
LEVEL 4 Err + Warn + Info + Log
LEVEL 5 Err + Warn + Info + Log + Debug
请注意，基于代码片段加入window下的debug设置，可能在刚载入插件时无效
*/
export function commonPushCheck(): number {
    const debugConfig = window.top?.["OpaqueGlassDebugV2"];
    if (debugConfig?.[g_NAME] === undefined && debugConfig?.["*"] !== undefined) {
        return debugConfig["*"];
    }
    if (debugConfig == undefined || debugConfig[g_NAME] == undefined) {
        return g_DEBUG;
    }
    return debugConfig[g_NAME];
}

export function initLogger(options: LoggerOptions): void {
    g_NAME = options.shortName ?? g_NAME;
    g_FULLNAME = options.fullName ?? options.shortName;
    g_DEBUG = options.defaultLevel ?? 2;
    g_TRACE_ON_ERROR = options.traceOnError ?? false;
}

export function isDebugMode(): boolean {
    return commonPushCheck() > g_DEBUG;
}

export function debugPush(str: string, ...args: any[]): void {
    if (commonPushCheck() >= 5) {
        console.debug(`${g_FULLNAME}[D] ${new Date().toLocaleTimeString()} ${str}`, ...args);
    }
}

export function infoPush(str: string, ...args: any[]): void {
    if (commonPushCheck() >= 3) {
        console.info(`${g_FULLNAME}[I] ${new Date().toLocaleTimeString()} ${str}`, ...args);
    }
}

export function logPush(str: string, ...args: any[]): void {
    if (commonPushCheck() >= 4) {
        console.log(`${g_FULLNAME}[L] ${new Date().toLocaleTimeString()} ${str}`, ...args);
    }
}

export function errorPush(str: string, ...args: any[]): void {
    if (commonPushCheck() >= 1) {
        console.error(`${g_FULLNAME}[E] ${new Date().toLocaleTimeString()} ${str}`, ...args);
        if (g_TRACE_ON_ERROR) {
            console.trace(`${g_FULLNAME}[E] ${str}`);
        }
    }
}

export function warnPush(str: string, ...args: any[]): void {
    if (commonPushCheck() >= 2) {
        console.warn(`${g_FULLNAME}[W] ${new Date().toLocaleTimeString()} ${str}`, ...args);
    }
}
