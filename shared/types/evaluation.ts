/**
 * 评估域共享类型（component-plan.md §2.5 归口）。
 *
 * 位于 shared/types/ 下，Nuxt 4 会同时向 app 与 server 自动导入，
 * 也可通过 `#shared/types/evaluation` 显式导入。
 * 后续 EvaluationResult / GroupResult / SSE 事件类型在此扩展。
 */

/**
 * EXIF 元数据（形状对齐 venus upload.js L45-116 extractExif 输出）。
 *
 * 消费方：useExif（提取）→ SinglePreview / ExifTagList（输入区展示）
 * → ExifPanel（结果区网格）。所有字段可选——提取失败或字段缺失时为 null。
 */
export interface ExifData {
  cameraModel?: string
  lensModel?: string
  fNumber?: number
  shutterSpeed?: string
  iso?: number
  focalLength?: number
  dateTimeOriginal?: string
  flash?: string
}

/** EXIF 字段键（标签列表遍历与 labels 映射的类型约束） */
export type ExifTagKey = keyof ExifData
