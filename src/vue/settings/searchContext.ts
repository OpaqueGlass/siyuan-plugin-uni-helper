import type { ComputedRef, InjectionKey } from 'vue';

/**
 * 设置项检索上下文
 * 由 setting.vue provide，group.vue / column.vue inject，用于三层（tab/column/item）显隐过滤
 */
export interface SettingSearchContext {
    /** 是否处于搜索状态（搜索框有非空关键字） */
    isSearching: ComputedRef<boolean>;
    /** 指定分类(tab)是否有命中设置项 */
    isTabMatch: (tabKey: string) => boolean;
    /** 指定分类下指定分组(column)是否有命中设置项 */
    isColumnMatch: (tabKey: string, colKey: string) => boolean;
    /** 指定设置项是否命中 */
    isItemMatch: (itemKey: string) => boolean;
}

export const SettingSearchKey: InjectionKey<SettingSearchContext> = Symbol('settingSearch');
