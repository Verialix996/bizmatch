const passport = require('passport');

// Protect route — requires valid JWT
function authenticate(req, res, next) {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err)   return next(err);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  })(req, res, next);
}

// Require email verified
function requireVerified(req, res, next) {
  if (!req.user.is_verified) {
    return res.status(403).json({ error: 'Email not verified' });
  }
  next();
}

module.exports = { authenticate, requireVerified };
