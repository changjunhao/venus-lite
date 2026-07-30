<script setup lang="ts">
// 根组件：初始化主题（head 注册需尽早发生），并交由布局与页面渲染
useTheme()
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
