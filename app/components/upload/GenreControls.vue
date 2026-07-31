<script setup lang="ts">
/**
 * 门类控制区：门类下拉 + 可选逐图明细开关（component-plan L107），
 * 收敛 venus single.html L66-76 与 group-joint.html L57-69 的 .input-sheet-controls。
 *
 * - 纯布局组合：BaseSelect variant="field"（§9.2）+ BaseSwitch（§9.3），零自绘控件。
 * - showPerImage=false 时退化为 single 页单列布局（venus .single-controls L643）。
 * - 门类选项由调用方传入 SelectOption[]——venus 源中选项为静态 HTML（single.html L70-73），
 *   /api/metadata 从不填充下拉框，仅用于结果区标签解析；未来 useEvalMetadata 落地后
 *   由 flow 层组装选项（i18n 静态标签 → metadata 增强），本组件 props 契约即稳定接缝。
 * - 文案全部纯 props（先例同 SelectionToolbar）。
 * - 变更转发 genreChange / includePerImageChange：
 *   「使旧结果失效」（group.js L1083-1087 invalidateResult）归父级流程编排。
 * - genreOptions 应由调用方以 computed 或模块级常量提供稳定引用，
 *   避免每渲染重建数组触发 BaseSelect v-for diff。
 */
import type { SelectOption } from '~/components/ui/BaseSelect.vue'

const props = withDefaults(
  defineProps<{
    /** 门类选项（含 auto + 8 门类；venus single.html L70-73） */
    genreOptions: SelectOption[]
    /** 门类下拉标签（single.html L68「摄影门类」） */
    genreLabel: string
    /** 是否显示逐图明细开关（single=false, joint/compare=true） */
    showPerImage?: boolean
    /** 开关主文案（group-joint.html L67「包含逐图明细」） */
    perImageTitle?: string
    /** 开关副说明（§9.3 默认关闭时必须解释开启后的结果和成本） */
    perImageDescription?: string
    /** 禁用全部控件（评估加载中；group.js L1040-1041） */
    disabled?: boolean
  }>(),
  { showPerImage: false, perImageTitle: '', perImageDescription: '', disabled: false },
)

// venus 默认值：genre='auto'（HTML selected）、includePerImage=false（§9.3 默认关闭）
const genre = defineModel<string>('genre', { default: 'auto' })
const includePerImage = defineModel<boolean>('includePerImage', { default: false })

const emit = defineEmits<{
  /** group.js L1083-1086 genreSelect change → invalidateResult */
  genreChange: [value: string | number]
  /** group.js L1087 includePerImage change → invalidateResult */
  includePerImageChange: [value: boolean]
}>()
</script>

<template>
  <div
    class="input-sheet-controls"
    :class="{ 'input-sheet-controls-single': !props.showPerImage }"
  >
    <UiBaseSelect
      v-model="genre"
      :options="props.genreOptions"
      :label="props.genreLabel"
      variant="field"
      :disabled="props.disabled"
      @change="emit('genreChange', $event)"
    />
    <UiBaseSwitch
      v-if="props.showPerImage"
      v-model="includePerImage"
      :disabled="props.disabled"
      @change="emit('includePerImageChange', $event)"
    >
      {{ props.perImageTitle }}
      <template #description>{{ props.perImageDescription }}</template>
    </UiBaseSwitch>
  </div>
</template>

<style scoped>
/* venus style.css L635-642 .input-sheet-controls */
.input-sheet-controls {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: minmax(240px, 0.8fr) minmax(340px, 1.2fr);
  padding: var(--space-5) 0;
}

/* venus style.css L643 .single-controls 单列覆盖 */
.input-sheet-controls-single {
  grid-template-columns: minmax(280px, 520px);
}

/* venus style.css L1152 移动端折叠（断点同源 L1105） */
@media (max-width: 767px) {
  .input-sheet-controls {
    grid-template-columns: 1fr;
  }
}
</style>
