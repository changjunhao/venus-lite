<script setup lang="ts">
// 主题切换：图标 + 文字表达「纸面 / 暗房」，不使用品牌名称（DESIGN.md §9.4）
// 两组文案同时渲染、由 CSS 按 html[data-theme] 三态选显（main.css），
// 使当前态在 hydration 之前即正确；display: none 会移出无障碍树，不会读到两份。
const { isDarkroom, toggle } = useTheme()
const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-pressed="isDarkroom"
    :aria-label="isDarkroom ? t('theme.toPaper') : t('theme.toDarkroom')"
    :title="isDarkroom ? t('theme.currentDarkroom') : t('theme.currentPaper')"
    @click="toggle"
  >
    <span class="theme-state theme-state-paper">
      <span class="theme-icon" aria-hidden="true">◐</span>
      <span class="theme-label">{{ t('theme.paper') }}</span>
    </span>
    <span class="theme-state theme-state-darkroom">
      <span class="theme-icon" aria-hidden="true">●</span>
      <span class="theme-label">{{ t('theme.darkroom') }}</span>
    </span>
  </button>
</template>

<style scoped>
/* §8.1：主题切换轨道用 --radius-full；字规取 §6.2 Caption/Data 档（500 12px）。
 * padding 依 §7.1 取间距梯度 12px，不照搬 venus 的 14px。 */
.theme-toggle {
  align-items: center;
  background: transparent;
  border: 1px solid var(--hairline-strong);
  border-radius: var(--radius-full);
  color: var(--ink);
  cursor: pointer;
  display: inline-flex;
  font: 500 12px/1 var(--font-ui);
  justify-content: center;
  min-height: 44px;
  min-width: 92px;
  padding: 0 var(--space-3);
  transition: background-color var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard);
}

.theme-toggle:hover {
  background: var(--paper-recessed);
  border-color: var(--amber);
}

.theme-icon {
  color: var(--amber);
  font-size: 14px;
}

/* 窄屏收敛为纯图标按钮（§13.1），触控目标保持 44×44；
 * 可访问名称由 aria-label 承担，隐藏 label 不影响无障碍。 */
@media (max-width: 767px) {
  .theme-toggle {
    height: 44px;
    min-width: 44px;
    padding: 0;
    width: 44px;
  }

  .theme-label {
    display: none;
  }
}
</style>
