<script lang="ts">
/** 选项结构：`disabled` 供 FocusCompare 互斥禁用等场景由消费方驱动 */
export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}
</script>

<script setup lang="ts">
/**
 * 基础下拉框：外置标签 + 原生 select（DESIGN.md §9.2），options 数组驱动。
 *
 * - `field` 变体对应 venus `.control-field` 边框壳（门类选择）；
 *   `plain` 变体对应 `.compare-focus-controls label` 的无壳 grid（聚焦对比左右下拉）。
 * - 保留原生 select 键盘行为，不做 appearance 自绘（§9.2）。
 * - 双下拉互斥等业务语义归消费方（venus `updateFocusPair` 的替换策略），
 *   本组件仅以 `option.disabled` 提供机制。
 * - 零内部文案：label / error / 选项文案全部由调用方传入。
 */
const props = withDefaults(
  defineProps<{
    options: SelectOption[]
    label: string
    variant?: 'field' | 'plain'
    disabled?: boolean
    error?: string
  }>(),
  { variant: 'field', disabled: false, error: undefined },
)

const model = defineModel<string | number>({ required: true })

const emit = defineEmits<{ change: [value: string | number] }>()

// SSR 水合安全的 id，label-for 与 aria-describedby 共用
const id = useId()
const errorId = computed(() => `${id}-error`)

const classes = computed(() => [
  'control-field',
  `control-field-${props.variant}`,
  ...(props.error ? ['control-field-error'] : []),
])

// DOM select.value 恒为 string，回查 options 保留 number 类型
function onChange(event: Event) {
  const raw = (event.target as HTMLSelectElement).value
  const matched = props.options.find(option => String(option.value) === raw)
  if (!matched) return
  model.value = matched.value
  emit('change', matched.value)
}
</script>

<template>
  <div :class="classes">
    <label class="control-label" :for="id">{{ props.label }}</label>
    <select
      :id="id"
      class="control-select"
      :value="model"
      :disabled="props.disabled"
      :aria-invalid="props.error ? 'true' : undefined"
      :aria-describedby="props.error ? errorId : undefined"
      @change="onChange"
    >
      <option
        v-for="option in props.options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
    <p v-if="props.error" :id="errorId" class="control-error">{{ props.error }}</p>
  </div>
</template>

<style scoped>
/* §9.2：48px 高、paper-raised、1px hairline-strong、radius-sm（值取自 venus .control-field select）。
 * 焦点样式不在此声明，由 main.css 全局 :focus-visible（2px --focus 外环）覆盖。 */
.control-select {
  background: var(--paper-raised);
  border: 1px solid var(--hairline-strong);
  border-radius: var(--radius-sm);
  color: var(--ink);
  font: 500 13px var(--font-ui);
  min-height: 48px;
  min-width: 0;
  /* 右 36px 为原生箭头留白，保留原生 appearance（§9.2） */
  padding: 0 36px 0 var(--space-3);
  transition: border-color var(--motion-fast) var(--ease-standard);
}

.control-select:disabled {
  background: var(--paper-recessed);
  color: var(--ink-muted);
  cursor: not-allowed;
}

/* 标签外置，不依赖 placeholder（§9.2） */
.control-label {
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
}

/* field 变体：venus .control-field 边框壳 */
.control-field-field {
  align-items: center;
  background: var(--paper);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  justify-content: space-between;
  min-height: 76px;
  padding: 14px var(--space-4);
}

.control-field-field .control-select {
  max-width: 190px;
}

/* plain 变体：venus .compare-focus-controls label，无壳 grid */
.control-field-plain {
  align-items: center;
  display: grid;
  gap: var(--space-4);
  grid-template-columns: auto minmax(0, 1fr);
  min-width: 0;
}

.control-field-plain .control-label {
  font-size: 13px;
}

/* §9.2 错误态：错误文字 + aria-describedby，边框转 oxide；错误行占满整行 */
.control-error {
  color: var(--oxide);
  flex-basis: 100%;
  font-size: 14px;
  grid-column: 1 / -1;
  margin: 0;
}

.control-field-error .control-select {
  border-color: var(--oxide);
}

/* 移动端收窄为纵向、select 全宽（venus §13.1 折叠策略） */
@media (max-width: 767px) {
  .control-field-field {
    align-items: flex-start;
    flex-direction: column;
  }

  .control-field-field .control-select {
    max-width: none;
    width: 100%;
  }

  .control-field-plain {
    gap: var(--space-2);
    grid-template-columns: 1fr;
  }
}
</style>
