<script setup>
import { computed, ref } from 'vue'
import IconBlock from './IconBlock.vue'
import HashChip from './HashChip.vue'
import { formatTime } from '../utils/format'
import { state } from '../store/chain'

const props = defineProps({
  block: { type: Object, required: true },
  verify: { type: Object, default: null }, // { valid, checks } | null
})
const emit = defineEmits(['open'])

const expanded = ref(false)
const dataString = computed(() => String(props.block.data ?? ''))
const preview = computed(() =>
  expanded.value || dataString.value.length <= 160
    ? dataString.value
    : `${dataString.value.slice(0, 160)}…`,
)
const difficulty = computed(() => state.nodeInfo?.difficulty ?? 3)

const failedChecks = computed(() => {
  if (!props.verify || props.verify.valid) return []
  const names = { genesisOk: '创世区块不符', hashOk: '哈希不一致', difficultyOk: '难度不足', linkOk: '链接断裂' }
  return Object.entries(props.verify.checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => names[k] || k)
})
</script>

<template>
  <article class="block-card fade-up" :class="{ invalid: verify && !verify.valid }" @click="emit('open', block)">
    <header class="block-head">
      <span class="block-idx">#{{ block.index }}</span>
      <span v-if="block.index === 0" class="chip tone-violet">创世区块</span>
      <span v-if="verify && verify.valid" class="chip tone-green"><IconBlock name="check" :size="12" /> 校验通过</span>
      <span v-else-if="verify" class="chip tone-red"><IconBlock name="x" :size="12" /> 校验失败</span>
      <span v-else class="chip">未校验</span>
      <span class="block-time"><IconBlock name="clock" :size="12" />{{ formatTime(block.timestamp) }}</span>
    </header>

    <div class="block-data">
      {{ preview }}
      <span
        v-if="dataString.length > 160 && !expanded"
        class="block-data-toggle"
        @click.stop="expanded = true"
      >展开全部</span>
      <span v-else-if="expanded" class="block-data-toggle" @click.stop="expanded = false">收起</span>
    </div>

    <div class="block-hashes">
      <HashChip label="区块哈希" :value="block.hash" />
      <HashChip label="前块哈希" :value="block.previousHash" />
    </div>

    <footer class="block-foot">
      <span class="block-meta-item">nonce <b>{{ block.nonce }}</b></span>
      <span class="block-meta-item">难度前缀 <b>{{ '0'.repeat(difficulty) }}…</b></span>
      <span class="block-meta-item">时间戳 <b>{{ block.timestamp }}</b></span>
      <button class="btn btn-ghost btn-sm" style="margin-left: auto" @click.stop="emit('open', block)">
        <IconBlock name="eye" :size="13" /> 查看详情
      </button>
    </footer>

    <div v-if="failedChecks.length" class="block-fails">
      <span v-for="f in failedChecks" :key="f" class="chip tone-red">{{ f }}</span>
    </div>
  </article>
</template>
