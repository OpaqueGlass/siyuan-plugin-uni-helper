/**
 * 通用设置引擎
 * 插件侧只提供「默认值 + 标签页定义 + 迁移 + 校验钩子」，加载、落盘、类型校正、防抖、调试开关通由此处统一处理
 */
import { buildDomId, getDebugKey, getPluginContext } from "../core/context";
import { debugPush, errorPush, logPush } from "../core/logger";
import { lang } from "../core/lang";
import { generateUUID } from "../core/uuid";
import { isValidStr } from "../core/commonCheck";
import { nextTick, ref, watch, createApp } from "vue";
import * as siyuan from "siyuan";
import { isMobile } from "../api";
import { ConfigProperty, TabProperty, loadAllConfigPropertyFromTabProperty } from "./model";
import OutdatedSettingVue from "../vue/dialog/outdatedSetting.vue";

const DEFAULT_STORAGE_FILE = "settings_main.json";
const DEFAULT_DEBUG_SWITCH_KEY = "debugMode";
const DEFAULT_ZERO_TO_MAX_KEYS = ["docMaxNum"];
const SAVE_DEBOUNCE_MILLISECONDS = 400;

export interface CreateSettingManagerOptions {
    /** 存储文件名，缺省 settings_main.json */
    storageFile?: string;
    defaultSetting: Record<string, any>;
    /** 原 @version 语义的设置版本号 */
    currentVersion: number;
    /** 标签页定义，可传数组或懒加载函数 */
    tabs: Array<TabProperty> | (() => Array<TabProperty>);
    /** 插件专属旧版设置迁移 */
    transferOld?: () => Promise<any | null>;
    /** @version 低于 currentVersion 时触发的插件专属迁移 */
    onVersionUpgrade?: (loadResult: any) => void | Promise<void>;
    /** 插件专属校验/钳制钩子，返回修正后的设置对象 */
    customValidate?: (input: any, defaultSetting: Record<string, any>) => any;
    /** 设置变更并落盘后的回调 */
    onChanged?: (settings: any) => void;
    /** 调试开关键名，缺省 debugMode */
    debugSwitchKey?: string;
    /** 数值设置项填 0 表示「不限制」时需要回退到 max 的 key，缺省 ["docMaxNum"] */
    zeroToMaxKeys?: Array<string>;
    /** 需要提示「已过时」的设置项 key，缺省不提示 */
    outdatedWarnKeys?: Array<string>;
}

export interface SettingManager {
    loadSettings(): Promise<void>;
    saveSettings(newSettings: any): void;
    getGSettings(): any;
    getReadOnlyGSettings(): any;
    getDefaultSettings(): Record<string, any>;
    getTabProperties(): Array<TabProperty>;
}

let gActiveManager: SettingManager | null = null;

export function setActiveSettingManager(manager: SettingManager): void {
    gActiveManager = manager;
}

export function getActiveSettingManager(): SettingManager {
    if (gActiveManager == null) {
        throw new Error("[uni-helper] 尚未创建设置管理器，请先调用 createSettingManager");
    }
    return gActiveManager;
}

export function getGSettings(): any {
    return getActiveSettingManager().getGSettings();
}

export function getReadOnlyGSettings(): any {
    return getActiveSettingManager().getReadOnlyGSettings();
}

export function getDefaultSettings(): any {
    return getActiveSettingManager().getDefaultSettings();
}

export function getTabProperties(): Array<TabProperty> {
    return getActiveSettingManager().getTabProperties();
}

export function saveSettings(newSettings: any): void {
    getActiveSettingManager().saveSettings(newSettings);
}

export function createSettingManager(options: CreateSettingManagerOptions): SettingManager {
    const storageFile = options.storageFile ?? DEFAULT_STORAGE_FILE;
    const debugSwitchKey = options.debugSwitchKey ?? DEFAULT_DEBUG_SWITCH_KEY;
    const zeroToMaxKeys = options.zeroToMaxKeys ?? DEFAULT_ZERO_TO_MAX_KEYS;
    const setting = ref({});
    let updateTimeout: any = null;

    function resolveTabs(): Array<TabProperty> {
        if (typeof options.tabs === "function") {
            return options.tabs();
        }
        return options.tabs;
    }

    function getSettingValue(): any {
        return (setting as any)._rawValue ?? setting.value;
    }

    function saveSettings(newSettings: any): void {
        const pluginInstance = getPluginContext().instance;
        if (pluginInstance == null) {
            errorPush("插件实例未注册，设置项未能保存", newSettings);
            return;
        }
        debugPush("界面调起保存设置项", newSettings);
        pluginInstance.saveData(storageFile, JSON.stringify(newSettings, null, 4));
    }

    /**
     * 校验并修正设置项，最后执行插件专属校验钩子
     */
    function checkSettingType(input: any): any {
        const propertyMap = loadAllConfigPropertyFromTabProperty(resolveTabs());

        for (const prop of Object.values(propertyMap)) {
            const key = prop.key;
            const currentValue = input[key];
            let targetValue = currentValue;

            if (prop.type === "SELECT") {
                if (!prop.options.includes(currentValue)) {
                    targetValue = options.defaultSetting[key];
                }
            }
            else if (prop.type === "SWITCH") {
                if (currentValue === undefined) {
                    targetValue = options.defaultSetting[key];
                }
            }
            else if (prop.type === "NUMBER") {
                if (isValidStr(currentValue)) {
                    let num = parseFloat(currentValue);
                    if (num === 0 && zeroToMaxKeys.includes(key)) {
                        num = prop.max;
                    }
                    if (prop.min !== undefined && num < prop.min) {
                        num = prop.min;
                    }
                    if (prop.max !== undefined && num > prop.max) {
                        num = prop.max;
                    }
                    targetValue = num;
                }
            }

            if (input[key] !== targetValue) {
                input[key] = targetValue;
            }
        }

        if (options.customValidate == null) {
            return input;
        }
        return options.customValidate(input, options.defaultSetting) ?? input;
    }

    function changeDebug(newVal: any): void {
        const debugKey = getDebugKey();
        if (newVal[debugSwitchKey] === true) {
            debugPush("调试模式已开启");
            window.top["OpaqueGlassDebug"] = true;
            if (!window.top["OpaqueGlassDebugV2"]) {
                window.top["OpaqueGlassDebugV2"] = {};
            }
            window.top["OpaqueGlassDebugV2"][debugKey] = 5;
        } else if (newVal[debugSwitchKey] === false) {
            debugPush("调试模式已关闭");
            if (window.top["OpaqueGlassDebugV2"] && window.top["OpaqueGlassDebugV2"][debugKey]) {
                delete window.top["OpaqueGlassDebugV2"][debugKey];
            }
        }
    }

    function checkOutdatedSettings(loadSetting: any): Array<string> {
        const result = new Array<string>();
        for (const key of options.outdatedWarnKeys ?? []) {
            if (loadSetting[key] != options.defaultSetting[key]) {
                result.push(key);
            }
        }
        return result;
    }

    function showOutdatedSettingWarnDialog(outdatedSettingKeys: Array<string>): void {
        if (outdatedSettingKeys.length == 0) {
            return;
        }
        const app = createApp(OutdatedSettingVue, {
            "outdatedKeys": outdatedSettingKeys,
            "defaultSettings": options.defaultSetting,
        });
        const uid = generateUUID();
        new siyuan.Dialog({
            "title": lang("dialog_panel_plugin_name") + lang("dialog_panel_outdate"),
            "content": `
            <div id="${buildDomId("dialog", uid)}" class="b3-dialog__content" style="overflow: hidden; position: relative;height: 100%;"></div>
            `,
            "width": isMobile() ? "42vw" : "520px",
            "height": "auto",
            "destroyCallback": () => app.unmount(),
        });
        app.mount(`#${buildDomId("dialog", uid)}`);
    }

    async function loadSettings(): Promise<void> {
        const pluginInstance = getPluginContext().instance;
        if (pluginInstance == null) {
            errorPush("插件实例未注册，设置项未能载入");
            return;
        }
        let loadResult = await pluginInstance.loadData(storageFile);
        debugPush("文件载入设置", loadResult);
        if (loadResult == undefined || loadResult == "") {
            let oldSettings = null;
            if (options.transferOld != null) {
                oldSettings = await options.transferOld();
                debugPush("oldSettings", oldSettings);
            }
            if (oldSettings != null) {
                debugPush("使用转换后的旧设置", oldSettings);
                loadResult = oldSettings;
            } else {
                loadResult = options.defaultSetting;
            }
        }
        let versionUpgraded = false;
        if (!loadResult["@version"] || loadResult["@version"] < options.currentVersion) {
            loadResult["@version"] = options.currentVersion;
            versionUpgraded = true;
            if (options.onVersionUpgrade != null) {
                await options.onVersionUpgrade(loadResult);
            }
        }
        try {
            loadResult = checkSettingType(loadResult);
        } catch (err) {
            logPush("设置项类型检查时发生错误", err);
        }

        setting.value = Object.assign(Object.assign({}, options.defaultSetting), loadResult);
        logPush("载入设置项", setting.value);
        let isInternalUpdating = false;
        watch(setting, (newVal) => {
            if (isInternalUpdating) {
                debugPush("内部更新设置项，不保存", newVal);
                return;
            }
            if (updateTimeout) {
                clearTimeout(updateTimeout);
            }
            logPush("检查到变化");
            updateTimeout = setTimeout(() => {
                isInternalUpdating = true;
                try {
                    const checkedData = checkSettingType(newVal);
                    saveSettings(checkedData);
                    changeDebug(checkedData);
                    options.onChanged?.(checkedData);
                } catch (err) {
                    logPush("设置项检查时发生错误", err);
                } finally {
                    nextTick(() => {
                        isInternalUpdating = false;
                    });
                }
                updateTimeout = null;
            }, SAVE_DEBOUNCE_MILLISECONDS);
        }, { deep: true, immediate: false });

        changeDebug(setting.value);
        options.onChanged?.(setting.value);
        if (versionUpgraded) {
            saveSettings(setting.value);
        }
        showOutdatedSettingWarnDialog(checkOutdatedSettings(setting.value));
    }

    const manager: SettingManager = {
        loadSettings,
        saveSettings,
        getGSettings: () => setting,
        getReadOnlyGSettings: getSettingValue,
        getDefaultSettings: () => options.defaultSetting,
        getTabProperties: resolveTabs,
    };

    setActiveSettingManager(manager);
    return manager;
}
