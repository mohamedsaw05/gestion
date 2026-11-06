module.exports = {
  apps: [
    {
      name: 'vtm-api',
      script: 'apps/api/dist/main.js',
      cwd: './',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        API_PORT: 4000,
      },
      max_memory_restart: '800M',
      restart_delay: 3000,
      error_file: './logs/api-err.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
