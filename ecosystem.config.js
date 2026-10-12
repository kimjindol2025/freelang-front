module.exports = {
  apps: [{
    name: 'freelang-front',
    cwd: '/home/kim/kim/platform/freelang-front',
    script: 'runtime/bootstrap.js',
    args: 'run server.fl',
    autorestart: true,
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '15s',
    watch: false,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    env: {
      NODE_ENV: 'production',
      PORT: 40860,
      FL_TRUST_PROXY: '1',
      NODE_OPTIONS: '--max-old-space-size=256',
      // afl-db 는 127.0.0.1:40610 — SSRF allowlist에 둘 다 필요
      FL_HTTP_ALLOW: '127.0.0.1,localhost'
    }
  }]
};
