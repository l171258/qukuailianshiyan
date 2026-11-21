<script setup>
import { computed } from 'vue'
import IconBlock from '../components/IconBlock.vue'
import StatCard from '../components/StatCard.vue'
import HashChip from '../components/HashChip.vue'
import ChainStrip from '../components/ChainStrip.vue'
import EmptyState from '../components/EmptyState.vue'
import BlockCard from '../components/BlockCard.vue'
import { state, store, latestBlock, difficulty, blockCount } from '../store/chain'
import { relativeTime, formatDuration } from '../utils/format'
import { go } from '../router'
import { toast } from '../utils/toast'

const loading = computed(() => state.loading && !state.blocks.length)

const chainAge = computed(() => {
  if (!state.blocks.length) return '—'
  return formatDuration(Date.now() - state.blocks[0].timestamp)
})
const avgInterval = computed(() => {
  if (state.blocks.length < 2) return '—'
  const diffs = []
  for (let i = 1; i < state.blocks.length; i++) {
    diffs.push(state.blocks[i].timestamp - state.blocks[i - 1].timestamp)
  }
  return formatDuration(diffs.reduce((a, b) => a + b, 0) / diffs.length)
})
const avgNonce = computed(() => {
  if (!state.blocks.length) return '—'
  const sum = state.blocks.reduce((a, b) => a + (Number(b.nonce) || 0), 0)
  return Math.round(sum / state.blocks.length).toLocaleString()
})
const connText = computed(() => ({ ok: '已连接', error: '连接失败', unknown: '连接中…' })[state.connection] || '—')

function copyLatestHash() {
  if (!latestBlock.value) return
  navigator.clipboard
    .writeText(latestBlock.value.hash)
    .then(() => toast('最新区块哈希已复制', 'success'))
    .catch(() => toast('复制失败', 'error'))
}
function goVerify() {
  go('/chain')
  toast('已进入区块链页，正在校验整条链…', 'info')
}
</script>

<template>
  <div class="stack">
    <!-- 连接失败提示 -->
    <div v-if="state.connection === 'error'" class="banner error section-gap">
      <span class="icon"><IconBlock name="wifi" :size="17" /></span>
      <div class="banner-body">
        <div><b>无法连接后端 API（{{ state.baseUrl }}）</b>：{{ state.connectError }}</div>
        <div style="margin-top: 4px; opacity: 0.85">
          请先启动后端：在 <code>blockchaindemo</code> 目录执行 <code>npm run api</code>
          （或 <code>npm start</code> 后在 CLI 中输入 <code>api 3001</code>），
          然后在左下角“连接设置”中确认 API 地址。
        </div>
        <div class="banner-actions">
          <button class="btn btn-ghost btn-sm" @click="store.sync()"><IconBlock name="refresh" :size="13" /> 重试连接</button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid section-gap">
      <StatCard icon="database" tone="cyan" label="区块总数" :value="blockCount" :loading="loading" />
      <StatCard icon="layers" tone="violet" label="当前链高" :value="'#' + (latestBlock?.index ?? '—')" :loading="loading" />
      <StatCard icon="share" tone="green" label="已连接节点" :value="state.peers.length" sub="个" :loading="loading" />
      <StatCard icon="zap" tone="amber" label="挖矿难度" :value="difficulty" sub="哈希前缀 0 位数" :loading="loading" />
    </div>

    <div class="grid-2">
      <!-- 左列 -->
      <div class="stack">
        <!-- 最新区块 -->
        <div class="card">
          <div class="card-title">
            <span class="icon"><IconBlock name="cube" :size="17" /></span>
            最新区块
            <span class="extra">
              <HashChip v-if="latestBlock" label="哈希" :value="latestBlock.hash" />
              <button class="btn btn-ghost btn-sm" @click="go('/chain')">查看全部</button>
            </span>
          </div>
          <template v-if="latestBlock">
            <BlockCard :block="latestBlock" @open="store.openDetail" />
          </template>
          <template v-else-if="loading">
            <div class="skeleton" style="height: 130px"></div>
          </template>
          <EmptyState v-else icon="database" title="暂无区块数据" desc="连接后端后，链上数据会显示在这里" />
        </div>

        <!-- 区块链预览 -->
        <div class="card">
          <div class="card-title">
            <span class="icon"><IconBlock name="layers" :size="17" /></span>
            区块链预览
            <span class="extra">
              <span class="chip" :class="state.verification?.valid ? 'tone-green' : 'tone-red'">
                <IconBlock :name="state.verification?.valid ? 'check' : 'shield'" :size="12" />
                {{ state.verification ? (state.verification.valid ? '整链有效' : '整链校验失败') : '未校验' }}
              </span>
              <button class="btn btn-ghost btn-sm" @click="go('/chain')"><IconBlock name="arrow-right" :size="13" /> 进入区块链</button>
            </span>
          </div>
          <template v-if="state.blocks.length">
            <ChainStrip :blocks="state.blocks" @select="store.openDetail" />
            <div class="strip-legend">
              <span><span class="dot ok"></span> 有效区块</span>
              <span><span class="dot error"></span> 无效区块</span>
              <span style="color: var(--accent-soft)">「最新」= 链尾区块</span>
            </div>
          </template>
          <EmptyState v-else icon="layers" title="链上还没有可展示的数据" desc="启动后端节点后，创世区块与后续区块会依次出现" />
        </div>
      </div>

      <!-- 右列 -->
      <div class="stack">
        <!-- 节点信息 -->
        <div class="card">
          <div class="card-title">
            <span class="icon"><IconBlock name="server" :size="17" /></span>
            节点信息
            <span class="extra"><span class="dot" :class="state.connection"></span></span>
          </div>
          <div class="kv"><span class="k">API 端口</span><span class="v">{{ state.nodeInfo?.apiPort ?? '—' }}</span></div>
          <div class="kv">
            <span class="k">P2P 端口</span>
            <span class="v">{{ state.nodeInfo?.p2pPort ?? '未开启' }}</span>
          </div>
          <div class="kv"><span class="k">区块总数</span><span class="v">{{ blockCount }}</span></div>
          <div class="kv"><span class="k">挖矿难度</span><span class="v">{{ difficulty }}（前缀 0 × {{ difficulty }}）</span></div>
          <div class="kv"><span class="k">API 地址</span><span class="v">{{ state.baseUrl }}</span></div>
          <div class="kv">
            <span class="k">连接状态</span>
            <span class="v" :style="state.connection === 'ok' ? 'color: var(--green)' : state.connection === 'error' ? 'color: var(--red)' : ''">
              {{ connText }}
            </span>
          </div>
          <div class="kv"><span class="k">最近同步</span><span class="v">{{ state.lastSync ? relativeTime(state.lastSync) : '—' }}</span></div>
        </div>

        <!-- 链上统计 -->
        <div class="card">
          <div class="card-title">
            <span class="icon"><IconBlock name="activity" :size="17" /></span>
            链上统计
          </div>
          <div class="kv"><span class="k">链龄</span><span class="v">{{ chainAge }}</span></div>
          <div class="kv"><span class="k">平均出块间隔</span><span class="v">{{ avgInterval }}</span></div>
          <div class="kv"><span class="k">平均 nonce</span><span class="v">{{ avgNonce }}</span></div>
          <div class="kv">
            <span class="k">最近出块</span>
            <span class="v">{{ latestBlock ? relativeTime(latestBlock.timestamp) : '—' }}</span>
          </div>
          <div class="kv"><span class="k">创世区块</span><span class="v">#0 · Genesis Block</span></div>
        </div>

        <!-- 快捷操作 -->
        <div class="card">
          <div class="card-title">
            <span class="icon"><IconBlock name="zap" :size="17" /></span>
            快捷操作
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">
            <button class="btn btn-primary" @click="go('/mine')"><IconBlock name="pick" :size="15" /> 去挖矿</button>
            <button class="btn btn-ghost" @click="go('/peers')"><IconBlock name="plus" :size="15" /> 添加节点</button>
            <button class="btn btn-ghost" @click="goVerify"><IconBlock name="shield" :size="15" /> 整链校验</button>
            <button class="btn btn-ghost" :disabled="!latestBlock" @click="copyLatestHash">
              <IconBlock name="copy" :size="15" /> 复制最新哈希
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
