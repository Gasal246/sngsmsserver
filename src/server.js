const mongoose = require('mongoose');
const createApp = require('./app');
const env = require('./config/env');

const start = async () => {
  await mongoose.connect(env.mongoUri);

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`SMS server listening on port ${env.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start().catch((error) => {
  console.error('Failed to start SMS server', error);
  process.exit(1);
});
