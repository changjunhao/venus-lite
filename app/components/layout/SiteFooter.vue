<script setup lang="ts">
/**
 * 页脚品牌区（component-plan §2.3），源事实为 venus 首页页脚
 * （index.html L153-159）：品牌链接（星芒 18px + VENUS 字标）+ 标语。
 * 样式贴源 style.css：L419-422（宽度约束）、L528-537（主体）、
 * L1071 / L1130 / L1141（响应式）、L176-190（.site-brand）。
 *
 * - 无 props：venus 仅首页有 footer 且单一形态，不做投机变体；
 * - 无版权/年份：venus 源页脚不存在此内容，且避免 SSR/CSR 时间边界；
 * - 品牌 aria-label 恒存在：移动端 brand-name 会 display:none
 *   （对应 venus 全局 .site-brand span 隐藏规则 L1114），
 *   无 aria-label 的链接将失去可访问名称（同 SiteNav 先例）。
 * - 新增相关外链区：外链 URL 属基础设施，用静态常量；文案走 i18n（labelKey）双语；
 *   采用原生 <a>（非 NuxtLink）附 rel="noopener noreferrer"，避免路由/prefetch 开销（同 SiteNav 数据驱动惯例）。
 */
const { t } = useI18n()

// 外链为基础设施，URL 用静态常量；文案走 i18n（labelKey），语言切换即时生效
const FOOTER_LINKS = [
  { href: 'https://www.ifable.cn/', labelKey: 'footer.linkAuthor' },
  { href: 'https://github.com/changjunhao/venus-core', labelKey: 'footer.linkCore' },
  { href: 'https://github.com/changjunhao/venus-lite', labelKey: 'footer.linkLite' },
  { href: 'https://blog.ifable.cn/2026/06/13/venus-ai-photography-evaluation/', labelKey: 'footer.linkBlogEval' },
  { href: 'https://blog.ifable.cn/2026/06/14/venus-ai-photography-engineering/', labelKey: 'footer.linkBlogEng' },
] as const
</script>

<template>
  <!-- footer 标签自带 contentinfo landmark，无需额外 role -->
  <footer class="site-footer">
    <div class="footer-identity">
      <NuxtLink to="/" class="footer-brand" :aria-label="t('footer.brandAria')">
        <!-- 18px 为 venus 页脚实测值，亦是 §4.1 最小图标尺寸 -->
        <UiStarMark :size="18" />
        <span class="footer-brand-name">VENUS</span>
      </NuxtLink>

      <p class="footer-tagline">{{ t('footer.tagline') }}</p>
    </div>

    <nav class="footer-links" :aria-label="t('footer.linksAria')">
      <a
        v-for="link in FOOTER_LINKS"
        :key="link.href"
        :href="link.href"
        class="footer-link"
        target="_blank"
        rel="noopener noreferrer"
      >{{ t(link.labelKey) }}</a>
    </nav>
  </footer>
</template>

<style scoped>
/* venus style.css L419-422 + L528-537 逐属性对齐。
 * 宽度约束与 border-top 自持于组件（venus 事实：边框仅跨约束宽度而非全幅）。
 * margin-top 承接原 default.vue 占位实现：venus 首页顶距由前置 section 提供，
 * 骨架阶段页面尚未实现，由 footer 自持，首页落地后可评估移除。 */
.site-footer {
  align-items: center;
  border-top: 1px solid var(--hairline);
  color: var(--ink-muted);
  display: flex;
  font-size: 13px;
  gap: var(--space-5);
  justify-content: space-between;
  margin-inline: auto;
  margin-top: var(--space-9);
  min-height: 120px;
  width: min(1440px, calc(100% - 112px));
}

/* 品牌：星芒 + VENUS 字标成组（§4.1），贴源 .site-brand L176-190 */
.footer-brand {
  align-items: center;
  color: var(--ink);
  display: inline-flex;
  font: 600 13px/1 var(--font-data);
  gap: 10px;
  letter-spacing: 0.14em;
  text-decoration: none;
  width: fit-content;
}

/* 星芒 amber 由父级 color 控制（同 SiteNav 惯例） */
.footer-brand svg {
  color: var(--amber);
}

/* 身份区：品牌 + 标语竖排成组，作为页脚左块（原标语独立右对齐收敛入此组） */
.footer-identity {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 相关外链区：横向排列、窄屏换行，色彩承接页脚 muted，hover 提亮至 ink */
.footer-links {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
}

.footer-link {
  color: var(--ink-muted);
  text-decoration: none;
  transition: color 0.2s ease;
}

.footer-link:hover {
  color: var(--ink);
}

@media (max-width: 1279px) {
  .site-footer {
    width: min(100% - 80px, 1280px);
  }
}

/* §13.1 折叠：品牌只留星芒（L1114），布局纵向堆叠（L1141） */
@media (max-width: 767px) {
  .site-footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
    justify-content: center;
    min-height: 108px;
    width: calc(100% - 40px);
  }

  .footer-brand-name {
    display: none;
  }
}
</style>
