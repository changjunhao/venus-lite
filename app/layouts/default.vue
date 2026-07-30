<script setup lang="ts">
// 导航变体由路由派生：三个评估页走 evaluation，其余（首页等）走 home。
// 评估页当前尚未创建，命中集为将来态，建页后零改动即生效。
const EVALUATION_PATHS = new Set(['/single', '/group-joint', '/group-compare'])

const route = useRoute()
const navVariant = computed(() => (EVALUATION_PATHS.has(route.path) ? 'evaluation' : 'home'))
</script>

<template>
  <div class="app-shell">
    <LayoutSiteNav :variant="navVariant" />

    <main class="site-main">
      <slot />
    </main>

    <footer class="site-footer">
      <div class="container">
        <p class="footer-text">{{ $t('layout.footer') }}</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.site-main {
  flex: 1;
}

.site-footer {
  border-top: 1px solid var(--hairline);
  margin-top: var(--space-9);
  padding-block: var(--space-6);
}

.footer-text {
  color: var(--ink-muted);
  font-size: 14px;
}
</style>
