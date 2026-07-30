<script setup lang="ts">
import { NuxtLink } from '#components'

/**
 * 基础按钮：Primary / Secondary / Share / Text 四个变体（DESIGN.md §9.1）。
 * 传入 `to` 时渲染为链接，否则渲染为 button。
 *
 * - `loading` 只负责禁用与 `aria-busy` 语义，文案切换由调用方替换 slot 内容
 *   （对应 venus 中「单图评估中…」「正在生成…」的既有模式）。
 * - `disabled` / `loading` 仅在 button 模式生效：链接无原生 disabled 语义。
 */
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'share' | 'text'
    to?: string
    type?: 'button' | 'submit'
    disabled?: boolean
    loading?: boolean
  }>(),
  { variant: 'primary', to: undefined, type: 'button', disabled: false, loading: false },
)

// text 变体不属于 .btn 家族（venus .text-button），避免 .btn:disabled 灰底污染其透明度禁用态
const classes = computed(() =>
  props.variant === 'text' ? ['text-button'] : ['btn', `btn-${props.variant}`],
)
</script>

<template>
  <NuxtLink v-if="props.to" :to="props.to" :class="classes">
    <slot />
  </NuxtLink>
  <button
    v-else
    :type="props.type"
    :class="classes"
    :disabled="props.disabled || props.loading"
    :aria-busy="props.loading || undefined"
  >
    <slot />
  </button>
</template>

<style scoped>
/* §9.1：最小高度 44px，4px 圆角，动词开头文案 */
.btn {
  align-items: center;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  font-family: var(--font-ui);
  font-size: 16px;
  gap: var(--space-2);
  justify-content: center;
  min-height: 44px;
  padding: 0 20px;
  text-decoration: none;
  transition: background-color var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard),
    color var(--motion-fast) var(--ease-standard);
}

.btn-primary {
  background: var(--amber);
  color: var(--paper-raised);
}

.btn-primary:hover:not(:disabled) {
  background: var(--amber-hover);
}

.btn-secondary,
.btn-share {
  background: transparent;
  border-color: var(--hairline-strong);
  color: var(--ink);
}

.btn-secondary:hover:not(:disabled),
.btn-share:hover:not(:disabled) {
  background: var(--paper-recessed);
}

.btn:disabled {
  background: var(--paper-recessed);
  border-color: transparent;
  color: var(--ink-muted);
  cursor: not-allowed;
}

/* §9.1 Tertiary：无背景无边框，1px 底边表达 hover */
.text-button {
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--hairline-strong);
  color: var(--ink-body);
  cursor: pointer;
  font-family: var(--font-ui);
  font-size: 14px;
  min-height: 44px;
  padding: 0 10px;
  transition: border-color var(--motion-fast) var(--ease-standard),
    color var(--motion-fast) var(--ease-standard);
}

.text-button:hover:not(:disabled) {
  border-color: var(--oxide);
  color: var(--oxide);
}

.text-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
