import type { Component } from "vue";

/**
 * 三级自定义组件的统一 props 契约
 * 设置项级（type: "CUSTOM"）、标签页级（TabProperty.component）、控件级（ConfigProperty.control）共用
 */
export interface SettingComponentProps {
    /** 设置项 key */
    settingKey: string;
    /** 设置项名称（已过语言包） */
    configName: string;
    /** 设置项描述（已过语言包） */
    description: string;
    /** 当前值，配合 update:modelValue 事件回写 */
    modelValue: any;
    disabled?: boolean;
    options?: Array<string>;
    optionNames?: Array<string>;
    min?: number;
    max?: number;
}

/** 标签页级自定义组件额外接收所属 tab 的 key */
export interface TabComponentProps {
    tabKey: string;
}
