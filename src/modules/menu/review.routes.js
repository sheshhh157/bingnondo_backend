'use strict';

/**
 * review.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Ratings & Reviews routes — mounted at /api/menu/items
 *
 *   GET  /api/menu/items/:id/reviews            — list reviews (public)
 *   POST /api/menu/items/:id/reviews            — submit/update review (auth)
 *   GET  /api/menu/items/:id/reviews/my-review  — get own review (auth)
 *   GET  /api/menu/items/:id/reviews/can-review — eligibility check (auth)
 *
 * NOTE: Mount this BEFORE the /:id catch-all in menu.routes.js, OR mount
 * it separately in app.js under /api/menu/items. See app.js comment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express           = require('express');
const rateLimit         = require('express-rate-limit');
const { requireCustomer } = require('../../middleware/auth');
const {
  listReviews,
  submitReview,
  getMyReview,
  canReview,
} = require('./review.controller');

const router = express.Router();

// ── Rate limiter — prevent review spam ───────────────────────────────────────
const reviewLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many review requests. Please slow down.' },
});

// ── Routes ────────────────────────────────────────────────────────────────────

// IMPORTANT: specific string sub-paths BEFORE param-dependent routes
// so Express does not match "my-review" or "can-review" as :id.

/**
 * GET /api/menu/items/:id/reviews/can-review
 * Returns { can_review, already_reviewed } — eligibility check for the
 * logged-in customer. Flutter calls this when the detail sheet opens.
 */
router.get('/:id/reviews/can-review', requireCustomer, canReview);

/**
 * GET /api/menu/items/:id/reviews/my-review
 * Returns the current customer's existing review for this item (for edit pre-fill).
 * 404 if they haven't reviewed it yet.
 */
router.get('/:id/reviews/my-review', requireCustomer, getMyReview);

/**
 * GET /api/menu/items/:id/reviews
 * Public listing — newest first + summary.
 */
router.get('/:id/reviews', listReviews);

/**
 * POST /api/menu/items/:id/reviews
 * Submit or update the customer's review.
 * Body: { rating: 1-5, comment?: string }
 */
router.post('/:id/reviews', requireCustomer, reviewLimiter, submitReview);

module.exports = router;