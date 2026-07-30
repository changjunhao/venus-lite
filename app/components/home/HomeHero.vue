<script setup lang="ts">
import { NuxtLink } from '#components'
import type { ContactSheetFrame } from '~/components/home/HomeContactSheet.vue'

/**
 * 首页 Hero：文案区 + HomeContactSheet 编排（DESIGN.md §10.1 非对称 Hero、
 * §7.2 内容 8 / 4 比例），对应 venus index.html L44-76 的 `header.home-hero`
 * （component-plan §2.3 首页展示域）。
 *
 * - 纯 props 组件不内嵌 $t()：文案由调用页面解析 i18n 后传入
 *   （先例 PageHero / HomeContactSheet）。eyebrow 品牌 mono 恒英文但仍
 *   props 化，先例 HomeContactSheet 的 noteLabel。
 * - CTA 不复用 BaseButton：venus `.home-primary-link`（48px / 600 14px /
 *   gap 22px / hover 上浮）与 `.btn-primary`（44px / 16px）规格不同，且
 *   component-plan §2.2 的 BaseButton 来源映射（.btn / .text-button /
 *   .btn-share）不含 Hero 链接，贴源保留为 scoped NuxtLink。
 * - 接触印样直接内嵌 HomeContactSheet（先例 SiteNav 内嵌 StarMark /
 *   ThemeToggle），sheet* 前缀 props 原样透传。
 */
const props = withDefaults(
  defineProps<{
    eyebrow?: string
    /** h1 首行品牌名（"Venus"）；Hero 无标题不成立故必填（先例 PageHero） */
    title: string
    /** h1 次行产品名，venus 源为 <strong>摄影美学评估系统</strong> */
    subtitle?: string
    tagline?: string
    lede?: string
    /** label 为空时不渲染对应链接；两个 label 皆空时整个 actions 行不渲染 */
    primaryLabel?: string
    primaryTo?: string
    secondaryLabel?: string
    secondaryTo?: string
    /** 透传 HomeContactSheet（frames 沿用其导出类型） */
    frames: ContactSheetFrame[]
    sheetAriaLabel: string
    sheetNoteLabel?: string
    sheetNoteText?: string
  }>(),
  {
    eyebrow: '',
    subtitle: '',
    tagline: '',
    lede: '',
    primaryLabel: '',
    primaryTo: '/single',
    secondaryLabel: '',
    secondaryTo: '#modes',
    sheetNoteLabel: '',
    sheetNoteText: '',
  },
)
</script>

<template>
  <header class="home-hero">
    <div class="home-hero-grid">
      <div class="home-hero-copy">
        <p v-if="props.eyebrow" class="home-eyebrow">{{ props.eyebrow }}</p>
        <h1>
          <span>{{ props.title }}</span>
          <strong v-if="props.subtitle">{{ props.subtitle }}</strong>
        </h1>
        <p v-if="props.tagline" class="home-hero-tagline">{{ props.tagline }}</p>
        <p v-if="props.lede" class="home-lede">{{ props.lede }}</p>
        <div v-if="props.primaryLabel || props.secondaryLabel" class="home-hero-actions">
          <NuxtLink v-if="props.primaryLabel" class="home-primary-link" :to="props.primaryTo">
            {{ props.primaryLabel }} <span aria-hidden="true">→</span>
          </NuxtLink>
          <NuxtLink v-if="props.secondaryLabel" class="home-text-link" :to="props.secondaryTo">
            {{ props.secondaryLabel }}
          </NuxtLink>
        </div>
      </div>

      <!-- eslint-disable vue/attribute-hyphenation -- ariaLabel 必须 camelCase：kebab 会被类型层视为全局 aria-label 属性而非 prop -->
      <HomeContactSheet
        :frames="props.frames"
        :ariaLabel="props.sheetAriaLabel"
        :note-label="props.sheetNoteLabel"
        :note-text="props.sheetNoteText"
      />
      <!-- eslint-enable vue/attribute-hyphenation -->
    </div>
  </header>
</template>

<style scoped>
/* venus style.css L260-267 逐属性对齐；venus fixed 导航补偿
 * `calc(72px + var(--space-9))` 在 SiteNav sticky 化（自占文档流）后
 * 扣除 72px（先例 PageHero），min-height 同步 900 − 72。 */
.home-hero {
  align-items: center;
  background: var(--paper);
  border-bottom: 1px solid var(--hairline);
  display: flex;
  min-height: min(828px, calc(100svh - 72px));
  padding: var(--space-9) max(32px, calc((100vw - 1440px) / 2)) var(--space-9);
}

/* §7.2 内容 8 / 4：venus 实现为 7fr / 5fr（style.css L268-274，贴源保留） */
.home-hero-grid {
  align-items: center;
  display: grid;
  gap: clamp(64px, 8vw, 128px);
  grid-template-columns: minmax(0, 7fr) minmax(390px, 5fr);
  width: 100%;
}

/* §6.2 Eyebrow：11px Mono、0.08em 字距（style.css L275-286），同 PageHero */
.home-eyebrow {
  color: var(--amber);
  font-family: var(--font-data);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.4;
  text-transform: uppercase;
}

.home-hero-copy {
  max-width: 760px;
}

/* §6.2 Brand Display：clamp(64px, 7vw, 88px)/500/0.98（style.css L288-294） */
.home-hero-copy h1 {
  font-size: clamp(64px, 7vw, 88px);
  letter-spacing: -0.055em;
  line-height: 0.98;
  margin: var(--space-4) 0 0;
  text-wrap: balance;
}

.home-hero-copy h1 span,
.home-hero-copy h1 strong {
  display: block;
  font: inherit;
}

/* 次行中文产品名（style.css L297-303） */
.home-hero-copy h1 strong {
  font-family: var(--font-display);
  font-size: 0.48em;
  letter-spacing: -0.035em;
  line-height: 1.12;
  margin-top: var(--space-3);
}

/* style.css L304-310 */
.home-hero-tagline {
  color: var(--ink);
  font-family: var(--font-display);
  font-size: clamp(21px, 2vw, 28px);
  line-height: 1.45;
  margin-top: var(--space-6);
}

/* Hero 说明（style.css L311-317）：17px/1.75 沿用源值（同 PageHero lede） */
.home-lede {
  color: var(--ink-body);
  font-size: 17px;
  line-height: 1.75;
  margin-top: var(--space-4);
  max-width: 640px;
}

/* style.css L318 */
.home-hero-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
  margin-top: var(--space-7);
}

/* 主 CTA（style.css L319-334）：48px / 600 14px / gap 22px 均为源值 */
.home-primary-link {
  align-items: center;
  background: var(--amber);
  border: 1px solid var(--amber);
  border-radius: var(--radius-sm);
  color: var(--paper-raised);
  display: inline-flex;
  font: 600 14px/1 var(--font-ui);
  gap: 22px;
  justify-content: center;
  min-height: 48px;
  padding: 0 20px;
  text-decoration: none;
  transition: transform var(--motion-fast) var(--ease-standard),
    background var(--motion-fast) var(--ease-standard);
}

.home-primary-link:hover {
  background: var(--amber-hover);
  transform: translateY(-1px);
}

/* 次 CTA（style.css L335-344）：hover amber/ink 异于 .text-button 的 oxide */
.home-text-link {
  align-items: center;
  border-bottom: 1px solid var(--hairline-strong);
  color: var(--ink-body);
  display: inline-flex;
  font-size: 14px;
  min-height: 44px;
  text-decoration: none;
}

.home-text-link:hover {
  border-color: var(--amber);
  color: var(--ink);
}

/* venus style.css L1069（接触印样自身断点已内聚于 HomeContactSheet） */
@media (max-width: 1279px) {
  .home-hero-grid {
    gap: 56px;
    grid-template-columns: minmax(0, 6.5fr) minmax(360px, 5.5fr);
  }
}

/* venus style.css L1079-1081：单列折叠，图片位于文字之后（§13.1）；
 * padding-top venus calc(72px + 72px) 扣 72px sticky 导航 */
@media (max-width: 1023px) {
  .home-hero {
    min-height: auto;
    padding: 72px 40px 72px;
  }

  .home-hero-grid {
    grid-template-columns: 1fr;
  }

  .home-hero-copy {
    max-width: 800px;
  }
}

/* venus style.css L1121-1127；padding-top calc(64px + 56px) 扣 64px 移动导航 */
@media (max-width: 767px) {
  .home-hero {
    padding: 56px 20px 56px;
  }

  .home-hero-copy h1 {
    font-size: clamp(52px, 16vw, 76px);
  }

  .home-hero-copy h1 strong {
    font-size: 0.5em;
  }

  .home-hero-tagline {
    font-size: 20px;
  }

  .home-hero-actions {
    align-items: stretch;
    flex-direction: column;
    margin-top: var(--space-6);
  }

  .home-primary-link {
    width: 100%;
  }

  .home-text-link {
    justify-content: center;
  }
}
</style>
