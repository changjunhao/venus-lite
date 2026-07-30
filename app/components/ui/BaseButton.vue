<script setup lang="ts">
import { NuxtLink } from '#components'

/**
 * 基础按钮：Primary / Secondary 两个变体（DESIGN.md §9.1）。
 * 传入 `to` 时渲染为链接，否则渲染为 button。
 */
const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary'
    to?: string
    type?: 'button' | 'submit'
    disabled?: boolean
  }>(),
  { variant: 'primary', to: undefined, type: 'button', disabled: false },
)
</script>

<template>
  <NuxtLink v-if="props.to" :to="props.to" class="btn" :class="`btn-${props.variant}`">
    <slot />
  </NuxtLink>
  <button
    v-else
    :type="props.type"
    class="btn"
    :class="`btn-${props.variant}`"
    :disabled="props.disabled"
  >
    <slot />
  </button>
</template>
