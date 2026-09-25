import {
    debugPush,
    infoPush,
    logPush,
    warnPush,
    errorPush,
    commonPushCheck,
    isDebugMode,
    initLogger,
} from "./logger";
import { getPluginContext, setPluginContext, usePluginContext, getDebugKey, PluginContext } from "./context";
import { setLanguage, lang, settingLang, settingPageLang, mergeI18n } from "./lang";
import { registerPlugin } from "./register";
import { isValidStr, isBlankStr, isMacOs, isEventCtrlKey, isCurrentVersionLessThan, parseVersion } from "./commonCheck";
import { htmlTransferParser } from "./stringUtils";
import Mutex from "./mutex";
import { isNotebookDocEnabled, isNotebookDoc, getListDocsByPathAPIFilePath } from "./compatUtils";
import { generateUUID } from "./uuid";
import { showPluginMessage } from "./message";
import { setPluginInstance, getPluginInstance } from "./getInstance";

export type { PluginContext };

export {
    debugPush,
    infoPush,
    logPush,
    warnPush,
    errorPush,
    commonPushCheck,
    isDebugMode,
    initLogger,
    getPluginContext,
    setPluginContext,
    usePluginContext,
    getDebugKey,
    setLanguage,
    lang,
    settingLang,
    settingPageLang,
    mergeI18n,
    registerPlugin,
    isValidStr,
    isBlankStr,
    isMacOs,
    isEventCtrlKey,
    isCurrentVersionLessThan,
    parseVersion,
    htmlTransferParser,
    Mutex,
    isNotebookDocEnabled,
    isNotebookDoc,
    getListDocsByPathAPIFilePath,
    generateUUID,
    showPluginMessage,
    setPluginInstance,
    getPluginInstance,
};
