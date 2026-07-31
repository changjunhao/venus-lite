/**
 * 图片选择与校验 —— 收敛 venus app.js（单图）与 group.js（多图）各一份的校验逻辑为一处。
 *
 * 职责（component-plan.md §2.5）：
 * - 文件校验：MIME 白名单 + 4K/8K 分辨率阈值
 * - 去重：基于 name:size:lastModified 的文件身份标识
 * - 排序：前移/后移（仅 multi 模式）
 * - objectURL 生命周期：创建、替换、移除、scope 销毁时回收
 *
 * 消费方：
 * - SingleEvaluationFlow.vue（mode: 'single'）
 * - GroupEvaluationInput.vue（mode: 'multi'，joint/compare 共用）
 */

// ── 常量（收敛 group.js L45-50 / app.js L168-174 的重复定义）──

export const MIN_GROUP_IMAGES = 2
export const MAX_GROUP_IMAGES = 10
export const RES_4K = 3840 * 2160
export const RES_8K = 7680 * 4320

/** 4K 以下支持的 MIME 类型 */
export const LOW_RES_TYPES: readonly string[] = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff', 'image/heic',
]
/** 4K–8K 仅支持 JPEG/PNG */
export const HIGH_RES_TYPES: readonly string[] = ['image/jpeg', 'image/jpg', 'image/png']

// ── 类型 ──

/** 单张已选文件条目（对应 group.js createFileEntry 返回值 L157-164） */
export interface ImageEntry {
  id: string
  /** `${name}:${size}:${lastModified}` 去重键（group.js L113-115） */
  identity: string
  file: File
  objectURL: string
  width: number
  height: number
}

export type SelectionErrorCode =
  | 'unsupported-type'
  | 'unreadable'
  | 'exceeds-8k'
  | 'high-res-format'
  | 'duplicate'
  | 'over-capacity'

/** 校验/操作产生的结构化错误（错误码 + 参数，文案交消费组件 i18n 映射） */
export interface SelectionError {
  code: SelectionErrorCode
  fileName: string
  params?: Record<string, number | string>
}

export type SelectionMode = 'single' | 'multi'

// ── 纯函数区（无 Vue 依赖，可独立测试）──

/** 文件身份标识（group.js L113-115） */
export function getFileIdentity(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`
}

/**
 * 读取图片自然尺寸（收敛 app.js L233-240 / group.js L123-130 的重复实现）。
 * 调用方负责传入 objectURL；本函数不管理 URL 生命周期。
 */
export function getImageDimensions(src: string): Promise<{ width: number, height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('unreadable'))
    img.src = src
  })
}

/**
 * 核心校验管线（收敛 app.js L177-210 / group.js L133-154）：
 * MIME → 创建 objectURL → 读尺寸 → 8K 上限 → 4K–8K 格式限制。
 *
 * 按成本升序短路：MIME（同步 O(1)）→ 解码取尺寸（唯一昂贵步骤）→ 像素阈值判断。
 * objectURL 只创建一次（group.js createFileEntry 模式），失败分支均 revoke。
 *
 * 返回 discriminated union：成功含 objectURL + 尺寸，失败含错误码 + 参数。
 */
export async function validateImageFile(file: File): Promise<
  | { ok: true, objectURL: string, width: number, height: number }
  | { ok: false, code: SelectionErrorCode, params?: Record<string, number | string> }
> {
  // ① MIME 校验（同步）
  if (!LOW_RES_TYPES.includes(file.type)) {
    return { ok: false, code: 'unsupported-type' }
  }

  // ② 创建 objectURL 并读取尺寸
  const objectURL = URL.createObjectURL(file)
  let width: number
  let height: number
  try {
    const dimensions = await getImageDimensions(objectURL)
    width = dimensions.width
    height = dimensions.height
  }
  catch {
    URL.revokeObjectURL(objectURL)
    return { ok: false, code: 'unreadable' }
  }

  const pixels = width * height

  // ③ 超过 8K 不支持（group.js L147-149）
  if (pixels > RES_8K) {
    URL.revokeObjectURL(objectURL)
    return { ok: false, code: 'exceeds-8k', params: { width, height } }
  }

  // ④ 4K–8K 仅支持 JPEG/PNG（group.js L151-153）
  if (pixels > RES_4K && !HIGH_RES_TYPES.includes(file.type)) {
    URL.revokeObjectURL(objectURL)
    return { ok: false, code: 'high-res-format', params: { width, height } }
  }

  return { ok: true, objectURL, width, height }
}

// ── Composable 主体 ──

/**
 * 图片选择管理（DESIGN.md §9.5-9.7：上传区 + 图片帧 + 接触印样）。
 *
 * - single 模式：替换语义，选新图时 revoke 旧图（app.js L214-215）
 * - multi 模式：追加 + 去重 + 排序 + 容量限制（group.js L167-232）
 *
 * 状态用 shallowRef + 整体替换数组，避免深度响应式遍历 File 对象内部。
 * 每个消费组件持有独立选片状态（非跨组件共享），不使用 useState。
 */
export function useImageSelection(options: { mode: SelectionMode }) {
  const { mode } = options

  const entries = shallowRef<ImageEntry[]>([])
  const errors = shallowRef<SelectionError[]>([])
  const count = computed(() => entries.value.length)
  const canSubmit = computed(() =>
    mode === 'single'
      ? count.value === 1
      : count.value >= MIN_GROUP_IMAGES && count.value <= MAX_GROUP_IMAGES,
  )

  let idCounter = 0

  /**
   * 添加文件（mode 分支仅在此处）。
   *
   * multi 模式（对齐 group.js L167-201）：
   * 1. 同步预裁：容量检查先于解码，超出部分直接记错误
   * 2. 同步去重：identity Set 判定（含批内追加）
   * 3. 串行校验：for...of + await（保持 venus 串行语义，≤10 文件无需并发）
   * 4. 一次性提交：整批只触发一轮渲染
   *
   * single 模式（对齐 app.js L212-215）：
   * 取首文件，校验通过后 revoke 旧 entry 并替换。
   */
  async function addFiles(fileList: FileList | File[]): Promise<void> {
    const incoming = Array.from(fileList)
    if (incoming.length === 0) return

    errors.value = []

    if (mode === 'single') {
      const file = incoming[0]
      if (!file) return
      const result = await validateImageFile(file)
      if (!result.ok) {
        errors.value = [{ code: result.code, fileName: file.name, params: result.params }]
        return
      }
      // 替换前 revoke 旧 URL（app.js L214）
      const old = entries.value[0]
      if (old) URL.revokeObjectURL(old.objectURL)
      idCounter += 1
      entries.value = [{
        id: `image-${idCounter}`,
        identity: getFileIdentity(file),
        file,
        objectURL: result.objectURL,
        width: result.width,
        height: result.height,
      }]
      return
    }

    // ── multi 模式 ──
    const collected: SelectionError[] = []
    const accepted: ImageEntry[] = []
    const identities = new Set(entries.value.map(e => e.identity))
    const remaining = MAX_GROUP_IMAGES - entries.value.length

    let processed = 0
    for (const file of incoming) {
      // ① 容量预裁（先裁再解码，修正 group.js L179 串行模式的浪费）
      if (processed >= remaining) {
        collected.push({ code: 'over-capacity', fileName: file.name, params: { max: MAX_GROUP_IMAGES } })
        continue
      }

      // ② 去重（含批内追加，group.js L184-188 + L193）
      const identity = getFileIdentity(file)
      if (identities.has(identity)) {
        collected.push({ code: 'duplicate', fileName: file.name })
        continue
      }

      // ③ 校验
      const result = await validateImageFile(file)
      if (!result.ok) {
        collected.push({ code: result.code, fileName: file.name, params: result.params })
        continue
      }

      // ④ 接受
      idCounter += 1
      processed += 1
      identities.add(identity)
      accepted.push({
        id: `image-${idCounter}`,
        identity,
        file,
        objectURL: result.objectURL,
        width: result.width,
        height: result.height,
      })
    }

    // 一次性提交（整批只触发一轮渲染）
    if (accepted.length > 0) {
      entries.value = [...entries.value, ...accepted]
    }
    if (collected.length > 0) {
      errors.value = collected
    }
  }

  /** 移除单张（group.js L204-212）：revoke + 整体替换 */
  function removeEntry(id: string): void {
    const index = entries.value.findIndex(e => e.id === id)
    if (index === -1) return
    const next = [...entries.value]
    const [removed] = next.splice(index, 1)
    if (removed) URL.revokeObjectURL(removed.objectURL)
    entries.value = next
  }

  /** 前移/后移（group.js L214-223）：swap + 整体替换；single 模式下为 no-op */
  function moveEntry(id: string, direction: -1 | 1): void {
    if (mode === 'single') return
    const index = entries.value.findIndex(e => e.id === id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= entries.value.length) return
    const next = [...entries.value]
    const temp = next[index]!
    next[index] = next[nextIndex]!
    next[nextIndex] = temp
    entries.value = next
  }

  /** 清空全部（group.js L225-232）：遍历 revoke + 清空 + 清错误 */
  function clear(): void {
    entries.value.forEach(e => URL.revokeObjectURL(e.objectURL))
    entries.value = []
    errors.value = []
  }

  // objectURL 生命周期兜底：替代 group.js L1124 的 beforeunload，
  // 覆盖 Nuxt SPA 路由切换场景（客户端路由切换不触发 beforeunload）
  onScopeDispose(() => clear())

  return { entries, errors, count, canSubmit, addFiles, removeEntry, moveEntry, clear }
}
