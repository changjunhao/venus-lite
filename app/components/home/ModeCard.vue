<script lang="ts">
/** 视觉区单图；width/height 为原始像素尺寸，绑定 img 以防 CLS */
export interface ModeVisual {
  src: string
  width?: number
  height?: number
}

/** 单张模式卡数据；label 为品牌 mono 恒英文不入 i18n（先例 ContactSheetFrame.caption） */
export interface ModeCardItem {
  label: string
  title: string
  description?: string
  ctaLabel: string
  to: string
  layout: 'single' | 'series' | 'compare'
  visuals: ModeVisual[]
  /** §10.1「当前默认推荐可以使用深色反相表面」：推荐位是语义而非顺序，故显式传入 */
  featured?: boolean
}
</script>

<script setup lang="ts">
/**
 * 首页单张评估模式卡（DESIGN.md §10.1 模式卡：编号、模式名、适用问题、结果与入口），
 * 对应 venus index.html L86-110 的 `a.home-mode-card`，
 * 由 ModeCardGrid 编排消费（component-plan §2.3 首页展示域）。
 *
 * - 纯 props 组件不内嵌 $t()：文案由调用页面解析 i18n 后传入
 *   （先例 HomeHero / HomeContactSheet）。
 * - `number` 由 ModeCardGrid 按顺序派生后传入（§4.2 编号只用于真实存在的可数对象），
 *   本组件只负责呈现。
 * - 视觉区默认按 `visuals` 渲染装饰图，`visual` 插槽提供时整体替换
 *   （component-plan「多图视觉区 slot」）；容器 aria-hidden + img alt=""（§14.4）。
 * - img 加 loading="lazy"：模式卡位于首屏之下（Hero min-height 达 828px），
 *   与 HomeContactSheet「三帧均为首屏故不加 lazy」互补。
 * - CTA 不复用 BaseButton：venus 源是卡片链接内的 `<strong>` 文本记号，改用按钮会在
 *   链接内嵌套可交互元素（§14.2）；同 HomeHero 拒用 BaseButton 的理由。
 * - 不复用 BaseCard：其 panel 变体的 paper-raised + radius-md 恰是 §10.1
 *   「不使用三张浮空 SaaS 卡片」所禁止的表达，plain 变体又只提供 min-width: 0。
 * - 内容区用显式 `.home-mode-body` 取代 venus 的 `> div:nth-of-type(3)`
 *   （style.css L1088 / L1136）：nth-of-type 依赖子元素顺序，组件化后易静默错位。
 * - NuxtLink 走 Nuxt 全局注册而非 HomeHero 式的 `#components` 显式导入：本组件的
 *   类型导出块在前，setup 内再 import 会触发 eslint `import/first`。
 */
const props = withDefaults(
  defineProps<{
    /** 顺序编号（`01` / `02` / `03`），由 ModeCardGrid 派生 */
    number: string
    /** 卡片右上角英文标签（`SINGLE FRAME` 等），品牌 mono 恒英文 */
    label: string
    /** 卡片无标题不成立故必填（先例 HomeHero） */
    title: string
    description?: string
    /** 不含箭头，箭头为独立装饰 span */
    ctaLabel: string
    to: string
    /** 决定视觉区图片栅格：单图 / 系列三图 / 对比双图 */
    layout?: 'single' | 'series' | 'compare'
    visuals?: ModeVisual[]
    featured?: boolean
  }>(),
  {
    description: '',
    layout: 'single',
    visuals: () => [],
    featured: false,
  },
)
</script>

<template>
  <NuxtLink
    class="home-mode-card"
    :class="{ 'home-mode-featured': props.featured }"
    :to="props.to"
  >
    <div class="home-mode-topline">
      <span>{{ props.number }}</span>
      <span>{{ props.label }}</span>
    </div>

    <div class="home-mode-visual" :class="`mode-visual-${props.layout}`" aria-hidden="true">
      <slot name="visual">
        <img
          v-for="visual in props.visuals"
          :key="visual.src"
          :src="visual.src"
          alt=""
          :width="visual.width"
          :height="visual.height"
          loading="lazy"
          decoding="async"
        >
      </slot>
    </div>

    <div class="home-mode-body">
      <h3>{{ props.title }}</h3>
      <p v-if="props.description">{{ props.description }}</p>
    </div>

    <strong>{{ props.ctaLabel }} <span aria-hidden="true">→</span></strong>
  </NuxtLink>
</template>

<style scoped>
/* venus style.css L448-462 逐属性对齐。四个直接子元素对应 grid-template-rows 四行；
 * 分隔线由卡片自持（含 :last-child 收边），网格容器只管列数。 */
.home-mode-card {
  background: transparent;
  border-right: 1px solid var(--hairline);
  color: var(--ink-body);
  display: grid;
  gap: var(--space-5);
  grid-template-rows: auto 240px 1fr auto;
  min-height: 560px;
  min-width: 0;
  padding: var(--space-5);
  text-decoration: none;
  transition: background var(--motion-standard) var(--ease-standard);
}

.home-mode-card:last-child {
  border-right: 0;
}

/* §12.3 允许的动效：仅表面色提升，无位移无阴影 */
.home-mode-card:hover {
  background: var(--paper-raised);
}

/* style.css L467-468（font 简写拆开）；venus gap 16px 即 §7.1 梯度同值 */
.home-mode-topline {
  color: var(--ink-muted);
  display: flex;
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 500;
  gap: var(--space-4);
  justify-content: space-between;
  letter-spacing: 0.06em;
  line-height: 1;
}

/* style.css L469-470；gap 6px 为图片栅缝，低于 §7.1 最小档故贴源保留
 * （先例 HomeContactSheet 的 gap: 10px） */
.home-mode-visual {
  background: var(--darkroom);
  display: grid;
  gap: 6px;
  min-height: 0;
  overflow: hidden;
}

/* §2.1 图片保留原始宽高比，一律 contain；main.css 全局仅兜底 display/max-width */
.home-mode-visual img {
  height: 100%;
  min-height: 0;
  object-fit: contain;
  transition: transform var(--motion-slow) var(--ease-enter);
  width: 100%;
}

/* style.css L471：hover 微放大 1.008，远低于 §12.4 的 1.02 上限 */
.home-mode-card:hover .home-mode-visual img {
  transform: scale(1.008);
}

/* mode-visual-single 沿用 .home-mode-visual 的默认单行单列，无需额外规则 */

/* style.css L472-473：首图跨两行 */
.mode-visual-series {
  grid-template-columns: 1.25fr 0.75fr;
  grid-template-rows: 1fr 1fr;
}

.mode-visual-series img:first-child {
  grid-row: 1 / 3;
}

/* style.css L474：§9.8 对比使用统一中性视框 */
.mode-visual-compare {
  grid-template-columns: 1fr 1fr;
}

/* §6.2 Result Lead 30px/500（style.css L476） */
.home-mode-card h3 {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 500;
  letter-spacing: -0.025em;
  line-height: 1.18;
}

/* style.css L477：venus margin-top 12px 即 §7.1 梯度同值 */
.home-mode-card p {
  font-size: 15px;
  line-height: 1.72;
  margin-top: var(--space-3);
}

/* style.css L478-479；strong 作为 grid 项已被块级化，箭头 float 成立 */
.home-mode-card > strong {
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
}

.home-mode-card > strong span {
  color: var(--amber);
  float: right;
}

/* §10.1 推荐模式的深色反相表面。--on-dark / --on-dark-muted 不在 tokens.css
 * （DESIGN.md §16 未定义，先例 HomeContactSheet：归组件局部），用 light-dark()
 * 对齐 venus 双主题源值（style.css L17-18 / L108-109）；color-scheme 已由
 * tokens.css 三态级联管理。
 *
 * 本变体组必须排在上方基础规则之后：`.home-mode-featured > strong` 与
 * `.home-mode-card > strong` 特异度相同（0,1,1），靠后者定胜负。venus 源
 * （style.css L466 在 L478 之前）因此让 --ink 覆盖了 --on-dark，反相卡的 CTA
 * 文字变成近黑压近黑（对比度约 1:1）而只剩箭头可见；此处调序修复，以满足
 * §14.1 的 4.5:1 正文对比度要求。 */
.home-mode-featured {
  --on-dark: #f1ede3;
  --on-dark-muted: light-dark(#aaa296, #9e9689);

  background: var(--darkroom);
  color: var(--on-dark-muted);
}

.home-mode-featured:hover {
  background: var(--darkroom-raised);
}

.home-mode-featured h3,
.home-mode-featured > strong {
  color: var(--on-dark);
}

.home-mode-featured .home-mode-topline {
  color: var(--on-dark-muted);
}

/* venus style.css L1084-1088：网格单列后卡片内部转「图 | 文」双列，
 * 分隔线由 border-right 改为 border-bottom */
@media (max-width: 1023px) {
  .home-mode-card {
    border-bottom: 1px solid var(--hairline);
    border-right: 0;
    grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.2fr);
    grid-template-rows: auto 1fr auto;
    min-height: 0;
  }

  .home-mode-card:last-child {
    border-bottom: 0;
  }

  .home-mode-visual {
    grid-row: 1 / 4;
    min-height: 280px;
  }

  .home-mode-topline,
  .home-mode-body,
  .home-mode-card > strong {
    grid-column: 2;
  }
}

/* venus style.css L1134-1136：回到单列堆叠。venus padding 20px 不在 §7.1 梯度内，
 * 归为 var(--space-4)（先例 HomeContactSheet 同断点取 16px） */
@media (max-width: 767px) {
  .home-mode-card {
    grid-template-columns: 1fr;
    grid-template-rows: auto 240px auto auto;
    padding: var(--space-4);
  }

  .home-mode-visual {
    grid-row: 2;
    min-height: 0;
  }

  .home-mode-topline,
  .home-mode-body,
  .home-mode-card > strong {
    grid-column: 1;
  }
}

/* venus style.css L1182 */
@media (max-width: 479px) {
  .home-mode-card {
    grid-template-rows: auto 200px auto auto;
  }
}
</style>
