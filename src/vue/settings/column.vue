<template>
    <div class="fn__flex-column" style="height: 100%;" v-if="!hide">
        <div class="layout-tab-bar fn__flex">
            <template v-for="(column, index) in props.columnKeys">
                <div class="item item--full" :class="{'item--focus': currentTab === column}" :data-type="column" @click="changeTab(column)">
                    <span class="fn__flex-1"></span>
                    <span>{{ props.columnNames[index] }}</span>
                    <span class="fn__flex-1"></span>
                </div>
            </template>
        </div>
        <div class="fn__flex-1">
            <div v-for="(column, index) in props.columnKeys" :data-type="column" :class="{'fn__none': !isColumnVisible(column)}">
                <slot :name="column"></slot>
            </div>
        </div>
    </div>
    <slot v-else name="none"></slot>
</template>
<script lang="ts" setup>
import { ref, inject } from 'vue';
import { SettingSearchKey } from './searchContext';

const props = defineProps<{
    columnKeys: string[],
    columnNames: string[],
    hide: boolean,
    tabKey: string
}>();

const search = inject(SettingSearchKey, null);

const changeTab = (newColumn)=>{
    currentTab.value = newColumn;
}

const currentTab = ref(props.columnKeys[0]);

// 非搜索态：维持原 currentTab 切换逻辑；搜索态：按命中展开所有匹配 column
const isColumnVisible = (col: string) => {
    if (!search) return currentTab.value === col;
    if (search.isSearching.value) {
        return search.isColumnMatch(props.tabKey, col);
    }
    return currentTab.value === col;
};
</script>
