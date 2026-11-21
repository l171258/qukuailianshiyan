<script setup>
import { computed, ref, watch } from 'vue'
import IconBlock from './IconBlock.vue'
import HashChip from './HashChip.vue'
import { state, store } from '../store/chain'
import { recomputeBlockHash, GENESIS_BLOCK } from '../utils/hash'
import { formatTime, prettyData } from '../utils/format'
import { toast } from '../utils/toast'

const open = computed(() => !!state.detailBlock)
const block = computed(() => state.detailBlock?.block || null)
const prev = computed(() => state.detailBlock?.prev || null)
const next = computed(() => state.detailBlock?.next || null)
const difficulty = computed(() => state.nodeInfo?.difficulty ?? 3)

const recomputed = ref('')
const computing = ref(false)

watch(open, async (on) => {
  if (on && block.value) {
    computing.value = true
    recomputed.value = ''
    recomputed.value = await recomputeBlockHash(block.value)
    computing.value = false
  }
})

const hashOk = computed(() => {
  if (!block.value) return false
  // 创世区块与后端一致：整块逐字段比对（后端 isValidChain 的规则，因创世哈希是硬编码常量而非公式算出）
  return block.value.index === 0
    ? JSON.stringify(block.value) === JSON.stringify(GENESIS_BLOCK)
    : recomputed.value === block.value.hash
})
const hashLabel = computed(() => {
  if (computing.value) return '正在计算哈希…'
  if (block.value?.index === 0) return hashOk.value ? '创世区块匹配' : '创世区块不符'
  return hashOk.value ? '哈希重算一致' : '哈希重算不一致'
})
const difficultyOk = computed(() => (block.value?.hash || '').startsWith('0'.repeat(difficulty.value)))
const linkOk = computed(() => {
  if (!block.value) return false
  if (block.value.index === 0) return block.value.previousHash === '0'
  return prev.value ? block.value.previousHash === prev.value.hash : null
})
const nextLinkOk = computed(() => {
  if (!next.value || !block.value) return null
  return next.value.previousHash === block.value.hash
})
const rawJson = computed(() => JSON.stringify(block.value, null, 2))

function onKey(e) {
  if (e.key === 'Escape') store.closeDetail()
}
watch(open, (on) => {
  if (on) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})

async function copyJson() {
  try {
    await navigator.clipboard.writeText(rawJson.value)
    toast('区块 JSON 已复制', 'success')
  } catch {
    toast('复制失败', 'error')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open && block" class="modal-mask" @click.self="store.closeDetail()">
        <div class="modal">
          <header class="modal-head">
            <IconBlock name="cube" :size="18" style="color: var(--accent-soft)" />
            <strong>区块详情 #{{ block.index }}</strong>
            <span v-if="block.index === 0" class="chip tone-violet">创世区块</span>
            <button class="modal-close" title="关闭（Esc）" @click="store.closeDetail()">
              <IconBlock name="x" :size="15" />
            </button>
          </header>

          <div class="modal-body">
            <!-- 校验状态 -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px">
              <span class="chip" :class="computing ? 'tone-amber' : hashOk ? 'tone-green' : 'tone-red'">
                <IconBlock :name="computing ? 'clock' : hashOk ? 'check' : 'x'" :size="12" />
                {{ hashLabel }}
              </span>
              <span class="chip" :class="difficultyOk ? 'tone-green' : 'tone-red'">
                <IconBlock :name="difficultyOk ? 'check' : 'x'" :size="12" />
                难度前缀 {{ '0'.repeat(difficulty) }}
              </span>
              <span class="chip" :class="linkOk === null ? '' : linkOk ? 'tone-green' : 'tone-red'">
                <IconBlock :name="linkOk ? 'check' : 'x'" :size="12" />
                {{ block.index === 0 ? '创世校验' : linkOk ? '前链链接有效' : '前链链接断裂' }}
              </span>
            </div>

            <!-- 字段 -->
            <div class="detail-grid">
              <div class="kv"><span class="k">索引</span><span class="v">#{{ block.index }}</span></div>
              <div class="kv"><span class="k">nonce</span><span class="v">{{ block.nonce }}</span></div>
              <div class="kv full"><span class="k">时间戳</span><span class="v">{{ block.timestamp }}（{{ formatTime(block.timestamp) }}）</span></div>
              <div class="kv full"><span class="k">区块哈希</span><span class="v" style="color: #0369a1">{{ block.hash }}</span></div>
              <div class="kv full"><span class="k">前块哈希</span><span class="v">{{ block.previousHash }}</span></div>
              <div class="kv full">
                <span class="k">数据</span>
                <span class="v" style="white-space: pre-wrap; font-family: var(--mono)">{{ prettyData(block.data) }}</span>
              </div>
            </div>

            <!-- 前后区块链接 -->
            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin: 18px 0">
              <div v-if="prev" style="flex: 1; min-width: 200px">
                <div style="font-size: 11.5px; color: var(--text-3); margin-bottom: 6px">← 前一个区块</div>
                <HashChip label="#" :value="String(prev.index)" :short="false" />
                <div class="mono" style="font-size: 11px; color: var(--text-3); margin-top: 6px; word-break: break-all">
                  {{ prev.hash.slice(0, 22) }}…
                </div>
              </div>
              <div v-if="next" style="flex: 1; min-width: 200px">
                <div style="font-size: 11.5px; color: var(--text-3); margin-bottom: 6px">下一个区块 →</div>
                <HashChip label="#" :value="String(next.index)" :short="false" />
                <div class="mono" style="font-size: 11px; color: var(--text-3); margin-top: 6px; word-break: break-all">
                  {{ next.hash.slice(0, 22) }}…
                </div>
              </div>
            </div>

            <!-- 原始 JSON -->
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px">
              <span style="font-size: 12.5px; font-weight: 700">原始 JSON</span>
              <button class="btn btn-ghost btn-sm" @click="copyJson"><IconBlock name="copy" :size="13" /> 复制</button>
            </div>
            <pre class="pre-json">{{ rawJson }}</pre>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
