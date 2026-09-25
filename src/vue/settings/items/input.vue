<template>
    <input class="b3-text-field fn__flex-center fn__size200" :type="inputElemType" :min="props.min" :max="props.max" v-model="model" />
</template>
<script lang="ts" setup>
import { ref } from 'vue';
const props = defineProps<{
    type: "NUMBER" | "TEXT",
    min?: number,
    max?: number
}>();

const model = defineModel();

let inputElemType = ref("text");
switch (props.type) {
    case "NUMBER":
        inputElemType.value = "number";
        break;
    case "TEXT":
        inputElemType.value = "text";
        break;
    default:
        inputElemType.value = "text";
        break;
}

</script>
