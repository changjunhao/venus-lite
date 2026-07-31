<script lang="ts">
import type { ExifData, ExifTagKey } from '#shared/types/evaluation'

/** 展示顺序锁定（对齐 venus app.js L790-794 labels 映射序），不依赖对象键插入序 */
export const EXIF_FIELD_ORDER: ExifTagKey[] = [
  'cameraModel', 'lensModel', 'fNumber', 'shutterSpeed',
  'iso', 'focalLength', 'dateTimeOriginal', 'flash',
]

/**
 * EXIF 值展示格式化（逐行移植 venus app.js L800-803）：
 * fNumber → f/x.x（toFixed(1) 防 rational 误读），focalLength → xmm，其余原样。
 */
export function formatExifValue(key: ExifTagKey, value: string | number): string {
  if (key === 'fNumber' && typeof value === 'number') return `f/${value.toFixed(1)}`
  if (key === 'focalLength' && typeof value === 'number') return `${value}mm`
  return String(value)
}

/**
 * EXIF 摘要用于文件名行（逐行移植 venus app.js L840-848 formatExifSummary）：
 * 仅 cameraModel / fNumber / shutterSpeed / iso / focalLength 参与，
 * ` · ` 连接、非空前缀 ` — `，无数据返回空串。
 * iso 前缀 ISO（与标签行的纯数值展示区分——标签行不加前缀，app.js L803）。
 */
export function formatExifSummary(exif: ExifData | null | undefined): string {
  if (!exif) return ''
  const parts: string[] = []
  if (exif.cameraModel) parts.push(exif.cameraModel)
  if (exif.fNumber != null) parts.push(`f/${exif.fNumber.toFixed(1)}`)
  if (exif.shutterSpeed) parts.push(exif.shutterSpeed)
  if (exif.iso != null) parts.push(`ISO${exif.iso}`)
  if (exif.focalLength != null) parts.push(`${exif.focalLength}mm`)
  return parts.length > 0 ? ` — ${parts.join(' · ')}` : ''
}
</script>

<script setup lang="ts">
/**
 * EXIF 标签行：相机/镜头/光圈/快门/ISO/焦距等格式化为标签网格
 * （component-plan §2.3 上传输入域，来源 venus app.js renderUploadExif L782-807）。
 *
 * - 根为纯内容网格——间距包装层 .exif-preview（style.css L717 的 border-top/间距）
 *   归调用方：输入区（SinglePreview）与结果区（ExifPanel，BaseCollapsible 内）
 *   间距上下文不同，纯网格使两处均可直接复用。
 * - 展示顺序由 EXIF_FIELD_ORDER 常量锁定，确定性渲染。
 * - 文案纯 props：labels 由调用方解析 i18n 后传入（先例 UploadZone）；
 *   缺键回退原始字段名（app.js L799 `labels[key] || key`）。
 */

interface ExifTag {
  key: ExifTagKey
  label: string
  value: string
}

const props = defineProps<{
  /** EXIF 数据（父级 v-if 保证非空才挂载） */
  exif: ExifData
  /** 字段标签（调用方 i18n 解析后传入）；缺键回退原始字段名 */
  labels: Partial<Record<ExifTagKey, string>>
}>()

const tags = computed<ExifTag[]>(() => {
  const result: ExifTag[] = []
  for (const key of EXIF_FIELD_ORDER) {
    const raw = props.exif[key]
    if (raw == null) continue
    result.push({ key, label: props.labels[key] ?? key, value: formatExifValue(key, raw) })
  }
  return result
})
</script>

<template>
  <div class="exif-preview-grid">
    <span
      v-for="tag in tags"
      :key="tag.key"
      class="exif-tag"
      :title="`${tag.label} ${tag.value}`"
    >{{ tag.label }} {{ tag.value }}</span>
  </div>
</template>

<style scoped>
/* venus style.css L718-719 逐属性对齐（仅搬 .exif-preview-grid 选择器，
 * .exif-grid 归未来 ExifPanel）。4 列 1px gap hairline 网格无移动端断点——贴源。 */
.exif-preview-grid {
  background: var(--hairline);
  border: 1px solid var(--hairline);
  display: grid;
  gap: 1px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

/* venus group.css L35-38 防御性兜底：全空时隐藏 */
.exif-preview-grid:empty {
  display: none;
}

/* venus group.css L40-50（single.html L25-26 同时加载 style.css 与 group.css，
 * 该规则在单图页上传预览实际生效；style.css L720-725 的 item/label/value 为死代码不迁） */
.exif-tag {
  background: var(--paper);
  color: var(--ink-body);
  display: block;
  font: 500 11px/1.4 var(--font-data);
  min-width: 0;
  overflow: hidden;
  padding: 10px 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
