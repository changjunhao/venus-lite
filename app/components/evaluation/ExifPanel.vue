<script setup lang="ts">
/**
 * 结果区 EXIF 折叠面板：BaseCollapsible 包裹 + label/value 双行网格
 * （component-plan L123），对应 venus single.html L166-171 #exif-section +
 * app.js L576-610 renderExifSection + style.css L718-725。
 *
 * - 默认展开（single.html L167 class="collapsible open" aria-expanded="true"；
 *   DESIGN §9.14「默认展开用户最需要的结果」）——与 ProcessTimeline 默认折叠相反。
 * - 根级 v-if="items.length"：exif 为 null/空对象/全字段 null 时不渲染
 *   （app.js L578-581 display:none 的 Vue 等价；DESIGN §2.5「为空时不显示容器」）。
 * - 字段顺序与格式化复用 ExifTagList 具名导出（EXIF_FIELD_ORDER / formatExifValue），
 *   零重复实现；跨目录导入先例 SinglePreview.vue L3。
 *   venus 原版用 Object.entries（依赖键插入序），此处以锁定序替代——确定性优先。
 * - labels 由调用方解析 i18n（result.exif.* 长标签键——对齐 app.js L584-593，
 *   与 upload.exif.* 短标签为有意双键集）后传入；
 *   缺键回退原始字段名（app.js L598 labels[key] || key）。
 * - 不含 .card.report-disclosure 外壳——卡片归 Flow 以 BaseCard variant="plain"
 *   包裹（ProcessTimeline L16-18 先例；single.html L166 页面级结构分工）。
 * - SSR 安全：exif 来自客户端 useExif（SSR 期恒为 null），面板服务端自然不渲染，
 *   无水合不匹配；未来 Flow 集成无需 <ClientOnly>。
 */
import type { ExifData, ExifTagKey } from '#shared/types/evaluation'
import { EXIF_FIELD_ORDER, formatExifValue } from '../upload/ExifTagList.vue'

interface ExifItem {
  key: ExifTagKey
  label: string
  value: string
}

const props = withDefaults(
  defineProps<{
    /** EXIF 数据（null/空对象时组件不渲染；app.js L578-581） */
    exif?: ExifData | null
    /** 折叠标题（Flow 解析 result.exifTitle 键；single.html L168） */
    title: string
    /** 字段标签（调用方 i18n 解析 result.exif.* 后传入）；缺键回退原始字段名 */
    labels: Partial<Record<ExifTagKey, string>>
  }>(),
  { exif: null },
)

// venus 默认展开（single.html L167）；Flow 可经 v-model:open 控制
const open = defineModel<boolean>('open', { default: true })

// 单遍 O(8) 遍历锁定序（上游 useExif 为 shallowRef，仅追踪引用变化）
const items = computed<ExifItem[]>(() => {
  if (!props.exif) return []
  const result: ExifItem[] = []
  for (const key of EXIF_FIELD_ORDER) {
    const raw = props.exif[key]
    if (raw == null) continue
    result.push({ key, label: props.labels[key] ?? key, value: formatExifValue(key, raw) })
  }
  return result
})
</script>

<template>
  <UiBaseCollapsible v-if="items.length" v-model:open="open">
    <template #header>{{ props.title }}</template>
    <!-- venus style.css L718-725：4 列 1px gap hairline 网格，label/value 双行 -->
    <div class="exif-grid">
      <div v-for="item in items" :key="item.key" class="exif-item">
        <span class="exif-label">{{ item.label }}</span>
        <span class="exif-value">{{ item.value }}</span>
      </div>
    </div>
  </UiBaseCollapsible>
</template>

<style scoped>
/* venus style.css L718-719（与 ExifTagList .exif-preview-grid 共享网格定义，
 * 选择器独立——结果区为 label/value 分离结构） */
.exif-grid {
  background: var(--hairline);
  border: 1px solid var(--hairline);
  display: grid;
  gap: 1px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

/* venus group.css L35-38 防御性兜底 */
.exif-grid:empty {
  display: none;
}

/* venus style.css L720-721 */
.exif-item {
  background: var(--paper);
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
}

/* venus style.css L722-723 */
.exif-label {
  color: var(--ink-muted);
  font: 500 10px/1.3 var(--font-data);
}

/* venus style.css L724-725 */
.exif-value {
  color: var(--ink);
  font: 500 13px/1.4 var(--font-ui);
}
</style>
