// setupDatabase.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database setup...');
    
    // Create tables - EXACT match to your SQLite schema
    console.log('Creating tables...');
    await client.query(`
      -- Customers table
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Services table (NO default prices)
      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT true
      );

      -- Staff table
      CREATE TABLE IF NOT EXISTS staff (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT true
      );

      -- Expense types table
      CREATE TABLE IF NOT EXISTS expense_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT true
      );

      -- Records table (daily transactions)
      CREATE TABLE IF NOT EXISTS records (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        customer_name VARCHAR(255),
        service VARCHAR(255),
        staff VARCHAR(255),
        price DECIMAL(10, 2) NOT NULL,
        payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('Nakit', 'Kart', 'Banka')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Expenses table
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        type VARCHAR(255) NOT NULL,
        description TEXT,
        amount DECIMAL(10, 2) NOT NULL,
        payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('Nakit', 'Kart', 'Banka')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Tables created successfully');

    // Create indexes for better performance
    console.log('Creating indexes...');
    await client.query(`
      -- Indexes for records table
      CREATE INDEX IF NOT EXISTS idx_records_date ON records(date);
      CREATE INDEX IF NOT EXISTS idx_records_staff ON records(staff);
      CREATE INDEX IF NOT EXISTS idx_records_service ON records(service);
      CREATE INDEX IF NOT EXISTS idx_records_customer ON records(customer_name);
      CREATE INDEX IF NOT EXISTS idx_records_payment ON records(payment_type);
      
      -- Indexes for expenses table
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
      CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(type);
      CREATE INDEX IF NOT EXISTS idx_expenses_payment ON expenses(payment_type);
      
      -- Index for active services and staff
      CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);
      CREATE INDEX IF NOT EXISTS idx_staff_active ON staff(active);
      CREATE INDEX IF NOT EXISTS idx_expense_types_active ON expense_types(active);
    `);

    console.log('Indexes created successfully');

    // Insert default services if table is empty
    const servicesCount = await client.query('SELECT COUNT(*) FROM services');
    if (parseInt(servicesCount.rows[0].count) === 0) {
      console.log('Inserting default services...');
      const defaultServices = ['Saç', 'Sakal', 'Saç Sakal', 'Bakım', 'Ürün', 'Boya', 'Manikür', 'Pedikür', 'Manikür Pedikür', 'Ağda', 'Kaş'];
      
      for (const service of defaultServices) {
        await client.query(
          'INSERT INTO services (name, active) VALUES ($1, true) ON CONFLICT (name) DO NOTHING',
          [service]
        );
      }
      console.log(`Added ${defaultServices.length} default services`);
    }

    // Insert default staff if table is empty
    const staffCount = await client.query('SELECT COUNT(*) FROM staff');
    if (parseInt(staffCount.rows[0].count) === 0) {
      console.log('Inserting default staff...');
      const defaultStaff = ['Ufuk', 'Muhammet', 'Manikürist', 'Kalfa'];
      
      for (const member of defaultStaff) {
        await client.query(
          'INSERT INTO staff (name, active) VALUES ($1, true) ON CONFLICT (name) DO NOTHING',
          [member]
        );
      }
      console.log(`Added ${defaultStaff.length} default staff members`);
    }

    // Insert default expense types if table is empty
    const expenseTypesCount = await client.query('SELECT COUNT(*) FROM expense_types');
    if (parseInt(expenseTypesCount.rows[0].count) === 0) {
      console.log('Inserting default expense types...');
      const defaultExpenseTypes = [
        'Kira', 
        'Elektrik Faturası', 
        'Su Faturası', 
        'Doğalgaz Faturası',
        'Sgk Prim Ödemeleri', 
        'İnternet ve Telefon Faturası', 
        'Kredi Finansbank Ödemesi', 
        'Kurutemizleme Giderleri',
        'Muhasebe ve Hukuk Giderleri', 
        'Genel Giderler',
        'Yiyecek İçecek Giderleri', 
        'Malzeme Alımları',
        'Ufuk Maaş / Avans', 
        'Muhammet Maaş / Avans',
        'Manikürist Maaş / Avans', 
        'Eleman Maaş / Avans', 
        'Çıraklar Maaş / Avans'
      ];
      
      for (const type of defaultExpenseTypes) {
        await client.query(
          'INSERT INTO expense_types (name, active) VALUES ($1, true) ON CONFLICT (name) DO NOTHING',
          [type]
        );
      }
      console.log(`Added ${defaultExpenseTypes.length} default expense types`);
    }

    console.log('Database setup completed successfully!');
    console.log('All tables created with default data matching your Electron app.');
    
  } catch (error) {
    console.error('Error setting up database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupDatabase;