/**
 * 门类元数据拉取与缓存 —— 收敛 venus app.js L36-43 / group.js L103-110 的
 * 重复 fetchMetadata 为一处，useState 跨组件共享（component-plan.md §2.5）。
 *
 * 职责：
 * - /api/metadata 拉取与 useState 缓存（页面生命周期内单次请求）
 * - 门类标签 / 场景标签解析的便捷纯函数
 * - genreEntries 派生（flow 层组装 GenreControls SelectOption[] 的接缝）
 *
 * 不含：维度名解析（已由 shared/utils/format.ts resolveDimensionName 承担，
 *       DimensionList 直接消费 metadata.value 传入即可）。
 *
 * 消费方：
 * - SingleEvaluationFlow.vue / JointEvaluationFlow.vue / CompareEvaluationFlow.vue
 *   （flow 层获取 metadata 传给 DimensionList / GenreControls / ResultMasthead）
 */
import type { GenreMetadata } from '#shared/types/evaluation'

// ── 纯函数区（无 Vue 依赖，可独立测试）──

/**
 * 门类标签解析（对齐 group.js L580-582 getGenreLabel）。
 * 未命中时回退原始 key（对齐 venus utils.js L94 兜底语义）。
 */
export function resolveGenreLabel(
  genre: string,
  metadata?: Record<string, GenreMetadata> | null,
): string {
  return metadata?.[genre]?.label || genre
}

/**
 * 场景标签解析（对齐 group.js L584-586 getSceneLabel）。
 * 在指定门类的 subtypes 中查找；未命中时回退原始 sceneType。
 */
export function resolveSceneLabel(
  sceneType: string,
  genre: string,
  metadata?: Record<string, GenreMetadata> | null,
): string {
  return metadata?.[genre]?.subtypes?.find(s => s.value === sceneType)?.label || sceneType
}

/**
 * 门类选项列表（对齐 GenreControls 的 SelectOption[] 需求）。
 * 返回 [{value, label}]，flow 层可直接映射或结合 i18n 增强。
 * metadata 为 null/空时返回空数组。
 */
export function buildGenreOptions(
  metadata?: Record<string, GenreMetadata> | null,
): Array<{ value: string; label: string }> {
  if (!metadata) return []
  return Object.entries(metadata).map(([key, g]) => ({ value: key, label: g.label }))
}

// ── Composable 主体 ──

export function useEvalMetadata() {
  // useState 跨组件共享缓存（对齐 useTheme 的 'venus-theme' 先例）
  const metadata = useState<Record<string, GenreMetadata> | null>('venus-metadata', () => null)
  const loading = useState('venus-metadata-loading', () => false)
  const error = useState<string | null>('venus-metadata-error', () => null)

  /**
   * 拉取元数据（幂等：已缓存/加载中时直接返回）。
   * 对齐 app.js L36-43 / group.js L103-110 的静默失败语义——
   * metadata 缺失时组件回退原始 key，不阻塞评估流程。
   */
  async function fetch(): Promise<Record<string, GenreMetadata> | null> {
    if (metadata.value || loading.value) return metadata.value
    loading.value = true
    error.value = null
    try {
      metadata.value = await $fetch<Record<string, GenreMetadata>>('/api/metadata')
    }
    catch (err) {
      error.value = (err as Error).message || '获取元数据失败'
      console.error('获取元数据失败:', err)
    }
    finally {
      loading.value = false
    }
    return metadata.value
  }

  /** 便捷只读派生：门类选项列表（供 flow 层组装 GenreControls options） */
  const genreEntries = computed(() => buildGenreOptions(metadata.value))

  return { metadata, loading, error, fetch, genreEntries }
}
