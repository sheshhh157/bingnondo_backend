'use strict';

/**
 * review.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Ratings & Reviews for menu items.
 *
 *   GET  /api/menu/items/:id/reviews     — list reviews for a menu item (public)
 *   POST /api/menu/items/:id/reviews     — submit a review (customer, auth required)
 *
 * Rules:
 *   • Only one review per customer per menu item (enforced by DB unique index).
 *   • Customer must have at least one COMPLETED order that includes the item.
 *   • Rating must be 1–5 (integer). Comment is optional (max 1 000 chars).
 *   • author_name is taken from the customer's first_name + last_name initial
 *     so the customer never has to type their name.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const db = require('../../config/db');

// ─── GET /api/menu/items/:id/reviews ─────────────────────────────────────────
// Public — no auth required.
// Returns reviews newest-first, together with a summary (avg + star counts).
// ─────────────────────────────────────────────────────────────────────────────
async function listReviews(req, res, next) {
  try {
    const itemId = parseInt(req.params.id, 10);
    if (isNaN(itemId)) {
      return res.status(400).json({ message: 'Invalid menu item ID.' });
    }

    // Verify item exists and is not deleted
    const itemCheck = await db.query(
      `SELECT id FROM menu_items WHERE id = $1 AND is_deleted = FALSE`,
      [itemId],
    );
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Menu item not found.' });
    }

    const result = await db.query(
      `SELECT
         id,
         author_name,
         rating,
         comment,
         created_at
       FROM   menu_item_reviews
       WHERE  menu_item_id = $1
       ORDER  BY created_at DESC`,
      [itemId],
    );

    const reviews = result.rows.map((r) => ({
      id:          r.id,
      author_name: r.author_name,
      rating:      r.rating,
      comment:     r.comment || '',
      created_at:  r.created_at,
    }));

    // Compute summary
    const total   = reviews.length;
    const avg     = total === 0
      ? 0
      : reviews.reduce((sum, r) => sum + r.rating, 0) / total;
    const counts  = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const star = Math.round(r.rating);
      if (star >= 1 && star <= 5) counts[star]++;
    }

    return res.json({
      summary: {
        average:     parseFloat(avg.toFixed(2)),
        total_count: total,
        star_counts: counts,
      },
      reviews,
    });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/menu/items/:id/reviews ────────────────────────────────────────
// Auth required (requireCustomer middleware).
// Body: { rating: 1–5, comment?: string }
// ─────────────────────────────────────────────────────────────────────────────
async function submitReview(req, res, next) {
  try {
    const customerId = req.customerId;          // set by requireCustomer
    const itemId     = parseInt(req.params.id, 10);

    if (isNaN(itemId)) {
      return res.status(400).json({ message: 'Invalid menu item ID.' });
    }

    // ── Validate input ────────────────────────────────────────────────────────
    const rating  = parseInt(req.body.rating, 10);
    const comment = (req.body.comment || '').toString().trim().slice(0, 1000);

    if (isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(422).json({ message: 'Rating must be a whole number between 1 and 5.' });
    }

    // ── Verify item exists ────────────────────────────────────────────────────
    const itemCheck = await db.query(
      `SELECT id FROM menu_items WHERE id = $1 AND is_deleted = FALSE`,
      [itemId],
    );
    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Menu item not found.' });
    }

    // ── Check: customer has a completed order containing this item ────────────
    const eligibilityCheck = await db.query(
      `SELECT 1
       FROM   orders o
       JOIN   order_items oi ON oi.order_id = o.id
       WHERE  o.customer_id    = $1
         AND  o.status         = 'completed'
         AND  oi.menu_item_id  = $2
       LIMIT  1`,
      [customerId, itemId],
    );

    if (eligibilityCheck.rows.length === 0) {
      return res.status(403).json({
        message: 'You can only review items from a completed order.',
      });
    }

    // ── Get customer's display name ───────────────────────────────────────────
    const customerResult = await db.query(
      `SELECT first_name, last_name FROM customers WHERE id = $1`,
      [customerId],
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    const { first_name, last_name } = customerResult.rows[0];
    // Format: "Juan D." (first name + last initial)
    const lastInitial  = last_name ? ` ${last_name.trim()[0].toUpperCase()}.` : '';
    const authorName   = `${(first_name || 'Customer').trim()}${lastInitial}`;

    // ── Upsert review (manual: partial unique index can't use ON CONFLICT) ────
    // The DB has: CREATE UNIQUE INDEX ... WHERE (customer_id IS NOT NULL)
    // PostgreSQL requires the WHERE clause to be repeated for ON CONFLICT to
    // recognise a partial index — easier to just do SELECT then INSERT/UPDATE.
    let review;

    const existing = await db.query(
      `SELECT id FROM menu_item_reviews
       WHERE menu_item_id = $1 AND customer_id = $2`,
      [itemId, customerId],
    );

    if (existing.rows.length > 0) {
      // Update the existing review
      const updateResult = await db.query(
        `UPDATE menu_item_reviews
         SET rating      = $1,
             comment     = $2,
             author_name = $3
         WHERE menu_item_id = $4 AND customer_id = $5
         RETURNING id, author_name, rating, comment, created_at`,
        [rating, comment, authorName, itemId, customerId],
      );
      review = updateResult.rows[0];
    } else {
      // Insert new review
      const insertResult = await db.query(
        `INSERT INTO menu_item_reviews
           (menu_item_id, customer_id, author_name, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, author_name, rating, comment, created_at`,
        [itemId, customerId, authorName, rating, comment],
      );
      review = insertResult.rows[0];
    }

    return res.status(201).json({
      message: 'Review submitted successfully.',
      review: {
        id:          review.id,
        author_name: review.author_name,
        rating:      review.rating,
        comment:     review.comment || '',
        created_at:  review.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/menu/items/:id/reviews/my-review ───────────────────────────────
// Auth required. Returns the current customer's existing review for this item,
// or 404 if they haven't reviewed it yet.
// The Flutter write-review sheet uses this to pre-fill the form on edit.
// ─────────────────────────────────────────────────────────────────────────────
async function getMyReview(req, res, next) {
  try {
    const customerId = req.customerId;
    const itemId     = parseInt(req.params.id, 10);

    if (isNaN(itemId)) {
      return res.status(400).json({ message: 'Invalid menu item ID.' });
    }

    const result = await db.query(
      `SELECT id, author_name, rating, comment, created_at
       FROM   menu_item_reviews
       WHERE  menu_item_id = $1 AND customer_id = $2`,
      [itemId, customerId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No review found for this item.' });
    }

    const r = result.rows[0];
    return res.json({
      id:          r.id,
      author_name: r.author_name,
      rating:      r.rating,
      comment:     r.comment || '',
      created_at:  r.created_at,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/menu/items/:id/reviews/can-review ──────────────────────────────
// Auth required. Returns { can_review: bool, already_reviewed: bool }
// Flutter uses this to decide whether to show the "Write a review" button.
// ─────────────────────────────────────────────────────────────────────────────
async function canReview(req, res, next) {
  try {
    const customerId = req.customerId;
    const itemId     = parseInt(req.params.id, 10);

    if (isNaN(itemId)) {
      return res.status(400).json({ message: 'Invalid menu item ID.' });
    }

    // Check eligibility (completed order with this item)
    const eligibilityCheck = await db.query(
      `SELECT 1
       FROM   orders o
       JOIN   order_items oi ON oi.order_id = o.id
       WHERE  o.customer_id   = $1
         AND  o.status        = 'completed'
         AND  oi.menu_item_id = $2
       LIMIT  1`,
      [customerId, itemId],
    );

    const canReviewItem = eligibilityCheck.rows.length > 0;

    // Check if already reviewed
    const existingReview = await db.query(
      `SELECT id FROM menu_item_reviews
       WHERE  menu_item_id = $1 AND customer_id = $2`,
      [itemId, customerId],
    );

    return res.json({
      can_review:       canReviewItem,
      already_reviewed: existingReview.rows.length > 0,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listReviews,
  submitReview,
  getMyReview,
  canReview,
};