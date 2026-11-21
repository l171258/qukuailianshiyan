<script setup>
import { computed } from 'vue'
import IconBlock from './IconBlock.vue'
import { shortenHash } from '../utils/format'
import { toast } from '../utils/toast'

const props = defineProps({
  value: { type: String, default: '' },
  label: { type: String, default: '' },
  short: { type: Boolean, default: true },
})

const shown = computed(() => (props.short ? shortenHash(props.value) : props.value))

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
  } catch {
    // 兼容非安全上下文
    const ta = document.createElement('textarea')
    ta.value = props.value
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch { /* ignore */ }
    ta.remove()
  }
  toast('已复制到剪贴板', 'success')
}
</script>

<template>
  <div class="hash-chip" :title="value">
    <span v-if="label" class="hash-label">{{ label }}</span>
    <code class="hash-value">{{ shown }}</code>
    <button class="hash-copy" type="button" @click.stop="copy" title="复制完整哈希">
      <IconBlock name="copy" :size="13" />
    </button>
  </div>
</template>
