import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbGet, dbRun } from '../database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const getJwtSecret = () => process.env.JWT_SECRET || 'akestron_super_secret_key_123!@#';

// Register User
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  try {
    // Check if email already exists
    const existingUser = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    // Determine role (first user becomes Admin, subsequent users become Members)
    const countRow = await dbGet('SELECT COUNT(*) as count FROM users');
    const role = countRow.count === 0 ? 'admin' : 'member';

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save to Database
    const result = await dbRun(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, role]
    );

    // Generate JWT Token
    const token = jwt.sign(
      { id: result.id, name, email, role },
      getJwtSecret(),
      { expiresIn: '30d' }
    );

    res.status(201).json({
      message: 'Account registered successfully',
      token,
      user: { id: result.id, name, email, role }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Login User
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Fetch User
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Compare Password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Generate JWT Token
    console.log('[JWT Sign Debug] Signing token with secret length:', getJwtSecret().length, 'Secret:', JSON.stringify(getJwtSecret()));
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      getJwtSecret(),
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Logged in successfully',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error authenticating user' });
  }
});

// Fetch Profile Context (Self)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Error fetching user profile context' });
  }
});

export default router;
