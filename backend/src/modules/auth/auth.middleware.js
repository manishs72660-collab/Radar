const jwt = require('jsonwebtoken');
const User = require('./user.model');

async function protect(req, res, next) {
  try {
    const token = req.cookies && req.cookies.accessToken;

    if (!token) {
      return res.status(401).json({ message: 'Not logged in. Token missing.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    req.user = { id: user._id, name: user.name, email: user.email };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = { protect };