<script setup lang="ts">
/**
 * 聚焦比较单帧：大图按钮 + 评分 + 优势与限制（component-plan L130），
 * 收敛 venus group.js L740-777 renderFocusCompareGrid 单帧 DOM 操作
 * 为声明式组件。
 *
 * - §9.8：统一视框 aspect-ratio 4/3 + darkroom 中性背景 + contain 不裁切；
 *   照片下方不留纸面区域（§9.8「照片应获得完整的中性暗色安静区」）。
 * - media 为 button（源 L746-756）：点击进入沉浸对比，emit zoom 归父组件；
 *   cursor: zoom-in 表达可放大（源 group.css L236）。
 * - entry required 非空：FocusCompare 的 ranked computed 已过滤无效 entry
 *   （group.js L708 等价），双层防线；组件内不设 null 分支（贴源 L741-742）。
 * - NaN 防御取健壮版（RankingCard L58-62 先例，修正源 L766 无防御）。
 * - rationale 空串走 fallback 文案（贴源 L773 `item.rationale || '暂无进一步判断依据'`，
 *   区别于 RankingCard 的 v-if 策略——源此处恒渲染 rationale 块）。
 * - 纯 props 组件不内嵌 $t()：文案模板由调用方解析 i18n 后传入，
 *   {side}/{index}/{name} 组件内插值（RankingCard L72-81 先例）。
 * - badge 补零恒英文（§4.2 品牌 mono 语言，ContactSheet L40 先例）。
 * - 沉浸态配色消费 FocusCompare 下发的 --cmp-* 自定义属性
 *   （缺省回退基态 token，脱离 FocusCompare 独立使用时行为不变）。
 */
import type { RankingItem } from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'

const props = withDefaults(
  defineProps<{
    /** 排名条目（group.js L737 遍历项：index/rank/score/rationale） */
    item: RankingItem
    /** 按 item.index 查找的图片条目（FocusCompare 保证非 null） */
    entry: ImageEntry
    /** 侧标签（group.js L749 aria 前缀「左侧」/「右侧」） */
    sideLabel?: string
    /** media button aria-label 模板，{side}/{index} 插值（group.js L749） */
    zoomAriaTemplate?: string
    /** img alt 模板，{index}/{name} 插值（group.js L752，§14.4） */
    altTemplate?: string
    /** 评分后缀（group.js L766「X.X / 10」） */
    scoreSuffix?: string
    /** rationale 标签（group.js L770「优势与限制」） */
    rationaleLabel?: string
    /** rationale 为空时的回退文案（group.js L773） */
    rationaleFallback?: string
  }>(),
  {
    sideLabel: '左侧',
    zoomAriaTemplate: '{side}第 {index} 张照片，进入沉浸对比',
    altTemplate: '第 {index} 张照片：{name}',
    scoreSuffix: ' / 10',
    rationaleLabel: '优势与限制',
    rationaleFallback: '暂无进一步判断依据',
  },
)

// group.js L756：media click → 父组件开沉浸
const emit = defineEmits<{ zoom: [] }>()

// group.js L766 + RankingCard L58-62 NaN 防御
const safeScore = computed(() => {
  const n = Number(props.item.score)
  return Number.isFinite(n) ? n : 0
})
const displayScore = computed(() => safeScore.value.toFixed(1))

// group.js L754：FRAME 补零 + 名次（ContactSheet L40 frameIndex 先例）
const badgeText = computed(() =>
  `FRAME ${String(Number(props.item.index) + 1).padStart(2, '0')} · #${props.item.rank}`,
)

// group.js L749：media aria-label 模板插值
const resolvedZoomAria = computed(() =>
  props.zoomAriaTemplate
    .replace('{side}', props.sideLabel)
    .replace('{index}', String(Number(props.item.index) + 1)),
)

// group.js L752：img alt 模板插值（RankingCard L72-76 先例）
const resolvedAlt = computed(() =>
  props.altTemplate
    .replace('{index}', String(Number(props.item.index) + 1))
    .replace('{name}', props.entry.file.name),
)

// group.js L773：rationale || fallback
const rationaleContent = computed(() =>
  props.item.rationale || props.rationaleFallback,
)
</script>

<template>
  <article class="compare-focus-frame">
    <!-- group.js L743-776：article.compare-focus-frame -->
    <!-- group.js L746-756：button.compare-focus-media（点击进入沉浸对比） -->
    <button
      class="compare-focus-media"
      type="button"
      :aria-label="resolvedZoomAria"
      @click="emit('zoom')"
    >
      <img
        :src="props.entry.objectURL"
        :alt="resolvedAlt"
        :width="props.entry.width"
        :height="props.entry.height"
        loading="lazy"
        decoding="async"
      >
      <!-- group.js L753-754：FRAME 编号 + 名次角标 -->
      <span>{{ badgeText }}</span>
    </button>

    <!-- group.js L758-774：body 区 -->
    <div class="compare-focus-body">
      <!-- group.js L760-767：评分行 = 文件名 + 分数 -->
      <div class="compare-focus-score">
        <h4 :title="props.entry.file.name">
          <UiFileName :name="props.entry.file.name" />
        </h4>
        <strong>{{ displayScore }}{{ props.scoreSuffix }}</strong>
      </div>
      <!-- group.js L768-770：「优势与限制」标签 -->
      <span class="compare-focus-label">{{ props.rationaleLabel }}</span>
      <!-- group.js L771-773：rationale Markdown（空串走 fallback） -->
      <div class="compare-focus-rationale">
        <UiBaseMarkdown :content="rationaleContent" final />
      </div>
    </div>
  </article>
</template>

<style scoped>
/* venus group.css L218-222：frame 壳。
 * 沉浸态配色经 --cmp-* 自定义属性继承（FocusCompare 下发，缺省回退基态 token）。 */
.compare-focus-frame {
  min-width: 0;
  border: 1px solid var(--cmp-hairline, var(--hairline));
  background: var(--cmp-surface, var(--paper-raised));
}

/* venus group.css L224-237：§9.8 统一视框 4/3 + darkroom 中性背景；
 * button 重置（padding/border 归零）；cursor: zoom-in 表达可放大 */
.compare-focus-media {
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: 0;
  aspect-ratio: 4 / 3;
  padding: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 0;
  background: var(--darkroom);
  cursor: zoom-in;
}

/* venus group.css L239-245：§2.1 contain 不裁切 */
.compare-focus-media img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* venus group.css L247-257：左下 FRAME 角标。
 * --on-dark 双主题同值 #f1ede3（style.css L17/L108），直接赋值 */
.compare-focus-media > span {
  --on-dark: #f1ede3;

  position: absolute;
  z-index: 1;
  left: 12px;
  bottom: 12px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: rgba(12, 11, 10, 0.8);
  color: var(--on-dark);
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
}

/* venus group.css L428-434：键盘焦点外环（frame 不加 contain，无裁切） */
.compare-focus-media:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

/* venus group.css L259-261 */
.compare-focus-body {
  padding: var(--space-5);
}

/* venus group.css L263-269 */
.compare-focus-score {
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
}

/* venus group.css L271-276；FileName 排版归此上下文（FileName.vue L12-13 委托） */
.compare-focus-score h4 {
  min-width: 0;
  display: flex;
  color: var(--cmp-ink, var(--ink));
  font-size: 15px;
}

/* venus group.css L278-282：§6.2 分数 tabular-nums；font 简写拆开 */
.compare-focus-score strong {
  flex-shrink: 0;
  color: var(--cmp-ink, var(--ink));
  font-family: var(--font-data);
  font-size: 18px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

/* venus group.css L155-160 + L284-287：amber mono 小字标签 */
.compare-focus-label {
  display: block;
  margin-top: var(--space-4);
  color: var(--amber);
  font-family: var(--font-data);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  line-height: 1.4;
}

/* venus group.css L289-294 */
.compare-focus-rationale {
  margin-top: 8px;
  color: var(--cmp-body, var(--ink-body));
  font-size: 14px;
  line-height: 1.72;
}

/* venus group.css L441/450：rationale 首尾 margin 修剪
 * （:deep() 先例 RankingCard L280-286） */
.compare-focus-rationale :deep(> :first-child) {
  margin-top: 0;
}

.compare-focus-rationale :deep(> :last-child) {
  margin-bottom: 0;
}
</style>
