<template>
    <select class="b3-select fn__flex-center fn__size200" v-model="model" >
        <option v-for="(item, index) in props.optionNames" :value="optionKeys[index]">{{ item }}</option>
    </select>
</template>
<script lang="ts" setup>
const props = defineProps<{
    optionNames: Array<string>,
    optionKeys: Array<string>,
}>();
// 获取optionNames
const model = defineModel({ type: String})
</script>
