<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import IconBlock from '../components/IconBlock.vue'
import BlockCard from '../components/BlockCard.vue'
import ChainStrip from '../components/ChainStrip.vue'
import EmptyState from '../components/EmptyState.vue'
import NodeSwitcher from '../components/NodeSwitcher.vue'
import { state, store, difficulty } from '../store/chain'
import { verifyChain } from '../utils/hash'
import { toast } from '../utils/toast'

const query = ref('')
const tampered = ref(false)
const verifying = ref(false)
const results = ref(null) // { valid, results }
const visibleCount = ref(30)

/** 展示用链：模拟篡改模式下复制最新区块数据 */
const displayBlocks = computed(() => {
  if (!tampered.value || state.blocks.length < 2) return state.blocks
  const clone = state.blocks.map((b) => ({ ...b }))
  const last = clone[clone.length - 1]
  last.data = `${String(last.data)}（⚠ 该数据已被恶意篡改）`
  return clone
})
const tamperedIndex = computed(() =>
  tampered.value && displayBlocks.value.length > 1 ? displayBlocks.value.length - 1 : -1,
)

const shown = computed(() => {
  let list = [...displayBlocks.value].reverse()
  const q = query.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (b) =>
        String(b.index) === q ||
        String(b.data).toLowerCase().includes(q) ||
        String(b.hash).toLowerCase().includes(q),
    )
  }
  return list.slice(0, visibleCount.value)
})

const resultMap = computed(() => {
  if (!results.value) return null
  const m = {}
  for (const r of results.value.results) m[r.block.index] = r
  return m
})
const firstInvalid = computed(() =>
  results.value ? results.value.results.find((r) => !r.valid) : null,
)
const failReasons = { genesisOk: '创世区块不符', hashOk: '哈希不一致', difficultyOk: '难度不足', linkOk: '前链链接断裂' }
const firstFailReason = computed(() => {
  if (!firstInvalid.value) return ''
  const entry = Object.entries(firstInvalid.value.checks).find(([, ok]) => !ok)
  return entry ? failReasons[entry[0]] || entry[0] : ''
})

async function runVerify(showToast = false) {
  if (!displayBlocks.value.length || verifying.value) return
  verifying.value = true
  try {
    const res = await verifyChain(displayBlocks.value, difficulty.value)
    results.value = res
    if (!tampered.value) state.verification = { ...res, count: res.results.length, at: Date.now() }
    if (showToast) {
      toast(
        res.valid ? '整链校验通过：所有区块哈希与链接均有效' : '整链校验失败：发现无效区块',
        res.valid ? 'success' : 'error',
      )
    }
  } finally {
    verifying.value = false
  }
}

// 链数据或篡改状态变化时自动重新校验
watch(
  () => state.blocks.map((b) => `${b.index}:${b.hash}`).join('|') + '|' + tampered.value,
  () => runVerify(false),
)
onMounted(() => runVerify(false))

function loadMore() {
  visibleCount.value += 50
}
function openBlock(b) {
  store.openDetail(b)
}
</script>

<template>
  <div class="stack">
    <!-- 可用节点：切换查看不同节点的链 -->
    <NodeSwitcher />

    <!-- 篡改演示提示 -->
    <div v-if="tampered" class="banner warn">
      <span class="icon"><IconBlock name="alert" :size="17" /></span>
      <div class="banner-body">
        <b>防篡改演示进行中</b>：区块 #{{ tamperedIndex }} 的数据被修改（仅前端模拟，未写入后端），
        整链校验立即失败——这正是区块链“内容可校验、不可篡改”的特性。
        <div class="banner-actions">
          <button class="btn btn-ghost btn-sm" @click="tampered = false"><IconBlock name="refresh" :size="13" /> 恢复原链</button>
        </div>
      </div>
    </div>

    <!-- 校验结果 -->
    <div v-if="results" class="banner" :class="results.valid ? 'success' : 'error'">
      <span class="icon"><IconBlock :name="results.valid ? 'shield' : 'alert'" :size="17" /></span>
      <div class="banner-body">
        <template v-if="results.valid">
          <b>整链校验通过</b>：共 {{ results.results.length }} 个区块，全部区块哈希与前后链接均有效。
        </template>
        <template v-else>
          <b>整链校验失败</b>：区块 #{{ firstInvalid?.block.index }} 未通过校验
          <span v-if="firstFailReason">（{{ firstFailReason }}）</span>
        </template>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="card">
      <div class="toolbar">
        <button class="btn btn-primary" :disabled="verifying || !state.blocks.length" @click="runVerify(true)">
          <IconBlock :name="verifying ? 'refresh' : 'shield'" :size="15" :class="{ spinning: verifying }" />
          {{ verifying ? '校验中…' : '整链校验' }}
        </button>
        <div class="search-wrap grow">
          <span class="icon"><IconBlock name="search" :size="15" /></span>
          <input class="input" v-model="query" placeholder="搜索区块：索引 / 数据内容 / 哈希…" />
        </div>
        <label style="display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-2); cursor: pointer">
          <span class="switch" :class="{ on: tampered }" @click="tampered = !tampered"></span>
          模拟篡改演示
        </label>
        <span class="chip tone-cyan">难度 {{ difficulty }}</span>
        <span class="chip">{{ state.blocks.length }} 个区块</span>
      </div>
    </div>

    <!-- 链条可视化 -->
    <div class="card" v-if="state.blocks.length">
      <div class="card-title">
        <span class="icon"><IconBlock name="layers" :size="17" /></span>
        链结构总览
        <span class="extra" style="font-size: 11.5px; color: var(--text-3)">点击区块查看详情 · 横向滚动</span>
      </div>
      <ChainStrip :blocks="displayBlocks" :results="resultMap" @select="openBlock" />
      <div class="strip-legend">
        <span><span class="dot ok"></span> 校验通过</span>
        <span><span class="dot error"></span> 校验失败</span>
      </div>
    </div>

    <!-- 区块列表 -->
    <div class="card">
      <div class="card-title">
        <span class="icon"><IconBlock name="database" :size="17" /></span>
        区块数据
        <span class="extra" style="font-size: 12px; color: var(--text-3)">最新在前 · 共 {{ displayBlocks.length }} 个区块</span>
      </div>

      <div v-if="shown.length" class="block-list">
        <BlockCard
          v-for="b in shown"
          :key="b.index"
          :block="b"
          :verify="resultMap ? resultMap[b.index] : null"
          @open="openBlock"
        />
        <div v-if="shown.length < displayBlocks.length" style="text-align: center; margin-top: 6px">
          <button class="btn btn-ghost" @click="loadMore">
            <IconBlock name="chevron-down" :size="14" /> 加载更多（已显示 {{ shown.length }} / {{ displayBlocks.length }}）
          </button>
        </div>
      </div>
      <EmptyState v-else-if="state.blocks.length" icon="search" title="没有匹配的区块" desc="换个关键词试试" />
      <EmptyState v-else icon="database" title="暂无区块数据" desc="连接后端后，区块数据会显示在这里" />
    </div>
  </div>
</template>
