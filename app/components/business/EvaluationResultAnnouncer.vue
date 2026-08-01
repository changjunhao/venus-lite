<script setup lang="ts">
/**
 * 无障碍结果播报（component-plan §2.4 L162）：§14.5 完成事件只播报一次。
 *
 * 抽取自 SingleEvaluationFlow L682 内联实现（其注释已文档化此抽取承诺：
 * 「待 Joint/Compare 复用时抽取为 EvaluationResultAnnouncer」）。
 *
 * - 纯展示：单 prop `message`，视觉隐藏（style.css L140-148 .visually-hidden）；
 * - `role="status"` 隐含 aria-live="polite"——message 由 Flow 在 onComplete
 *   中一次性赋值（新一轮开始时清空），保证只播报一次（group.js L570-575 先例）；
 * - 三 Flow（Single/Joint/Compare）共用，消除重复的 visually-hidden 样式声明。
 */
defineProps<{
  /** 播报文案（空字符串时屏幕阅读器不重复播报） */
  message: string
}>()
</script>

<template>
  <p class="visually-hidden" role="status">{{ message }}</p>
</template>

<style scoped>
/* style.css L140-148：§14.5 live region 视觉隐藏 */
.visually-hidden {
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  height: 1px;
  overflow: hidden;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}
</style>
