<script setup>
import IconBlock from './IconBlock.vue'

defineProps({
  icon: { type: String, default: 'box' },
  title: { type: String, default: '暂无数据' },
  desc: { type: String, default: '' },
})
</script>

<template>
  <div class="empty">
    <div class="empty-icon"><IconBlock :name="icon" :size="26" /></div>
    <div class="empty-title">{{ title }}</div>
    <div v-if="desc" class="empty-desc">{{ desc }}</div>
    <div style="margin-top: 14px"><slot /></div>
  </div>
</template>
