<template>
    <div class="fn__flex-1 fn__flex config__panel" style="width: auto; height: 100%; max-width: 1280px;">
        <div class="config__side b3-list b3-list--background">
            <div class="config__tab-head">
                <div class="config__tab-title resize__move">
                    <svg class="b3-list-item__graphic"><use xlink:href="#iconSettings"></use></svg>
                    <span class="b3-list-item__text">{{ panelTitle }}</span>
                </div>
                <input v-model="searchKeyword" :placeholder="searchPlaceholder" class="b3-text-field fn__block" aria-label="搜索设置项">
            </div>
            <ul class="config__tab-scroll">
                <li v-for="(tab, index) in tabList" :key="index"
                    v-show="searchContext.isTabMatch(tab.key)"
                    :class="{ 'b3-list-item--focus': activeTab === tab.key, 'b3-list-item': true }" @click="changeTab(tab.key)">
                    <svg class="b3-list-item__graphic">
                        <use :xlink:href="'#' + tab.iconKey"></use>
                    </svg>
                    <span class="b3-list-item__text">{{ settingPageLang(tab.key)[0] }}</span>
                </li>
            </ul>
        </div>
        <div class="config__tab-wrap">
            <Page v-for="(tab, index) in tabList" v-show="activeTab === tab.key">
                <!-- 标签页级自定义组件：整个 tab 内容由插件接管 -->
                <component v-if="tab.component" :is="tab.component" :tab-key="tab.key" v-bind="tab.componentProps ?? {}"></component>
                <component v-else :is="tab.showColumnAsGroup ? Group : Column" :hide="!tab.isColumn" :column-keys="tab.columnKeys" :column-names="tab.columnNames" :tab-key="tab.key">
                    <template #[key] v-for="(items, key) in tab.props">
                        <template v-for="(item, index) in items">
                            <!-- 设置项级自定义组件：整块 UI 由插件接管 -->
                            <component v-if="item.component" :is="item.component" :key="index"
                                v-show="searchContext.isItemMatch(item.key)"
                                v-bind="buildComponentProps(item)"
                                :model-value="g_setting[item.key]"
                                @update:model-value="updateValue(item.key, $event)">
                            </component>
                            <template v-else-if="isBlockType(item.type)">
                                <Block :setting-key="item.key" v-show="searchContext.isItemMatch(item.key)" :config-name="item.configName" :config-desp="item.description">
                                    <template v-if="item.type == 'TEXTAREA'">
                                        <Textarea v-model="g_setting[item.key]"></Textarea>
                                    </template>
                                    <template v-else-if="item.type == 'ORDER'">
                                        <Order :option-names="item.optionNames" :option-desps="item.optionDesps" :option-keys="item.options"
                                            :setting-key="item.key" v-model="g_setting[item.key]"></Order>
                                    </template>
                                </Block>
                            </template>
                            <template v-else>
                                <Item :key="index" v-show="searchContext.isItemMatch(item.key)" :setting-key="item.key" :config-name="item.configName" :config-desp="item.description" :apply-value="g_setting[item.key]" :default-value="defaultSettings[item.key]">
                                    <!-- 控件级自定义组件：沿用 Item 的名称与描述布局，仅替换右侧控件 -->
                                    <component v-if="item.control" :is="item.control"
                                        v-bind="buildComponentProps(item)"
                                        :model-value="g_setting[item.key]"
                                        @update:model-value="updateValue(item.key, $event)">
                                    </component>
                                    <template v-else-if="item.type == 'SWITCH'">
                                        <Switch v-model="g_setting[item.key]"></Switch>
                                    </template>
                                    <template v-else-if="item.type == 'SELECT'">
                                        <Select :option-names="item.optionNames" :option-keys="item.options"
                                            v-model="g_setting[item.key]"></Select>
                                    </template>
                                    <template v-else-if="item.type == 'NUMBER'">
                                        <Input :min="item.min" :max="item.max" :type="item.type"
                                            v-model="g_setting[item.key]"></Input>
                                    </template>
                                    <template v-else-if="item.type == 'TEXT'">
                                        <Input :min="item.min" :max="item.max" :type="item.type"
                                            v-model="g_setting[item.key]"></Input>
                                    </template>
                                    <template v-else-if="item.type == 'BUTTON'">
                                        <Button :btn-name="settingLang(item.key)[2]" :btndo="item.btndo"></Button>
                                    </template>
                                    <template v-else-if="item.type == 'PATH'">
                                        <PathSelector v-model="g_setting[item.key]"></PathSelector>
                                    </template>

                                    <template v-else>
                                        出错啦，不能载入设置项，请检查设置代码实现。 Key: {{ item.key }}
                                        <br />
                                        Oops, can't load settings, check code please. Key: {{ item.key }}
                                    </template>
                                </Item>
                            </template>
                        </template>
                    </template>

                </component>


            </Page>
            <div v-if="isSearching && !hasAnyMatch" class="b3-label__text" style="padding: 16px; text-align: center;">{{ searchEmptyText }}</div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, provide } from 'vue';
import { lang, settingLang, settingPageLang } from '../../core/lang';
import type { ConfigProperty } from '../../settings/model';
import { getDefaultSettings, getGSettings, getTabProperties } from '../../settings/settingManager';
import Page from './page.vue';
import Column from './column.vue';
import Block from './block.vue';
import Item from './item.vue';
import Group from './group.vue';
import Button from './items/button.vue';
import Switch from './items/switch.vue';
import Input from './items/input.vue';
import Select from './items/select.vue';
import Textarea from './items/textarea.vue';
import PathSelector from './items/pathSelector.vue';
import Order from './items/order.vue';
import { SettingSearchKey } from './searchContext';
import type { SettingSearchContext } from './searchContext';

const BLOCK_TYPES = ['TEXTAREA', 'CUSTOM', 'ORDER', 'TIPS', 'CUSTOM_NOTEBOOK'];

const g_setting = getGSettings();
const defaultSettings = getDefaultSettings();
const tabList = getTabProperties();
const activeTab = ref(tabList[0].key);

const panelTitle = lang('setting_panel_title');
const searchPlaceholder = lang('setting_search_placeholder');
const searchEmptyText = lang('setting_search_empty');

// 设置项检索：输入防抖 + AND 匹配 name(configName) + desp(description)
const searchKeyword = ref('');
const debouncedKeyword = ref('');
let searchTimer: ReturnType<typeof setTimeout> | null = null;

watch(searchKeyword, (val) => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        debouncedKeyword.value = val.trim();
        searchTimer = null;
    }, 300);
});

const isSearching = computed(() => debouncedKeyword.value !== '');

interface MatchState {
    tabs: Set<string>;
    columns: Map<string, Set<string>>;
    items: Set<string>;
}

// 遍历所有 tab/column/item，按空格分词做 AND 匹配，仅检索 configName + description
const matchState = computed<MatchState>(() => {
    const result: MatchState = { tabs: new Set(), columns: new Map(), items: new Set() };
    const kw = debouncedKeyword.value.toLowerCase();
    const tokens = kw ? kw.split(/\s+/).filter(Boolean) : [];
    for (const tab of tabList) {
        const hitCols = new Set<string>();
        let tabHit = false;
        for (const colKey of tab.columnKeys) {
            const props = tab.props[colKey] ?? [];
            let colHit = false;
            for (const item of props) {
                const hay = (item.configName + ' ' + item.description).toLowerCase();
                if (tokens.every(t => hay.includes(t))) {
                    result.items.add(item.key);
                    colHit = true;
                }
            }
            if (colHit) hitCols.add(colKey);
            if (colHit) tabHit = true;
        }
        if (tabHit) {
            result.tabs.add(tab.key);
            result.columns.set(tab.key, hitCols);
        }
    }
    return result;
});

const hasAnyMatch = computed(() => matchState.value.tabs.size > 0);

const searchContext: SettingSearchContext = {
    isSearching,
    isTabMatch: (k: string) => !isSearching.value || matchState.value.tabs.has(k),
    isColumnMatch: (tabKey: string, colKey: string) => !isSearching.value || (matchState.value.columns.get(tabKey)?.has(colKey) ?? false),
    isItemMatch: (k: string) => !isSearching.value || matchState.value.items.has(k),
};
provide(SettingSearchKey, searchContext);

// 搜索后若当前 tab 无匹配，自动跳转到首个有匹配的 tab
watch(debouncedKeyword, () => {
    if (isSearching.value && !searchContext.isTabMatch(activeTab.value)) {
        const first = tabList.find(t => searchContext.isTabMatch(t.key));
        if (first) activeTab.value = first.key;
    }
});

function changeTab(key: string) {
    activeTab.value = key;
}

function isBlockType(type: string): boolean {
    return BLOCK_TYPES.indexOf(type) !== -1;
}

/**
 * 三级自定义组件共用的 props 契约，插件可在其上叠加 componentProps
 */
function buildComponentProps(item: ConfigProperty): Record<string, any> {
    return {
        settingKey: item.key,
        configName: item.configName,
        description: item.description,
        options: item.options,
        optionNames: item.optionNames,
        min: item.min,
        max: item.max,
        ...(item.componentProps ?? {}),
    };
}

function updateValue(key: string, value: any) {
    g_setting[key] = value;
}
</script>

<style>
.tab-menu {
    list-style: none;
    padding: 0;
    margin: 0;
}

.tab-menu li {
    display: inline-block;
    margin-right: 10px;
    cursor: pointer;
}

.tab-menu li.active {
    font-weight: bold;
}
</style>
