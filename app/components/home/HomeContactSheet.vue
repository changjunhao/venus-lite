<script lang="ts">
/** 单帧结构：width/height 为原始像素尺寸，传入时绑定 img 以防 CLS */
export interface ContactSheetFrame {
  src: string
  alt: string
  /** figcaption 第二个 span（如 LANDSCAPE / LIGHT / RHYTHM） */
  caption: string
  width?: number
  height?: number
}
</script>

<script setup lang="ts">
/**
 * 首页三帧接触印样示例（DESIGN.md §10.1 Hero 右侧 4 列 / §4.2 品牌语言），
 * 对应 venus index.html L57-74 的 `aside.home-contact-sheet`，
 * 由 HomeHero 编排消费（component-plan §2.3 首页展示域）。
 *
 * - 文案与图片全部 props 化，纯 props 组件不内嵌 $t()：由调用方解析
 *   i18n 后传入（先例同 PageHero / CardHeading）。
 * - FRAME 编号按 frames 顺序补零生成而非 prop：编号即顺序语义
 *   （component-plan「figure + FRAME 编号」），且品牌 mono 语言恒为英文。
 * - img 不加 loading="lazy"：三帧均为首屏 Hero 内容。
 * - 注记行仅在 noteLabel / noteText 任一非空时渲染。
 */
const props = withDefaults(
  defineProps<{
    /** 按序渲染；首帧自动加 contact-frame-primary（跨两行） */
    frames: ContactSheetFrame[]
    /** aside 地标名（venus 源值「摄影作品接触印样示例」由调用方传） */
    ariaLabel: string
    noteLabel?: string
    noteText?: string
  }>(),
  { noteLabel: '', noteText: '' },
)

const frameIndex = (index: number) => `FRAME ${String(index + 1).padStart(2, '0')}`
</script>

<template>
  <aside class="home-contact-sheet" :aria-label="props.ariaLabel">
    <figure
      v-for="(frame, index) in props.frames"
      :key="frame.src"
      class="contact-frame"
      :class="{ 'contact-frame-primary': index === 0 }"
    >
      <img
        :src="frame.src"
        :alt="frame.alt"
        :width="frame.width"
        :height="frame.height"
        decoding="async"
      >
      <figcaption>
        <span>{{ frameIndex(index) }}</span>
        <span>{{ frame.caption }}</span>
      </figcaption>
    </figure>
    <div v-if="props.noteLabel || props.noteText" class="contact-sheet-note">
      <span>{{ props.noteLabel }}</span>
      <p>{{ props.noteText }}</p>
    </div>
  </aside>
</template>

<style scoped>
/* venus style.css L346-357 逐属性对齐。
 * --on-dark / --on-dark-muted 不在 tokens.css（DESIGN.md §16 未定义，
 * CardHeading 先例：归组件局部），用 light-dark() 对齐 venus 双主题源值，
 * color-scheme 已由 tokens.css 三态级联管理。 */
.home-contact-sheet {
  --on-dark: #f1ede3;
  --on-dark-muted: light-dark(#aaa296, #9e9689);

  background: var(--darkroom);
  border-radius: var(--radius-lg);
  display: grid;
  gap: 10px;
  grid-template-columns: 1.25fr 0.75fr;
  grid-template-rows: 1fr 1fr auto;
  min-height: 560px;
  overflow: hidden;
  padding: var(--space-6);
  position: relative;
}

/* 四角 12×1px 裁切角（style.css L359-378），Amber 小面积品牌语言（§4.2） */
.home-contact-sheet::before {
  --crop-color: var(--amber);

  background:
    linear-gradient(var(--crop-color), var(--crop-color)) top left / 12px 1px,
    linear-gradient(var(--crop-color), var(--crop-color)) top left / 1px 12px,
    linear-gradient(var(--crop-color), var(--crop-color)) top right / 12px 1px,
    linear-gradient(var(--crop-color), var(--crop-color)) top right / 1px 12px,
    linear-gradient(var(--crop-color), var(--crop-color)) bottom left / 12px 1px,
    linear-gradient(var(--crop-color), var(--crop-color)) bottom left / 1px 12px,
    linear-gradient(var(--crop-color), var(--crop-color)) bottom right / 12px 1px,
    linear-gradient(var(--crop-color), var(--crop-color)) bottom right / 1px 12px;
  background-repeat: no-repeat;
  content: "";
  inset: 14px;
  pointer-events: none;
  position: absolute;
  z-index: 2;
}

/* style.css L383-390 */
.contact-frame {
  background: var(--darkroom-raised);
  display: flex;
  flex-direction: column;
  margin: 0;
  min-width: 0;
  overflow: hidden;
}

/* 首帧跨两行（style.css L391） */
.contact-frame-primary {
  grid-row: 1 / 3;
}

/* style.css L392；main.css 全局仅兜底 display/max-width，此处声明完整规则 */
.contact-frame img {
  display: block;
  height: 100%;
  min-height: 0;
  object-fit: contain;
  width: 100%;
}

/* style.css L393-402 */
.contact-frame figcaption {
  align-items: center;
  color: var(--on-dark-muted);
  display: flex;
  font: 500 9px/1 var(--font-data);
  justify-content: space-between;
  letter-spacing: 0.06em;
  min-height: 34px;
  padding: 0 10px;
}

/* style.css L403-413 */
.contact-sheet-note {
  align-items: baseline;
  color: var(--on-dark-muted);
  display: flex;
  gap: var(--space-5);
  grid-column: 1 / -1;
  justify-content: space-between;
  padding-top: var(--space-4);
}

.contact-sheet-note span {
  font: 500 10px/1 var(--font-data);
  letter-spacing: 0.06em;
}

.contact-sheet-note p {
  color: var(--on-dark);
  font-family: var(--font-display);
  font-size: 15px;
  line-height: 1.5;
  max-width: 240px;
}

/* venus style.css L1070 */
@media (max-width: 1279px) {
  .home-contact-sheet {
    min-height: 500px;
    padding: var(--space-5);
  }
}

/* venus style.css L1082：Hero 单列后限宽居中 */
@media (max-width: 1023px) {
  .home-contact-sheet {
    min-height: 600px;
    width: min(720px, 100%);
  }
}

/* venus style.css L1128-1129 */
@media (max-width: 767px) {
  .home-contact-sheet {
    min-height: 470px;
    padding: var(--space-4);
  }

  .contact-sheet-note {
    flex-direction: column;
    gap: var(--space-2);
  }
}

/* venus style.css L1180-1181：窄屏收窄列比并隐藏图注标题 */
@media (max-width: 479px) {
  .home-contact-sheet {
    grid-template-columns: 1.2fr 0.8fr;
    min-height: 400px;
  }

  .contact-frame figcaption span:last-child {
    display: none;
  }
}
</style>
