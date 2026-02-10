import express from 'express';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT) || 3002;

// Health check - самый простой
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).send('OK');
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('Root endpoint accessed');
  res.json({
    status: 'running',
    message: 'RetailCRM MCP Server',
    port: PORT
  });
});

// Manifest endpoint (статический)
app.get('/manifest', (req, res) => {
  res.json({
    name: "retailcrm-mcp",
    version: "1.0.0",
    transport: "http",
    endpoints: {
      health: "/health",
      manifest: "/manifest"
    }
  });
});

// Запуск сервера с ошибками
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://0.0.0.0:${PORT}/health`);
  console.log(`🔑 Environment check:`);
  console.log(`   PORT: ${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'undefined'}`);
  console.log(`   RETAILCRM_URL: ${process.env.RETAILCRM_URL ? '✅ Set' : '❌ Missing'}`);
});

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// app.on('error', (error) => {
//   console.error('Server Error:', error);
// });