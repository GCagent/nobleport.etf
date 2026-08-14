const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { audit } = require('../utils/logger');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

// Bootstrap: the first registered account, when it matches ADMIN_EMAIL,
// becomes admin. Every account after that requires an admin to create it.
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || password.length < 12) {
      return res
        .status(400)
        .json({ error: 'Email and a password of at least 12 characters are required' });
    }

    const userCount = await User.countDocuments();
    if (userCount === 0) {
      if (
        !process.env.ADMIN_EMAIL ||
        email.toLowerCase() !== process.env.ADMIN_EMAIL.toLowerCase()
      ) {
        return res
          .status(403)
          .json({ error: 'First account must match ADMIN_EMAIL' });
      }
    } else {
      // Non-bootstrap registration is admin-only.
      return requireAuth(req, res, () =>
        requireAdmin(req, res, () => createUser(req, res, next, 'staff'))
      );
    }

    return createUser(req, res, next, 'admin');
  } catch (err) {
    return next(err);
  }
});

async function createUser(req, res, next, role) {
  try {
    const { email, password, name } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash, name, role });
    audit('auth.user.created', { email: user.email, role: user.role });
    return res.status(201).json({ id: String(user._id), email: user.email, role });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    return next(err);
  }
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    const ok = user && (await bcrypt.compare(password || '', user.passwordHash));
    if (!ok) {
      audit('auth.login.failed', { email, ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    audit('auth.login.success', { email: user.email, ip: req.ip });
    return res.json({ token: signToken(user), role: user.role });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ email: req.user.email, role: req.user.role });
});

module.exports = router;
