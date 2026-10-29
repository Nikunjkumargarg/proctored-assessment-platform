const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config');

async function start() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');

  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
