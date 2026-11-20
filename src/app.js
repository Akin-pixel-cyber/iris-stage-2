const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cfg = require('./config');
require('./db');
const { csrfGuard } = require('./auth');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (cfg.trustProxy) app.set('trust proxy', cfg.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"], connectSrc: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"], formAction: ["'self'"], baseUri: ["'self'"],
      upgradeInsecureRequests: cfg.cookieSecure ? [] : null,   // only upgrade to https once the app really is on https
    } },
    hsts: cfg.cookieSecure,
    crossOriginOpenerPolicy: false, originAgentCluster: false,
  }));
  app.use(express.json({ limit: '20kb' }));
  app.use(cookieParser());

  app.get('/healthz', (req, res) => res.json({ ok: true }));
  app.get('/api/config', (req, res) => res.json({ appName: 'Iris', allowedDomain: cfg.allowedDomain, devMail: !cfg.isProd }));

  app.use('/api', csrfGuard);
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api', require('./routes/tickets'));
  app.use('/api', require('./routes/notifications'));
  app.use('/api', require('./routes/users'));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found', code: 'not_found' }));

  const pub = path.join(__dirname, '..', 'public');
  app.use('/fonts', express.static(path.join(pub, 'fonts'), { maxAge: '30d', immutable: true }));
  app.use(express.static(pub, { index: false }));
  // Single-page app: every other path serves the app shell (so links like /verify?token=... work).
  app.get('*', (req, res) => res.sendFile(path.join(pub, 'index.html')));

  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That file is too large (max 2 MB)', code: 'too_large' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request', code: 'bad_json' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side', code: 'server_error' });
  });
  return app;
}
module.exports = { createApp };
