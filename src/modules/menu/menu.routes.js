/**
 * menu.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * § 1.3 Digital Menu — public REST endpoints.
 *
 *   GET /api/menu                       — all categories + items (nested)
 *   GET /api/menu/categories            — categories only (tab headers)
 *   GET /api/menu/availability-check    — check is_available for N item IDs
 *   GET /api/menu/:id                   — single item detail
 *
 * All routes are PUBLIC (no auth required) — customers browse before logging in,
 * and even unauthenticated users can see the menu.
 *
 * A light rate limiter is applied to prevent scraping / accidental hammering.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const {
  getMenu,
  getCategories,
  getMenuItem,
  checkAvailability,
} = require('./menu.controller');

const router = express.Router();

// ── Rate Limiter ──────────────────────────────────────────────────────────────
// 120 requests per minute per IP — generous for normal browsing;
// tight enough to block aggressive scrapers.
const menuLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
});

router.use(menuLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────

// IMPORTANT: specific string paths BEFORE /:id — otherwise Express would match
// "categories" and "availability-check" as the :id param.

/**
 * GET /api/menu
 * Full menu: categories array with items nested inside each.
 * Used by the Flutter Home/Menu screen on initial load.
 */
router.get('/', getMenu);

/**
 * GET /api/menu/categories
 * Categories list only — no items.
 * Fast: used to render tab headers while items load.
 */
router.get('/categories', getCategories);

/**
 * GET  /api/menu/availability-check?ids=1,2,3
 * POST /api/menu/availability-check  { item_ids: [1, 2, 3] }
 * Pre-checkout cart validation — returns current is_available per item.
 */
router.get('/availability-check', checkAvailability);
router.post('/availability-check', checkAvailability);

/**
 * GET /api/menu/:id
 * Single item detail.
 */
router.get('/:id', getMenuItem);

module.exports = router;