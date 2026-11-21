// 格式化工具

const pad = (n) => String(n).padStart(2, '0')

/**
 * 统一成毫秒时间戳。
 * 后端时间戳是毫秒；这里兼容「秒」级写法（如 1508270000），
 * 避免其被误当毫秒 ×1000 后显示成 49765 年。
 */
function toMillis(ts) {
  const n = Number(ts)
  if (!Number.isFinite(n)) return null
  return n > 0 && n < 1e12 ? n * 1000 : n
}

/** 时间戳 -> "YYYY-MM-DD HH:mm:ss" */
export function formatTime(ts) {
  if (ts == null || ts === '') return '—'
  const ms = toMillis(ts)
  if (ms == null) return String(ts)
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return String(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 时间戳 -> "YYYY-MM-DD" */
export function formatDate(ts) {
  return formatTime(ts).slice(0, 10)
}

/** 相对时间："刚刚 / N 秒前 / N 分钟前 / N 小时前 / N 天前" */
export function relativeTime(ts) {
  if (ts == null) return '—'
  const ms = toMillis(ts)
  if (ms == null) return '—'
  const diff = Date.now() - ms
  if (diff < 0) return '刚刚'
  const sec = Math.floor(diff / 1000)
  if (sec < 5) return '刚刚'
  if (sec < 60) return `${sec} 秒前`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  return formatDate(ts)
}

/** 缩短哈希："000dc75a31…109b37cf" */
export function shortenHash(hash, head = 10, tail = 8) {
  if (!hash) return '—'
  const s = String(hash)
  if (s.length <= head + tail + 1) return s
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}

/** 时长格式化：ms -> "862 ms" / "1.42 s" / "2 分 13 秒" / "3 天 4 小时" */
export function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return '—'
  const v = Math.abs(Number(ms))
  if (v < 1000) return `${Math.round(v)} ms`
  const sec = v / 1000
  if (sec < 60) return `${sec.toFixed(2)} s`
  const min = Math.floor(sec / 60)
  const rest = Math.round(sec % 60)
  if (min < 60) return `${min} 分 ${rest} 秒`
  const hour = Math.floor(min / 60)
  const restMin = min % 60
  if (hour < 24) return `${hour} 小时 ${restMin} 分`
  const day = Math.floor(hour / 24)
  return `${day} 天 ${hour % 24} 小时`
}

/** 尝试将区块数据按 JSON 美化输出，否则原样返回 */
export function prettyData(data) {
  try {
    const obj = JSON.parse(String(data))
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(data)
  }
}
