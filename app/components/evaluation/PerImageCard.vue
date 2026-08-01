<script setup lang="ts">
/**
 * 逐图明细单卡：media 视框 + 角标 + 文件名 + 裸分数 + comment（component-plan L132），
 * 收敛 venus group.js L860-893 renderPerImage 单卡 DOM 操作为声明式组件。
 *
 * - 与 RankingCard 的三处关键差异（防惯性复制）：
 *   1. 分数为裸 X.X，不带「/ 10」后缀（源 group.js L886，区别于 RankingCard L112）；
 *   2. 缺图时仅不渲染 img，无占位文案（源 group.js L865-870 只在 entry 存在时
 *      追加 img，区别于 renderRanking L669-671 的 missingText 占位）；
 *      降级时 h4 回退「第 N 张」已覆盖缺图语义（group.js L883）。
 *   3. h4 为 14px UI Sans 文件名行，非 22px Serif 标题（style.css L1038 vs L1029）。
 * - compare media 布局内化（偏离源选择器）：源依赖
 *   `body[data-evaluation-mode="compare"]` 上下文（group.css L103-122），
 *   PerImageCard 同时服务 joint/compare 两页，scoped 组件内无此上下文
 *   → 直接合并 relative + absolute inset contain 布局（RankingCard L147-173 先例；
 *   两模式在固定高度视框下渲染等价）。
 * - 性能：loading="lazy" + decoding="async"（结果区在视口外，blob URL
 *   无网络成本仅解码成本）；width/height 原生属性防 CLS；
 *   contain: layout paint 渲染隔离（group.css L411-415 源已有）。
 * - score NaN 防御取健壮版（ScorePanel L36-39 先例，修正源 L886 无防御）。
 * - 纯 props 组件不内嵌 $t()：文案模板由调用方解析 i18n 后传入，
 *   {index} 组件内插值（RankingCard L72-76 先例）；未传时回退中文默认。
 * - comment v-if 判空：空串不实例化 markstream-vue（最多 10 卡 × 成本，
 *   RankingCard L22 rationale 判空先例）。
 * - title 归 UiFileName 组件根而非 h4（FileName.vue L9-11 对源的收敛先例）。
 */
import type { PerImageDetail } from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'

const props = withDefaults(
  defineProps<{
    /** 逐图明细条目（group.js L857 遍历项：index/score/comment） */
    detail: PerImageDetail
    /** 按 detail.index 查找的图片条目；null 时不渲染 img，h4 回退「第 N 张」（group.js L865-884） */
    entry?: ImageEntry | null
    /** img alt 模板，{index} 1-based（group.js L868，§14.4） */
    altTemplate?: string
    /** entry 缺失时的文件名回退模板，{index} 1-based（group.js L883） */
    fallbackNameTemplate?: string
  }>(),
  {
    entry: null,
    altTemplate: '第 {index} 张照片的评估明细',
    fallbackNameTemplate: '第 {index} 张',
  },
)

// group.js L872：帧号补零（§4.2 摄影语义元素，恒英文 mono）
const badgeText = computed(() => String(Number(props.detail.index) + 1).padStart(2, '0'))

// group.js L886 + ScorePanel L36-39 NaN 防御
const safeScore = computed(() => {
  const n = Number(props.detail.score)
  return Number.isFinite(n) ? n : 0
})
const displayScore = computed(() => safeScore.value.toFixed(1))

// group.js L868：alt 模板插值（RankingCard L72-76 先例）
const resolvedAlt = computed(() =>
  props.altTemplate.replace('{index}', String(Number(props.detail.index) + 1)),
)

// group.js L883：缺图回退名模板插值
const resolvedFallbackName = computed(() =>
  props.fallbackNameTemplate.replace('{index}', String(Number(props.detail.index) + 1)),
)
</script>

<template>
  <article class="per-image-card">
    <!-- group.js L863-873：media 区 + 帧号角标；
         缺图时仅无 img（L865-870），角标恒渲染（L871-873） -->
    <div class="per-image-media">
      <img
        v-if="props.entry"
        :src="props.entry.objectURL"
        :alt="resolvedAlt"
        :width="props.entry.width"
        :height="props.entry.height"
        loading="lazy"
        decoding="async"
      >
      <span class="per-image-badge">{{ badgeText }}</span>
    </div>

    <!-- group.js L875-890：body 区 -->
    <div class="per-image-body">
      <!-- group.js L877-887：heading = 文件名/回退名 + 裸分数 -->
      <div class="per-image-heading">
        <h4>
          <UiFileName v-if="props.entry" :name="props.entry.file.name" />
          <template v-else>{{ resolvedFallbackName }}</template>
        </h4>
        <strong>{{ displayScore }}</strong>
      </div>
      <!-- group.js L888-889：comment Markdown -->
      <div v-if="props.detail.comment" class="per-image-comment">
        <UiBaseMarkdown :content="props.detail.comment" final />
      </div>
    </div>
  </article>
</template>

<style scoped>
/* venus style.css L1034 + group.css L411-415：
 * 双列 grid（media 160px / body 1fr）+ contain 渲染隔离 */
.per-image-card {
  min-width: 0;
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  background: var(--paper-raised);
  contain: layout paint;
}

/* venus group.css L417-421 */
.per-image-card:focus-within {
  border-color: var(--focus);
}

/* venus style.css L770-772 + L1035 + group.css L103-111 合并：
 * compare 布局内化——源 body[data-evaluation-mode="compare"] 选择器
 * 上下文在 scoped 内不存在（RankingCard L147-161 先例）。
 * 暗色视框撑满卡片高度（height:100% + grid-auto-rows:1fr 由
 * PerImageGrid 承担），卡片等高保证所有视框同尺寸（§9.8）。 */
.per-image-media {
  position: relative;
  min-width: 0;
  min-height: 170px;
  height: 100%;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--darkroom);
}

/* venus style.css L1036 + group.css L113-122（compare img 绝对定位
 * contain——内化，同上）。§2.1：照片 contain 不裁切 */
.per-image-media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-height: 100%;
  display: block;
  object-fit: contain;
}

/* venus style.css L776-778：帧号角标（区别于 ranking-position 的
 * 14px/44px 尺寸，此处为 10px/34px）；--on-dark 双主题同值 #f1ede3
 *（style.css L17/L108），直接赋值；font 简写拆开 */
.per-image-badge {
  --on-dark: #f1ede3;

  position: absolute;
  top: 10px;
  left: 10px;
  min-width: 34px;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
  background: rgba(12, 11, 10, 0.78);
  color: var(--on-dark);
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  text-align: center;
}

/* venus style.css L1037 */
.per-image-body {
  min-width: 0;
  padding: var(--space-4);
  color: var(--ink-body);
  font-size: 14px;
  line-height: 1.65;
}

/* venus style.css L1027-1028（.per-image-body > div:first-child 部分） */
.per-image-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
}

/* venus style.css L1038：14px UI Sans 文件名行
 *（区别于 ranking-heading h4 的 22px Serif，L1029） */
.per-image-body h4 {
  min-width: 0;
  display: flex;
  color: var(--ink);
  font-size: 14px;
}

/* venus style.css L1039：裸分数 20px mono（§6.2 tabular-nums）；font 简写拆开 */
.per-image-body strong {
  flex-shrink: 0;
  color: var(--ink);
  font-family: var(--font-data);
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

/* venus style.css L1040（.per-image-body > div:last-child） */
.per-image-comment {
  margin-top: 10px;
}

/* venus group.css L436-452：comment 首尾 margin 修剪
 *（:deep() 先例 RankingCard L280-286） */
.per-image-comment :deep(> :first-child) {
  margin-top: 0;
}

.per-image-comment :deep(> :last-child) {
  margin-bottom: 0;
}

/* venus style.css L1197-1198：≤479px 卡内单列堆叠 + 视框加高
 *（区别于 ranking-card 在 ≤767px 堆叠，L1172-1173） */
@media (max-width: 479px) {
  .per-image-card {
    grid-template-columns: 1fr;
  }

  .per-image-media {
    min-height: 260px;
  }
}
</style>
