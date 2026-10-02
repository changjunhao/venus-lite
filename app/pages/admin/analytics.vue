<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import { use } from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import type { AnalyticsBreakdown, AnalyticsBreakdownItem, AnalyticsOverview, AnalyticsRecordsPage, AnalyticsTimelinePoint } from '#shared/types/analytics'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { useAnalyticsAdmin } from '~/composables/useAnalyticsAdmin'

use([BarChart, CanvasRenderer, GridComponent, LegendComponent, LineChart, TooltipComponent])

const MODE_LABELS: Record<string, string> = { single: '单图评估', joint: '组图联合', compare: '组图对比', unknown: '未识别' }
const STATUS_LABELS: Record<string, string> = { started: '进行中', completed: '已完成', failed: '失败' }
const GENRE_LABELS: Record<string, string> = {
  portrait: '人像', landscape: '风光', street: '街头', documentary: '纪实', wildlife: '野生动物',
  architecture: '建筑', still_life: '静物', abstract: '抽象', unknown: '未识别',
}
const { loading, error, refresh } = useAnalyticsAdmin()
const mode = ref<string | undefined>()
const overview = ref<AnalyticsOverview | null>(null)
const timeline = ref<AnalyticsTimelinePoint[]>([])
const breakdown = ref<AnalyticsBreakdown | null>(null)
const records = ref<AnalyticsRecordsPage | null>(null)
const labelMode = (value: string) => MODE_LABELS[value] || value
const labelStatus = (value: string) => STATUS_LABELS[value] || value
const labelGenre = (value: string | null) => value ? (GENRE_LABELS[value] || value) : '未识别'
const columns = [
  { title: '状态', dataIndex: 'status' }, { title: '模式', dataIndex: 'mode' }, { title: '门类', dataIndex: 'genre' },
  { title: '分值', dataIndex: 'totalScore' }, { title: '地区', key: 'region' }, { title: '匿名访客', dataIndex: 'ipHash' }, { title: '完成时间', dataIndex: 'completedAt' },
]
const trendOption = computed<EChartsOption>(() => ({
  animationDuration: 420, color: ['#a9541e', '#2f6b60'], grid: { left: 40, right: 40, top: 64, bottom: 44 },
  legend: { data: ['完成次数', '平均分'], left: 'center', top: 8 }, tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: timeline.value.map(item => item.date), axisTick: { show: false } },
  yAxis: [{ type: 'value', name: '次数', minInterval: 1 }, { type: 'value', name: '平均分', min: 0, max: 10 }],
  series: [
    { name: '完成次数', type: 'bar', barMaxWidth: 26, data: timeline.value.map(item => item.completedCount), itemStyle: { borderRadius: [4, 4, 0, 0] } },
    { name: '平均分', type: 'line', yAxisIndex: 1, smooth: true, data: timeline.value.map(item => item.averageScore), symbolSize: 7 },
  ],
}))
function distributionOption(items: AnalyticsBreakdownItem[], label: (key: string) => string): EChartsOption {
  return { animationDuration: 420, color: ['#2f6b60'], grid: { left: 88, right: 24, top: 16, bottom: 20 }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, xAxis: { type: 'value', minInterval: 1 }, yAxis: { type: 'category', data: [...items].reverse().map(item => label(item.key)), axisTick: { show: false } }, series: [{ type: 'bar', data: [...items].reverse().map(item => item.count), barMaxWidth: 22, itemStyle: { borderRadius: [0, 4, 4, 0] } }] }
}
const genreOption = computed(() => distributionOption(breakdown.value?.genres || [], labelGenre))
const regionOption = computed(() => distributionOption(breakdown.value?.regions || [], key => key === 'unknown' ? '未知地区' : key))
async function load() { const data = await refresh({ mode: mode.value as never }); if (data) { overview.value = data.overview; timeline.value = data.timeline; breakdown.value = data.breakdown; records.value = data.records } }
onMounted(load)
</script>

<template>
  <div class="analytics-page">
    <main class="analytics-shell">
      <header class="analytics-header"><div><p class="eyebrow">VENUS · ANALYTICS LEDGER</p><h1>使用分析</h1><p>仅统计服务端确认完成的评估；IP 只以匿名哈希与本地 GeoLite2 地区呈现。</p></div><div class="header-actions"><a-button :loading="loading" @click="load"><ReloadOutlined />刷新</a-button></div></header>
      <a-alert v-if="error" type="error" :message="error" show-icon class="notice" />
      <a-spin :spinning="loading"><div class="filters"><a-space wrap><span>评估模式</span><a-select v-model:value="mode" allow-clear placeholder="全部模式" style="width: 160px" :options="[{ value: 'single', label: '单图' }, { value: 'joint', label: '组图联合' }, { value: 'compare', label: '组图对比' }]" @change="load" /></a-space></div>
      <div v-if="overview" class="stats"><a-statistic title="完成评估" :value="overview.completedCount" /><a-statistic title="平均分" :value="overview.averageScore ?? '—'" :precision="1" /><a-statistic title="完成率" :value="overview.completionRate * 100" suffix="%" :precision="1" /><a-statistic title="匿名访客" :value="overview.uniqueVisitors" /></div>
      <section class="charts" aria-label="使用趋势与分布图表"><a-card title="评估趋势" class="trend-card"><a-empty v-if="!timeline.length" description="暂无完成评估" /><ClientOnly v-else><VChart class="chart trend-chart" :option="trendOption" autoresize /></ClientOnly></a-card><a-card title="门类分布"><a-empty v-if="!breakdown?.genres.length" description="暂无数据" /><ClientOnly v-else><VChart class="chart" :option="genreOption" autoresize /></ClientOnly></a-card><a-card title="地区分布"><a-empty v-if="!breakdown?.regions.length" description="暂无数据" /><ClientOnly v-else><VChart class="chart" :option="regionOption" autoresize /></ClientOnly></a-card></section>
      <a-card title="评估记录" class="records"><a-table :columns="columns" :data-source="records?.items ?? []" :pagination="false" row-key="id" size="middle"><template #bodyCell="{ column, record }"><template v-if="column.dataIndex === 'status'">{{ labelStatus(record.status) }}</template><template v-else-if="column.dataIndex === 'mode'">{{ labelMode(record.mode) }}</template><template v-else-if="column.dataIndex === 'genre'">{{ labelGenre(record.genre) }}</template><template v-else-if="column.key === 'region'">{{ record.countryCode === 'unknown' ? '未知地区' : `${record.countryCode} · ${record.regionName}` }}</template><template v-else-if="column.dataIndex === 'totalScore'">{{ record.totalScore?.toFixed?.(1) ?? '—' }}</template><template v-else-if="column.dataIndex === 'completedAt'">{{ record.completedAt ? new Date(record.completedAt).toLocaleString() : '进行中' }}</template></template></a-table></a-card></a-spin>
    </main>
  </div>
</template>

<style scoped>
.analytics-page{min-height:100vh;background:var(--paper);padding:var(--space-8) var(--space-4);color:var(--ink-body)}
.filters{margin-bottom:var(--space-6)}.charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-4);margin-bottom:var(--space-4)}.trend-card{grid-column:1 / -1}.chart{height:260px;width:100%}.trend-chart{height:290px}
:deep(.ant-btn-primary){background:#874016;border-color:#874016;color:#fff}:deep(.ant-btn-primary:hover),:deep(.ant-btn-primary:focus){background:#6d3210;border-color:#6d3210;color:#fff}.analytics-shell,.login-card{margin:auto;max-width:1180px}.login-card{max-width:430px;background:var(--paper-raised);border:1px solid var(--hairline);padding:var(--space-7);box-shadow:var(--shadow-overlay)}.login-mark{color:var(--amber);font-size:30px;margin-bottom:var(--space-3)}h1{font-size:clamp(32px,5vw,52px);margin:var(--space-2) 0}.analytics-header{display:flex;justify-content:space-between;gap:var(--space-5);margin-bottom:var(--space-6)}.header-actions{display:flex;align-items:start;gap:var(--space-2)}.notice{margin-bottom:var(--space-4)}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--hairline);border:1px solid var(--hairline);margin-bottom:var(--space-5)}.stats :deep(.ant-statistic){background:var(--paper-raised);padding:var(--space-4)}.split-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:var(--space-4);margin-bottom:var(--space-4)}.timeline{display:grid;gap:var(--space-2)}.timeline>div{display:flex;justify-content:space-between;border-bottom:1px solid var(--hairline);padding-bottom:var(--space-2)}.timeline span{font-family:var(--font-data);font-size:13px}.records{overflow:auto}@media(max-width:720px){.analytics-page{padding:var(--space-5) var(--space-3)}.analytics-header{display:block}.header-actions{margin-top:var(--space-3)}.stats,.split-grid,.charts{grid-template-columns:1fr 1fr}.split-grid,.charts{gap:var(--space-3)}.trend-card{grid-column:1 / -1}}
</style>
