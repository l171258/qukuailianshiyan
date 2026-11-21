// 轻量哈希路由（无 vue-router 依赖，URL 可定位、可前进后退）
import { reactive, computed } from 'vue'
import DashboardView from '../views/DashboardView.vue'
import ChainView from '../views/ChainView.vue'
import MineView from '../views/MineView.vue'
import PeersView from '../views/PeersView.vue'

export const routes = [
  { path: '/dashboard', name: 'dashboard', label: '总览', desc: '节点信息与链上数据一览', icon: 'grid', component: DashboardView },
  { path: '/chain', name: 'chain', label: '区块链', desc: '浏览区块数据与整链完整性校验', icon: 'layers', component: ChainView },
  { path: '/mine', name: 'mine', label: '挖矿', desc: '写入数据，通过工作量证明生成新区块', icon: 'pick', component: MineView },
  { path: '/peers', name: 'peers', label: '节点网络', desc: 'P2P 对等节点连接管理', icon: 'share', component: PeersView },
]

function normalizeHash() {
  const h = window.location.hash.replace(/^#/, '')
  return routes.some((r) => r.path === h) ? h : '/dashboard'
}

const current = reactive({ path: normalizeHash() })

export function go(path) {
  if (path !== current.path) window.location.hash = path
}

window.addEventListener('hashchange', () => {
  current.path = normalizeHash()
})

export const currentRoute = computed(() => routes.find((r) => r.path === current.path) || routes[0])
