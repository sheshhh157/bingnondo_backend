'use strict';

/**
 * notifications.routes.js  —  §1.8 Notifications
 * ─────────────────────────────────────────────────
 * Route table (all protected by requireCustomer middleware):
 *
 *   GET  /api/customer/notifications         → list, paginated, with unread_count
 *   PUT  /api/notifications/read-all         → batch mark all unread → read
 *   PUT  /api/notifications/:id/read         → mark single notification as read
 *
 * Note on route order:
 *   /read-all must be declared BEFORE /:id/read — Express matches routes in
 *   declaration order and 'read-all' would otherwise be captured as the :id
 *   param (which would parse to NaN and return 400).
 *
 * Mount points (in app.js):
 *   app.use('/api/customer',       notificationsCustomerRoutes);
 *   app.use('/api/notifications',  notificationsSharedRoutes);
 *
 * The split is needed because the flow doc specifies two base paths:
 *   GET  /api/customer/notifications     (list — lives under /customer)
 *   PUT  /api/notifications/:id/read     (mark read — lives under /notifications)
 *   PUT  /api/notifications/read-all     (batch read — lives under /notifications)
 *
 * Both routers are exported and registered separately in app.js.
 */

const express = require('express');
const { requireCustomer } = require('../../middleware/auth');

const {
  listNotifications,
  markOneRead,
  markAllRead,
} = require('./notifications.controller');

// ── /api/customer prefix ──────────────────────────────────────────────────────
const customerRouter = express.Router();

/**
 * GET /api/customer/notifications
 * Paginated list of the authenticated customer's notifications.
 * Query params: limit, before_id, unread_only
 */
customerRouter.get('/notifications', requireCustomer, listNotifications);

// ── /api/notifications prefix ─────────────────────────────────────────────────
const notificationsRouter = express.Router();

/**
 * PUT /api/notifications/read-all
 * Mark ALL unread notifications as read.
 * MUST be declared before /:id/read (see note above).
 */
notificationsRouter.put('/read-all', requireCustomer, markAllRead);

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read.
 */
notificationsRouter.put('/:id/read', requireCustomer, markOneRead);

module.exports = { customerRouter, notificationsRouter };