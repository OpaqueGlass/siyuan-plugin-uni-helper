<template>
    <div :class="{'config__tab-container': true, 'config__tab-container--top': hasColumn}">
        <slot></slot>
    </div>
</template>

<script lang="ts" setup>
const props = defineProps<{
    hasColumn?: boolean;
}>();

</script>
