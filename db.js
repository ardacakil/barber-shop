// db.js - PostgreSQL Database Connection Module
// This replaces your SQLite connection with PostgreSQL + connection pooling

const { Pool } = require('pg');
require('dotenv').config();

// ============================================
// DATABASE CONFIGURATION
// ============================================

const dbConfig = {
  // Railway provides DATABASE_URL automatically
  connectionString: process.env.DATABASE_URL,
  
  // Connection Pool Configuration
  max: 10,                      // Maximum number of clients in pool
  min: 2,                       // Minimum number of clients in pool
  idleTimeoutMillis: 30000,     // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Timeout if can't connect in 5 seconds
  
  // SSL Configuration
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }  // Required for Railway
    : false,                         // No SSL for local development
    
  // Query timeout
  statement_timeout: 30000,     // 30 seconds max per query
  query_timeout: 30000,
  
  // Application name (shows in pg_stat_activity)
  application_name: 'barber-shop-app'
};

// For local development without DATABASE_URL
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  dbConfig.host = process.env.PGHOST || 'localhost';
  dbConfig.port = process.env.PGPORT || 5432;
  dbConfig.database = process.env.PGDATABASE || 'barbershop';
  dbConfig.user = process.env.PGUSER || 'postgres';
  dbConfig.password = process.env.PGPASSWORD || 'postgres';
  delete dbConfig.connectionString;
}

// ============================================
// CREATE CONNECTION POOL
// ============================================

const pool = new Pool(dbConfig);

// ============================================
// POOL EVENT HANDLERS
// ============================================

// Log when a client is connected
pool.on('connect', (client) => {
  console.log('✅ New database client connected');
  
  // Set timezone for each new connection (Antalya, Turkey)
  client.query('SET timezone TO "Europe/Istanbul"');
});

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('❌ Unexpected database error:', err.message);
  // Don't crash the app, just log the error
});

// Log when a client is removed
pool.on('remove', () => {
  console.log('🔄 Database client removed from pool');
});

// ============================================
// QUERY HELPERS
// ============================================

/**
 * Execute a simple query with automatic connection management
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (over 1 second)
    if (duration > 1000) {
      console.warn(`⚠️ Slow query (${duration}ms):`, text.substring(0, 100));
    }
    
    return result;
  } catch (error) {
    console.error('❌ Query error:', {
      message: error.message,
      query: text.substring(0, 100),
      params: params
    });
    throw error;
  }
}

/**
 * Get a single row from query result
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>} Single row or null
 */
async function getOne(text, params) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

/**
 * Get all rows from query result
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Array of rows
 */
async function getAll(text, params) {
  const result = await query(text, params);
  return result.rows;
}

/**
 * Execute INSERT query and return the created row
 * @param {string} table - Table name
 * @param {Object} data - Data to insert
 * @returns {Promise<Object>} Created row
 */
async function insert(table, data) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  
  const text = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `;
  
  const result = await query(text, values);
  return result.rows[0];
}

/**
 * Execute UPDATE query and return updated row
 * @param {string} table - Table name
 * @param {Object} data - Data to update
 * @param {Object} where - WHERE conditions
 * @returns {Promise<Object>} Updated row
 */
async function update(table, data, where) {
  const dataColumns = Object.keys(data);
  const dataValues = Object.values(data);
  const whereColumns = Object.keys(where);
  const whereValues = Object.values(where);
  
  const setClause = dataColumns.map((col, i) => `${col} = $${i + 1}`).join(', ');
  const whereClause = whereColumns.map((col, i) => `${col} = $${dataValues.length + i + 1}`).join(' AND ');
  
  const text = `
    UPDATE ${table}
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP
    WHERE ${whereClause}
    RETURNING *
  `;
  
  const result = await query(text, [...dataValues, ...whereValues]);
  return result.rows[0];
}

/**
 * Soft delete (set deleted_at timestamp)
 * @param {string} table - Table name
 * @param {Object} where - WHERE conditions
 * @returns {Promise<Object>} Deleted row
 */
async function softDelete(table, where) {
  return update(table, { deleted_at: new Date() }, where);
}

/**
 * Hard delete from database
 * @param {string} table - Table name
 * @param {Object} where - WHERE conditions
 * @returns {Promise<Object>} Deleted row
 */
async function hardDelete(table, where) {
  const whereColumns = Object.keys(where);
  const whereValues = Object.values(where);
  const whereClause = whereColumns.map((col, i) => `${col} = $${i + 1}`).join(' AND ');
  
  const text = `
    DELETE FROM ${table}
    WHERE ${whereClause}
    RETURNING *
  `;
  
  const result = await query(text, whereValues);
  return result.rows[0];
}

// ============================================
// TRANSACTION SUPPORT
// ============================================

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Async function that receives client
 * @returns {Promise<any>} Transaction result
 */
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a client for manual transaction control
 * @returns {Promise<Object>} Database client
 */
async function getClient() {
  const client = await pool.connect();
  
  // Add transaction helpers to client
  client.transaction = {
    begin: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK')
  };
  
  // Override release to ensure cleanup
  const originalRelease = client.release;
  client.release = function() {
    return originalRelease.apply(client, arguments);
  };
  
  return client;
}

// ============================================
// DATABASE UTILITIES
// ============================================

/**
 * Test database connection
 * @returns {Promise<boolean>} Connection status
 */
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as current_time, current_database() as database');
    const info = result.rows[0];
    console.log('✅ Database connected:', {
      database: info.database,
      time: info.current_time,
      poolSize: pool.totalCount,
      idleConnections: pool.idleCount
    });
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Get pool statistics
 * @returns {Object} Pool stats
 */
function getPoolStats() {
  return {
    total: pool.totalCount,      // Total clients
    idle: pool.idleCount,        // Idle clients
    waiting: pool.waitingCount   // Queued requests
  };
}

/**
 * Close all database connections
 * @returns {Promise<void>}
 */
async function closePool() {
  console.log('🔄 Closing database connection pool...');
  await pool.end();
  console.log('✅ Database pool closed');
}

/**
 * Check if table exists
 * @param {string} tableName - Name of table to check
 * @returns {Promise<boolean>}
 */
async function tableExists(tableName) {
  const result = await query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    )
  `, [tableName]);
  return result.rows[0].exists;
}

/**
 * Initialize database schema
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
  try {
    console.log('🔄 Checking database schema...');
    
    // Check if main tables exist
    const customersExist = await tableExists('customers');
    const appointmentsExist = await tableExists('appointments');
    
    if (!customersExist || !appointmentsExist) {
      console.log('📦 Database tables not found. Please run schema setup.');
      // You can automatically run schema here if needed
      // await runSchemaFile('./schema.sql');
    } else {
      console.log('✅ Database schema is ready');
    }
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    throw error;
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

// Handle app termination gracefully
process.on('SIGTERM', async () => {
  console.log('📛 SIGTERM received, closing database pool...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📛 SIGINT received, closing database pool...');
  await closePool();
  process.exit(0);
});

// ============================================
// MODULE EXPORTS
// ============================================

module.exports = {
  // Pool instance (if you need direct access)
  pool,
  
  // Query methods
  query,
  getOne,
  getAll,
  insert,
  update,
  softDelete,
  hardDelete,
  
  // Transaction methods
  transaction,
  getClient,
  
  // Utility methods
  testConnection,
  getPoolStats,
  closePool,
  tableExists,
  initializeDatabase,
  
  // Helper to escape identifiers (table/column names)
  escapeIdentifier: (str) => `"${str.replace(/"/g, '""')}"`,
  
  // Helper to build WHERE clause
  buildWhereClause: (conditions) => {
    const entries = Object.entries(conditions);
    const clause = entries.map(([key, value], i) => {
      if (value === null) return `${key} IS NULL`;
      if (Array.isArray(value)) return `${key} = ANY($${i + 1})`;
      return `${key} = $${i + 1}`;
    }).join(' AND ');
    const values = entries.map(([_, value]) => value).filter(v => v !== null);
    return { clause, values };
  }
};