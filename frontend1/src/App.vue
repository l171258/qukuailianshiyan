<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import IconBlock from './components/IconBlock.vue'
import Toasts from './components/Toasts.vue'
import BlockDetailModal from './components/BlockDetailModal.vue'
import { routes, currentRoute, go } from './router'
import { state, store, recentNodes } from './store/chain'
import { relativeTime } from './utils/format'
import { toast } from './utils/toast'

const view = computed(() => currentRoute.value.component)
const connPopOpen = ref(false)
const apiDraft = ref(state.baseUrl)
const now = ref(Date.now())
let tick = null

onMounted(() => {
  store.sync()
  store.probeAllNodes()
  store.startPolling()
  tick = setInterval(() => { now.value = Date.now() }, 1000)
})
onBeforeUnmount(() => {
  store.stopPolling()
  clearInterval(tick)
})
watch(() => state.autoRefresh, (v) => (v ? store.startPolling() : store.stopPolling()))

const connText = computed(() => ({ ok: '已连接', error: '连接失败', unknown: '连接中…' })[state.connection] || '—')
const syncText = computed(() => {
  now.value // 依赖时钟，让相对时间每秒刷新
  return state.lastSync ? relativeTime(state.lastSync) : ''
})

/** 显示节点名（去掉协议头） */
function nodeLabel(url) {
  return String(url).replace(/^https?:\/\//i, '')
}

/** 快速切换到最近连接过的节点 */
function switchNode(url) {
  if (url === state.baseUrl) {
    connPopOpen.value = false
    return
  }
  apiDraft.value = url
  connPopOpen.value = false
  store.setBaseUrl(url)
}

async function refresh() {
  await store.sync({ silent: true })
  if (state.connection === 'ok') toast('数据已刷新', 'success')
}

function saveConn() {
  connPopOpen.value = false
  store.setBaseUrl(apiDraft.value)
}
</script>

<template>
  <div class="app-shell">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="logo">
        <div class="logo-badge"><IconBlock name="cube" :size="22" /></div>
        <div>
          <div class="logo-name">区块链演示平台</div>
          <div class="logo-sub">Blockchain Lab</div>
        </div>
      </div>

      <nav class="nav">
        <div
          v-for="r in routes"
          :key="r.path"
          class="nav-item"
          :class="{ active: r.path === currentRoute.path }"
          @click="go(r.path)"
        >
          <span class="nav-icon"><IconBlock :name="r.icon" :size="16" /></span>
          {{ r.label }}
        </div>
      </nav>

      <div class="side-foot">
        <!-- 连接设置弹层 -->
        <div v-if="connPopOpen" class="conn-pop">
          <div class="conn-pop-title">连接设置</div>
          <div class="conn-row">
            <span class="dot" :class="state.connection"></span>
            <span>{{ connText }}</span>
            <span style="color: var(--text-3)">· {{ state.baseUrl }}</span>
          </div>

          <!-- 最近连接过的节点，点击即可切换 -->
          <div v-if="recentNodes.length > 1" class="conn-recent">
            <span class="conn-recent-label">最近节点</span>
            <button
              v-for="n in recentNodes"
              :key="n"
              class="node-chip"
              :class="{ active: n === state.baseUrl }"
              :title="n"
              @click="switchNode(n)"
            >{{ nodeLabel(n) }}</button>
          </div>

          <input
            class="input"
            v-model="apiDraft"
            placeholder="http://localhost:3001"
            @keyup.enter="saveConn"
          />
          <div class="conn-actions">
            <button class="btn btn-primary btn-sm" style="flex: 1" :disabled="state.syncing" @click="saveConn">
              保存并重新连接
            </button>
          </div>
          <div class="conn-row between">
            <span>自动刷新</span>
            <span class="switch" :class="{ on: state.autoRefresh }" @click="store.setAutoRefresh(!state.autoRefresh)"></span>
          </div>
          <div class="conn-row between">
            <span>刷新间隔</span>
            <select class="select select-sm" :value="state.intervalSec" @change="store.setIntervalSec($event.target.value)">
              <option :value="2">2 秒</option>
              <option :value="5">5 秒</option>
              <option :value="10">10 秒</option>
              <option :value="30">30 秒</option>
            </select>
          </div>
        </div>

        <button class="conn-btn" @click="connPopOpen = !connPopOpen">
          <span class="dot" :class="state.connection"></span>
          <span class="conn-info">
            <span class="conn-status">{{ connText }}</span>
            <span class="conn-addr">{{ state.baseUrl }}</span>
          </span>
          <IconBlock name="chevron-down" :size="14" style="margin-left: auto" />
        </button>
      </div>
    </aside>

    <!-- 主区域 -->
    <div class="main-col">
      <header class="topbar">
        <div class="top-title">
          <h1>{{ currentRoute.label }}</h1>
          <div class="sub">{{ currentRoute.desc }}</div>
        </div>
        <div class="top-actions">
          <span class="chip tone-cyan node-pill" :title="'当前后端节点：' + state.baseUrl">
            <IconBlock name="server" :size="12" /> {{ nodeLabel(state.baseUrl) }}
          </span>
          <span v-if="state.lastSync" class="sync-pill">
            <IconBlock name="clock" :size="13" /> 同步于 {{ syncText }}
          </span>
          <span class="sync-pill">
            <span class="dot" :class="state.connection"></span> {{ connText }}
          </span>
          <button class="btn btn-ghost btn-icon" :class="{ spinning: state.syncing }" title="立即刷新" @click="refresh">
            <IconBlock name="refresh" :size="16" />
          </button>
        </div>
      </header>

      <main class="content">
        <component :is="view" />
      </main>

      <footer class="app-footer">
        <span>Blockchain Demo · 基于 Vue 3 + Vite 的区块链演示前端（区块浏览 · 挖矿 · P2P 网络）</span>
        <span class="mono">API: {{ state.baseUrl }}</span>
      </footer>
    </div>

    <BlockDetailModal />
    <Toasts />
  </div>
</template>
