<script setup lang="ts">
/**
 * 首页结尾 CTA 区块（DESIGN.md §10.1 结构 6「结尾 CTA」），
 * 对应 venus index.html L145-150 的 `section.home-cta`
 * （component-plan §2.3 首页展示域「底部 CTA」）。
 *
 * - 纯 props 组件不内嵌 $t()：文案由调用页面解析 i18n 后传入
 *   （先例 HomeHero / ModeCardGrid / ProcessSection / ResultSample）。
 * - 锚点 id 不写在组件内（页面信息架构归页面）：调用方经 attrs 传入即可；
 *   h2 的 id 用 useId() 生成，仅供 aria-labelledby 使用（先例 ProcessSection）。
 * - CTA 不复用 BaseButton：venus `.home-primary-link`（48px / 600 14px /
 *   gap 22px / hover 上浮）与 `.btn-primary`（44px / 16px）规格不同，且
 *   component-plan §2.2 的 BaseButton 来源映射（.btn / .text-button /
 *   .btn-share）不含 Hero 链接，贴源保留为 scoped NuxtLink（先例 HomeHero）。
 * - 纯静态 SSR 内容：无状态、无 watcher，客户端零额外开销。
 */
const props = withDefaults(
  defineProps<{
    /** 章节眉标（`READY`）；为空时不渲染 */
    eyebrow?: string
    /** 章节标题，同时是 aria-labelledby 的目标故必填（先例 ProcessSection） */
    title: string
    /** 说明文案；为空时不渲染 */
    lede?: string
    /** CTA 链接文案；为空时不渲染链接 */
    ctaLabel?: string
    /** CTA 目标路由 */
    ctaTo?: string
  }>(),
  { eyebrow: '', lede: '', ctaLabel: '', ctaTo: '/single' },
)

// SSR 水合安全的 id，仅用于 section 的 aria-labelledby
const titleId = useId()
</script>

<template>
  <section class="home-cta" :aria-labelledby="titleId">
    <UiBaseSectionIndex v-if="props.eyebrow">{{ props.eyebrow }}</UiBaseSectionIndex>
    <h2 :id="titleId">{{ props.title }}</h2>
    <p v-if="props.lede">{{ props.lede }}</p>
    <NuxtLink v-if="props.ctaLabel" class="home-primary-link" :to="props.ctaTo">
      {{ props.ctaLabel }} <span aria-hidden="true">→</span>
    </NuxtLink>
  </section>
</template>

<style scoped>
/* venus style.css L526 逐属性对齐。width/margin-inline 不搬——由页面根节点
 * .container 承担（先例 ModeCardGrid / ProcessSection / ResultSample） */
.home-cta {
  border-top: 1px solid var(--hairline);
  padding: var(--space-9) 0;
  text-align: center;
}

/* §6.2 Section Display，与 ProcessSection / ResultSample 的 h2 同源
 * （style.css L431-439）；text-wrap: balance 由 main.css 全局承担，不重复声明 */
.home-cta h2 {
  font-size: clamp(32px, 3.6vw, 48px);
  letter-spacing: -0.03em;
  line-height: 1.12;
  margin-top: var(--space-3);
}

/* style.css L527：max-width 42rem 由 main.css 全局 p 承担，auto 水平 margin 居中 */
.home-cta p {
  color: var(--ink-muted);
  margin: var(--space-4) auto var(--space-6);
}

/* 主 CTA（style.css L319-334）：与 HomeHero 同规格贴源（先例 HomeHero）；
 * gap 22px / padding 0 20px 不在 §7.1 梯度内，贴源保留 */
.home-primary-link {
  align-items: center;
  background: var(--amber);
  border: 1px solid var(--amber);
  border-radius: var(--radius-sm);
  color: var(--paper-raised);
  display: inline-flex;
  font: 600 14px/1 var(--font-ui);
  gap: 22px;
  justify-content: center;
  min-height: 48px;
  padding: 0 20px;
  text-decoration: none;
  transition: transform var(--motion-fast) var(--ease-standard),
    background var(--motion-fast) var(--ease-standard);
}

.home-primary-link:hover {
  background: var(--amber-hover);
  transform: translateY(-1px);
}

/* venus style.css L1131：64px → space-8（§7.1 梯度同值）；
 * L1126：移动端主 CTA 全宽（§13.1 按钮组折叠策略） */
@media (max-width: 767px) {
  .home-cta {
    padding-block: var(--space-8);
  }

  .home-primary-link {
    width: 100%;
  }
}

/* venus style.css L1184 */
@media (max-width: 479px) {
  .home-cta h2 {
    font-size: 32px;
  }
}
</style>
