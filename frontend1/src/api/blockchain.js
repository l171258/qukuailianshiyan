// 后端 HTTP API 封装
// 后端启动方式：
//   1) blockchaindemo 目录下执行 `npm run api`（或 `node server.js 3001 2727`）
//   2) `npm start` 进入 CLI 后执行 `api 3001`
const DEFAULT_BASE = 'http://localhost:3001'
const STORAGE_KEY = 'bc-api-base'

let baseUrl = (localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE).replace(/\/+$/, '')

export function getBaseUrl() {
  return baseUrl
}

export function setBaseUrl(url) {
  const clean = String(url || '').trim().replace(/\/+$/, '')
  baseUrl = clean || DEFAULT_BASE
  localStorage.setItem(STORAGE_KEY, baseUrl)
}

/** 把后端返回的 HTML 错误页转成简短可读信息 */
function extractErrorText(data, status) {
  const raw = typeof data === 'string' ? data : ''
  if (!raw) return `HTTP ${status}`
  const pre = raw.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)
  if (pre) {
    return pre[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim()
      .split('\n')[0]
  }
  if (/<html|<!doctype/i.test(raw)) return `HTTP ${status}（后端返回了错误页面）`
  return raw.length > 140 ? `${raw.slice(0, 140)}…` : raw
}

async function request(path, options = {}) {
  const { timeout = 15000, headers, body, ...rest } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(baseUrl + path, {
      ...rest,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const text = await res.text()
    let data = null
    if (text) {
      try { data = JSON.parse(text) } catch { data = text }
    }
    if (!res.ok) {
      throw new Error(extractErrorText(data, res.status))
    }
    return data
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error(`请求超时（${Math.round(timeout / 1000)}s）：${baseUrl}${path}`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  /** 获取整条区块链（含创世区块） */
  getBlocks: () => request('/blocks'),
  /** 获取已连接节点列表 ["host:port"] */
  getPeers: () => request('/peers'),
  /** 获取本节点信息 { p2pPort, apiPort, blockCount, difficulty } */
  getNodeInfo: () => request('/nodeInfo'),
  /** 挖矿：写入 data 并生成新区块（工作量证明），返回新区块 */
  mineBlock: (data) => request('/mineBlock', { method: 'POST', body: { data }, timeout: 60000 }),
  /** 连接对等节点 */
  addPeer: (host, port) => request('/addPeer', { method: 'POST', body: { peer: `${host}:${port}` } }),
}

/**
 * 探测任意节点的可用性（多节点切换用）。
 * 不切换当前 baseUrl，直接请求指定地址的 /nodeInfo。
 */
export async function probeNode(url, timeout = 4000) {
  const clean = String(url || '').trim().replace(/\/+$/, '')
  if (!clean) return { ok: false, error: '地址为空' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(`${clean}/nodeInfo`, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const info = await res.json()
    return { ok: true, info }
  } catch (err) {
    return { ok: false, error: err && err.name === 'AbortError' ? '请求超时' : String(err?.message || err) }
  } finally {
    clearTimeout(timer)
  }
}
