<script setup lang="ts">
/**
 * 双图聚焦比较：左右下拉互斥选择 + CompareFrame×2 + CompareDelta +
 * 沉浸模式（component-plan L129），收敛 venus group.js L703-850
 * renderFocusCompare / renderFocusCompareGrid / openImmersiveCompare /
 * closeImmersiveCompare / updateFocusPair 全部交互逻辑为声明式组件。
 *
 * - 沉浸模式为「原位提升」（源 L798-817）：同一 section 添加 .is-immersive
 *   升级为 fixed dialog，不使用 BaseModal（其 Teleport + v-if 会销毁 DOM
 *   导致两张大图重解码与 markstream-vue 重建，且源无 backdrop）。
 *   focus trap 复用 useFocusTrap——component-plan §四.2「复用 BaseModal 的
 *   focus-trap 能力」即指此 composable（useFocusTrap.ts L15-16 指定消费方）。
 * - Esc + 滚动锁归本组件（useFocusTrap L18「Esc 等 dismissal 语义归调用方」），
 *   代码块与 BaseModal L32-57 同构。
 * - 关闭按钮 v-if 而非源 CSS display:none 切换（group.css L170-175）：
 *   useFocusTrap 不做可见性过滤（L21-22），display:none 元素会进入 Tab 循环
 *   造成焦点逃逸。
 * - 互斥选择逐行移植源 updateFocusPair（L840-850）：一侧选中对侧已选项时，
 *   对侧替换为 ranked 中首个 index≠next 者（非朴素交换——rank 序与 index 序
 *   不一致时行为不同）。
 * - 节级 v-if（ranked < 2 不渲染）贴源 L709-710：有意偏离「隐藏归 Flow」
 *   先例（RankingList L21）——此处是结构性不可能成对，非空数据语义。
 * - pair 校验 watch(ranked, immediate) 移植源 L713-716：重评估后旧 pair
 *   失效时回退前两名（兼作初始化，覆盖源 L549-552 complete 时的初始化）。
 * - 沉浸态配色经 --cmp-* 自定义属性继承下发子组件：一次 class 切换经纯 CSS
 *   级联完成全部重着色，无 prop 变更、无子树 patch。
 * - 约束：Flow 不得以 transform/filter/will-change 祖先包裹本组件——
 *   沉浸模式 position:fixed 相对最近变换祖先定位（源同约束，页面祖先干净）。
 * - 纯 props 组件不内嵌 $t()：文案由调用方解析 i18n 后传入，
 *   未传时回退中文默认（RankingCard L19-21 先例）。
 */
import type { SelectOption } from '~/components/ui/BaseSelect.vue'
import type { RankingItem } from '#shared/types/evaluation'
import type { ImageEntry } from '~/composables/useImageSelection'

const props = withDefaults(
  defineProps<{
    /** 排名数据（GroupCompareEvaluationResult.ranking，原始顺序任意） */
    items: RankingItem[]
    /** 已选文件条目（useImageSelection().entries 只读消费，按 index 查找） */
    entries: ImageEntry[]
    /** 眉标（§4.2 常量；group-compare.html L134） */
    eyebrow?: string
    /** 标题（group-compare.html L134「双图聚焦比较」） */
    title?: string
    /** 引言说明（group-compare.html L137） */
    intro?: string
    /** 左侧下拉标签（group-compare.html L139） */
    leftLabel?: string
    /** 右侧下拉标签（group-compare.html L140） */
    rightLabel?: string
    /** 选项文案模板，{rank}/{index}/{name} 插值（group.js L725） */
    optionTemplate?: string
    /** 退出按钮文案（group-compare.html L135） */
    closeText?: string
    /** 退出按钮 aria-label（group-compare.html L135） */
    closeAria?: string
    // ── CompareFrame 透传（RankingList L34-51 undefined 默认透传先例）──
    /** 透传 CompareFrame：media aria 模板 */
    zoomAriaTemplate?: string
    /** 透传 CompareFrame：img alt 模板 */
    altTemplate?: string
    /** 透传 CompareFrame：评分后缀 */
    scoreSuffix?: string
    /** 透传 CompareFrame：rationale 标签 */
    rationaleLabel?: string
    /** 透传 CompareFrame：rationale 回退文案 */
    rationaleFallback?: string
    // ── CompareDelta 透传 ──
    /** 透传 CompareDelta：差值标题 */
    deltaHeadingLabel?: string
    /** 透传 CompareDelta：评分条 aria-label */
    deltaBarsAriaLabel?: string
    /** 透传 CompareDelta：左条标签模板 */
    deltaLeftBarTemplate?: string
    /** 透传 CompareDelta：右条标签模板 */
    deltaRightBarTemplate?: string
    /** 透传 CompareDelta：脚注 */
    deltaFootnote?: string
  }>(),
  {
    eyebrow: 'FOCUS / TWO FRAMES',
    title: '双图聚焦比较',
    intro: '选择两张照片，在相同尺寸下核对综合分差、优势与限制。点击任一大图可进入沉浸对比。',
    leftLabel: '左侧照片',
    rightLabel: '右侧照片',
    optionTemplate: '#{rank} · 第 {index} 张 · {name}',
    closeText: '退出沉浸',
    closeAria: '退出沉浸对比',
    zoomAriaTemplate: undefined,
    altTemplate: undefined,
    scoreSuffix: undefined,
    rationaleLabel: undefined,
    rationaleFallback: undefined,
    deltaHeadingLabel: undefined,
    deltaBarsAriaLabel: undefined,
    deltaLeftBarTemplate: undefined,
    deltaRightBarTemplate: undefined,
    deltaFootnote: undefined,
  },
)

// SSR 水合安全的 id：aria-labelledby 指向标题（group-compare.html L132）
const headingId = useId()

// ── 派生链（单条 computed，RankingList L62-66 先例）──

/** getEntryByIndex 等价（group.js L635-637）：越界/非整数 → null */
function resolveEntry(index: number): ImageEntry | null {
  return Number.isInteger(index) && index >= 0 && index < props.entries.length
    ? (props.entries[index] ?? null)
    : null
}

// group.js L706-708：rank 升序 + 过滤有效 entry
const ranked = computed(() =>
  [...props.items]
    .sort((a, b) => Number(a.rank) - Number(b.rank))
    .filter(item => resolveEntry(Number(item.index)) !== null),
)

// ── pair 状态（源 state.focusPair，group.js L61）──
const pair = shallowRef<[number, number]>([0, 1])

// group.js L549-552：新结果到达时 pair 恒重置为 rank 前两名（非仅失效回退——
// 源在 complete 回调中无条件执行，renderFocusCompare L713-716 校验仅为安全网）。
// Vue 版本中 ranked 重算即「新结果」事件；用户选择经 onSideChange 直接变更
// pair 而不触及 ranked，故合法选择不会被重置。immediate 兼作初始化。
watch(ranked, (list) => {
  const top2 = list.slice(0, 2).map(item => Number(item.index))
  pair.value = [top2[0] ?? 0, top2[1] ?? 0]
}, { immediate: true })

// group.js L718-728：双侧共享 options（label 模板插值，源 L725）
const selectOptions = computed<SelectOption[]>(() =>
  ranked.value.map((item) => {
    const index = Number(item.index)
    const entry = resolveEntry(index)
    return {
      value: index,
      label: props.optionTemplate
        .replace('{rank}', String(item.rank))
        .replace('{index}', String(index + 1))
        .replace('{name}', entry?.file.name ?? ''),
    }
  }),
)

// group.js L737-738：pair → 选中帧（null 守卫：pair 与 ranked 竞态时不渲染 grid）
const selectedFrames = computed(() => {
  const resolve = (index: number) => {
    const item = ranked.value.find(i => Number(i.index) === index)
    const entry = resolveEntry(index)
    return item && entry ? { item, entry } : null
  }
  const left = resolve(pair.value[0])
  const right = resolve(pair.value[1])
  return left && right ? [left, right] as const : null
})

// ── 互斥选择（group.js L840-850 逐行移植）──
function onSideChange(side: 0 | 1, value: string | number) {
  const next = Number(value)
  const otherSide = side === 0 ? 1 : 0
  const current = pair.value
  if (next === current[otherSide]) {
    // 源 L844-846：replacement = ranked 首个 index ≠ next 者（非朴素交换）
    const replacement = ranked.value
      .map(item => Number(item.index))
      .find(index => index !== next)
    if (replacement != null) {
      pair.value = side === 0
        ? [next, replacement]
        : [replacement, next]
      return
    }
  }
  pair.value = side === 0 ? [next, current[1]] : [current[0], next]
}

// BaseSelect defineModel 消费：computed getter/setter 保持 pair 单一来源
const leftModel = computed<string | number>({
  get: () => pair.value[0],
  set: value => onSideChange(0, value),
})
const rightModel = computed<string | number>({
  get: () => pair.value[1],
  set: value => onSideChange(1, value),
})

// ── 沉浸模式（group.js L798-817 声明式等价）──
const immersive = ref(false)
const section = ref<HTMLElement | null>(null)

// Tab 循环 + 回焦（useFocusTrap L15-16 指定消费方；
// engage 自动聚焦首个 focusable 即关闭按钮，等价源 L805）
useFocusTrap(section, immersive)

if (import.meta.client) {
  // Esc 关闭 + 滚动锁定（BaseModal L32-57 同构，
  // 对应源 .compare-immersive-open { overflow: hidden }，group.css L406-408）
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') immersive.value = false
  }

  let restoreOverflow = ''
  let locked = false

  const lock = () => {
    locked = true
    document.addEventListener('keydown', onKeydown)
    restoreOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  const unlock = () => {
    if (!locked) return
    locked = false
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = restoreOverflow
  }

  watch(immersive, value => (value ? lock() : unlock()), { immediate: true })
  onScopeDispose(unlock)
}
</script>

<template>
  <section
    v-if="ranked.length >= 2"
    ref="section"
    class="compare-focus"
    :class="{ 'is-immersive': immersive }"
    tabindex="-1"
    :role="immersive ? 'dialog' : undefined"
    :aria-modal="immersive ? 'true' : undefined"
    :aria-labelledby="headingId"
  >
    <!-- group-compare.html L132：section.compare-focus；
         源 L801-803 沉浸时升级为 dialog（role/aria-modal 动态绑定）；
         tabindex="-1" 供 useFocusTrap 空 focusable 回退（L23）；
         v-if 贴源 L709-710：有效排名项 < 2 时结构性不可能成对 -->
    <!-- group-compare.html L133-136：heading = CardHeading + 退出按钮。
         flex 变体归调用方（CardHeading L12-13 委托）；
         退出按钮 v-if（非 display:none）防焦点逃逸 -->
    <div class="compare-focus-heading">
      <UiCardHeading :eyebrow="props.eyebrow">
        <span :id="headingId">{{ props.title }}</span>
      </UiCardHeading>
      <UiBaseButton
        v-if="immersive"
        variant="secondary"
        class="focus-compare-close"
        :aria-label="props.closeAria"
        @click="immersive = false"
      >
        {{ props.closeText }}
      </UiBaseButton>
    </div>

    <!-- group-compare.html L137：引言说明 -->
    <p class="compare-focus-intro">{{ props.intro }}</p>

    <!-- group-compare.html L138-141：左右下拉（BaseSelect plain 变体，
         源 .compare-focus-controls label 的无壳 grid，BaseSelect L128-139） -->
    <div class="compare-focus-controls">
      <UiBaseSelect
        v-model="leftModel"
        variant="plain"
        :options="selectOptions"
        :label="props.leftLabel"
      />
      <UiBaseSelect
        v-model="rightModel"
        variant="plain"
        :options="selectOptions"
        :label="props.rightLabel"
      />
    </div>

    <!-- group.js L734-796：双帧 + 分差块 -->
    <div v-if="selectedFrames" class="compare-focus-grid">
      <EvaluationCompareFrame
        :key="`left-${pair[0]}`"
        :item="selectedFrames[0].item"
        :entry="selectedFrames[0].entry"
        side-label="左侧"
        :zoom-aria-template="props.zoomAriaTemplate"
        :alt-template="props.altTemplate"
        :score-suffix="props.scoreSuffix"
        :rationale-label="props.rationaleLabel"
        :rationale-fallback="props.rationaleFallback"
        @zoom="immersive = true"
      />
      <EvaluationCompareFrame
        :key="`right-${pair[1]}`"
        :item="selectedFrames[1].item"
        :entry="selectedFrames[1].entry"
        side-label="右侧"
        :zoom-aria-template="props.zoomAriaTemplate"
        :alt-template="props.altTemplate"
        :score-suffix="props.scoreSuffix"
        :rationale-label="props.rationaleLabel"
        :rationale-fallback="props.rationaleFallback"
        @zoom="immersive = true"
      />
      <EvaluationCompareDelta
        :left-score="Number(selectedFrames[0].item.score)"
        :right-score="Number(selectedFrames[1].item.score)"
        :heading-label="props.deltaHeadingLabel"
        :bars-aria-label="props.deltaBarsAriaLabel"
        :left-bar-template="props.deltaLeftBarTemplate"
        :right-bar-template="props.deltaRightBarTemplate"
        :footnote="props.deltaFootnote"
      />
    </div>
  </section>
</template>

<style scoped>
/* ── 基态（venus group.css L141-216）── */

/* group.css L141-146：分节线（margin-top/padding-top/border-top）。
 * --cmp-* 自定义属性：基态映射全局 token，沉浸态重映射暗房色系——
 * 子组件（CompareFrame/CompareDelta）消费 var(--cmp-x, var(--x)) 缺省回退，
 * 一次 class 切换经纯 CSS 级联完成重着色（替代源 L371-404 的 14 条覆盖选择器）。 */
.compare-focus {
  --cmp-ink: var(--ink);
  --cmp-body: var(--ink-body);
  --cmp-muted: var(--ink-muted);
  --cmp-surface: var(--paper-raised);
  --cmp-hairline: var(--hairline);
  --cmp-bar-track: var(--hairline);

  margin-top: var(--space-8);
  padding-top: var(--space-6);
  border-top: 1px solid var(--hairline-strong);
}

/* group.css L148-153：heading flex（CardHeading L12-13 委托调用方） */
.compare-focus-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-5);
}

/* group.css L162-168：focus 区标题 28px（覆盖 CardHeading 26px） */
.compare-focus-heading :deep(.card-heading h3) {
  margin-top: 8px;
  font-size: 28px;
}

/* group.css L170-175（display:none 部分由 v-if 替代）：
 * 退出按钮透明底 + hairline-strong 边框 */
.focus-compare-close {
  border-color: var(--hairline-strong);
  color: inherit;
}

/* group.css L177-181 */
.compare-focus-intro {
  max-width: 42rem;
  color: var(--cmp-muted, var(--ink-muted));
  font-size: 14px;
}

/* group.css L183-188 */
.compare-focus-controls {
  margin: var(--space-5) 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

/* group.css L212-216 */
.compare-focus-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

/* ── 沉浸态（venus group.css L352-408 变量化重写）──
 * 源 14 条 .is-immersive 覆盖选择器收敛为变量重映射 + 少量 :deep()。
 * --on-dark 双主题同值 #f1ede3（style.css L17/L108）；
 * --on-dark-muted 归组件局部 light-dark()（RankingCard L179 先例）。 */
.compare-focus.is-immersive {
  --cmp-ink: #f1ede3;
  --cmp-body: light-dark(#aaa296, #9e9689);
  --cmp-muted: light-dark(#aaa296, #9e9689);
  --cmp-surface: var(--darkroom-raised);
  --cmp-hairline: #3d3832;
  --cmp-bar-track: #3d3832;

  position: fixed;
  inset: 20px;
  z-index: 1800;
  margin: 0;
  padding: var(--space-5);
  overflow: auto;
  border: 1px solid #3d3832;
  background: var(--darkroom);
  color: #f1ede3;
  box-shadow: var(--shadow-overlay);
}

/* 源 L371-375：heading 分隔线转暗 */
.compare-focus.is-immersive :deep(.card-heading) {
  border-color: var(--cmp-hairline);
}

/* 源 L390-392：控件标签转亮 */
.compare-focus.is-immersive :deep(.control-label) {
  color: var(--cmp-ink);
}

/* 源 L394-399：select 转暗房表面 */
.compare-focus.is-immersive :deep(.control-select) {
  background: var(--cmp-surface);
  border-color: var(--cmp-hairline);
  color: var(--cmp-ink);
}

/* 源 L365-369：退出按钮继承亮色 */
.compare-focus.is-immersive .focus-compare-close {
  color: var(--cmp-ink);
}

/* ── 响应式（venus group.css L461-511）── */

/* 源 L487-490：移动端沉浸全屏 */
@media (max-width: 767px) {
  .compare-focus.is-immersive {
    inset: 0;
    border: 0;
  }
}

/* 源 L493-499：≤479px grid 与 controls 降 1 列 */
@media (max-width: 479px) {
  .compare-focus-grid,
  .compare-focus-controls {
    grid-template-columns: 1fr;
  }
}
</style>
