<script setup lang="ts">
/**
 * 行内错误提示：常驻 `role="alert"` 容器（DESIGN.md §9.15 Inline error / §14.5），
 * 对应 venus `.error-message`。
 *
 * - 内容走 `message` prop 而非 default slot（偏离「零内部文案」惯例的原因）：
 *   alert 容器需常驻无障碍树、由文本注入触发播报，字符串 prop 与 venus
 *   `showError(message)` 一一对应，组件也因此能自知内容为空时收起。
 * - 根元素不用 v-if：卸载重挂会让首个错误可能不被屏幕阅读器播报，
 *   与 venus 常驻 `div[role=alert]` 的既有模式保持一致。
 * - 错误文案语气与摆放位置（最接近出错控件）归调用方职责（§9.15、§15.4）。
 */
const props = withDefaults(
  defineProps<{
    message?: string
  }>(),
  { message: '' },
)
</script>

<template>
  <div class="error-message" :class="{ active: !!props.message }" role="alert">{{ props.message }}</div>
</template>

<style scoped>
/* venus .error-message 逐属性对齐。
 * - 2px oxide 左边线沿用源：§8.2 的「1px Oxide 边框」针对控件错误态，
 *   2px 左边线是 §9.12 认可的强调图形语言；
 * - padding 14px 沿用源（BaseSwitch/BaseSelect 已有 14px 先例）；
 * - 无过渡动效：源无、§12.3 允许清单亦无，错误出现应即时（Calm precision）。 */
.error-message {
  background: color-mix(in srgb, var(--oxide) 7%, var(--paper));
  border-left: 2px solid var(--oxide);
  color: var(--oxide);
  display: none;
  font-size: 14px;
  margin: 0;
  padding: 12px 14px;
}

.error-message.active {
  display: block;
}
</style>
