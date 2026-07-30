<script setup lang="ts">
// 语言切换：中英双语二态互切（对照 ThemeToggle 的 pill 形态，DESIGN.md §8.1 / §9.4）。
// setLocale 内置写 venus-locale cookie 并热切换消息，SSR 下次请求即读到偏好。
const { locale, t, setLocale } = useI18n()

function toggle() {
  setLocale(locale.value === 'zh' ? 'en' : 'zh')
}
</script>

<template>
  <button
    type="button"
    class="locale-toggle"
    :aria-label="t('locale.switchTo')"
    :title="t('locale.switchTo')"
    @click="toggle"
  >
    <span class="locale-icon" aria-hidden="true">文</span>
    <span class="locale-label">{{ t('locale.label') }}</span>
  </button>
</template>

<style scoped>
/* 与 ThemeToggle 同一控件家族：--radius-full 轨道、500 12px 字规、44px 触控目标 */
.locale-toggle {
  align-items: center;
  background: transparent;
  border: 1px solid var(--hairline-strong);
  border-radius: var(--radius-full);
  color: var(--ink);
  cursor: pointer;
  display: inline-flex;
  font: 500 12px/1 var(--font-ui);
  gap: var(--space-2);
  justify-content: center;
  min-height: 44px;
  min-width: 72px;
  padding: 0 var(--space-3);
  transition: background-color var(--motion-fast) var(--ease-standard),
    border-color var(--motion-fast) var(--ease-standard);
}

.locale-toggle:hover {
  background: var(--paper-recessed);
  border-color: var(--amber);
}

.locale-icon {
  color: var(--amber);
  font-size: 14px;
}

/* 窄屏收敛为纯图标按钮（§13.1），可访问名称由 aria-label 承担 */
@media (max-width: 767px) {
  .locale-toggle {
    height: 44px;
    min-width: 44px;
    padding: 0;
    width: 44px;
  }

  .locale-label {
    display: none;
  }
}
</style>
