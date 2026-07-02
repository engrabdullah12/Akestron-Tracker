import jwt from 'jsonwebtoken';

// Authenticate token middleware
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token missing or malformed' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'akestron_super_secret_key_123!@#', (err, decodedUser) => {
    if (err) {
      console.error('[JWT Debug] Verification failed:', err.message, 'Secret length:', (process.env.JWT_SECRET || '').length);
      return res.status(403).json({ message: 'Token is invalid or expired' });
    }
    req.user = decodedUser;
    next();
  });
};

// Check if user is admin middleware
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'User context is missing' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admin role required' });
  }
  next();
};
