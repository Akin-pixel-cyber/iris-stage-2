const cfg = require('./config');
const { createApp } = require('./app');

const server = createApp().listen(cfg.port, '0.0.0.0', () => {
  console.log(`Iris listening on :${cfg.port} (${cfg.nodeEnv}, mail: ${cfg.mailMode})`);
});
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
