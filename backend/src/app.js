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

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(require('path').join(__dirname, '../uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Rate limiting on all /api routes
app.use('/api', apiLimiter);

// Request logger
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth',    authRoutes);
app.use('/api/users',   userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/match',    matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/projects', projectRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use(errorHandler);

module.exports = app;
