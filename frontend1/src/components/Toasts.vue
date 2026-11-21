<script setup>
import IconBlock from './IconBlock.vue'
import { toasts, removeToast } from '../utils/toast'

const iconOf = { success: 'check', error: 'x', warn: 'alert', info: 'info' }
</script>

<template>
  <Teleport to="body">
    <div class="toasts">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="t.type"
          @click="removeToast(t.id)"
        >
          <span class="toast-icon"><IconBlock :name="iconOf[t.type] || 'info'" :size="16" /></span>
          <span class="toast-msg">{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
