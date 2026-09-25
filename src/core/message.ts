import { showMessage } from "siyuan";
import { lang } from "./lang";

/**
 * 自动携带插件名称的消息提示
 * @param message 要显示的消息内容
 * @param timeout 显示时长（毫秒），默认 6000
 * @param type 消息类型，默认 "info"
 */
export function showPluginMessage(message: string, timeout?: number, type?: "info" | "error"): void {
    const pluginName = lang("dialog_panel_plugin_name");
    const prefixedMessage = `${message} —— ${pluginName}`;
    showMessage(prefixedMessage, timeout, type);
}
