<script setup lang="ts">
import type { ExifData, ExifTagKey } from '#shared/types/evaluation'
import { formatExifSummary } from './ExifTagList.vue'

/**
 * 单图预览：Darkroom 图片舞台 + 帧号角标 + 文件信息行 + EXIF 标签列表
 * （component-plan §2.3 上传输入域，对应 venus single.html L88-97 .single-preview 块；
 * 行为来源 app.js L212-226：先显示图片，EXIF 异步到达后两阶段渲染）。
 *
 * - 零内部状态：无 watcher / 无 emits / 无 ref；显隐归调用方 v-if
 *   （venus .preview-container/.active 机制不搬——组件化后编排归 SingleEvaluationFlow）。
 * - objectURL 只读消费：URL 生命周期归 useImageSelection（onScopeDispose 兜底）；
 *   img 不加 :key——src patch 即可（revoke→替换在 composable 内同步完成，
 *   与 venus app.js L214-216 同语义；:key 强制元素重建会放大 revoked-URL 窗口）。
 * - frameLabel 品牌 mono 恒英文硬编码（先例 index.vue L158 / ResultSample L22-23）；
 *   结果区 REVIEWED FRAME 变体经 prop 覆盖。结果区实现时 stage 三元组
 *   （media + img + badge）可机械化提取为 ImageStage——props 已就位。
 * - 文案纯 props：alt 由调用方解析 i18n 后传入（§14.4 功能状态描述）。
 * - UiFileName 保障 §13.2（截断保留扩展名 + title 提供完整名）。
 * - 不加 loading="lazy"：选图后视口内主内容（先例 HomeContactSheet L23）。
 */
const props = withDefaults(
  defineProps<{
    /** 图片地址（objectURL），只读消费 */
    src: string
    /** 替代文本，描述功能状态（§14.4：「待评估照片预览」） */
    alt: string
    /** 文件名（UiFileName 截断展示，§13.2） */
    fileName: string
    /** 文件体积（bytes），经 formatFileSize 格式化 */
    fileSize: number
    /** 帧号角标（品牌 mono 恒英文）；结果区传 'REVIEWED FRAME' */
    frameLabel?: string
    /** EXIF 数据（异步到达；null = 未提取或无数据） */
    exif?: ExifData | null
    /** EXIF 标签文案，透传 UploadExifTagList（调用方 i18n 解析） */
    exifLabels?: Partial<Record<ExifTagKey, string>>
    /** 图片原始像素宽，防 CLS（先例 ResultSample L47-49） */
    imageWidth?: number
    /** 图片原始像素高，防 CLS */
    imageHeight?: number
  }>(),
  {
    frameLabel: 'SELECTED FRAME',
    exif: null,
    exifLabels: () => ({}),
    imageWidth: undefined,
    imageHeight: undefined,
  },
)

/**
 * 非空 EXIF（v-if 守卫 + 窄化类型供子组件消费）：
 * null / 全字段空值均返回 null（对齐 app.js L784 隐藏语义，防全 null 对象渲染空网格）。
 */
const exifData = computed<ExifData | null>(() => {
  const exif = props.exif
  if (exif == null || !Object.values(exif).some(v => v != null)) return null
  return exif
})

/** 信息行后缀：(体积) + EXIF 摘要（app.js L225：`${name} (${size})${exifInfo}`） */
const infoSuffix = computed(() => `(${formatFileSize(props.fileSize)})${formatExifSummary(props.exif)}`)
</script>

<template>
  <div class="single-preview">
    <div class="single-preview-media">
      <img
        class="preview-image"
        :src="props.src"
        :alt="props.alt"
        :width="props.imageWidth"
        :height="props.imageHeight"
        decoding="async"
      >
      <span class="single-preview-index" aria-hidden="true">{{ props.frameLabel }}</span>
    </div>
    <p class="preview-info"><UiFileName :name="props.fileName" /> {{ infoSuffix }}</p>
    <div v-if="exifData" class="exif-preview">
      <UploadExifTagList :exif="exifData" :labels="props.exifLabels" />
    </div>
  </div>
</template>

<style scoped>
/* venus style.css L708 */
.single-preview {
  margin-top: var(--space-5);
}

/* style.css L709-712 合并（.single-preview-media ∩ .image-stage 共享规则）；
 * --on-dark 组件局部（先例 UploadZone L146：tokens.css 不含该 token） */
.single-preview-media {
  --on-dark: #f1ede3;

  background: var(--darkroom);
  border-radius: var(--radius-md);
  display: grid;
  min-height: 480px;
  overflow: hidden;
  place-items: center;
  position: relative;
}

/* style.css L713-714（.single-preview-media img ∩ .preview-image 合并，
 * scoped 下单选择器即可覆盖） */
.preview-image {
  border-radius: 0;
  display: block;
  height: 100%;
  max-height: 680px;
  max-width: 100%;
  object-fit: contain;
  width: 100%;
}

/* style.css L715：帧号角标，Data Mono（§4.2 图像索引语义元素） */
.single-preview-index {
  background: rgba(12, 11, 10, 0.8);
  border-radius: var(--radius-sm);
  bottom: 14px;
  color: var(--on-dark);
  font: 500 10px/1 var(--font-data);
  left: 14px;
  letter-spacing: 0.05em;
  padding: 6px 8px;
  position: absolute;
}

/* style.css L716：文件信息行，次级信息 Data Mono（§9.6） */
.preview-info {
  color: var(--ink-muted);
  font: 500 11px/1.5 var(--font-data);
  margin-top: var(--space-3);
  text-align: left;
}

/* style.css L717：间距相对 info 行的布局上下文，归本组件所有
 * （ExifTagList 根为纯网格，结果区 ExifPanel 复用时自带间距语境） */
.exif-preview {
  border-top: 1px solid var(--hairline);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
}

/* style.css L1156：移动端收窄（同断点先例 UploadZone L233） */
@media (max-width: 767px) {
  .single-preview-media {
    min-height: 320px;
  }
}
</style>
