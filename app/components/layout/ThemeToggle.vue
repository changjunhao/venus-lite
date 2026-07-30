<script setup lang="ts">
// 主题切换：图标 + 文字表达「纸面 / 暗房」，不使用品牌名称（DESIGN.md §9.4）
const { isDarkroom, toggle } = useTheme()
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-pressed="isDarkroom"
    :aria-label="isDarkroom ? '切换到纸面模式' : '切换到暗房模式'"
    :title="isDarkroom ? '当前为暗房模式' : '当前为纸面模式'"
    @click="toggle"
  >
    <span class="theme-icon" aria-hidden="true">{{ isDarkroom ? '●' : '◐' }}</span>
    <span class="theme-label">{{ isDarkroom ? '暗房' : '纸面' }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  align-items: center;
  background: transparent;
  border: 1px solid var(--hairline-strong);
  border-radius: var(--radius-sm);
  color: var(--ink);
  cursor: pointer;
  display: inline-flex;
  font-family: var(--font-ui);
  font-size: 14px;
  gap: var(--space-2);
  min-height: 44px;
  padding: 0 var(--space-3);
  transition: background-color var(--motion-fast) var(--ease-standard);
}

.theme-toggle:hover {
  background: var(--paper-recessed);
}

.theme-icon {
  font-size: 12px;
}
</style>
