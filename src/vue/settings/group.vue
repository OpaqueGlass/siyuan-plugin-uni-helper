<template>
    <div>
        <template v-for="(column, index) in props.columnKeys" v-if="!hide">
            <div class="config-group" :data-group-id="column" v-show="isColumnVisible(column)">
                <div class="config-title">{{ props.columnNames[index] }}</div>
                <div class="config-items">
                    <slot :name="column"></slot>
                </div>
            </div>
        </template>
        <slot v-else name="none"></slot>
    </div>
</template>
<script lang="ts" setup>
import { inject } from 'vue';
import { SettingSearchKey } from './searchContext';

const props = defineProps<{
    columnKeys: string[],
    columnNames: string[],
    hide: boolean,
    tabKey: string
}>();

const search = inject(SettingSearchKey, null);

// 无搜索上下文（独立使用）时默认全部显示；有上下文时由 isColumnMatch 决定（内部已处理非搜索态）
const isColumnVisible = (col: string) => {
    if (!search) return true;
    return search.isColumnMatch(props.tabKey, col);
};
</script>
