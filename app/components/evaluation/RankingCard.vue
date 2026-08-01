<script setup lang="ts">
/**
 * 排名单卡：winner 高亮、rationale、缺图占位（component-plan L128），
 * 收敛 venus group.js L659-698 renderRanking 单卡 DOM 操作为声明式组件。
 *
 * - §9.13：每项包含名次、原始图片索引、缩略图、综合分数、一句话判断；
 *   第一名 Amber 细线标注，不用金冠/奖杯/渐变；名次不覆盖图片主体。
 * - §9.8：暗色视框撑满卡片高度，照片 contain 自适应不留纸面空白；
 *   缩略图使用原始 index 映射（§10.4 不得用 rank - 1）。
 * - compare media 布局内化（偏离源选择器）：源依赖
 *   `body[data-evaluation-mode="compare"]` 上下文（group.css L103-122），
 *   RankingCard 仅出现于 compare 页（joint 无排名），scoped 组件内
 *   无此上下文 → 直接合并 relative + absolute inset contain 布局。
 * - 性能：loading="lazy" + decoding="async"（结果区在视口外，blob URL
 *   无网络成本仅解码成本；区别于 ContactSheet sticky 常显列不加 lazy）；
 *   width/height 原生属性防 CLS（ContactSheet L16-18 先例）；
 *   contain: layout paint 渲染隔离（group.css L411-415 源已有）。
 * - score NaN 防御取健壮版（ScorePanel L36-39 先例，修正源 L691 无防御）。
 * - 纯 props 组件不内嵌 $t()：文案模板由调用方解析 i18n 后传入，
 *   {rank}/{index} 组件内插值（ContactSheet L43-44 altTemplate 先例）；
 *   未传时回退中文默认（CritiqueReport L20-21 先例）。
 * - rationale v-if 判空：空串不实例化 markstream-vue（最多 10 卡 × 成本）。
 */
import type { RankingItem } from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'

const props = withDefaults(
  defineProps<{
    /** 排名条目（group.js L657 遍历项：index/rank/score/rationale） */
    item: RankingItem
    /** 按 item.index 查找的图片条目；null 渲染缺图占位（group.js L658/L669-671） */
    entry?: ImageEntry | null
    /** rank=1 标题（group.js L689「本组最佳」） */
    winnerTitle?: string
    /** 名次标题模板，{rank} 插值（group.js L689「第 N 名」） */
    rankTitleTemplate?: string
    /** 照片索引标签模板，{index} 1-based（group.js L683「第 N 张照片」） */
    photoLabelTemplate?: string
    /** 缺图占位文案（group.js L671） */
    missingText?: string
    /** img alt 模板，{rank}/{index} 插值（group.js L667，§14.4） */
    altTemplate?: string
  }>(),
  {
    entry: null,
    winnerTitle: '本组最佳',
    rankTitleTemplate: '第 {rank} 名',
    photoLabelTemplate: '第 {index} 张照片',
    missingText: '照片已从当前列表移除，重新上传后可查看预览',
    altTemplate: '排名第 {rank}：第 {index} 张照片',
  },
)

// group.js L660：rank === 1 → winner
const isWinner = computed(() => Number(props.item.rank) === 1)

// group.js L691 + ScorePanel L36-39 NaN 防御
const safeScore = computed(() => {
  const n = Number(props.item.score)
  return Number.isFinite(n) ? n : 0
})
const displayScore = computed(() => safeScore.value.toFixed(1))

// group.js L689：winner → 本组最佳；否则模板插值
const headingText = computed(() =>
  isWinner.value
    ? props.winnerTitle
    : props.rankTitleTemplate.replace('{rank}', String(props.item.rank)),
)

// group.js L667：alt 模板插值（ContactSheet L43-44 先例）
const resolvedAlt = computed(() =>
  props.altTemplate
    .replace('{rank}', String(props.item.rank))
    .replace('{index}', String(Number(props.item.index) + 1)),
)

// group.js L683：照片索引标签 1-based
const resolvedPhotoLabel = computed(() =>
  props.photoLabelTemplate.replace('{index}', String(Number(props.item.index) + 1)),
)
</script>

<template>
  <article class="ranking-card" :class="{ 'ranking-winner': isWinner }">
    <!-- group.js L659-660：article.ranking-card + winner class；
         group.js L662-676：media 区 + 角标 -->
    <div class="ranking-media" :class="{ 'media-missing': !props.entry }">
      <img
        v-if="props.entry"
        :src="props.entry.objectURL"
        :alt="resolvedAlt"
        :width="props.entry.width"
        :height="props.entry.height"
        loading="lazy"
        decoding="async"
      >
      <span v-else class="media-missing-text">{{ props.missingText }}</span>
      <span class="ranking-position">#{{ props.item.rank }}</span>
    </div>

    <!-- group.js L678-696：body 区 -->
    <div class="ranking-body">
      <!-- group.js L680-685：kicker = 照片索引 + 文件名 -->
      <span class="ranking-source">
        <span>{{ resolvedPhotoLabel }}{{ props.entry ? ' ·' : '' }}</span>
        <UiFileName v-if="props.entry" :name="props.entry.file.name" />
      </span>
      <!-- group.js L686-692：标题 + 分数 -->
      <div class="ranking-heading">
        <h4>{{ headingText }}</h4>
        <strong>{{ displayScore }} / 10</strong>
      </div>
      <!-- group.js L693-695：rationale Markdown -->
      <div v-if="props.item.rationale" class="ranking-rationale">
        <UiBaseMarkdown :content="props.item.rationale" final />
      </div>
    </div>
  </article>
</template>

<style scoped>
/* venus style.css L1017 + group.css L411-415：
 * 双列 grid（media 0.8fr / body 1.2fr）+ contain 渲染隔离 */
.ranking-card {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(0, 1.2fr);
  overflow: hidden;
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  background: var(--paper-raised);
  contain: layout paint;
}

/* venus group.css L417-421 */
.ranking-card:focus-within {
  border-color: var(--focus);
}

/* venus style.css L1018：§9.13 第一名 Amber 细线 + 内阴影标注 */
.ranking-winner {
  border-color: var(--amber);
  box-shadow: inset 2px 0 var(--amber);
}

/* venus style.css L770-772 + L1019 + group.css L103-111 合并：
 * compare 布局内化——RankingCard 仅出现于 compare 页，源
 * body[data-evaluation-mode="compare"] 选择器上下文在 scoped 内不存在。
 * §9.8：暗色视框撑满卡片高度（height:100% + grid-auto-rows:1fr 由
 * RankingList 承担），卡片等高保证所有视框同尺寸。 */
.ranking-media {
  position: relative;
  min-width: 0;
  min-height: 240px;
  height: 100%;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--darkroom);
}

/* venus group.css L113-122（compare img 绝对定位 contain——内化，同上）。
 * §2.1：照片 contain 不裁切；§9.8：照片下方不留纸面区域 */
.ranking-media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-height: 100%;
  display: block;
  object-fit: contain;
}

/* venus style.css L1021；--on-dark-muted 不在 tokens.css（DESIGN.md §16
 * 未定义，ContactSheet L95-100 先例：归组件局部 light-dark()），
 * font 简写拆开（MetadataStrip L83 先例） */
.ranking-media.media-missing {
  --on-dark-muted: light-dark(#aaa296, #9e9689);

  padding: var(--space-5);
  color: var(--on-dark-muted);
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.6;
  text-align: center;
}

/* venus style.css L776-778 + L1022 合并（基态 + ranking 覆盖）。
 * --on-dark 双主题同值 #f1ede3（style.css L17/L108），直接赋值 */
.ranking-position {
  --on-dark: #f1ede3;

  position: absolute;
  top: 12px;
  left: 12px;
  min-width: 44px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: rgba(12, 11, 10, 0.78);
  color: var(--on-dark);
  font-family: var(--font-data);
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  text-align: center;
}

/* venus style.css L1023：winner 角标 amber 底 */
.ranking-winner .ranking-position {
  background: var(--amber);
  color: var(--paper-raised);
}

/* venus style.css L1024 */
.ranking-body {
  min-width: 0;
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* venus style.css L1025-1026；font 简写拆开 */
.ranking-source {
  min-width: 0;
  margin-bottom: 10px;
  display: flex;
  align-items: baseline;
  gap: 5px;
  color: var(--ink-muted);
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 500;
  line-height: 1.4;
}

.ranking-source > span:first-child {
  flex-shrink: 0;
}

/* venus style.css L1027-1028（仅 ranking-heading 部分） */
.ranking-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
}

/* venus style.css L1029：§2.3 Serif 用于判断 */
.ranking-heading h4 {
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 500;
}

/* venus style.css L1030：§6.2 分数 tabular-nums；font 简写拆开 */
.ranking-heading strong {
  flex-shrink: 0;
  color: var(--ink);
  font-family: var(--font-data);
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

/* venus style.css L1031 */
.ranking-rationale {
  margin-top: 14px;
  color: var(--ink-body);
  font-size: 14px;
  line-height: 1.72;
}

/* venus group.css L436-452：rationale 首尾 margin 修剪
 * （:deep() 先例 BaseMarkdown L72-76） */
.ranking-rationale :deep(> :first-child) {
  margin-top: 0;
}

.ranking-rationale :deep(> :last-child) {
  margin-bottom: 0;
}

/* venus style.css L1172-1173：移动端单列堆叠 + 视框加高 */
@media (max-width: 767px) {
  .ranking-card {
    grid-template-columns: 1fr;
  }

  .ranking-media {
    min-height: 300px;
  }
}

/* venus style.css L1196 */
@media (max-width: 479px) {
  .ranking-media {
    min-height: 260px;
  }
}
</style>
