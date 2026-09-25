/**
 * 设置、设置标签页定义
 * 请注意，设置项的初始化应该在语言文件加载后进行
 */
import type { Component } from "vue";
import { isCurrentVersionLessThan, isValidStr } from "../core/commonCheck";
import { lang } from "../core/lang";

type BuiltinConfigPropertyType =
    | "SELECT"
    | "TEXT"
    | "NUMBER"
    | "BUTTON"
    | "TEXTAREA"
    | "SWITCH"
    | "ORDER"
    | "PATH"
    | "TIPS"
    | "CUSTOM";

/** 内置类型之外允许扩展自定义类型名（如 CUSTOM_NOTEBOOK） */
export type ConfigPropertyType = BuiltinConfigPropertyType | (string & {});

export interface IConfigProperty {
    key: string,
    type: ConfigPropertyType, // 设置项类型
    min?: number, // 设置项最小值
    max?: number, // 设置项最大值
    btndo?: () => void,  // 按钮设置项的调用函数(callback)
    options?: Array<string>, // 选项key数组，元素顺序决定排序顺序，请勿使用非法字符串
    optionSameAsSettingKey?: string, // 如果选项的描述文本和其他某个设置项相同，在此指定；请注意，仍需要指定options
    /** 控件级自定义组件：复用 Item 的名称与描述布局，仅替换右侧控件 */
    control?: Component,
    /** 设置项级自定义组件：type 为 CUSTOM 时整块渲染该组件 */
    component?: Component,
    /** 透传给自定义组件的额外参数 */
    componentProps?: Record<string, any>,
}

export class ConfigProperty {
    key: string;
    type: ConfigPropertyType;
    min?: number;
    max?: number;
    btndo?: () => void;
    options?: Array<string>;
    control?: Component;
    component?: Component;
    componentProps?: Record<string, any>;

    configName: string;
    description: string;
    tips: string;

    optionNames: Array<string>;
    optionDesps: Array<string>;

    constructor({key, type, min, max, btndo, options, optionSameAsSettingKey, control, component, componentProps}: IConfigProperty){
        this.key = key;
        this.type = type;
        this.min = min;
        this.max = max;
        this.btndo = btndo;
        this.options = options ?? new Array<string>();
        this.control = control;
        this.component = component;
        this.componentProps = componentProps;

        this.configName = lang(`setting_${key}_name`);
        this.description = lang(`setting_${key}_desp`);
        if (this.configName.startsWith("🧪")) {
            this.description = lang("setting_experimental") + this.description;
        } else if (this.configName.startsWith("✈")) {
            this.description = lang("setting_testing") + this.description;
        } else if (this.configName.startsWith("❌")) {
            this.description = lang("setting_deprecated") + this.description;
        }

        this.optionNames = new Array<string>();
        this.optionDesps = new Array<string>();
        for(let optionKey of this.options){
            this.optionNames.push(lang(`setting_${optionSameAsSettingKey ?? key}_option_${optionKey}`));
            this.optionDesps.push(lang(`setting_${optionSameAsSettingKey ?? key}_option_${optionKey}_desp`));
        }
    }
}

export interface ITabProperty {
    key: string,
    props: Array<ConfigProperty>|Record<string, Array<ConfigProperty>>,
    iconKey?: string,
    showColumnAsGroup?: boolean,
    /** 标签页级自定义组件：给定后将接管整个 tab 的内容 */
    component?: Component,
    /** 透传给标签页自定义组件的额外参数 */
    componentProps?: Record<string, any>,
}

export class TabProperty {
    key: string;
    iconKey: string;
    props: {[name:string]:Array<ConfigProperty>};
    isColumn: boolean = false;
    columnNames: Array<string> = new Array<string>();
    columnKeys: Array<string> = new Array<string>();
    showColumnAsGroup: boolean = false;
    component?: Component;
    componentProps?: Record<string, any>;

    /**
     * @param param0 key 设置项分组key，props 设置项列表，iconKey 图标关键字，showColumnAsGroup 是否将列显示为分组，component 标签页级自定义组件
     */
    constructor({key, props, iconKey, showColumnAsGroup, component, componentProps}: ITabProperty){
        this.key = key;
        this.showColumnAsGroup = (showColumnAsGroup ?? false) && !isCurrentVersionLessThan("3.7.0");
        this.component = component;
        this.componentProps = componentProps;
        if (isValidStr(iconKey)) {
            this.iconKey = iconKey;
        } else {
            this.iconKey = "setting";
        }
        if (!Array.isArray(props)) {
            this.isColumn = true;
            Object.keys(props).forEach((columnKey) => {
                this.columnNames.push(lang(`setting_column_${columnKey}_name`));
                this.columnKeys.push(columnKey);
            });
            this.props = props;
        } else {
            this.props = {"none": props};
            this.columnNames.push(lang(`setting_column_none_name`));
            this.columnKeys.push("none");
        }
    }
}

/**
 * 获得ConfigMap对象
 * @param tabDefinitions
 * @returns
 */
export function loadAllConfigPropertyFromTabProperty(tabDefinitions: Array<ITabProperty>):Record<string, ConfigProperty> {
    let result: Record<string, ConfigProperty> = {};
    tabDefinitions.forEach((tabDefinition) => {
        Object.values(tabDefinition.props).forEach((properties) => {
            properties.forEach((property) => {
                result[property.key] = property;
            });
        });
    });
    return result;
}
