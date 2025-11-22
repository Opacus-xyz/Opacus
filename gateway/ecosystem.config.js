module.exports = {
  apps: [
    {
      name: 'opacus-gateway',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 8080,
        LOG_LEVEL: 'debug'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080,
        LOG_LEVEL: 'info'
      }
    }
  ]
};
