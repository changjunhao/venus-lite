<script setup lang="ts">
/**
 * 评估页 Hero：eyebrow + h1 + 引言（DESIGN.md §6.2 Page Display / §10.2），
 * 对应 venus 三个评估页的 `.group-hero.work-hero`（single.html L44-50、
 * group-joint.html L41-47、group-compare.html L41-47），三页结构一致仅文案不同。
 *
 * - 三项均为 prop 而非 slot（component-plan L95 明确规定）：恒为单行/单段
 *   纯文本，先例同 CardHeading 的 `eyebrow`；title 必填，Hero 无标题不成立。
 * - 纯 props 组件不内嵌 $t()：文案由调用页面解析 i18n 后传入（同 CardHeading）。
 * - class 收敛为 `.page-hero`：venus 的 `.group-hero.work-hero` 双 class 属
 *   手写漂移（`.single-hero` 在 style.css 中无对应规则），先例同 SiteNav
 *   将 `.home-nav`/`.group-nav` 收敛为 `.site-nav`。
 */
const props = withDefaults(
  defineProps<{
    eyebrow?: string
    title: string
    lede?: string
  }>(),
  { eyebrow: '', lede: '' },
)
</script>

<template>
  <header class="page-hero">
    <div class="page-hero-copy">
      <p v-if="props.eyebrow" class="page-hero-eyebrow">{{ props.eyebrow }}</p>
      <h1>{{ props.title }}</h1>
      <p v-if="props.lede" class="page-hero-lede">{{ props.lede }}</p>
    </div>
  </header>
</template>

<style scoped>
/* venus style.css L541-563 逐属性对齐；padding-top 与 min-height 扣除
 * venus fixed 导航补偿（72px 桌面 / 64px 移动）——SiteNav sticky 化
 * （自占文档流）后照抄将产生 72px 多余空白。 */
.page-hero {
  align-items: flex-end;
  background: var(--paper);
  border-bottom: 1px solid var(--hairline);
  display: flex;
  min-height: 358px; /* venus 430px - 72px 导航 */
  overflow: hidden;
  padding: var(--space-8) max(32px, calc((100vw - 1280px) / 2)) var(--space-8);
  position: relative;
}

/* 右上装饰框线（venus .work-hero::before，top 72px → 0 随 sticky 适配） */
.page-hero::before {
  border-right: 1px solid var(--hairline);
  border-top: 1px solid var(--hairline);
  bottom: var(--space-8);
  content: "";
  pointer-events: none;
  position: absolute;
  right: max(32px, calc((100vw - 1280px) / 2));
  top: 0;
  width: min(30vw, 360px);
}

/* 文案区（copy = 编辑术语「文案」，非副本），贴源 venus .group-hero-copy */
.page-hero-copy {
  margin: 0 auto;
  position: relative;
  width: min(1280px, 100%);
  z-index: 1;
}

/* §6.2 Eyebrow：11px Mono、0.08em 字距；同 CardHeading > span（style.css L275-286），
 * amber 随 Paper/Darkroom token 自动切换。 */
.page-hero-eyebrow {
  color: var(--amber);
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.4;
  text-transform: uppercase;
}

/* §6.2 Page Display：clamp(40px, 5vw, 64px)/500/1.02（style.css L572-579）。
 * 颜色、display 字体、字重、text-wrap: balance 由 main.css 全局排版承担，不重复声明。 */
.page-hero h1 {
  font-size: clamp(40px, 5vw, 64px);
  letter-spacing: -0.045em;
  line-height: 1.02;
  margin-top: var(--space-3);
  max-width: 850px;
}

/* Hero 说明（style.css L580）：17px/1.75 沿用源值（§6.2 Body Lead 的实现漂移，贴源）；
 * 显式 class 替代 venus 的 `> p:last-child`，避免 lede 缺席时选择器歧义。 */
.page-hero-lede {
  color: var(--ink-body);
  font-size: 17px;
  line-height: 1.75;
  margin-top: var(--space-5);
  max-width: 660px;
  text-wrap: pretty;
}

/* venus style.css L1142-1145 逐属性对齐；同样扣除 64px 移动导航补偿。
 * 56px/20px/48px/100px/40px 均为 venus 源值贴源保留。 */
@media (max-width: 767px) {
  .page-hero {
    min-height: 296px; /* venus 360px - 64px 导航 */
    padding: 56px 20px 48px;
  }

  .page-hero::before {
    bottom: 40px;
    right: 20px;
    top: 32px; /* venus 96px - 64px 导航 */
    width: 100px;
  }

  .page-hero h1 {
    font-size: 40px;
  }

  .page-hero-lede {
    font-size: 16px;
  }
}
</style>
