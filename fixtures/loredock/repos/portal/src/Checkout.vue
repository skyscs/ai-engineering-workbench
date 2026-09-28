<script setup lang="ts">
import { submitOrder } from './orders';
const props = defineProps<{ orderId: string; tenantId: string }>();
const submit = () => submitOrder(props.orderId, props.tenantId);
</script>

<template><button @click="submit">Place order</button></template>
