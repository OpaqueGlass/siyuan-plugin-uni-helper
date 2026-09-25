/**
 * 设置层统一出口
 */
export {
    ConfigProperty,
    TabProperty,
    loadAllConfigPropertyFromTabProperty,
    type ConfigPropertyType,
    type IConfigProperty,
    type ITabProperty,
} from "./model";

export {
    createSettingManager,
    getActiveSettingManager,
    getDefaultSettings,
    getGSettings,
    getReadOnlyGSettings,
    getTabProperties,
    saveSettings,
    type CreateSettingManagerOptions,
    type SettingManager,
} from "./settingManager";

export { openSetting, type OpenSettingOptions } from "./openSetting";
export type { SettingComponentProps, TabComponentProps } from "./customTypes";
