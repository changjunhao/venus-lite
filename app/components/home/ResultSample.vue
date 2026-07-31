<script lang="ts">
/** 依据清单单项；三组为真实评审输出（DESIGN.md §4.2 编号只用于真实存在的可数对象） */
export interface ResultProofItem {
  /** dt：优势/改进/依据 */
  term: string
  /** dd */
  detail: string
}
</script>

<script setup lang="ts">
/**
 * 首页结果示例区块（DESIGN.md §10.1 结构 5「结果示例」），
 * 对应 venus index.html L127-143 的 `section.home-result-example#sample`
 * （component-plan §2.3 首页展示域「结果示例区（示例评分 + 依据清单）」）。
 *
 * - 纯 props 组件不内嵌 $t()：文案由调用页面解析 i18n 后传入
 *   （先例 HomeHero / ModeCardGrid / ProcessSection）。
 * - 锚点 id 不写在组件内（页面信息架构归页面）：调用方经 attrs 传 `id="sample"`
 *   即可命中 SiteNav 的 `#sample` 锚点；h2 的 id 用 useId() 生成，
 *   仅供 aria-labelledby 使用（先例 ProcessSection）。
 * - 评分 `/ 10` 为评分制常量（§9.10），同 FRAME 编号的品牌 mono 先例，
 *   硬编码于模板而不入 i18n。
 * - 纯静态 SSR 内容：无状态、无 watcher，客户端零额外开销。
 */
const props = withDefaults(
  defineProps<{
    /** 章节眉标（`REVIEW SAMPLE`）；为空时不渲染 */
    eyebrow?: string
    /** 章节标题，同时是 aria-labelledby 的目标故必填（先例 ProcessSection） */
    title: string
    /** 静态示例评分（8.2）；展示为 toFixed(1)，§9.10 综合分数始终 Ink */
    score: number
    /** 分数说明（「示例评分」）；为空时不渲染 */
    scoreCaption?: string
    /** §9.10 分数带区间文字标签（「优势明确」）；为空时不渲染 */
    scoreBand?: string
    /** 导语；为空时不渲染 */
    lede?: string
    /** 依据清单，按序渲染为 dl > div > dt+dd */
    proofs: ResultProofItem[]
    /** 媒体区图片地址 */
    imageSrc: string
    /** 媒体区图片替代文本 */
    imageAlt: string
    /** 图片原始像素宽，防 CLS（先例 heroFrames） */
    imageWidth?: number
    /** 图片原始像素高，防 CLS */
    imageHeight?: number
    /** 帧号角标（`FRAME 02 / REVIEWED`），品牌 mono 恒英文；为空时不渲染 */
    frameLabel?: string
  }>(),
  { eyebrow: '', scoreCaption: '', scoreBand: '', lede: '', frameLabel: '', imageWidth: undefined, imageHeight: undefined },
)

// SSR 水合安全的 id，仅用于 section 的 aria-labelledby
const titleId = useId()
</script>

<template>
  <section class="home-result-example" :aria-labelledby="titleId">
    <div class="home-result-media">
      <img
        :src="props.imageSrc"
        :alt="props.imageAlt"
        :width="props.imageWidth"
        :height="props.imageHeight"
        loading="lazy"
        decoding="async"
      >
      <span v-if="props.frameLabel" class="frame-index">{{ props.frameLabel }}</span>
    </div>

    <article class="home-result-report">
      <UiBaseSectionIndex v-if="props.eyebrow">{{ props.eyebrow }}</UiBaseSectionIndex>
      <div class="sample-score">
        <strong>{{ props.score.toFixed(1) }}</strong>
        <span>/ 10<template v-if="props.scoreCaption"><br>{{ props.scoreCaption }}</template></span>
        <span v-if="props.scoreBand" class="sample-score-band">{{ props.scoreBand }}</span>
      </div>
      <h2 :id="titleId">{{ props.title }}</h2>
      <p v-if="props.lede" class="result-lead">{{ props.lede }}</p>
      <dl class="result-proof-list">
        <div v-for="proof in props.proofs" :key="proof.term">
          <dt>{{ proof.term }}</dt>
          <dd>{{ proof.detail }}</dd>
        </div>
      </dl>
    </article>
  </section>
</template>

<style scoped>
/* venus style.css L503-512 逐属性对齐。width/margin-inline 不搬——由页面根节点
 * .container 承担（先例 ModeCardGrid）；scroll-margin-top 亦不搬——已由 main.css
 * 的 html { scroll-padding-top } 全局承担（先例 ProcessSection）。 */
.home-result-example {
  --on-dark: #f1ede3; /* 组件局部（先例 HomeContactSheet）：tokens.css 不含该 token */

  background: var(--darkroom);
  border-radius: var(--radius-lg);
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(420px, 5fr);
  margin-bottom: var(--space-9);
  min-height: 680px;
  overflow: hidden;
}

/* style.css L513：媒体面板在双主题下均为最深黑（#0c0b0a = darkroom 主题 --darkroom 值），
 * 贴源保留硬编码——图片舞台不用彩色干扰色彩判断（§2.1） */
.home-result-media {
  background: #0c0b0a;
  display: grid;
  min-height: 520px;
  place-items: center;
  position: relative;
}

.home-result-media img {
  height: 100%;
  object-fit: contain;
  width: 100%;
}

/* style.css L275-286（共享排版规则）∩ L515（定位规则）：
 * padding 7px 9px / left 20px / bottom 18px 不在 §7.1 梯度内，贴源保留
 * （先例 ModeCard 的 gap: 6px） */
.frame-index {
  background: rgba(12, 11, 10, 0.82);
  border-radius: var(--radius-sm);
  bottom: 18px;
  color: var(--on-dark);
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 600;
  left: 20px;
  letter-spacing: 0.08em;
  line-height: 1.4;
  padding: 7px 9px;
  position: absolute;
  text-transform: uppercase;
}

/* style.css L516 */
.home-result-report {
  background: var(--paper-raised);
  padding: clamp(40px, 5vw, 72px);
}

/* style.css L517 */
.sample-score {
  align-items: flex-end;
  display: flex;
  gap: var(--space-4);
  margin: var(--space-7) 0 var(--space-6);
}

/* style.css L518：§9.10 分数 64-88px Data Mono；§5.4 L238 综合分数始终 Ink */
.sample-score strong {
  color: var(--ink);
  font-family: var(--font-data);
  font-size: clamp(64px, 7vw, 88px);
  font-weight: 500;
  letter-spacing: -0.07em;
  line-height: 0.8;
}

/* style.css L519 */
.sample-score span {
  color: var(--ink-muted);
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.5;
}

/* 唯一超出 venus 源的新规则：§9.10 要求分数旁使用区间文字标签说明水平。
 * 8.2 ∈ [8.0, 10.0] → 「优势明确」→ Verdigris（§5.4）；区间色只用于小型标签。
 * ⚠️ 若示例分数改带，颜色须同步 §5.4 四区间映射 */
.sample-score-band {
  color: var(--verdigris);
}

/* §6.2 Section Display，与 ProcessSection 的 h2 同源（style.css L431-439）；
 * text-wrap: balance 由 main.css 全局承担，不重复声明 */
.home-result-report h2 {
  font-size: clamp(32px, 3.6vw, 48px);
  letter-spacing: -0.03em;
  line-height: 1.12;
  margin-top: var(--space-3);
}

/* style.css L520：Result Lead 30px 档的首页收敛变体（21px），贴源保留 */
.result-lead {
  color: var(--ink-body);
  font-family: var(--font-display);
  font-size: 21px;
  line-height: 1.65;
  margin-top: var(--space-5);
}

/* style.css L521 */
.result-proof-list {
  border-top: 1px solid var(--hairline);
  margin-top: var(--space-6);
}

/* style.css L522：gap 20px 不在 §7.1 梯度内，贴源保留（先例 ModeCard 的 gap: 6px） */
.result-proof-list > div {
  border-bottom: 1px solid var(--hairline);
  display: grid;
  gap: 20px;
  grid-template-columns: 64px 1fr;
  padding: var(--space-4) 0;
}

/* style.css L523：amber 小面积标注为 §5.3 品牌色语义 */
.result-proof-list dt {
  color: var(--amber);
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.5;
}

/* style.css L524 */
.result-proof-list dd {
  color: var(--ink-body);
  font-size: 14px;
}

/* venus style.css L1091-1092：平板折叠为单列 */
@media (max-width: 1023px) {
  .home-result-example {
    grid-template-columns: 1fr;
  }

  .home-result-media {
    min-height: 540px;
  }
}

/* venus style.css L1138-1140：64px → space-8、32px/24px → space-6/space-5（§7.1 梯度同值） */
@media (max-width: 767px) {
  .home-result-example {
    margin-bottom: var(--space-8);
    min-height: 0;
  }

  .home-result-media {
    min-height: 420px;
  }

  .home-result-report {
    padding: var(--space-6) var(--space-5);
  }
}

/* venus style.css L1183-1186 */
@media (max-width: 479px) {
  .home-result-media {
    min-height: 340px;
  }

  .home-result-report h2 {
    font-size: 32px;
  }

  .sample-score strong {
    font-size: 64px;
  }

  .result-proof-list > div {
    grid-template-columns: 52px 1fr;
  }
}
</style>
