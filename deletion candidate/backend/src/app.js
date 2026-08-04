const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const passport = require('passport');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

require('./config/passport');

const authRoutes    = require('./routes/auth.routes');
const userRoutes    = require('./routes/user.routes');
const profileRoutes = require('./routes/profile.routes');
const matchRoutes    = require('./routes/match.routes');
const messageRoutes  = require('./routes/message.routes');
const projectRoutes  = require('./routes/project.routes');
const meetingRoutes  = require('./routes/meeting.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();

// Trust Railway's proxy so rate-limiting and IP detection work correctly
app.set('trust proxy', 1);

// Security & parsing
// crossOriginOpenerPolicy disabled: COOP: same-origin severs the opener's popup reference,
// making popup.closed return true immediately in Chrome and breaking the OAuth popup flow.
app.use(helmet({ crossOriginOpenerPolicy: false }));
const NETLIFY_SITE = 'bizmatchapp.netlify.app';
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: process.env.NODE_ENV === 'development'
    ? true
    : (origin, cb) => {
        if (!origin) return cb(null, true);
        const isNetlify = origin === `https://${NETLIFY_SITE}` ||
                          origin.endsWith(`--${NETLIFY_SITE}`);
        if (isNetlify || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Not allowed by CORS'));
      },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());

// Rate limiting on all /api routes
app.use('/api', apiLimiter);

// Request logger
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/profile',  profileRoutes);
app.use('/api/match',    matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/meetings',       meetingRoutes);
app.use('/api/notifications',  notificationRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use(errorHandler);

module.exports = app;
