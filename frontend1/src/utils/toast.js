// 轻量 Toast 通知
import { reactive } from 'vue'

export const toasts = reactive([])
let seq = 0

export function toast(message, type = 'info', duration = 3200) {
  const id = ++seq
  toasts.push({ id, message, type })
  if (toasts.length > 5) toasts.splice(0, toasts.length - 5)
  setTimeout(() => removeToast(id), duration)
}

export function removeToast(id) {
  const i = toasts.findIndex((t) => t.id === id)
  if (i > -1) toasts.splice(i, 1)
}
