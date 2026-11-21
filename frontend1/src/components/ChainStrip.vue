<script setup>
import { ref, watch, nextTick } from 'vue'
import { shortenHash } from '../utils/format'

const props = defineProps({
  blocks: { type: Array, default: () => [] },
  results: { type: Object, default: null }, // index -> 校验结果 { valid }
})
const emit = defineEmits(['select'])

const stripEl = ref(null)

watch(
  () => props.blocks.length,
  async () => {
    await nextTick()
    if (stripEl.value) stripEl.value.scrollTo({ left: stripEl.value.scrollWidth, behavior: 'smooth' })
  },
  { immediate: true },
)

function statusClass(block) {
  if (!props.results) return ''
  const r = props.results[block.index]
  if (!r) return ''
  return r.valid ? 'ok' : 'bad'
}
function isLatest(b) {
  return props.blocks.length > 0 && b.index === props.blocks[props.blocks.length - 1].index
}
</script>

<template>
  <div class="strip" ref="stripEl">
    <template v-for="(b, i) in blocks" :key="b.index">
      <div v-if="i > 0" class="strip-conn" :class="{ bad: results && results[b.index] && !results[b.index].valid }"></div>
      <div
        class="strip-item"
        :class="[statusClass(b), { latest: isLatest(b), genesis: b.index === 0 }]"
        :title="`点击查看区块 #${b.index}`"
        @click="emit('select', b)"
      >
        <div class="strip-idx">{{ b.index === 0 ? 'GENESIS' : 'BLOCK' }}</div>
        <div class="strip-num">#{{ b.index }}</div>
        <div class="strip-hash">{{ shortenHash(b.hash, 5, 4) }}</div>
      </div>
    </template>
  </div>
</template>
