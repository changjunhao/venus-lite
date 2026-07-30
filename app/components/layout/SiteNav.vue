<script setup lang="ts">
/**
 * 统一导航壳（DESIGN.md §7.3），对应 venus 两种导航变体：
 * - home：首页锚点导航（index.html L28-42 `.home-nav`）；
 * - evaluation：三模式路由导航（single/group-joint/group-compare.html L29-42 `.group-nav`），
 *   `aria-current="page"` 由 NuxtLink 对精确激活路由自动附加，无需 useRoute 派生。
 *
 * - StarMark 两变体统一用默认 22：venus 的 24/22 分歧属手写 HTML 漂移，
 *   §4.1 只约束「导航推荐 22–24px」区间，组件化后收敛为一个值。
 * - 品牌 aria-label 恒存在：移动端 brand-name 会 display:none（§13.1），
 *   无 aria-label 的链接将失去可访问名称。
 * - 右侧控件组在 StarMark + ThemeToggle 之上纳入 LocaleToggle：
 *   venus-lite 是双语项目（venus 不是），component-plan 的组合按下限理解。
 */
const props = defineProps<{
  variant: 'home' | 'evaluation'
}>()

const { t } = useI18n()

// 导航项数据驱动（i18n key 而非文案，语言切换即时生效）
const HOME_LINKS = [
  { href: '#modes', labelKey: 'nav.anchorModes' },
  { href: '#process', labelKey: 'nav.anchorProcess' },
  { href: '#sample', labelKey: 'nav.anchorSample' },
] as const

const EVALUATION_LINKS = [
  { to: '/single', labelKey: 'nav.modeSingle' },
  { to: '/group-joint', labelKey: 'nav.modeJoint' },
  { to: '/group-compare', labelKey: 'nav.modeCompare' },
] as const

const isHome = computed(() => props.variant === 'home')
</script>

<template>
  <nav class="site-nav" :aria-label="isHome ? t('nav.homeAria') : t('nav.modesAria')">
    <NuxtLink
      to="/"
      class="nav-brand"
      :aria-label="isHome ? t('nav.brandHomeAria') : t('nav.brandBackAria')"
    >
      <UiStarMark />
      <span class="nav-brand-name">VENUS</span>
    </NuxtLink>

    <div class="nav-links">
      <!-- home：纯锚点不走路由；evaluation：NuxtLink，aria-current 自动 -->
      <template v-if="isHome">
        <a v-for="link in HOME_LINKS" :key="link.href" :href="link.href">
          {{ t(link.labelKey) }}
        </a>
      </template>
      <template v-else>
        <NuxtLink v-for="link in EVALUATION_LINKS" :key="link.to" :to="link.to">
          {{ t(link.labelKey) }}
        </NuxtLink>
      </template>
    </div>

    <div class="nav-actions">
      <LayoutThemeToggle />
      <LayoutLocaleToggle />
    </div>
  </nav>
</template>

<style scoped>
/* venus style.css L152-175 逐属性对齐。
 * sticky 替代 venus 的 fixed：组件自占文档流，无需 body padding 补偿、无 CLS，
 * 视觉效果等同 §7.3「固定顶部」；z-index 1000 对齐 BaseModal(2000) 的分层假设。 */
.site-nav {
  align-items: center;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: color-mix(in srgb, var(--paper) 94%, transparent);
  border-bottom: 1px solid var(--hairline);
  box-shadow: var(--shadow-nav);
  display: grid;
  gap: var(--space-5);
  grid-template-columns: minmax(128px, 1fr) auto minmax(128px, 1fr);
  min-height: 72px;
  padding: 0 max(24px, calc((100vw - 1440px) / 2));
  position: sticky;
  top: 0;
  z-index: 1000;
}

/* 品牌：星芒 + VENUS 字标成组（§4.1），星芒 amber 由父级 color 控制 */
.nav-brand {
  align-items: center;
  color: var(--ink);
  display: inline-flex;
  font: 600 13px/1 var(--font-data);
  gap: 10px;
  letter-spacing: 0.14em;
  text-decoration: none;
  width: fit-content;
}

.nav-brand svg {
  color: var(--amber);
}

.nav-links {
  align-items: center;
  display: flex;
  gap: var(--space-5);
  justify-content: center;
  min-width: 0;
}

.nav-links a {
  color: var(--ink-muted);
  font: 500 13px/1.2 var(--font-ui);
  padding: 24px 0 22px;
  position: relative;
  text-decoration: none;
  transition: color var(--motion-standard) var(--ease-standard);
  white-space: nowrap;
}

/* 当前项下划线：1px amber 横向展开 180ms（§12.3）；
 * 当前页三重信号 = 文字色 + 下划线 + aria-current（§7.3，NuxtLink 自动写入） */
.nav-links a::after {
  background: var(--amber);
  bottom: -1px;
  content: "";
  height: 1px;
  left: 0;
  position: absolute;
  right: 0;
  transform: scaleX(0);
  transform-origin: right;
  transition: transform var(--motion-standard) var(--ease-standard);
}

.nav-links a:hover,
.nav-links a:focus-visible,
.nav-links a[aria-current="page"] {
  color: var(--ink);
}

.nav-links a:hover::after,
.nav-links a:focus-visible::after,
.nav-links a[aria-current="page"]::after {
  transform: scaleX(1);
  transform-origin: left;
}

.nav-actions {
  display: flex;
  gap: var(--space-3);
  justify-self: end;
}

@media (max-width: 1023px) {
  .site-nav {
    grid-template-columns: auto minmax(0, 1fr) auto;
    padding-inline: 32px;
  }
}

/* §13.1 折叠：品牌只留星芒、模式链接横向滚动隐藏滚动条 + 两侧淡出；
 * ThemeToggle / LocaleToggle 自带窄屏收敛为 44px 图标，无需处理 */
@media (max-width: 767px) {
  .site-nav {
    gap: 12px;
    min-height: 64px;
    padding-inline: 20px;
  }

  .nav-brand-name {
    display: none;
  }

  .nav-links {
    gap: 18px;
    justify-content: flex-start;
    mask-image: linear-gradient(90deg, transparent, #000 14px, #000 calc(100% - 14px), transparent);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .nav-links::-webkit-scrollbar {
    display: none;
  }

  .nav-links a {
    font-size: 12px;
    padding-block: 21px 19px;
  }
}
</style>
