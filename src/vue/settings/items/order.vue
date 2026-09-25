<template>
    <div :id="enableDomId" class="oguh-setting-order-enable-container" ref="enableArea">
        {{ lang("order_panel_enable") }}
        <div v-for="(item, index) in model" :key="item" class="oguh-setting-order-option-container">
            <div class="oguh-setting-order-option-name-container">
                <span class="oguh-order-drag-handle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-grip-vertical"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                </span>
                <span class="oguh-order-option-name-text">
                    {{ optionNames[optionKeys.indexOf(item)] }}
                </span>
            </div>
            <div class="oguh-setting-order-option-desp" v-show="isValidStr(optionDesps[optionKeys.indexOf(item)])" v-html="optionDesps[optionKeys.indexOf(item)]">
            </div>
        </div>
    </div>
    <div :id="disableDomId" class="oguh-setting-order-disable-container" ref="disableArea">
        {{ lang("order_panel_disable") }}
        <div v-for="(item, index) in disableList" :key="item" class="oguh-setting-order-option-container">
            <div class="oguh-setting-order-option-name-container">
                <span class="oguh-order-drag-handle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-grip-vertical"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                </span>
                <span class="oguh-order-option-name-text">
                    {{ optionNames[optionKeys.indexOf(item)] }}
                </span>
            </div>
            <div class="oguh-setting-order-option-desp" v-show="isValidStr(optionDesps[optionKeys.indexOf(item)])" v-html="optionDesps[optionKeys.indexOf(item)]">
            </div>
        </div>
    </div>
</template>
<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import Sortable from "sortablejs";
import { debugPush, logPush, errorPush } from '../../../core/logger';
import { lang } from '../../../core/lang';
import { isValidStr } from '../../../core/commonCheck';
import { getPluginContext } from '../../../core/context';

const props = defineProps<{
    optionNames: Array<string>,
    optionKeys: Array<string>,
    optionDesps: Array<string>,
    settingKey: string,
}>();
const model = defineModel({ type: Array<string>});
let disableList = ref(props.optionKeys.filter(element => !model.value?.includes(element)));

let sortable1, sortable2;

const enableArea = ref(null);
const disableArea = ref(null);

const sharedGroupName = `${getPluginContext().styleIdPrefix}-order-${props.settingKey}`;
const enableDomId = `${sharedGroupName}-enable`;
const disableDomId = `${sharedGroupName}-disable`;

function dropEmptyValue(list) {
    for (let i = 0; i < list.length; i++) {
        if (!isValidStr(list[i])) {
            list.splice(i, 1);
            i--;
        }
    }
}

// 首次载入时 element 尚未进入文档流，用 ref 而非 getElementById 绑定
onMounted(() => {
    logPush("绑定");
    try {
        sortable1 = new Sortable(enableArea.value, {
            group: sharedGroupName,
            animation: 150,
            handle: ".oguh-order-drag-handle",
            scroll: true,
            onEnd: function (evt) {
                debugPush("移动1", evt);
                const item = model.value[evt.oldIndex];
                model.value.splice(evt.oldIndex, 1);
                if (evt.to.id === enableDomId) {
                    model.value.splice(evt.newIndex, 0, item);
                } else {
                    disableList.value.splice(evt.newIndex, 0, item);
                }
                dropEmptyValue(model.value);
                dropEmptyValue(disableList.value);
                debugPush("移动结果", model.value);
                debugPush("disable", disableList);
            }
        });
        sortable2 = new Sortable(disableArea.value, {
            group: sharedGroupName,
            animation: 150,
            handle: ".oguh-order-drag-handle",
            scroll: true,
            onEnd: function (evt) {
                debugPush("移动2", evt);
                const item = disableList.value[evt.oldIndex];
                disableList.value.splice(evt.oldIndex, 1);
                if (evt.to.id === enableDomId) {
                    model.value.splice(evt.newIndex, 0, item);
                } else {
                    disableList.value.splice(evt.newIndex, 0, item);
                }
                dropEmptyValue(model.value);
                dropEmptyValue(disableList.value);
                debugPush("移动结果", model.value);
                debugPush("disable", disableList);
            }
        });
    } catch(err) {
        errorPush("排序绑定失败", err);
    }

});


</script>
<style>
.oguh-setting-order-option-desp {
    color: var(--b3-theme-on-surface);

}
.oguh-order-drag-handle {
    cursor: grab;
    padding-right: 8px;
}
.oguh-setting-order-option-container {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 8px;
    margin: 4px 0;
    background-color: var(--b3-theme-background);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
}

.oguh-setting-order-option-name-container {
    display: flex;
    align-items: flex-start;
}

.oguh-order-option-name-text {
    height: 24px;
    line-height: 24px;
}

.oguh-setting-order-option-desp {
    margin-top: 8px;
}

.oguh-setting-order-enable-container, .oguh-setting-order-disable-container {
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    padding: 8px;
    margin: 4px 0;
}

.oguh-setting-order-disable-container > * {
    opacity: 0.7;
}
</style>
