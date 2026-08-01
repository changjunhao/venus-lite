<script setup lang="ts">
import type { ImageEntry } from '~/composables/useImageSelection'

/**
 * 结果接触印样：FRAME 编号图组（component-plan L126），收敛 venus
 * group.js L639-653 renderResultContactSheet 的 DOM 操作为声明式组件。
 *
 * - §9.7：联合评估保留自然宽高比——2 列网格 + height:auto，帧无背景
 *   因而不产生黑块空隙（style.css L1006 源注释）。
 * - §10.3：接触印样保留在结果旁；原始索引即 FRAME 编号（§9.7「图片
 *   底部固定显示原始索引」），补零生成恒为英文（§4.2 品牌 mono 语言，
 *   先例 HomeContactSheet L38 frameIndex）。
 * - 数据流单向：entries 从 useImageSelection → Flow → 本组件只读消费
 *   （PreviewGrid L27 先例）；结果印样为一次性静态渲染，无增删重排，
 *   不含 TransitionGroup（区别于输入态 PreviewGrid）。
 * - img 绑定 width/height 原生属性（ImageEntry 已有自然尺寸，
 *   useImageSelection L38-39）防 CLS；不加 loading="lazy"——
 *   组件位于 sticky 列始终可见（HomeContactSheet L23 先例）。
 * - 纯 props 组件不内嵌 $t()：alt 模板由调用方传入 i18n 键
 *   （result.contactPhotoAlt），{index} 替换为 1-based 序号
 *   （PreviewGrid L33 altTemplate 先例；源 group.js L647
 *   `系列中的第 ${index + 1} 张照片`）。
 * - 不含 .joint-contact-column 暗色外壳与 CardHeading——归 Flow 编排
 *   （group-joint.html L109-110 静态结构；ScorePanel L18-19 先例：
 *   布局归 Flow 组件）。
 * - 空 entries 不做 v-if 守卫——隐藏归 Flow（贴源 L640-641 仅
 *   null-check 容器）。
 * - 纯展示：无状态、无 watcher、无 computed，SSR 零额外客户端开销。
 */
const props = defineProps<{
  /** 已选文件条目（useImageSelection().entries 只读消费） */
  entries: ImageEntry[]
  /** 图片 alt 模板，{index}=1-based 序号（§14.4） */
  altTemplate: string
  /** 容器 aria-label（group-joint.html L111「系列照片接触印样」） */
  ariaLabel: string
}>()

/** FRAME 编号按序补零生成（group.js L649） */
const frameIndex = (index: number) => `FRAME ${String(index + 1).padStart(2, '0')}`

/** alt 模板插值：{index} → 1-based 序号（PreviewGrid L64-66 简化版） */
const resolveAlt = (template: string, index: number) =>
  template.replace('{index}', String(index + 1))
</script>

<template>
  <!-- group-joint.html L111：aria-label 标注的接触印样容器 -->
  <div class="result-contact-sheet" :aria-label="props.ariaLabel">
    <!-- group.js L642-652：figure + img + figcaption -->
    <figure
      v-for="(entry, index) in props.entries"
      :key="entry.id"
      class="result-contact-frame"
    >
      <img
        :src="entry.objectURL"
        :alt="resolveAlt(props.altTemplate, index)"
        :width="entry.width"
        :height="entry.height"
      >
      <figcaption>{{ frameIndex(index) }}</figcaption>
    </figure>
  </div>
</template>

<style scoped>
/* 自然比例接触印样（style.css L1007）：保持系列顺序按行排列，
 * 帧无背景因而不产生黑块空隙。列间隙 8px 贴源保留（非 §7.1 梯度值，
 * 先例 MetadataStrip L79）；行间隙 --space-4 = 16px。
 * 不做响应式变列：源无媒体查询，容器位于 4.5fr 暗色列（桌面）/
 * max-width 760px 静态块（移动端），2 列在两场景均合理。 */
.result-contact-sheet {
  align-items: start;
  display: grid;
  gap: var(--space-4) 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* style.css L1008 */
.result-contact-frame {
  background: transparent;
  margin: 0;
  min-width: 0;
}

/* style.css L1009；height:auto + width/height 属性 = 比例保留 + 零 CLS */
.result-contact-frame img {
  display: block;
  height: auto;
  object-fit: contain;
  width: 100%;
}

/* style.css L1010；--on-dark-muted 不在 tokens.css（DESIGN.md §16 未定义，
 * HomeContactSheet L74-75 先例：归组件局部），用 light-dark() 对齐 venus
 * 双主题源值（style.css L18 / L109）；font 简写拆开（MetadataStrip L83 先例）；
 * padding 6px 贴源保留 */
.result-contact-frame figcaption {
  --on-dark-muted: light-dark(#aaa296, #9e9689);

  color: var(--on-dark-muted);
  font-family: var(--font-data);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.06em;
  line-height: 1;
  padding: 6px 0 0;
}
</style>
