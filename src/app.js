'use strict';

require('dotenv').config();

const http    = require('http');
const express = require('express');
const cors    = require('cors');

require('./config/db');
const ensureSchema = require('./config/ensureSchema');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', ts: new Date().toISOString() })
);

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes        = require('./modules/auth/auth.routes');
const chatbotRoutes     = require('./modules/chatbot/chatbot.routes');
const menuRoutes        = require('./modules/menu/menu.routes');
const reviewRoutes      = require('./modules/menu/review.routes');
const businessHoursRoutes = require('./modules/business-hours/business_hours.routes');
const customerRoutes    = require('./modules/customer/customer.routes');
const ordersRoutes      = require('./modules/orders/orders.routes');
const paymentsRoutes    = require('./modules/payments/payments.routes');
const supportChatRoutes = require('./modules/support-chat/support_chat.routes');
// Address picker — reverse geocoding + place search (OSM Nominatim)
const geoRoutes         = require('./modules/geo/geo.routes');
// Service-to-service bridge — the web backend (Bingnondo/backend) calls these
// so staff-side status/payment changes reach the customer app in real time.
const internalRoutes    = require('./modules/internal/internal.routes');

// §1.8 Notifications — two routers under different base paths
const {
  customerRouter:      notificationsCustomerRouter,   // GET /api/customer/notifications
  notificationsRouter: notificationsRouter,            // PUT /api/notifications/...
} = require('./modules/notifications/notifications.routes');

// §1.9 Rider live location — PUT /api/rider/location (rider device pushes GPS)
const riderLocationRouter = require('./modules/rider/rider_location_route');

app.use('/api/auth',          authRoutes);
app.use('/api/chatbot',       chatbotRoutes);
app.use('/api/menu/items',    reviewRoutes);   // ← Reviews: /api/menu/items/:id/reviews
app.use('/api/menu',          menuRoutes);
app.use('/api/business-hours', businessHoursRoutes);           // ← Open/Closed + order window
app.use('/api/customer',      customerRoutes);
app.use('/api/customer',      notificationsCustomerRouter);  // ← §1.8 GET /api/customer/notifications
app.use('/api/orders',        ordersRoutes);
app.use('/api/payments',      paymentsRoutes);
app.use('/api/support-chat',  supportChatRoutes);
app.use('/api/geo',           geoRoutes);
app.use('/api/internal',      internalRoutes);              // ← bridge (web → app)
app.use('/api/notifications', notificationsRouter);          // ← §1.8 PUT /api/notifications/:id/read
app.use('/api/rider',         riderLocationRouter);          // ← §1.9 PUT /api/rider/location

app.use((_req, res) => res.status(404).json({ message: 'Not found.' }));

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

const server = http.createServer(app);
const socketManager = require('./sockets/socket');
socketManager.init(server);

const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, () => {
  console.log(`Bingnondo Backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

// Idempotent schema top-ups (address pin columns). Non-fatal if it fails.
ensureSchema().catch((err) =>
  console.error('ensureSchema failed:', err.message)
);

module.exports = app;