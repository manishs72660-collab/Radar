const jwt = require('jsonwebtoken');
const User = require('./user.model');

async function protect(req, res, next) {
  const authorization = req.get('authorization');
  const bearerToken = authorization && authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearerToken || (req.cookies && req.cookies.accessToken);

  if (!token) {
    return res.status(401).json({ message: 'Not logged in. Token missing.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    req.user = { id: user._id, name: user.name, email: user.email };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { protect };