/**
 * 语言方向 Single Entry
 * 优先级：插件词条 > 包内置框架词条 > key 本身
 * 插件未提供某 key 时退化为框架词条，避免搜索框等框架 UI 直接显示 raw key
 */
import zhCN from "./i18n/zh_CN.json";
import enUS from "./i18n/en_US.json";

let pluginLanguage: Record<string, any> = {};

export function setLanguage(language: Record<string, any>): void {
    pluginLanguage = language ?? {};
}

export function getLanguage(): Record<string, any> {
    return pluginLanguage;
}

function getCurrentLanguage(): string {
    const topLang = window.top?.["siyuan"]?.config?.langs?.current;
    if (typeof topLang === "string") {
        return topLang;
    }
    return window["siyuan"]?.config?.langs?.current ?? "";
}

function getFrameworkLanguage(): Record<string, any> {
    if (getCurrentLanguage().toLowerCase().startsWith("en")) {
        return enUS;
    }
    return zhCN;
}

/**
 * 合并插件词条与框架词条，插件词条优先
 */
export function mergeI18n(pluginI18n: Record<string, any> = {}): Record<string, any> {
    return { ...getFrameworkLanguage(), ...(pluginI18n ?? {}) };
}

export function lang(key: string): string {
    const pluginResult = pluginLanguage?.[key];
    if (pluginResult != undefined) {
        return pluginResult;
    }
    const frameworkResult = getFrameworkLanguage()[key];
    if (frameworkResult != undefined) {
        return frameworkResult;
    }
    return key;
}

/**
 * @param key 设置项key
 * @returns [设置项名称，设置项描述，设置项按钮名称（如果有）]
 */
export function settingLang(key: string): Array<string> {
    let settingName: string = lang(`setting_${key}_name`);
    let settingDesc: string = lang(`setting_${key}_desp`);
    let settingBtnName: string = lang(`setting_${key}_btn`)
    if (settingName == "Undefined" || settingDesc == "Undefined") {
        throw new Error(`设置文本${key}未定义`);
    }
    return [settingName, settingDesc, settingBtnName];
}

export function settingPageLang(key: string): Array<string> {
    let pageSettingName: string = lang(`settingpage_${key}_name`);
    return [pageSettingName];
}
