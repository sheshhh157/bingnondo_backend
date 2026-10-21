'use strict';

/**
 * support_chat.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mounts under /api/support-chat  (registered in app.js)
 *
 * All routes require a valid customer JWT (requireCustomer middleware).
 *
 * Routes:
 *   GET  /api/support-chat          → fetch chat thread + messages
 *   POST /api/support-chat/message  → customer sends a message
 *   PUT  /api/support-chat/read     → mark incoming messages as read
 * ─────────────────────────────────────────────────────────────────────────────
 */

const router  = require('express').Router();
const { requireCustomer } = require('../../middleware/auth');
const ctrl    = require('./support_chat.controller');

// All support-chat routes are customer-only
router.use(requireCustomer);

router.get   ('/',        ctrl.fetchChat);
router.post  ('/message', ctrl.sendMessage);
router.put   ('/read',    ctrl.markRead);

module.exports = router;