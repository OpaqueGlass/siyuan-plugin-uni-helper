/**
 * 插件上下文：包与插件之间唯一的解耦点
 * 插件在 onload 阶段通过 registerPlugin 一次性注入，包内所有能力通过此处反查插件，绝不反向 import 插件代码
 */
export interface PluginContext {
    /** 思源插件实例 */
    instance: any;
    /** 插件短名，用于日志标识与 window.OpaqueGlassDebugV2 调试键 */
    shortName: string;
    /** 插件全名，用于日志前缀 */
    fullName: string;
    /** 设置面板等临时 DOM 的 id 前缀 */
    styleIdPrefix: string;
    /** 插件的临时窗口/节点 id */
    wndTempId?: string;
    /** 调试开关键名，缺省时与 shortName 一致 */
    debugKey?: string;
}

const DEFAULT_CONTEXT: PluginContext = {
    instance: null,
    shortName: "ogplugin",
    fullName: "OG Plugin",
    styleIdPrefix: "og_plugintemplate",
    wndTempId: undefined,
    debugKey: undefined,
};

let gContext: PluginContext = { ...DEFAULT_CONTEXT };

export function setPluginContext(context: Partial<PluginContext>): void {
    gContext = { ...gContext, ...context };
}

export function getPluginContext(): PluginContext {
    return gContext;
}

/**
 * 取得需要插件实例参与才能工作的上下文
 * 未先调用 registerPlugin 时直接抛错，避免后续出现难以定位的空引用
 */
export function usePluginContext(): PluginContext {
    if (gContext.instance == null) {
        throw new Error("[uni-helper] 插件实例尚未注册，请先调用 registerPlugin(this)");
    }
    return gContext;
}

export function getDebugKey(): string {
    return gContext.debugKey ?? gContext.shortName;
}

/**
 * 生成插件独占的临时 DOM id
 * @param scene 使用场景，如 setting / dialog
 */
export function buildDomId(scene: string, uid: string): string {
    return `${gContext.styleIdPrefix}_${scene}_${uid}`;
}
