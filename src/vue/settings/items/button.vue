<template>
    <button class="b3-button b3-button--outline fn__size200" @click="props.btndo">{{ props.btnName }}</button>
</template>
<script lang="ts" setup>
const props = defineProps<{
    btnName: string,
    btndo: () => void
}>();

</script>
