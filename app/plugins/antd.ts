import Antd from 'ant-design-vue'

/** 管理看板使用 Ant Design Vue；业务评估页仍沿用项目自有 UI 组件。 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(Antd)
})
