// 全局状态（无第三方依赖的响应式单例 store）
import { reactive, computed } from 'vue'
import { api, probeNode, getBaseUrl, setBaseUrl as persistBase } from '../api/blockchain'
import { verifyChain } from '../utils/hash'
import { toast } from '../utils/toast'

const state = reactive({
  baseUrl: getBaseUrl(),
  connection: 'unknown', // unknown | ok | error
  connectError: '',
  nodeInfo: null,        // { p2pPort, apiPort, blockCount, difficulty }
  blocks: [],            // 区块数组（按索引升序，含创世区块）
  peers: [],             // 已连接节点 ["host:port"]
  loading: false,        // 首次加载/手动刷新
  syncing: false,        // 防重入标记
  lastSync: null,
  autoRefresh: localStorage.getItem('bc-auto') !== '0',
  intervalSec: Math.min(60, Math.max(2, Number(localStorage.getItem('bc-interval')) || 5)),
  mining: false,
  mineHistory: [],       // 本次会话的挖矿记录
  detailBlock: null,     // 区块详情弹窗: { block, prev, next }
  verification: null,    // 最近一次整链校验结果 { valid, results, count, at }
  verifying: false,
  peerError: '',         // 最近一次添加节点失败的原因（用于页面提示）
})

let pollTimer = null

/* ---------- 最近节点（多节点快速切换） ---------- */
const MAX_RECENT_NODES = 6
function loadRecentNodes() {
  try {
    const list = JSON.parse(localStorage.getItem('bc-recent-nodes') || '[]')
    return Array.isArray(list) ? list.filter((u) => typeof u === 'string' && u) : []
  } catch {
    return []
  }
}
const recentNodes = reactive(loadRecentNodes())
if (!recentNodes.includes(state.baseUrl)) recentNodes.unshift(state.baseUrl)
if (recentNodes.length > MAX_RECENT_NODES) recentNodes.splice(MAX_RECENT_NODES)

/** 记录成功连接的节点，最多保留 MAX_RECENT_NODES 个 */
function rememberNode(url) {
  const idx = recentNodes.indexOf(url)
  if (idx > -1) recentNodes.splice(idx, 1)
  recentNodes.unshift(url)
  if (recentNodes.length > MAX_RECENT_NODES) recentNodes.length = MAX_RECENT_NODES
  localStorage.setItem('bc-recent-nodes', JSON.stringify([...recentNodes]))
}

/* ---------- 各节点状态（可用节点列表 / 多节点切换看链） ---------- */
const nodeStatus = reactive({}) // url -> { state: 'checking'|'ok'|'error', blockCount, p2pPort, apiPort, error, checkedAt }

function setNodeStatus(url, patch) {
  nodeStatus[url] = { ...(nodeStatus[url] || {}), ...patch, checkedAt: Date.now() }
}

/** 并行探测所有最近节点的状态与区块数，不改动当前连接 */
async function probeAllNodes() {
  const urls = [...recentNodes]
  urls.forEach((u) => setNodeStatus(u, { state: 'checking' }))
  await Promise.all(
    urls.map(async (u) => {
      const r = await probeNode(u)
      if (r.ok) {
        setNodeStatus(u, {
          state: 'ok',
          blockCount: r.info?.blockCount ?? null,
          p2pPort: r.info?.p2pPort ?? null,
          apiPort: r.info?.apiPort ?? null,
          error: '',
        })
      } else {
        setNodeStatus(u, { state: 'error', error: r.error || '连接失败' })
      }
    }),
  )
}

/** 规范化节点地址：纯端口补 localhost，缺协议补 http，去尾部斜杠 */
function normalizeNodeUrl(raw) {
  let s = String(raw || '').trim()
  if (!s) return ''
  if (/^\d+$/.test(s)) s = `http://localhost:${s}`
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`
  s = s.replace(/\/+$/, '')
  try {
    // eslint-disable-next-line no-new
    new URL(s)
    return s
  } catch {
    return ''
  }
}

/** 把节点加入可用列表（不切换），随后探测其状态 */
function addNode(raw) {
  const clean = normalizeNodeUrl(raw)
  if (!clean) {
    toast('节点地址格式不正确，例如 http://localhost:3002', 'error')
    return false
  }
  if (recentNodes.includes(clean)) {
    toast('该节点已在可用列表中', 'info')
    return true
  }
  recentNodes.unshift(clean)
  if (recentNodes.length > MAX_RECENT_NODES) recentNodes.length = MAX_RECENT_NODES
  localStorage.setItem('bc-recent-nodes', JSON.stringify([...recentNodes]))
  toast(`已添加节点 ${clean.replace(/^https?:\/\//i, '')}`, 'success')
  probeAllNodes()
  return true
}

/**
 * 扫描本机端口段，自动发现运行中的区块链 API 节点（类似老师页面的「可用节点」）。
 * 探测标准：/nodeInfo 返回带 blockCount 的 JSON。
 */
async function scanLocalNodes(start = 3001, end = 3010) {
  const ports = []
  for (let p = start; p <= end; p++) ports.push(p)
  const found = []
  await Promise.all(
    ports.map(async (p) => {
      const url = `http://localhost:${p}`
      if (recentNodes.includes(url)) return
      const r = await probeNode(url, 1200)
      if (r.ok && r.info && typeof r.info.blockCount === 'number') {
        found.push({ url, info: r.info })
      }
    }),
  )
  found.sort((a, b) => Number(new URL(a.url).port) - Number(new URL(b.url).port))
  for (const f of found) {
    recentNodes.push(f.url)
    setNodeStatus(f.url, {
      state: 'ok',
      blockCount: f.info.blockCount,
      p2pPort: f.info.p2pPort ?? null,
      apiPort: f.info.apiPort ?? null,
      error: '',
    })
  }
  if (recentNodes.length > MAX_RECENT_NODES) recentNodes.length = MAX_RECENT_NODES
  localStorage.setItem('bc-recent-nodes', JSON.stringify([...recentNodes]))
  return found.map((f) => f.url)
}

const latestBlock = computed(() => state.blocks[state.blocks.length - 1] || null)
const difficulty = computed(() => state.nodeInfo?.difficulty ?? 3)
const chainHeight = computed(() => latestBlock.value?.index ?? 0)
const blockCount = computed(() => state.nodeInfo?.blockCount ?? state.blocks.length)

/** 拉取全部数据（节点信息 + 区块 + 节点列表） */
async function sync({ silent = false } = {}) {
  if (state.syncing) return
  state.syncing = true
  if (!silent) state.loading = true
  try {
    const [blocks, peers, nodeInfo] = await Promise.allSettled([
      api.getBlocks(), api.getPeers(), api.getNodeInfo(),
    ])
    if (nodeInfo.status === 'fulfilled') {
      state.nodeInfo = nodeInfo.value || {}
      state.connection = 'ok'
      state.connectError = ''
      rememberNode(state.baseUrl)
      setNodeStatus(state.baseUrl, {
        state: 'ok',
        blockCount: nodeInfo.value?.blockCount ?? null,
        p2pPort: nodeInfo.value?.p2pPort ?? null,
        apiPort: nodeInfo.value?.apiPort ?? null,
        error: '',
      })
    } else {
      state.connection = 'error'
      state.connectError = String(nodeInfo.reason?.message || '无法连接后端 API')
      setNodeStatus(state.baseUrl, { state: 'error', error: state.connectError })
    }
    if (blocks.status === 'fulfilled' && Array.isArray(blocks.value)) state.blocks = blocks.value
    if (peers.status === 'fulfilled' && Array.isArray(peers.value)) state.peers = peers.value
    state.lastSync = Date.now()
  } catch (err) {
    state.connection = 'error'
    state.connectError = String(err?.message || err)
  } finally {
    state.syncing = false
    state.loading = false
  }
}

/** 挖矿：提交数据，成功后刷新数据。返回新区块或 null */
async function mine(data) {
  if (state.mining) return null
  state.mining = true
  const t0 = performance.now()
  try {
    const block = await api.mineBlock(data)
    const duration = Math.round(performance.now() - t0)
    state.mineHistory.unshift({ data, block, duration, at: Date.now() })
    if (state.mineHistory.length > 20) state.mineHistory.pop()
    await sync({ silent: true })
    toast(`挖矿成功：新区块 #${block.index} 已上链并广播`, 'success')
    return block
  } catch (err) {
    toast(`挖矿失败：${err.message}`, 'error')
    return null
  } finally {
    state.mining = false
  }
}

/** 添加对等节点 */
async function addPeer(host, port) {
  const h = String(host || '').trim()
  const p = Number(port)
  if (!h) { toast('请输入节点地址（host）', 'error'); return false }
  if (!Number.isInteger(p) || p <= 0 || p > 65535) { toast('端口号无效（1-65535）', 'error'); return false }
  try {
    await api.addPeer(h, p)
    state.peerError = ''
    toast(`已向节点 ${h}:${p} 发起连接`, 'success')
    await sync({ silent: true })
    return true
  } catch (err) {
    const msg = String(err?.message || err)
    // 后端原版 /addPeer 把整串 "host:port" 当成 host，导致 net.connect 缺少 port
    const friendly = /ERR_MISSING_ARGS|argument must be specified|Socket\.connect/i.test(msg)
      ? '后端原版 /addPeer 接口存在主机端口拆分问题（ERR_MISSING_ARGS）。请改用命令行连接：在该节点终端执行 connect localhost <对方 P2P 端口>'
      : msg
    state.peerError = friendly
    toast(`连接节点失败：${friendly}`, 'error')
    return false
  }
}

/** 整链校验（本地重算所有哈希） */
async function verify() {
  if (state.verifying || !state.blocks.length) return state.verification
  state.verifying = true
  try {
    const res = await verifyChain(state.blocks, difficulty.value)
    state.verification = { ...res, count: res.results.length, at: Date.now() }
    return state.verification
  } finally {
    state.verifying = false
  }
}

/** 修改并保存 API 地址，随后重新同步 */
function setBaseUrl(url) {
  const clean = String(url || '').trim().replace(/\/+$/, '')
  if (!clean || !/^https?:\/\//i.test(clean)) {
    toast('请输入合法的 API 地址，例如 http://localhost:3001', 'error')
    return
  }
  persistBase(clean)
  state.baseUrl = clean
  rememberNode(clean)
  toast(`API 地址已保存：${clean}`, 'success')
  sync()
}

/** 轮询 */
function startPolling() {
  stopPolling()
  if (!state.autoRefresh) return
  pollTimer = setInterval(() => sync({ silent: true }), state.intervalSec * 1000)
}
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}
function setAutoRefresh(on) {
  state.autoRefresh = !!on
  localStorage.setItem('bc-auto', on ? '1' : '0')
  startPolling()
}
function setIntervalSec(sec) {
  state.intervalSec = Math.min(60, Math.max(2, Number(sec) || 5))
  localStorage.setItem('bc-interval', String(state.intervalSec))
  if (state.autoRefresh) startPolling()
}

/** 区块详情弹窗 */
function openDetail(block) {
  const idx = state.blocks.findIndex((b) => b === block || b.index === block.index)
  if (idx < 0) return
  state.detailBlock = {
    block: state.blocks[idx],
    prev: idx > 0 ? state.blocks[idx - 1] : null,
    next: idx < state.blocks.length - 1 ? state.blocks[idx + 1] : null,
  }
}
function closeDetail() { state.detailBlock = null }
function clearMineHistory() { state.mineHistory.length = 0 }

export const store = {
  sync, mine, addPeer, verify, setBaseUrl,
  startPolling, stopPolling, setAutoRefresh, setIntervalSec,
  openDetail, closeDetail, clearMineHistory,
  probeAllNodes, addNode, scanLocalNodes,
}
export { state, latestBlock, difficulty, chainHeight, blockCount, recentNodes, nodeStatus }
