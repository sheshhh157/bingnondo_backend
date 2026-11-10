const { Pool, types } = require('pg');

// NUMERIC (OID 1700) → JS number, so JSON sends 250.5 instead of "250.50"
types.setTypeParser(1700, (v) => parseFloat(v));

const databaseConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

const pool = new Pool({
  ...databaseConfig,
  // Keep a small pool — this is a cafe app, not high-traffic SaaS
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('PostgreSQL connection failed:', err.message);
    process.exit(1);
  }
  console.log('PostgreSQL connected');
  release();
});

module.exports = pool;