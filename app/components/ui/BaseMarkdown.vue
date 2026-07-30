<script setup lang="ts">
import MarkdownRender from 'markstream-vue'

/**
 * Markdown 渲染统一出口：薄封装 markstream-vue 的 MarkdownRender
 * （component-plan.md §2.2/§四.7），替代 venus 全部 `innerHTML = renderMarkdown()`，
 * 业务/高阶组件不得直接依赖该库。
 *
 * - 静态场景（点评三章、rationale、逐图明细、过程步骤等）：传完整 `content`
 *   并置 `final: true`；流式场景（StreamReasoning）：传持续累积的 `content`，
 *   `agent_complete` 事件后置 `final: true`，renderer 自动失效 stream cache
 *   并收敛未闭合结构。
 * - `custom-id="venus"` 硬编码：限定样式作用域，为后续
 *   `setCustomComponents('venus', …)` 预留扩展点。
 * - `mode="minimal"` 硬编码：venus 报告是编辑排版而非聊天面，取库的轻量默认值，
 *   规避 docs 模式默认开启的 fade/tooltips。
 * - `:fade="false"` 与不设 typewriter：§12.4 禁止闪烁与逐字打字；
 *   `smooth-streaming="auto"` 是块级 pacing 而非逐字动效，属计划文档既定选型。
 */
const props = withDefaults(
  defineProps<{
    content: string
    final?: boolean
  }>(),
  { final: false },
)
</script>

<template>
  <MarkdownRender
    :content="props.content"
    :final="props.final"
    custom-id="venus"
    smooth-streaming="auto"
    mode="minimal"
    :fade="false"
  />
</template>

<style scoped>
/* 排版与颜色桥接：库的 --ms-* 颜色主变量是 HSL 三元组（经 hsl() 消费），
 * 不能直接赋 hex token，故只覆盖排版变量与接受完整颜色值的派生变量；
 * 文字主色不在此设置——库基础规则无 color，自然继承 body 的 --ink-body，
 * token 随 Paper/Darkroom 自动切换，无需库的 .dark 机制。
 * 阅读宽度（§9.12 的 42rem）归调用方上下文，组件不设 max-width。 */
.markstream-vue {
  /* §6.1 字体职责：正文 UI Sans、代码 Data Mono */
  --ms-font-sans: var(--font-ui);
  --ms-font-mono: var(--font-data);

  /* §6.2 Body：16px / 1.7，段落间距 0.8em（不通过首行缩进区分） */
  --ms-text-body: 16px;
  --ms-leading-body: 1.7;
  --ms-flow-paragraph-y: 0.8em;

  /* §6.2 中文 Display 不使用小于 500 的字重 */
  --ms-weight-h1: 500;
  --ms-weight-h2: 500;
  --ms-weight-h3: 500;

  /* §5.1/§8.2 语义色与细线：amber 承担链接强调，hairline 承担分隔 */
  --link-color: var(--amber);
  --blockquote-border: var(--hairline);
  --hr-border: var(--hairline);
  --inline-code-bg: var(--paper-recessed);
  --inline-code-fg: var(--ink-body);
  --inline-code-border: var(--hairline);
  --list-marker: var(--ink-muted);
  --list-counter-marker: var(--ink-muted);
}

/* venus .critique-text strong 逐属性对齐（style.css L936-938） */
:deep(strong) {
  color: var(--ink);
  font-weight: 600;
}

/* §6.1 章节标题归 Display Serif；库标题继承 --ms-font-sans，需显式改回 */
:deep(h1),
:deep(h2),
:deep(h3) {
  color: var(--ink);
  font-family: var(--font-display);
}
</style>
