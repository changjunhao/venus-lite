<script setup lang="ts">
import type { ModeCardItem } from '~/components/home/ModeCard.vue'

/**
 * 首页三种评估模式卡区块（DESIGN.md §10.1「三栏 Hairline 网格，不使用三张浮空 SaaS 卡片」），
 * 对应 venus index.html L79-111 的 `section.home-modes`
 * （component-plan §2.3 首页展示域）。
 *
 * - 纯 props 组件不内嵌 $t()：文案由调用页面解析 i18n 后传入
 *   （先例 HomeHero / HomeContactSheet）。
 * - 编号 `01/02/03` 按 modes 顺序补零派生而非 prop：编号即顺序语义（§4.2「编号只用于
 *   真实存在的可数对象……模式列表」，先例 HomeContactSheet 的 FRAME 编号）；而
 *   `featured` 是「当前默认推荐」的语义，不由 index === 0 派生，由数据显式标记。
 * - 锚点 id 不写在组件内（页面信息架构归页面）：调用方经 attrs 传 `id="modes"`
 *   即可命中 SiteNav 的 `#modes` 与 HomeHero 的次 CTA；h2 的 id 用 useId() 生成，
 *   仅供 aria-labelledby 使用（先例 BaseSelect / BaseSwitch / BaseCollapsible）。
 * - 网格列数贴 §10.1 的「三栏」固定为 3：新增第四种模式应先补规范再实现（§19），
 *   故不预置 auto-fit。
 */
const props = withDefaults(
  defineProps<{
    /** 章节眉标（`MODES`）；为空时不渲染 */
    eyebrow?: string
    /** 章节标题，同时是 aria-labelledby 的目标故必填 */
    title: string
    description?: string
    modes: ModeCardItem[]
  }>(),
  { eyebrow: '', description: '' },
)

// SSR 水合安全的 id，仅用于 section 的 aria-labelledby
const titleId = useId()

const modeNumber = (index: number) => String(index + 1).padStart(2, '0')
</script>

<template>
  <section class="home-modes" :aria-labelledby="titleId">
    <div class="home-section-heading">
      <div>
        <UiBaseSectionIndex v-if="props.eyebrow">{{ props.eyebrow }}</UiBaseSectionIndex>
        <h2 :id="titleId">{{ props.title }}</h2>
      </div>
      <p v-if="props.description">{{ props.description }}</p>
    </div>

    <div class="home-mode-grid">
      <HomeModeCard
        v-for="(mode, index) in props.modes"
        :key="mode.to"
        :number="modeNumber(index)"
        :label="mode.label"
        :title="mode.title"
        :description="mode.description"
        :cta-label="mode.ctaLabel"
        :to="mode.to"
        :layout="mode.layout"
        :visuals="mode.visuals"
        :featured="mode.featured"
      />
    </div>
  </section>
</template>

<style scoped>
/* venus style.css L423 逐属性对齐。venus 的 width: min(1440px, calc(100% - 112px))
 * 与 margin-inline: auto 不搬——宽度与外边距由页面根节点的 .container 承担（§7.2）；
 * scroll-margin-top 亦不搬——已由 main.css 的 html { scroll-padding-top } 全局承担。 */
.home-modes {
  padding-block: var(--space-9);
}

/* style.css L424-430 */
.home-section-heading {
  align-items: end;
  display: grid;
  gap: var(--space-6);
  grid-template-columns: minmax(0, 7fr) minmax(280px, 5fr);
  margin-bottom: var(--space-7);
}

/* §6.2 Section Display；venus clamp 上限 48px 贴源保留（先例 HomeHero 的贴源说明）。
 * margin-top 承担与眉标的间距，故 BaseSectionIndex 自身不带 margin。 */
.home-section-heading h2 {
  font-size: clamp(32px, 3.6vw, 48px);
  letter-spacing: -0.03em;
  line-height: 1.12;
  margin-top: var(--space-3);
}

/* style.css L441 */
.home-section-heading > p {
  color: var(--ink-body);
  justify-self: end;
  max-width: 520px;
}

/* §10.1 三栏 Hairline 网格；§8.3 普通卡片无阴影，层级只由细线与留白建立 */
.home-mode-grid {
  border-bottom: 1px solid var(--hairline);
  border-top: 1px solid var(--hairline);
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* venus style.css L1083：卡片改为单列堆叠（卡片内部布局由 ModeCard 自持） */
@media (max-width: 1023px) {
  .home-mode-grid {
    grid-template-columns: 1fr;
  }
}

/* venus style.css L1131-1133 */
@media (max-width: 767px) {
  .home-modes {
    padding-block: var(--space-8);
  }

  .home-section-heading {
    grid-template-columns: 1fr;
  }

  .home-section-heading > p {
    justify-self: start;
  }
}
</style>
