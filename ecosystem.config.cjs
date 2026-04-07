module.exports = {
  apps: [{
    name: 'world-menu',
    script: 'npx',
    args: 'tsx server/src/index.ts',
    cwd: __dirname,
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    // Auto-restart on crash
    autorestart: true,
    max_restarts: 50,
    min_uptime: '5s',
    restart_delay: 2000,
    // Watch for changes (disable in prod)
    watch: false,
    // Logs
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    // Memory limit — restart if exceeds
    max_memory_restart: '500M',
  }],
};
