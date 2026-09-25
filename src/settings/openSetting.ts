import { createApp } from "vue";
import * as siyuan from "siyuan";
import { buildDomId } from "../core/context";
import { generateUUID } from "../core/uuid";
import { lang } from "../core/lang";
import { isMobile } from "../api";
import SettingPanel from "../vue/settings/setting.vue";

export interface OpenSettingOptions {
    /** 弹窗标题，缺省取 lang("setting_panel_title") */
    title?: string;
    width?: string;
    height?: string;
}

/**
 * 打开设置面板
 * 由插件在自己的 openSetting() 中显式调用，包不会改动插件实例
 */
export function openSetting(openOptions: OpenSettingOptions = {}): void {
    const uid = generateUUID();
    const app = createApp(SettingPanel);
    new siyuan.Dialog({
        "content": `
        <div id="${buildDomId("setting", uid)}" style="overflow: hidden; position: relative;height: 100%;"></div>
        `,
        "width": openOptions.width ?? (isMobile() ? "92vw" : "1040px"),
        "height": openOptions.height ?? "80vh",
        "destroyCallback": () => app.unmount(),
    });
    app.mount(`#${buildDomId("setting", uid)}`);
}
