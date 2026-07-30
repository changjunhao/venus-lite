import type { ComputedRef, Ref } from 'vue'

// venus trapImmersiveFocus 的判定选择器，补充 input/textarea 覆盖未来弹层内的表单内容
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'select:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * 焦点圈定（DESIGN.md §14.2：Dialog 打开时锁定焦点，关闭后返回触发元素）。
 * 迁移自 venus group.js `trapImmersiveFocus`，供 BaseModal 与 FocusCompare 沉浸模式共用，
 * 收敛 venus 中分享弹窗 / 沉浸对比两套弹层逻辑并存的问题（component-plan.md §四.2）。
 *
 * - 只管 Tab 循环与回焦；Esc 等 dismissal 语义归调用方（BaseModal 自持）。
 * - focusable 每次按键实时查询、不缓存：弹层内容可动态变化（按钮禁用、图片加载），
 *   缓存会产生焦点逃逸，而 Tab 低频无性能顾虑。
 * - 不做 venus 原版的 getClientRects 可见性过滤：调用方以 v-if 懒渲染，
 *   关闭时内容不在 DOM；且该 API 在 happy-dom 中恒为空，会破坏测试。
 * - 容器内无 focusable 时聚焦容器本身，调用方需保证容器有 tabindex="-1"。
 */
export function useFocusTrap(
  container: Ref<HTMLElement | null>,
  active: Ref<boolean> | ComputedRef<boolean>,
) {
  if (!import.meta.client) return

  // 激活时的 document.activeElement，对应 venus state.focusReturn
  let returnFocus: HTMLElement | null = null
  let engaged = false

  function focusables(): HTMLElement[] {
    if (!container.value) return []
    return Array.from(container.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter(element => !element.hidden)
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !container.value) return
    const list = focusables()
    if (list.length === 0) {
      event.preventDefault()
      container.value.focus()
      return
    }
    const first = list[0]
    const last = list[list.length - 1]
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    }
    else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function engage() {
    engaged = true
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.addEventListener('keydown', onKeydown)
    const target = focusables()[0] ?? container.value
    target?.focus()
  }

  function disengage() {
    if (!engaged) return
    engaged = false
    document.removeEventListener('keydown', onKeydown)
    // 回焦前确认触发元素仍在文档中（可能已随结果区重渲染销毁）
    if (returnFocus?.isConnected) returnFocus.focus()
    returnFocus = null
  }

  // immediate：挂载即打开的弹层（如测试直挂 open=true）也要圈定；
  // nextTick 等 v-if 内容进入 DOM 后再定位首个 focusable
  watch(active, async (value) => {
    if (value) {
      await nextTick()
      engage()
    }
    else {
      disengage()
    }
  }, { immediate: true })

  onScopeDispose(disengage)
}
