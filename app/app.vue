<script setup lang="ts">
// 根组件：初始化主题（head 注册需尽早发生），并交由布局与页面渲染
useTheme()

// html lang 随当前语言动态更新（zh-CN / en-US）；no_prefix 下仅接管 lang，无 hreflang alternate
const localeHead = useLocaleHead()
useHead(() => ({ htmlAttrs: { lang: localeHead.value.htmlAttrs?.lang } }))
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
