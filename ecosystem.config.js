module.exports = {
  apps: [
    {
      name: 'disparador',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      time: true
    }
  ]
};
