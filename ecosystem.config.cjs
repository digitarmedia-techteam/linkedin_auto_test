module.exports = {
  apps: [
    {
      name: 'linkedin-auto',
      script: 'server.js',
      interpreter: 'node',
      node_args: '--import tsx',
      env: {
        NODE_ENV: 'production',
        PORT: 3011,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
    },
  ],
};
