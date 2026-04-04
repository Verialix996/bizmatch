const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: LinkedInStrategy } = require('passport-linkedin-oauth2');
const UserModel = require('../models/user.model');

// JWT strategy — validates Bearer tokens on protected routes
passport.use(new JwtStrategy(
  {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
  },
  async (payload, done) => {
    try {
      const user = await UserModel.findById(payload.id);
      return user ? done(null, user) : done(null, false);
    } catch (err) {
      return done(err, false);
    }
  }
));

// Google OAuth strategy
passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL,
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const user = await UserModel.findOrCreateOAuth({
        provider: 'google',
        providerId: profile.id,
        email: profile.emails[0].value,
        name:  profile.displayName,
        photo: profile.photos?.[0]?.value,
      });
      return done(null, user);
    } catch (err) {
      return done(err, false);
    }
  }
));

// LinkedIn OAuth strategy
passport.use(new LinkedInStrategy(
  {
    clientID:     process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    callbackURL:  process.env.LINKEDIN_CALLBACK_URL,
    scope: ['r_emailaddress', 'r_liteprofile'],
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const user = await UserModel.findOrCreateOAuth({
        provider: 'linkedin',
        providerId: profile.id,
        email: profile.emails[0].value,
        name:  profile.displayName,
        photo: profile.photos?.[0]?.value,
      });
      return done(null, user);
    } catch (err) {
      return done(err, false);
    }
  }
));
