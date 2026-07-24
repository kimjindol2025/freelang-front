module.exports = {
  apps: [{
    name: 'freelang-front',
    cwd: '/home/kim/kim/skl/freelang-front',
    script: 'npm',
    args: 'start',
    autorestart: true,
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '15s',
    watch: false,
    out_file: '/home/kim/kim/skl/freelang-front/logs/out.log',
    error_file: '/home/kim/kim/skl/freelang-front/logs/err.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    env: {
      NODE_ENV: 'production',
      PORT: 40860,
      FL_TRUST_PROXY: '1',
      // afl-db 는 127.0.0.1:40610 — SSRF allowlist에 둘 다 필요
      FL_HTTP_ALLOW: '127.0.0.1,localhost'
    }
  }]
};
