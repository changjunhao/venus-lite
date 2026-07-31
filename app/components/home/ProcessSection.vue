<script lang="ts">
/** 方法论单步；四步为真实评审环节（DESIGN.md §4.2 编号只用于真实存在的可数对象） */
export interface ProcessStepItem {
  title: string
  description?: string
}
</script>

<script setup lang="ts">
/**
 * 首页四步评审方法区块（DESIGN.md §10.1 结构 4「四步评审方法」），
 * 对应 venus index.html L113-125 的 `section.home-process`
 * （component-plan §2.3 首页展示域「方法论四步列表（数据驱动渲染）」）。
 *
 * - 纯 props 组件不内嵌 $t()：文案由调用页面解析 i18n 后传入
 *   （先例 HomeHero / ModeCardGrid）。
 * - 编号 `01–04` 按 steps 顺序补零派生而非 prop：编号即顺序语义
 *   （先例 ModeCardGrid 的 modeNumber / HomeContactSheet 的 FRAME 编号）。
 * - 锚点 id 不写在组件内（页面信息架构归页面）：调用方经 attrs 传 `id="process"`
 *   即可命中 SiteNav 的 `#process` 锚点；h2 的 id 用 useId() 生成，
 *   仅供 aria-labelledby 使用（先例 ModeCardGrid）。
 * - 标题为单行纯文本 prop：venus 源的 `<br>` 断行交由全局 text-wrap: balance
 *   （main.css h1-h3）在窄列自然平衡，不引入 v-html。
 * - 纯静态 SSR 内容：无状态、无 watcher、无图片，客户端零额外开销。
 */
const props = withDefaults(
  defineProps<{
    /** 章节眉标（`METHOD`）；为空时不渲染 */
    eyebrow?: string
    /** 章节标题，同时是 aria-labelledby 的目标故必填（先例 ModeCardGrid） */
    title: string
    /** 导语；为空时不渲染 */
    lede?: string
    /** 方法论步骤，按序渲染并派生编号 */
    steps: ProcessStepItem[]
  }>(),
  { eyebrow: '', lede: '' },
)

// SSR 水合安全的 id，仅用于 section 的 aria-labelledby
const titleId = useId()

const stepNumber = (index: number) => String(index + 1).padStart(2, '0')
</script>

<template>
  <section class="home-process" :aria-labelledby="titleId">
    <div class="home-process-intro">
      <UiBaseSectionIndex v-if="props.eyebrow">{{ props.eyebrow }}</UiBaseSectionIndex>
      <h2 :id="titleId">{{ props.title }}</h2>
      <p v-if="props.lede">{{ props.lede }}</p>
    </div>

    <ol class="home-process-list">
      <li v-for="(step, index) in props.steps" :key="step.title">
        <span>{{ stepNumber(index) }}</span>
        <div>
          <strong>{{ step.title }}</strong>
          <p v-if="step.description">{{ step.description }}</p>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
/* venus style.css L481-488 逐属性对齐。width/margin-inline 不搬——由页面根节点
 * .container 承担（先例 ModeCardGrid）；scroll-margin-top 亦不搬——已由 main.css
 * 的 html { scroll-padding-top } 全局承担。 */
.home-process {
  border-top: 1px solid var(--hairline);
  display: grid;
  gap: clamp(56px, 9vw, 140px);
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  padding-block: var(--space-9);
}

/* style.css L489：桌面导语随滚动驻留；top 120px = 72px 导航 + 48px 呼吸，贴源保留 */
.home-process-intro {
  align-self: start;
  position: sticky;
  top: 120px;
}

/* §6.2 Section Display，与 ModeCardGrid 的 .home-section-heading h2 同源
 * （style.css L431-440）；text-wrap: balance 由 main.css 全局承担，不重复声明 */
.home-process-intro h2 {
  font-size: clamp(32px, 3.6vw, 48px);
  letter-spacing: -0.03em;
  line-height: 1.12;
  margin-top: var(--space-3);
}

/* style.css L490 */
.home-process-intro p {
  margin-top: var(--space-5);
  max-width: 500px;
}

/* style.css L491：ol 语义保留、视觉编号自持（§4.2 编号用于真实评审步骤） */
.home-process-list {
  border-top: 1px solid var(--hairline);
  list-style: none;
}

/* style.css L492-498 */
.home-process-list li {
  border-bottom: 1px solid var(--hairline);
  display: grid;
  gap: var(--space-4);
  grid-template-columns: 54px 1fr;
  padding: var(--space-5) 0;
}

/* style.css L499（font 简写拆开）：amber 编号为 §5.3 小面积品牌色 */
.home-process-list > li > span {
  color: var(--amber);
  font-family: var(--font-data);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

/* style.css L500：§6.2 Title Medium 18px/600 */
.home-process-list strong {
  color: var(--ink);
  font-size: 18px;
  font-weight: 600;
}

/* style.css L501：margin-top 6px 不在 §7.1 梯度内，贴源保留（先例 ModeCard 的 gap: 6px） */
.home-process-list p {
  color: var(--ink-muted);
  font-size: 14px;
  margin-top: 6px;
}

/* venus style.css L1089-1090：平板折叠为单列，导语取消 sticky */
@media (max-width: 1023px) {
  .home-process {
    grid-template-columns: 1fr;
  }

  .home-process-intro {
    position: static;
  }
}

/* venus style.css L1131/L1137：64px → space-8、48px → space-7（§7.1 梯度同值） */
@media (max-width: 767px) {
  .home-process {
    gap: var(--space-7);
    padding-block: var(--space-8);
  }
}

/* venus style.css L1184 */
@media (max-width: 479px) {
  .home-process-intro h2 {
    font-size: 32px;
  }
}
</style>
