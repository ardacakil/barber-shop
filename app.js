// app.js
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Database connection check
db.pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('✅ Database connected:', {
      database: client.database,
      time: new Date(),
      poolSize: db.pool.totalCount,
      idleConnections: db.pool.idleCount
    });
    release();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Wouw Hair Design API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: {
        services: '/api/services',
        staff: '/api/staff',
        customers: '/api/customers',
        records: '/api/records',
        expenses: '/api/expenses',
        expenseTypes: '/api/expense-types',
        reports: '/api/reports'
      }
    }
  });
});

// IMPORTANT: Mount API routes BEFORE 404 handler
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// 404 handler (must be AFTER all routes)
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown();
});

function gracefulShutdown() {
  console.log('\n📛 Shutdown signal received, starting graceful shutdown...');
  
  server.close(() => {
    console.log('🔄 HTTP server closed');
    
    console.log('🔄 Closing database connection pool...');
    db.pool.end(() => {
      console.log('✅ Database pool closed');
      process.exit(0);
    });
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// Start server
console.log('🚀 Starting Barber Shop API...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');

const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log('📱 Ready for mobile app connections');
  console.log(`🔗 Local: http://localhost:${PORT}`);
});