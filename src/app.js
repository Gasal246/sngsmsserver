const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const env = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const smsRoutes = require('./routes/sms.routes');
const { sha256 } = require('./utils/hash');

const createApp = () => {
  const app = express();

  app.set('trust proxy', env.trustProxy);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin === '*' ? '*' : env.corsOrigin.split(',') }));
  app.use(express.json({ limit: '64kb' }));

  app.use((req, _res, next) => {
    req.id = crypto.randomUUID();
    next();
  });

  app.use(requestLogger());

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      uptime: process.uptime(),
      mongo: {
        readyState: mongoose.connection.readyState,
        state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'
      }
    });
  });

  app.use('/api', rateLimit({
    windowMs: env.rateLimitWindowMs,
    limit: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const apiKey = req.get('x-api-key');
      return apiKey ? `api-key:${sha256(apiKey).slice(0, 12)}` : `ip:${req.ip}`;
    },
    handler: (req, res) => {
      res.locals.error = {
        message: 'Too many requests',
        code: 'RATE_LIMITED'
      };
      res.status(429).json({
        success: false,
        requestId: req.id,
        error: res.locals.error
      });
    }
  }));

  app.use('/api', smsRoutes);

  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found'
      }
    });
  });

  app.use(errorHandler);

  return app;
};

module.exports = createApp;
