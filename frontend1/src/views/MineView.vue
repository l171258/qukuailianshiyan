<script setup>
import { ref, reactive, computed, nextTick, watch, onBeforeUnmount } from 'vue'
import IconBlock from '../components/IconBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import HashChip from '../components/HashChip.vue'
import { state, store, difficulty, latestBlock } from '../store/chain'
import { formatTime, relativeTime, formatDuration, shortenHash } from '../utils/format'
import { toast } from '../utils/toast'

const data = ref('Hello Blockchain!')
const templates = [
  { label: '普通文本', value: 'Hello Blockchain!' },
  { label: '转账记录', value: '{"from":"Alice","to":"Bob","amount":3.5,"memo":"午餐费用"}' },
  { label: '节点消息', value: '节点A与节点B完成数据同步' },
]

const lines = reactive([])
const elapsed = ref('0.0 s')
const consoleEl = ref(null)
let fxTimer = null
let clockTimer = null
let nonce = 0

const isGenesisOnly = computed(() => state.blocks.length <= 1)

function randomHex(len) {
  const bytes = new Uint8Array(Math.ceil(len / 2))
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, len)
}
function pushLine(text, cls = '') {
  lines.push({ text, cls })
  if (lines.length > 60) lines.splice(0, lines.length - 60)
}
function clearFx() {
  clearInterval(fxTimer)
  clearInterval(clockTimer)
  fxTimer = clockTimer = null
}
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function startMine() {
  if (state.mining) return
  const value = data.value.trim()
  if (!value) { toast('请先输入要写入区块的数据', 'warn'); return }

  nonce = 0
  lines.length = 0
  pushLine(`> 提交挖矿任务，数据：${value}`, 'line-dim')
  pushLine(`> 目标：找到 SHA-256 哈希前缀为 ${'0'.repeat(difficulty.value)} 的值`, 'line-dim')
  pushLine('')

  const t0 = performance.now()
  fxTimer = setInterval(() => {
    nonce++
    const hit = nonce % 113 === 0
    const h = (hit ? '0'.repeat(difficulty.value) : '') + randomHex(64 - difficulty.value)
    pushLine(`nonce=${String(nonce).padStart(6, ' ')}  hash=${h}${hit ? '  <== 命中!' : ''}`, hit ? 'line-ok' : '')
  }, 40)
  clockTimer = setInterval(() => {
    elapsed.value = `${((performance.now() - t0) / 1000).toFixed(1)} s`
  }, 100)

  // 真实挖矿由后端完成；前端动画至少展示 1.6s
  const [block] = await Promise.all([store.mine(value), wait(1600)])
  clearFx()

  if (block) {
    pushLine('')
    pushLine('✔ 挖矿成功，新区块已写入区块链并广播至节点网络', 'line-ok')
    pushLine(`   区块索引 : #${block.index}`, 'line-ok')
    pushLine(`   区块哈希 : ${block.hash}`, 'line-ok')
    pushLine(`   nonce    : ${block.nonce}`, 'line-ok')
    pushLine(`   上链时间 : ${formatTime(block.timestamp)}`, 'line-ok')
    pushLine('')
    pushLine('> 等待下一次挖矿任务…', 'line-dim')
  } else {
    pushLine('✘ 挖矿失败，请检查后端连接', 'line-err')
  }
  elapsed.value = '0.0 s'
}

watch(
  () => lines.length,
  async () => {
    await nextTick()
    if (consoleEl.value) consoleEl.value.scrollTop = consoleEl.value.scrollHeight
  },
)
onBeforeUnmount(clearFx)
</script>

<template>
  <div class="grid-2">
    <!-- 左：挖矿控制台 -->
    <div class="card">
      <div class="card-title">
        <span class="icon"><IconBlock name="pick" :size="17" /></span>
        挖矿控制台
        <span class="extra">
          <span class="chip tone-amber">难度 {{ difficulty }}（前缀 0 × {{ difficulty }}）</span>
          <span class="chip tone-cyan">{{ elapsed }}</span>
        </span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px">
        <div class="template-chips">
          <button v-for="t in templates" :key="t.label" class="template-chip" @click="data = t.value">
            {{ t.label }}
          </button>
        </div>
        <textarea class="textarea" v-model="data" placeholder="输入要写入区块的数据，支持任意文本 / JSON…"></textarea>
        <button class="btn btn-primary" :disabled="state.mining" @click="startMine">
          <IconBlock :name="state.mining ? 'refresh' : 'pick'" :size="15" :class="{ spinning: state.mining }" />
          {{ state.mining ? '正在挖矿…' : '开始挖矿' }}
        </button>

        <div v-if="state.mining" class="mining-bar"><div></div></div>

        <div class="console" ref="consoleEl">
          <div v-if="!lines.length" class="line-dim">> 控制台空闲，输入数据后点击「开始挖矿」。</div>
          <div v-for="(l, i) in lines" :key="i" :class="l.cls">{{ l.text }}</div>
          <div v-if="state.mining" class="line-dim">> 计算中<span class="cursor">_</span></div>
        </div>

        <div class="banner info">
          <span class="icon"><IconBlock name="info" :size="15" /></span>
          <div class="banner-body">
            控制台动画用于展示工作量证明（PoW）过程；真实的哈希计算与出块由后端节点完成，
            挖出的新区块会立即广播给所有已连接节点。
          </div>
        </div>
      </div>
    </div>

    <!-- 右：结果 / 历史 / 说明 -->
    <div class="stack">
      <div class="card">
        <div class="card-title">
          <span class="icon"><IconBlock name="cube" :size="17" /></span>
          链上最新区块
        </div>
        <template v-if="latestBlock && !isGenesisOnly">
          <div style="display: flex; flex-direction: column; gap: 10px">
            <div style="display: flex; align-items: center; gap: 10px">
              <span class="block-idx">#{{ latestBlock.index }}</span>
              <span class="block-time">{{ relativeTime(latestBlock.timestamp) }}</span>
            </div>
            <HashChip label="哈希" :value="latestBlock.hash" />
            <div class="kv" style="border: none; padding: 0"><span class="k">nonce</span><span class="v">{{ latestBlock.nonce }}</span></div>
            <div class="kv" style="border: none; padding: 0"><span class="k">数据</span><span class="v">{{ latestBlock.data }}</span></div>
            <button class="btn btn-ghost btn-sm" @click="store.openDetail(latestBlock)">
              <IconBlock name="eye" :size="13" /> 查看详情
            </button>
          </div>
        </template>
        <EmptyState v-else icon="cube" title="还没有挖出新区块" desc="目前链上只有创世区块，去左侧挖出第一个区块吧" />
      </div>

      <div class="card">
        <div class="card-title">
          <span class="icon"><IconBlock name="clock" :size="17" /></span>
          挖矿历史
          <span class="extra">
            <button v-if="state.mineHistory.length" class="btn btn-ghost btn-sm" @click="store.clearMineHistory()">
              <IconBlock name="trash" :size="13" /> 清空
            </button>
          </span>
        </div>
        <div v-if="state.mineHistory.length" class="history-list">
          <div v-for="(h, i) in state.mineHistory" :key="i" class="history-item">
            <div class="row" style="justify-content: space-between">
              <span class="chip tone-green">#{{ h.block.index }}</span>
              <span style="color: var(--text-3)">{{ relativeTime(h.at) }}</span>
            </div>
            <div class="row" style="margin-top: 6px; color: var(--text-2)">
              <IconBlock name="zap" :size="13" style="color: var(--accent-soft)" />
              nonce {{ h.block.nonce }} · 耗时 {{ formatDuration(h.duration) }}
            </div>
            <div class="mono" style="margin-top: 6px; font-size: 11.5px; color: #0369a1; word-break: break-all">
              {{ shortenHash(h.block.hash, 14, 10) }}
            </div>
            <div style="margin-top: 6px; font-size: 12px; color: var(--text-3); word-break: break-all">
              数据：{{ h.data }}
            </div>
          </div>
        </div>
        <EmptyState v-else icon="clock" title="暂无挖矿记录" desc="本次会话挖出的区块会记录在这里" />
      </div>

      <div class="card">
        <div class="card-title">
          <span class="icon"><IconBlock name="info" :size="17" /></span>
          挖矿流程
        </div>
        <div class="steps">
          <div class="step">
            <span class="step-num">1</span>
            <div><div class="step-title">输入数据</div><div class="step-desc">任意文本或 JSON 字符串，作为新区块的数据内容</div></div>
          </div>
          <div class="step">
            <span class="step-num">2</span>
            <div><div class="step-title">工作量证明</div><div class="step-desc">后端不断尝试 nonce，直到 SHA-256 哈希前缀满足难度（0 × {{ difficulty }}）</div></div>
          </div>
          <div class="step">
            <span class="step-num">3</span>
            <div><div class="step-title">写入区块链</div><div class="step-desc">新区块链接到前一个区块的哈希，成为链尾</div></div>
          </div>
          <div class="step">
            <span class="step-num">4</span>
            <div><div class="step-title">广播同步</div><div class="step-desc">通过 P2P 网络广播给所有已连接节点，保持全网一致</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
