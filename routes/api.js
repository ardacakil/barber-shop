// routes/api.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// ==================== RECORDS ENDPOINTS ====================

// Add a new record
router.post('/records', async (req, res) => {
  try {
    const { date, customer_name, service, staff, price, payment_type } = req.body;
    
    const result = await db.query(
      `INSERT INTO records (date, customer_name, service, staff, price, payment_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [date, customer_name, service, staff, price, payment_type]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding record:', error);
    res.status(500).json({ error: 'Failed to add record' });
  }
});

// Get daily records
router.get('/records/daily/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    const result = await db.query(
      `SELECT * FROM records 
       WHERE date = $1 
       ORDER BY created_at DESC`,
      [date]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching daily records:', error);
    res.status(500).json({ error: 'Failed to fetch daily records' });
  }
});

// Get monthly records
router.get('/records/monthly/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;
    
    const result = await db.query(
      `SELECT * FROM records 
       WHERE date >= $1 AND date <= $2 
       ORDER BY date DESC, created_at DESC`,
      [startDate, endDate]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching monthly records:', error);
    res.status(500).json({ error: 'Failed to fetch monthly records' });
  }
});

// Delete a record
router.delete('/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM records WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    res.json({ message: 'Record deleted successfully', record: result.rows[0] });
  } catch (error) {
    console.error('Error deleting record:', error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// ==================== EXPENSES ENDPOINTS ====================

// Add a new expense
router.post('/expenses', async (req, res) => {
  try {
    const { date, type, description, amount, payment_type } = req.body;
    
    const result = await db.query(
      `INSERT INTO expenses (date, type, description, amount, payment_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [date, type, description, amount, payment_type]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// Get daily expenses
router.get('/expenses/daily/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    const result = await db.query(
      `SELECT * FROM expenses 
       WHERE date = $1 
       ORDER BY created_at DESC`,
      [date]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching daily expenses:', error);
    res.status(500).json({ error: 'Failed to fetch daily expenses' });
  }
});

// Get monthly expenses
router.get('/expenses/monthly/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;
    
    const result = await db.query(
      `SELECT * FROM expenses 
       WHERE date >= $1 AND date <= $2 
       ORDER BY date DESC, created_at DESC`,
      [startDate, endDate]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching monthly expenses:', error);
    res.status(500).json({ error: 'Failed to fetch monthly expenses' });
  }
});

// Delete an expense
router.delete('/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      'DELETE FROM expenses WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    res.json({ message: 'Expense deleted successfully', expense: result.rows[0] });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

// ==================== CUSTOMERS ENDPOINTS ====================

// Get all customers
router.get('/customers', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM customers ORDER BY name'
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get customer details
router.get('/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const customerResult = await db.query(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );
    
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const recordsResult = await db.query(
      `SELECT * FROM records 
       WHERE customer_name = $1 
       ORDER BY date DESC, created_at DESC 
       LIMIT 50`,
      [customerResult.rows[0].name]
    );
    
    res.json({
      customer: customerResult.rows[0],
      records: recordsResult.rows
    });
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

// Add a new customer
router.post('/customers', async (req, res) => {
  try {
    const { name, phone, email } = req.body;
    
    const result = await db.query(
      `INSERT INTO customers (name, phone, email)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, phone, email]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding customer:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Customer with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to add customer' });
    }
  }
});

// ==================== SERVICES ENDPOINTS ====================

// Get all services (active only by default)
router.get('/services', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    
    const query = includeInactive 
      ? 'SELECT * FROM services ORDER BY name'
      : 'SELECT * FROM services WHERE active = true ORDER BY name';
    
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// Add a new service
router.post('/services', async (req, res) => {
  try {
    const { name, default_price } = req.body;
    
    const result = await db.query(
      `INSERT INTO services (name, default_price, active)
       VALUES ($1, $2, true)
       RETURNING *`,
      [name, default_price]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding service:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Service with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to add service' });
    }
  }
});

// Soft delete a service (set active = false)
router.delete('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `UPDATE services 
       SET active = false 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json({ message: 'Service deactivated successfully', service: result.rows[0] });
  } catch (error) {
    console.error('Error deactivating service:', error);
    res.status(500).json({ error: 'Failed to deactivate service' });
  }
});

// ==================== STAFF ENDPOINTS ====================

// Get all staff (active only by default)
router.get('/staff', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    
    const query = includeInactive 
      ? 'SELECT * FROM staff ORDER BY name'
      : 'SELECT * FROM staff WHERE active = true ORDER BY name';
    
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Add a new staff member
router.post('/staff', async (req, res) => {
  try {
    const { name } = req.body;
    
    const result = await db.query(
      `INSERT INTO staff (name, active)
       VALUES ($1, true)
       RETURNING *`,
      [name]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding staff:', error);
    if (error.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Staff member with this name already exists' });
    } else {
      res.status(500).json({ error: 'Failed to add staff member' });
    }
  }
});

// Soft delete a staff member (set active = false)
router.delete('/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `UPDATE staff 
       SET active = false 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    res.json({ message: 'Staff member deactivated successfully', staff: result.rows[0] });
  } catch (error) {
    console.error('Error deactivating staff member:', error);
    res.status(500).json({ error: 'Failed to deactivate staff member' });
  }
});

// ==================== EXPENSE TYPES ENDPOINTS ====================

// Get all expense types
router.get('/expense-types', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    
    const query = includeInactive 
      ? 'SELECT * FROM expense_types ORDER BY name'
      : 'SELECT * FROM expense_types WHERE active = true ORDER BY name';
    
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching expense types:', error);
    res.status(500).json({ error: 'Failed to fetch expense types' });
  }
});

// ==================== REPORTS ENDPOINTS ====================

// Get daily summary
router.get('/reports/daily-summary/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Get income by payment type
    const incomeResult = await db.query(
      `SELECT 
        payment_type,
        COUNT(*) as count,
        SUM(price) as total
       FROM records
       WHERE date = $1
       GROUP BY payment_type`,
      [date]
    );
    
    // Get expenses by payment type
    const expenseResult = await db.query(
      `SELECT 
        payment_type,
        COUNT(*) as count,
        SUM(amount) as total
       FROM expenses
       WHERE date = $1
       GROUP BY payment_type`,
      [date]
    );
    
    // Get total income
    const totalIncomeResult = await db.query(
      `SELECT 
        COUNT(*) as count,
        SUM(price) as total
       FROM records
       WHERE date = $1`,
      [date]
    );
    
    // Get total expenses
    const totalExpenseResult = await db.query(
      `SELECT 
        COUNT(*) as count,
        SUM(amount) as total
       FROM expenses
       WHERE date = $1`,
      [date]
    );
    
    const summary = {
      date,
      income: {
        byPaymentType: incomeResult.rows,
        total: {
          count: parseInt(totalIncomeResult.rows[0].count) || 0,
          amount: parseFloat(totalIncomeResult.rows[0].total) || 0
        }
      },
      expenses: {
        byPaymentType: expenseResult.rows,
        total: {
          count: parseInt(totalExpenseResult.rows[0].count) || 0,
          amount: parseFloat(totalExpenseResult.rows[0].total) || 0
        }
      },
      netProfit: (parseFloat(totalIncomeResult.rows[0].total) || 0) - 
                 (parseFloat(totalExpenseResult.rows[0].total) || 0)
    };
    
    res.json(summary);
  } catch (error) {
    console.error('Error generating daily summary:', error);
    res.status(500).json({ error: 'Failed to generate daily summary' });
  }
});

// Get staff performance
router.get('/reports/staff-performance/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    
    const result = await db.query(
      `SELECT 
        staff,
        COUNT(*) as service_count,
        SUM(price) as total_revenue,
        AVG(price) as average_price,
        array_agg(DISTINCT service) as services_provided
       FROM records
       WHERE date >= $1 AND date <= $2 AND staff IS NOT NULL
       GROUP BY staff
       ORDER BY total_revenue DESC`,
      [startDate, endDate]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error generating staff performance report:', error);
    res.status(500).json({ error: 'Failed to generate staff performance report' });
  }
});

// Get service analysis
router.get('/reports/service-analysis/:startDate/:endDate', async (req, res) => {
  try {
    const { startDate, endDate } = req.params;
    
    const result = await db.query(
      `SELECT 
        service,
        COUNT(*) as count,
        SUM(price) as total_revenue,
        AVG(price) as average_price,
        MIN(price) as min_price,
        MAX(price) as max_price
       FROM records
       WHERE date >= $1 AND date <= $2 AND service IS NOT NULL
       GROUP BY service
       ORDER BY count DESC`,
      [startDate, endDate]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error generating service analysis:', error);
    res.status(500).json({ error: 'Failed to generate service analysis' });
  }
});

module.exports = router;