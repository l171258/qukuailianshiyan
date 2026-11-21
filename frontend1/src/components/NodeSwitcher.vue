<script setup>
import { computed, onMounted, ref } from 'vue'
import IconBlock from './IconBlock.vue'
import { state, store, recentNodes, nodeStatus } from '../store/chain'
import { toast } from '../utils/toast'

const refreshing = ref(false)
const scanning = ref(false)
const newUrl = ref('')

const nodes = computed(() =>
  recentNodes.map((url) => ({
    url,
    label: String(url).replace(/^https?:\/\//i, ''),
    active: url === state.baseUrl,
    status: nodeStatus[url] || { state: 'unknown' },
  })),
)

onMounted(() => {
  store.probeAllNodes()
})

function switchTo(url) {
  if (url === state.baseUrl) return
  store.setBaseUrl(url) // 保存并立即拉取该节点的链数据
}

function addNode() {
  if (!newUrl.value.trim()) return
  if (store.addNode(newUrl.value)) newUrl.value = ''
}

/** 扫描 localhost:3001-3010，自动发现运行中的节点 */
async function scanNodes() {
  if (scanning.value) return
  scanning.value = true
  try {
    const found = await store.scanLocalNodes(3001, 3010)
    if (found.length) {
      toast(`发现 ${found.length} 个节点：${found.map((u) => u.replace(/^https?:\/\//i, '')).join('、')}`, 'success')
    } else {
      toast('本机 3001-3010 未发现可用节点，请确认后端已执行 api <端口>', 'warn')
    }
  } finally {
    scanning.value = false
  }
}

async function refreshNodes() {
  if (refreshing.value) return
  refreshing.value = true
  try {
    await Promise.all([store.probeAllNodes(), store.sync({ silent: true })])
    toast('节点状态已刷新', 'success')
  } finally {
    refreshing.value = false
  }
}
</script>

<template>
  <div class="card node-switcher">
    <div class="card-title">
      <span class="icon"><IconBlock name="share" :size="17" /></span>
      可用节点
      <span class="extra">
        <span class="chip">点击节点切换查看该节点的链</span>
        <button class="btn btn-ghost btn-sm" :disabled="scanning" title="扫描 localhost:3001-3010 自动发现节点" @click="scanNodes">
          <IconBlock :name="scanning ? 'refresh' : 'radio'" :size="13" :class="{ spinning: scanning }" />
          {{ scanning ? '扫描中…' : '扫描本机节点' }}
        </button>
        <button class="btn btn-ghost btn-sm" :disabled="refreshing" @click="refreshNodes">
          <IconBlock name="refresh" :size="13" :class="{ spinning: refreshing }" /> 刷新节点
        </button>
      </span>
    </div>

    <div class="node-chips">
      <button
        v-for="n in nodes"
        :key="n.url"
        type="button"
        class="node-card"
        :class="{ active: n.active, bad: n.status.state === 'error' }"
        :title="n.url"
        @click="switchTo(n.url)"
      >
        <span class="dot" :class="n.status.state === 'ok' ? 'ok' : n.status.state === 'error' ? 'error' : 'unknown'"></span>
        <span class="node-card-body">
          <span class="node-card-name">{{ n.label }}</span>
          <span class="node-card-sub">
            <template v-if="n.status.state === 'ok'">
              {{ n.status.blockCount ?? '—' }} 区块 · P2P {{ n.status.p2pPort ?? '未开启' }}
            </template>
            <template v-else-if="n.status.state === 'checking'">检查中…</template>
            <template v-else-if="n.status.state === 'error'">连接失败</template>
            <template v-else>点击切换查看</template>
          </span>
        </span>
        <span v-if="n.active" class="chip tone-cyan">当前节点</span>
      </button>
    </div>

    <div class="node-add-row">
      <input
        class="input"
        v-model="newUrl"
        placeholder="添加节点，例如 http://localhost:3002"
        @keyup.enter="addNode"
      />
      <button class="btn btn-primary btn-sm" @click="addNode">
        <IconBlock name="plus" :size="13" /> 添加节点
      </button>
    </div>

    <div class="node-switcher-hint">
      切换节点后，下方区块数据会更新为该节点的链；节点间通过 P2P 同步，正常情况下各节点链内容一致，
      区块数不同则说明该节点还未同步到最新区块。
    </div>
  </div>
</template>
