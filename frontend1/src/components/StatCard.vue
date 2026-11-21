<script setup>
import IconBlock from './IconBlock.vue'

defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '—' },
  sub: { type: String, default: '' },
  icon: { type: String, default: 'box' },
  tone: { type: String, default: 'cyan' }, // cyan | violet | green | amber
  loading: { type: Boolean, default: false },
})
</script>

<template>
  <div class="stat-card fade-up" :class="`tone-${tone}`">
    <div class="stat-icon"><IconBlock :name="icon" :size="21" /></div>
    <div class="stat-body">
      <div class="stat-label">{{ label }}</div>
      <div class="stat-value">
        <span v-if="loading" class="skeleton" style="display: inline-block; width: 74px; height: 26px"></span>
        <template v-else>
          {{ value }}<span v-if="sub" class="stat-sub">{{ sub }}</span>
        </template>
      </div>
    </div>
  </div>
</template>
