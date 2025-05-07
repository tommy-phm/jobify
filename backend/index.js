import express from "express";
import mysql from 'mysql2/promise';
import cors from "cors";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Database connection
const connectToDatabase = async () => {
  try {
    const db = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "password",
      database: process.env.DB_NAME || "database"
    });
    return db;
  } catch (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }
};

// Get all jobs with optional filtering
app.get("/jobs", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { id, status, days } = req.query;
    const conditions = [];
    const params = [];
    
    // Handle ID filter
    if (id) {
      const idNum = parseInt(id);
      if (!isNaN(idNum)) {
        conditions.push(`id = ?`);
        params.push(idNum);
      }
    }

    // Handle status filter
    if (status) {
      const statusArray = Array.isArray(status) 
        ? status 
        : status.split(',')
            .map(s => parseInt(s.trim()))
            .filter(s => !isNaN(s));
      
      if (statusArray.length > 0) {
        conditions.push(`status IN (?)`);
        params.push(statusArray);
      }
    }
    
    // Handle days filter
    if (days) {
      const daysNum = parseInt(days);
      if (!isNaN(daysNum) && daysNum > 0) {
        conditions.push(`created_at > DATE_SUB(NOW(), INTERVAL ? DAY)`);
        params.push(daysNum);
      }
    }
    
    let whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM jobs ${whereClause}`;
    
    const [rows] = await db.query(query, params);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching jobs:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Get a specific job by ID
app.get("/jobs/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const jobID = parseInt(req.params.id);
    
    if (isNaN(jobID)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }
    
    const query = "SELECT * FROM jobs WHERE id = ?";
    const [rows] = await db.query(query, [jobID]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    return res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching job:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Create a new job
app.post("/jobs", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const { id, title, company, location, date_created, description, status, date_applied } = req.body;
    
    // Validate required fields
    if (!title || !company) {
      return res.status(400).json({ error: "Title and company are required fields" });
    }
    
    const query = `
      INSERT INTO jobs 
      (id, title, company, location, date_created, description, status, date_applied) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      id,
      title,
      company,
      location,
      date_created,
      description,
      status !== undefined ? status : 0, // Default to unprocessed (0)
      date_applied
    ];
    
    const [result] = await db.query(query, values);
    
    return res.status(201).json({
      message: "Job created successfully",
      jobId: result.insertId
    });
  } catch (err) {
    console.error("Error creating job:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Update an existing job
app.put("/jobs/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const jobId = parseInt(req.params.id);
    
    if (isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }
    
    const jobData = req.body;
    const allowedFields = ['title', 'company', 'location', 'date_created', 'description', 'status', 'date_applied'];
    const fields = Object.keys(jobData).filter(key => allowedFields.includes(key));
    
    if (fields.length === 0) {
      return res.status(400).json({ error: "No valid job fields provided for update" });
    }
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const query = `UPDATE jobs SET ${setClause} WHERE id = ?`;
    const values = [...fields.map(field => jobData[field]), jobId];
  
    const [result] = await db.query(query, values);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    return res.json({
      message: "Job updated successfully",
      jobId
    });
  } catch (err) {
    console.error("Error updating job:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Delete a job
app.delete("/jobs/:id", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const jobId = parseInt(req.params.id);
    
    if (isNaN(jobId)) {
      return res.status(400).json({ error: "Invalid job ID" });
    }
    
    const query = "DELETE FROM jobs WHERE id = ?";
    const [result] = await db.query(query, [jobId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Job not found" });
    }
    
    return res.json({
      message: "Job deleted successfully",
      jobId
    });
  } catch (err) {
    console.error("Error deleting job:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Get job statistics
app.get("/statistics", async (req, res) => {
  try {
    const db = await connectToDatabase();
    
    // Query for overall statistics
    const overallStatsQuery = `
      SELECT
        COUNT(CASE WHEN status = 0 THEN 1 END) AS unprocessed,
        COUNT(CASE WHEN status = 1 THEN 1 END) AS rejected,
        COUNT(CASE WHEN status = 2 THEN 1 END) AS accepted,
        COUNT(CASE WHEN status = 3 THEN 1 END) AS applied,
        COUNT(id) AS total
      FROM jobs
    `;
   
    // Query for counting jobs by date_applied for the last 30 days
    const dailyCountsQuery = `
      WITH RECURSIVE date_range AS (
        SELECT DATE_SUB(CURRENT_DATE(), INTERVAL 29 DAY) AS date_applied
        UNION ALL
        SELECT DATE_ADD(date_applied, INTERVAL 1 DAY)
        FROM date_range
        WHERE date_applied < CURRENT_DATE()
      )
      SELECT
        DATE_FORMAT(dr.date_applied, '%Y-%m-%d') AS date_applied,
        COALESCE(COUNT(j.id), 0) AS job_applied
      FROM date_range dr
      LEFT JOIN jobs j ON DATE(j.date_applied) = dr.date_applied
      GROUP BY dr.date_applied
      ORDER BY dr.date_applied DESC
      LIMIT 30
    `;
   
    // Execute both queries concurrently
    const [[overallData], [dailyData]] = await Promise.all([
      db.query(overallStatsQuery),
      db.query(dailyCountsQuery)
    ]);
    
    // Return both sets of data
    return res.json({
      ...overallData[0],
      appliedCount: dailyData
    });
  } catch (err) {
    console.error("Error fetching statistics:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Start the server
app.listen(80, ()=>{
  console.log("Backend Server Started")
})