<script setup>
import { ref, computed } from 'vue'
import IconBlock from '../components/IconBlock.vue'
import EmptyState from '../components/EmptyState.vue'
import { state, store, difficulty, blockCount } from '../store/chain'
import { relativeTime } from '../utils/format'

const host = ref('localhost')
const port = ref('2727')
const adding = ref(false)

async function submit() {
  if (adding.value) return
  adding.value = true
  try {
    await store.addPeer(host.value, port.value)
  } finally {
    adding.value = false
  }
}

const peers = computed(() => state.peers || [])
const peerErrorHint = computed(() => state.peerError)
const shown = computed(() => peers.value.slice(0, 12))
const overflow = computed(() => Math.max(0, peers.value.length - 12))

const peerDots = computed(() =>
  shown.value.map((label, i) => {
    const ang = -Math.PI / 2 + (i / shown.value.length) * Math.PI * 2
    return { x: 200 + Math.cos(ang) * 108, y: 132 + Math.sin(ang) * 88, label, index: i }
  }),
)

const connText = computed(() => ({ ok: '已连接', error: '连接失败', unknown: '连接中…' })[state.connection] || '—')
</script>

<template>
  <div class="stack">
    <!-- 连接失败提示 -->
    <div v-if="state.connection === 'error'" class="banner error">
      <span class="icon"><IconBlock name="wifi" :size="17" /></span>
      <div class="banner-body">
        <b>无法连接后端 API（{{ state.baseUrl }}）</b>：{{ state.connectError }}。
        请先在 <code>blockchaindemo</code> 目录执行 <code>npm run api</code> 启动后端。
        <div class="banner-actions">
          <button class="btn btn-ghost btn-sm" @click="store.sync()"><IconBlock name="refresh" :size="13" /> 重试连接</button>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <!-- 左列 -->
      <div class="stack">
        <!-- 本节点信息 -->
        <div class="card">
          <div class="card-title">
            <span class="icon"><IconBlock name="server" :size="17" /></span>
            本节点信息
            <span class="extra"><span class="dot" :class="state.connection"></span></span>
          </div>
          <div class="kv"><span class="k">API 端口</span><span class="v">{{ state.nodeInfo?.apiPort ?? '—' }}</span></div>
          <div class="kv">
            <span class="k">P2P 端口</span>
            <span class="v">
              {{ state.nodeInfo?.p2pPort ?? '未开启' }}
              <span v-if="!state.nodeInfo?.p2pPort" class="chip tone-amber" style="margin-left: 8px">只能主动连接他人</span>
            </span>
          </div>
          <div class="kv"><span class="k">区块总数</span><span class="v">{{ blockCount }}</span></div>
          <div class="kv"><span class="k">挖矿难度</span><span class="v">{{ difficulty }}</span></div>
          <div class="kv"><span class="k">已连接节点</span><span class="v">{{ peers.length }} 个</span></div>
          <div class="kv"><span class="k">最近同步</span><span class="v">{{ state.lastSync ? relativeTime(state.lastSync) : '—' }}</span></div>
          <div class="kv">
            <span class="k">状态</span>
            <span class="v" :style="state.connection === 'ok' ? 'color: var(--green)' : state.connection === 'error' ? 'color: var(--red)' : ''">{{ connText }}</span>
          </div>
        </div>

        <!-- 网络拓扑 -->
        <div class="card">
          <div class="card-title">
            <span class="icon"><IconBlock name="share" :size="17" /></span>
            网络拓扑
            <span class="extra" style="font-size: 11.5px; color: var(--text-3)">P2P 星型示意</span>
          </div>
          <svg v-if="peers.length" class="net-svg" viewBox="0 0 400 264">
            <template v-for="(p, i) in peerDots" :key="i">
              <line class="net-line" x1="200" y1="132" :x2="p.x" :y2="p.y" />
            </template>
            <circle class="net-center" cx="200" cy="132" r="27" />
            <text x="200" y="130" text-anchor="middle" style="fill: #0f172a; font-size: 12px; font-weight: 700">本节点</text>
            <text x="200" y="143" text-anchor="middle" style="fill: #7c3aed; font-size: 9px">#0</text>
            <template v-for="(p, i) in peerDots" :key="'p' + i">
              <circle class="net-node" :cx="p.x" :cy="p.y" r="11" />
              <text :x="p.x" :y="p.y + 3" text-anchor="middle" style="fill: #0e7490; font-size: 10px; font-weight: 700">{{ i + 1 }}</text>
              <text :x="p.x" :y="p.y + 22" text-anchor="middle">{{ p.label }}</text>
            </template>
            <text v-if="overflow" x="400" y="254" text-anchor="end" style="fill: var(--text-3)">+{{ overflow }} 个节点未显示</text>
          </svg>
          <EmptyState v-else icon="share" title="暂无已连接节点" desc="添加节点后，这里会展示 P2P 网络拓扑" />
        </div>
      </div>

      <!-- 右列 -->
      <div class="stack">
        <!-- 添加节点 -->
        <div class="card">
          <div class="card-title">
            <span class="icon"><IconBlock name="plus" :size="17" /></span>
            添加对等节点
          </div>
          <div style="display: flex; flex-direction: column; gap: 12px">
            <div class="form-row">
              <input class="input" v-model="host" placeholder="节点地址，如 localhost" @keyup.enter="submit" />
              <input class="input port-input" v-model="port" placeholder="端口" @keyup.enter="submit" />
            </div>
            <button class="btn btn-primary" :disabled="adding" @click="submit">
              <IconBlock :name="adding ? 'refresh' : 'share'" :size="15" :class="{ spinning: adding }" />
              {{ adding ? '连接中…' : '连接节点' }}
            </button>
            <div style="font-size: 12px; color: var(--text-3)">
              连接成功后对方会出现在节点列表中；两侧节点会立即交换最新区块，挖矿产生的区块也会自动广播同步。
            </div>
            <div v-if="peerErrorHint" class="banner warn" style="padding: 10px 12px; font-size: 12px">
              <span class="icon"><IconBlock name="alert" :size="14" /></span>
              <div class="banner-body">
                若出现 <code>ERR_MISSING_ARGS</code>，是后端原版 <code>/addPeer</code> 的已知问题（未拆分 host:port）。
                请改用命令行连接：在节点终端执行 <code>connect localhost 2727</code>，网页会自动显示已连接节点。
              </div>
            </div>
          </div>
        </div>

        <!-- 节点列表 -->
        <div class="card">
          <div class="card-title">
            <span class="icon"><IconBlock name="radio" :size="17" /></span>
            已连接节点
            <span class="extra"><span class="chip">{{ peers.length }} 个</span></span>
          </div>
          <div v-if="peers.length" class="stack" style="gap: 10px">
            <div v-for="(p, i) in peers" :key="i" class="peer-card">
              <div class="peer-avatar"><IconBlock name="globe" :size="19" /></div>
              <div style="min-width: 0">
                <div class="peer-addr">{{ p }}</div>
                <div class="peer-sub">节点 {{ i + 1 }} · TCP 长连接 · 实时同步区块</div>
              </div>
              <span class="chip tone-green" style="margin-left: auto"><span class="dot ok"></span> 在线</span>
            </div>
          </div>
          <EmptyState v-else icon="radio" title="暂无已连接节点" desc="使用上方表单连接其他节点的 P2P 端口" />
        </div>

        <!-- P2P 说明 -->
        <div class="card">
          <div class="card-title">
            <span class="icon"><IconBlock name="info" :size="17" /></span>
            P2P 组网说明
          </div>
          <div class="steps">
            <div class="step">
              <span class="step-num">1</span>
              <div><div class="step-title">开启本机 P2P 监听</div><div class="step-desc">后端 CLI 中执行 <code style="color: var(--accent-soft)">open 2727</code>（网页查看需另执行 <code style="color: var(--accent-soft)">api 3001</code>）</div></div>
            </div>
            <div class="step">
              <span class="step-num">2</span>
              <div><div class="step-title">多开一个节点</div><div class="step-desc">另开终端再启动一个后端：<code style="color: var(--accent-soft)">api 3002</code> + <code style="color: var(--accent-soft)">open 2728</code></div></div>
            </div>
            <div class="step">
              <span class="step-num">3</span>
              <div><div class="step-title">互相连接</div><div class="step-desc">在本页输入对方地址与 P2P 端口建立连接；若按钮报错，改用命令行 <code style="color: var(--accent-soft)">connect localhost 2727</code></div></div>
            </div>
            <div class="step">
              <span class="step-num">4</span>
              <div><div class="step-title">广播同步</div><div class="step-desc">任一节点挖出的新区块会广播到全网，各节点链数据保持一致</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
