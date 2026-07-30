<script setup lang="ts">
/**
 * 基础开关：label 整体可点 + 原生 checkbox（DESIGN.md §9.3），对应 venus `.detail-switch`。
 *
 * - 只用于可立即生效的二元设置（如「包含逐图明细」），非即时生效场景应改用其他控件。
 * - 零内部文案：主文案走 default slot，副说明走 description slot；
 *   默认关闭时由调用方在副说明中解释开启后的结果和成本（§9.3 约束归调用方）。
 * - 原生 checkbox + role="switch"：checked 状态由浏览器映射无障碍语义，
 *   Space 切换等键盘行为免自实现，不手写 aria-checked。
 */
const props = withDefaults(
  defineProps<{
    disabled?: boolean
  }>(),
  { disabled: false },
)

const model = defineModel<boolean>({ required: true })

const emit = defineEmits<{ change: [value: boolean] }>()

// SSR 水合安全的 id，label-for 显式关联（label 包裹之外的双保险）
const id = useId()

function onChange(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  model.value = checked
  emit('change', checked)
}
</script>

<template>
  <label
    class="detail-switch"
    :class="{ 'detail-switch-disabled': props.disabled }"
    :for="id"
  >
    <input
      :id="id"
      type="checkbox"
      role="switch"
      :checked="model"
      :disabled="props.disabled"
      @change="onChange"
    >
    <span class="switch-track" aria-hidden="true"><span /></span>
    <span class="switch-copy">
      <strong><slot /></strong>
      <small v-if="$slots.description"><slot name="description" /></small>
    </span>
  </label>
</template>

<style scoped>
/* venus .detail-switch 外壳：76px 高整体可点，已覆盖 44px 触控目标（§13.1）。
 * 14px 竖向 padding 沿用 BaseSelect .control-field-field 的既有先例。 */
.detail-switch {
  align-items: center;
  background: var(--paper);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: grid;
  gap: 14px;
  grid-template-columns: auto 1fr;
  min-height: 76px;
  padding: 14px var(--space-4);
}

/* checkbox 视觉隐藏但保留焦点与键盘行为 */
.detail-switch input {
  opacity: 0;
  pointer-events: none;
  position: absolute;
}

/* §9.3：轨道 40×22px，关闭态用 Hairline Strong；仅颜色过渡（180ms） */
.switch-track {
  background: var(--paper-recessed);
  border: 1px solid var(--hairline-strong);
  border-radius: var(--radius-full);
  height: 22px;
  padding: 1px;
  transition: background-color var(--motion-standard) var(--ease-standard),
    border-color var(--motion-standard) var(--ease-standard);
  width: 40px;
}

/* Thumb 18px，位移只用 transform，不触发布局；
 * reduced-motion 时长由 tokens.css 全局降为 1ms，此处无需处理 */
.switch-track span {
  background: var(--ink-muted);
  border-radius: 50%;
  display: block;
  height: 18px;
  transition: transform var(--motion-standard) var(--ease-standard),
    background-color var(--motion-standard) var(--ease-standard);
  width: 18px;
}

/* §9.3：开启使用 Amber */
.detail-switch input:checked + .switch-track {
  background: var(--amber);
  border-color: var(--amber);
}

.detail-switch input:checked + .switch-track span {
  background: var(--paper-raised);
  transform: translateX(18px);
}

/* input 视觉隐藏，全局 :focus-visible 外环不可见，焦点环转移到轨道上（§14.3） */
.detail-switch input:focus-visible + .switch-track {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.switch-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.switch-copy strong {
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
}

.switch-copy small {
  color: var(--ink-muted);
  font-size: 12px;
  line-height: 1.45;
}

/* 禁用态：透明度值对齐 BaseButton .text-button:disabled 先例 */
.detail-switch-disabled {
  cursor: not-allowed;
}

.detail-switch-disabled .switch-track,
.detail-switch-disabled .switch-copy {
  opacity: 0.45;
}
</style>
