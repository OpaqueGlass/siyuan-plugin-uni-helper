import { setPluginContext, getPluginContext, PluginContext } from "./context";
import { initLogger } from "./logger";
import { setLanguage } from "./lang";

export interface RegisterPluginOptions {
    /** 插件短名，用于日志标识与调试键，缺省取插件实例的 name */
    shortName?: string;
    /** 插件全名，用于日志前缀，缺省与 shortName 一致 */
    fullName?: string;
    /** 临时 DOM id 前缀，缺省为 og_${shortName} */
    styleIdPrefix?: string;
    wndTempId?: string;
    /** 调试键名，缺省与 shortName 一致 */
    debugKey?: string;
    /** 插件语言包，缺省取 plugin.i18n */
    i18n?: Record<string, any>;
    /** 默认日志等级，缺省 2 */
    defaultLevel?: number;
    /** errorPush 是否附带调用栈，缺省 false */
    traceOnError?: boolean;
}

/**
 * 插件注册入口：收敛「实例保存 + 日志器初始化 + 语言包装载」三处散落调用
 * @param plugin 插件实例，通常在 onload 中传入 this
 */
export function registerPlugin(plugin: any, options: RegisterPluginOptions = {}): PluginContext {
    const shortName = options.shortName ?? plugin?.name ?? "ogplugin";
    const fullName = options.fullName ?? options.shortName ?? plugin?.name ?? "OG Plugin";
    const styleIdPrefix = options.styleIdPrefix ?? `og_${shortName}`;

    setPluginContext({
        instance: plugin,
        shortName,
        fullName,
        styleIdPrefix,
        wndTempId: options.wndTempId,
        debugKey: options.debugKey,
    });

    initLogger({
        shortName,
        fullName,
        defaultLevel: options.defaultLevel,
        traceOnError: options.traceOnError,
    });

    setLanguage(options.i18n ?? plugin?.i18n ?? {});

    return getPluginContext();
}
