# 区块链演示平台（Frontend）

基于项目内已有 **Vue 3 + Vite** 框架实现的区块链演示前端，对接 `blockchaindemo` 后端，
展示后端输出的区块链内容与节点信息，并提供区块浏览、整链校验、挖矿、P2P 节点管理等完整功能。

## 功能一览

| 页面 | 功能 |
| --- | --- |
| 总览 | 节点信息（API/P2P 端口、区块数、难度、连接状态）、链上统计（链龄、平均出块间隔、平均 nonce）、最新区块、链条预览、快捷操作 |
| 区块链 | 全部区块数据浏览（倒序 + 增量加载）、搜索（索引/数据/哈希）、整链完整性校验（本地重算 SHA-256）、防篡改模拟演示、链结构总览、区块详情弹窗（含原始 JSON、前后链接校验）、**可用节点切换看链**（顶部节点列表显示各节点区块数/连接状态，可添加节点，一键切换查看对应节点的链） |
| 挖矿 | 挖矿控制台（工作量证明过程动画）、模板数据、挖矿结果、本次会话挖矿历史、挖矿流程说明 |
| 节点网络 | 本节点信息、P2P 网络拓扑图、添加对等节点、已连接节点列表、P2P 组网说明 |

其他能力：API 地址可配置（左下角「连接设置」）、**多节点快速切换**（自动记录最近连接的
后端地址，点击即可切换）、自动轮询刷新（间隔可调）、连接状态实时指示、哈希一键复制、
断连提示与重试、时间戳兼容（毫秒/秒自动识别，避免显示成 49765 年）。

## 目录结构

```
frontend/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.js                 # 入口
    ├── App.vue                 # 布局壳：侧边栏 + 顶栏 + 路由视图 + 弹窗/Toast
    ├── style.css               # 全局主题（深色科技风）
    ├── api/blockchain.js       # 后端 HTTP API 封装（原生 fetch，零额外依赖）
    ├── store/chain.js          # 全局状态：节点信息/区块/节点/轮询/挖矿/校验
    ├── router/index.js         # 轻量哈希路由
    ├── utils/
    │   ├── hash.js             # WebCrypto 重算 SHA-256 + 整链校验（与后端逻辑一致）
    │   ├── format.js           # 时间/哈希/时长格式化
    │   └── toast.js            # 轻量 Toast
    ├── components/             # 通用组件（图标/统计卡/哈希芯片/区块卡/链条可视化/详情弹窗…）
    └── views/                  # 页面：总览 / 区块链 / 挖矿 / 节点网络
```

## 快速开始

### 1. 启动后端（blockchaindemo）

```bash
cd ../blockchaindemo
npm start
```

进入交互式 CLI 后输入（保持后端原始用法，未做任何改动）：

```text
api 3001      # 启动 HTTP API（前端默认地址）
open 2727     # 可选：开启 P2P 监听端口，用于多节点组网
```

### 2. 启动前端

```bash
cd frontend
npm install            # 依赖已安装时可跳过
npm run dev            # 开发服务器，默认 http://localhost:5173
```

打开浏览器访问 <http://localhost:5173>。若后端 API 不在 `http://localhost:3001`，
点击左下角「连接设置」修改 API 地址即可（浏览器 localStorage 持久化）。

### 3. 构建产物

```bash
npm run build          # 输出到 dist/
npm run preview        # 本地预览构建产物
```

## 多节点演示（可选）

```bash
# 节点 A（终端 1）
cd blockchaindemo && npm start
#   api 3001
#   open 2727

# 节点 B（终端 2，同机演示时换端口）
cd blockchaindemo && npm start
#   api 3002
#   open 2728
```

在页面上把「连接设置」的 API 地址切到 `http://localhost:3001`，
进入「节点网络」页添加节点 `localhost:2728`；此时在「挖矿」页挖出的新区块
会自动广播给节点 B，切换 API 地址到 `http://localhost:3002` 即可看到链已同步。

## 后端 API 说明

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/blocks` | 整条区块链（含创世区块） |
| GET | `/peers` | 已连接节点列表 `["host:port"]` |
| GET | `/nodeInfo` | 节点信息 `{ p2pPort, apiPort, blockCount }` |
| POST | `/mineBlock` | 挖矿，body `{ "data": "…" }`，返回新区块 |
| POST | `/addPeer` | 连接节点，body `{ "peer": "host:port" }` |

> 说明：前端对后端零侵入，仅按上述接口读取/调用。`nodeInfo` 不含难度字段时前端按难度 3 处理；
> 原版 `/addPeer` 接口存在参数解析问题（把 `host:port` 整串当作 host），未修复前「节点网络」页的
> 「添加节点」会失败，属后端既有问题，与前端无关。

## 技术说明

- 无第三方运行时依赖（仅 Vue 3 + Vite），HTTP 使用原生 `fetch`，后端已开启 CORS；
- 整链校验在前端用 WebCrypto（SHA-256）按后端相同拼接规则重算所有哈希，
  检查难度前缀与前向链接，实现「链上内容可独立验证」；创世区块按后端 `isValidChain`
  的规则以整块一致进行校验；
- 明亮科技风 UI：玻璃拟态白色卡片、氛围光 + 网格背景、链条可视化、终端式挖矿动画，响应式布局。
