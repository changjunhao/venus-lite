// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Venus Contributors

/**
 * PM2 Ecosystem File — Venus Lite (Nuxt 4 SSR)
 *
 * 生产启动:   pm2 start ecosystem.config.cjs --only venus-lite
 * 查看状态:   pm2 status
 * 查看日志:   pm2 logs venus-lite
 * 重启:       pm2 restart venus-lite
 * 停止:       pm2 stop venus-lite
 * 删除:       pm2 delete venus-lite
 * 开机自启:   pm2 startup && pm2 save
 */

module.exports = {
  apps: [
    {
      name: 'venus-lite',
      script: '.output/server/index.mjs',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',

      // 环境变量通过 .env 文件注入（Node 20.6+ 原生支持 --env-file）
      node_args: '--env-file=.env',

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
      },

      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,

      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      watch: false,
      ignore_watch: ['node_modules', 'logs', '.nuxt'],

      max_memory_restart: '512M',
      kill_timeout: 10000,
      listen_timeout: 5000,
    },
  ],
}

