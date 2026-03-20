module.exports = {
  apps: [{
    name: 'kairos',
    script: 'npx',
    args: 'tsx engine/src/index.ts',
    cwd: '/home/ubuntu/kairos-v2',
    restart_delay: 10000,
    max_restarts: 50,
    autorestart: true,
  }]
};
