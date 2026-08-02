# Venus Lite

[English](./README.md)

基于多智能体对抗的摄影美学评估系统。上传照片，Venus 通过提案（Proposer）、质疑（Critic）与仲裁（Arbiter）的对抗流程，给出评分、维度分析、改进建议及可核对的判断依据。

## 评估模式

| 模式 | 路由 | 说明 |
| --- | --- | --- |
| 单图评估 | `/single` | 单张照片 → EXIF 提取 → 流式评估 → 评分报告 → 分享海报 |
| 组图联合评估 | `/group-joint` | 多张照片作为系列 → 整体评分 + 接触印样 + 逐图明细 |
| 组图对比评估 | `/group-compare` | 多张照片横向对比 → 排名列表 + 双图聚焦沉浸比较 |

## 技术栈

- **框架**: Nuxt 4（Vue 3 + Nitro Server）
- **语言**: TypeScript（全栈）
- **评估引擎**: [@theogony/venus-core](https://github.com/changjunhao/venus-core) — 多 Agent 对抗评估，SSE 流式输出
- **样式**: 原生 CSS Design Tokens（Paper / Darkroom 双主题，无 CSS 框架）
- **国际化**: @nuxtjs/i18n（中 / 英，no_prefix 策略，cookie 持久化）
- **Markdown**: markstream-vue（流式渲染）
- **图片上传**: 阿里云 OSS 直传（STS 临时凭证 + 分片上传 + SHA-256 去重）
- **EXIF**: exifreader（客户端即时提取）
- **测试**: Vitest + @nuxt/test-utils + happy-dom
- **包管理**: pnpm

## 项目结构

```
app/
├── assets/css/           # tokens.css（Design Tokens）+ main.css（基础样式）
├── components/
│   ├── ui/               # 基础组件（BaseButton, BaseCard, BaseModal…）
│   ├── evaluation/       # 评估结果展示组件（ScorePanel, ProcessTimeline…）
│   ├── business/         # 业务编排组件（SingleEvaluationFlow, JointEvaluationFlow…）
│   ├── home/             # 首页区块（HomeHero, ModeCardGrid…）
│   ├── layout/           # 布局组件（SiteNav, ThemeToggle, LocaleToggle…）
│   ├── share/            # 分享海报（ShareAction, SharePreviewModal）
│   └── upload/           # 上传交互（UploadZone, PreviewGrid, ExifTagList…）
├── composables/          # 共享状态与副作用
│   ├── useEvaluationStream.ts  # SSE 流式评估（单图/组图共用）
│   ├── useOssUpload.ts         # OSS 直传（STS + 分片 + 去重）
│   ├── useExif.ts              # EXIF 元数据提取
│   ├── useShareImage.ts        # Canvas 分享海报生成
│   ├── useImageSelection.ts    # 多图选择状态管理
│   ├── useEvalMetadata.ts      # 评估元数据
│   └── useTheme.ts             # 主题切换
├── layouts/              # default.vue
├── pages/                # 文件路由（index, single, group-joint, group-compare）
├── utils/                # 评估结果映射工具
├── app.vue               # 根组件
└── error.vue             # 错误页
server/
├── api/
│   ├── evaluate/         # venus-core 评估代理（SSE 流式 + 同步）
│   ├── oss/              # STS 临时凭证签发
│   ├── notes/            # 备忘录（架构演示）
│   ├── health.get.ts     # 健康检查
│   └── metadata.get.ts   # 引擎元数据
├── middleware/            # 请求日志
└── utils/
    └── venus-engine.ts   # Venus 引擎单例 + Nitro 适配器
shared/
├── types/                # 前后端共享类型（api.ts, evaluation.ts）
├── utils/                # 同构工具（format.ts）
└── theme.ts              # 主题初始化脚本
i18n/locales/             # 国际化资源（zh.json, en.json）
tests/nuxt/               # 组件 & composable 单元测试
docs/                     # 设计文档（component-plan.md）
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 复制环境变量
cp .env.example .env

# 启动开发服务器（http://localhost:3000）
pnpm dev
```

## 环境变量

运行时配置通过 `NUXT_` 前缀环境变量覆盖（Nuxt runtimeConfig 约定）：

### 基础配置

| 变量 | 映射 | 可见性 |
| --- | --- | --- |
| `NUXT_APP_VERSION` | `runtimeConfig.appVersion` | 服务端 |
| `NUXT_PUBLIC_SITE_NAME` | `runtimeConfig.public.siteName` | 客户端 |

### OSS / STS（图片直传）

| 变量 | 说明 |
| --- | --- |
| `NUXT_OSS_REGION` | OSS 区域（如 `oss-cn-beijing`） |
| `NUXT_OSS_BUCKET` | Bucket 名称 |
| `NUXT_OSS_STS_ROLE_ARN` | STS AssumeRole ARN |
| `NUXT_OSS_STS_ACCESS_KEY_ID` | AccessKey ID |
| `NUXT_OSS_STS_ACCESS_KEY_SECRET` | AccessKey Secret |

### Venus 评估引擎

全局配置（`NUXT_VENUS_*`）：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `NUXT_VENUS_PROVIDER_TYPE` | Provider 类型 | `openai-chat` |
| `NUXT_VENUS_PROVIDER_BASE_URL` | API 接入点 | — |
| `NUXT_VENUS_PROVIDER_API_KEY` | API 密钥 | — |
| `NUXT_VENUS_PROVIDER_MODEL` | 模型名称 | — |
| `NUXT_VENUS_PROVIDER_TIMEOUT` | 超时（ms） | `60000` |
| `NUXT_VENUS_MAX_RETRIES` | 最大重试 | `3` |
| `NUXT_VENUS_REASONING_ENABLED` | 启用推理 | `true` |
| `NUXT_VENUS_REASONING_EFFORT` | 推理力度 | 空（不启用） |

支持的 Provider 类型：`openai-chat` | `openai-responses` | `anthropic` | `gemini`

每个 Agent（Genre Detector / Proposer / Critic / Arbiter / Revision）可通过 `NUXT_VENUS_<AGENT>_*` 独立配置 Provider、模型与推理参数，未配置时回落全局。

> `BASE_URL` + `API_KEY` + `MODEL` 三项缺一时，`/api/evaluate*` 与 `/api/metadata` 返回 503 `VENUS_DISABLED`。

## API 路由

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/metadata` | 引擎元数据（模型、Agent 配置） |
| POST | `/api/evaluate` | 单图评估（同步） |
| POST | `/api/evaluate/stream` | 单图评估（SSE 流式） |
| POST | `/api/evaluate/group` | 组图评估（同步） |
| POST | `/api/evaluate/group/stream` | 组图评估（SSE 流式） |
| GET | `/api/oss/sts` | 签发 OSS STS 临时凭证 |

错误统一返回 `ApiError` 结构（`code` + `message`）。

## 架构要点

### 评估流程

```
上传照片 → OSS 直传 → POST /api/evaluate/stream
                              ↓
              ┌── Genre Detector（门类检测）
              ├── Proposer（初评提案）
              ├── Critic（质疑攻击）
              ├── Proposer-Revision（条件修正）
              └── Arbiter（终裁裁决）
                              ↓
              SSE 事件流 → 步骤轨道 + 推理块实时渲染
                              ↓
              evaluation_complete → 评分报告
```

### 组件分层

三层单向依赖，禁止反向引用：

1. **基础组件**（`ui/`）：零业务，纯 props/emits 驱动
2. **高阶组件**（`evaluation/` / `upload/` / `share/`）：评估域渲染，消费 composables 状态
3. **业务编排**（`business/`）：页面级流程编排，组合高阶组件 + composables

### 状态管理

Nuxt `useState` + composables 封装，不引入 Pinia。副作用（SSE、OSS、EXIF、Canvas）全部下沉 composable，组件只管渲染与交互。

## 开发

```bash
# 代码检查
pnpm lint

# 运行测试
pnpm test

# 测试（watch 模式）
pnpm test:watch
```

## 生产构建

```bash
pnpm build        # 构建
pnpm preview      # 本地预览生产构建
```

生产环境通过进程环境变量注入配置（PM2 / `node --env-file`），参见 [Nuxt 部署文档](https://nuxt.com/docs/getting-started/deployment)。
