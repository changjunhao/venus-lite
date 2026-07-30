<template>
  <div class="app-shell">
    <header class="site-header">
      <div class="container header-inner">
        <NuxtLink to="/" class="brand" aria-label="Venus Lite 首页">
          <span class="brand-mark" aria-hidden="true">✦</span>
          <span class="brand-name">VENUS LITE</span>
        </NuxtLink>

        <nav class="site-nav" aria-label="主导航">
          <NuxtLink to="/" class="nav-link">首页</NuxtLink>
        </nav>

        <LayoutThemeToggle />
      </div>
    </header>

    <main class="site-main">
      <slot />
    </main>

    <footer class="site-footer">
      <div class="container">
        <p class="footer-text">Venus Lite · Nuxt 4 架构骨架</p>
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

/* 固定导航：移动端 64px / 桌面 72px，94% 不透明 + 模糊（DESIGN.md §7.3） */
.site-header {
  backdrop-filter: blur(12px);
  background: color-mix(in srgb, var(--paper) 94%, transparent);
  border-bottom: 1px solid var(--hairline);
  box-shadow: var(--shadow-nav);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-inner {
  align-items: center;
  display: flex;
  gap: var(--space-5);
  height: 64px;
}

@media (min-width: 768px) {
  .header-inner {
    height: 72px;
  }
}

.brand {
  align-items: center;
  color: var(--ink);
  display: inline-flex;
  gap: var(--space-2);
  text-decoration: none;
}

.brand-mark {
  color: var(--amber);
  font-size: 18px;
}

.brand-name {
  font-family: var(--font-data);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.site-nav {
  display: flex;
  flex: 1;
  gap: var(--space-4);
}

/* 当前页：文字色 + 1px 下划线 + aria-current（NuxtLink 自动附加） */
.nav-link {
  border-bottom: 1px solid transparent;
  color: var(--ink-body);
  padding: var(--space-2) 0;
  text-decoration: none;
  transition: color var(--motion-fast) var(--ease-standard);
}

.nav-link:hover {
  color: var(--ink);
}

.nav-link.router-link-exact-active {
  border-bottom-color: var(--ink);
  color: var(--ink);
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
