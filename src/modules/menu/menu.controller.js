/**
 * menu.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles § 1.3 Digital Menu endpoints.
 *
 *   GET  /api/menu              — all categories + their menu items (customer-facing)
 *   GET  /api/menu/categories   — categories list only (for tab rendering)
 *   GET  /api/menu/:id          — single menu item detail
 *
 * These are PUBLIC routes — no auth required.
 * is_deleted = FALSE filter is always applied so soft-deleted items never appear.
 * is_available reflects real-time stock state updated by the inventory module.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const db = require('../../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/menu
// Returns all categories (in display order) with their menu items nested.
// Only non-deleted items are returned. Unavailable items ARE included
// (the Flutter app shows them greyed out / "Unavailable" badge, not hidden).
// ─────────────────────────────────────────────────────────────────────────────
async function getMenu(req, res, next) {
  try {
    // 1. Fetch all active categories ordered by display_order
    // Note: menu_categories has no description column in the base schema.
    // Run migration 007 to add it, or leave it out — both work fine here.
    const categoriesResult = await db.query(
      `SELECT id, name, display_order
       FROM   menu_categories
       ORDER  BY display_order ASC, id ASC`
    );

    if (categoriesResult.rows.length === 0) {
      return res.json({ categories: [] });
    }

    // 2. Fetch all non-deleted menu items with their category_id
    //    We pull every column the Flutter card needs so the app doesn't need
    //    a second request per item on the list screen.
    const itemsResult = await db.query(
      `SELECT
         mi.id,
         mi.category_id,
         mi.name,
         mi.description,
         mi.price,
         mi.image_url,
         mi.is_available,
         mi.display_order
       FROM   menu_items mi
       WHERE  mi.is_deleted = FALSE
       ORDER  BY mi.display_order ASC, mi.id ASC`
    );

    // 3. Group items under their category (in-memory — cheaper than 7 queries)
    const itemsByCategory = {};
    for (const item of itemsResult.rows) {
      const catId = item.category_id;
      if (!itemsByCategory[catId]) itemsByCategory[catId] = [];
      itemsByCategory[catId].push({
        id:            item.id,
        name:          item.name,
        description:   item.description,
        price:         parseFloat(item.price),       // NUMERIC → JS number
        image_url:     item.image_url || null,
        is_available:  item.is_available,
        display_order: item.display_order,
      });
    }

    // 4. Build the response: categories array, items nested inside each
    const categories = categoriesResult.rows.map((cat) => ({
      id:            cat.id,
      name:          cat.name,
      description:   cat.description ?? null,   // null if column doesn't exist yet
      display_order: cat.display_order,
      items:         itemsByCategory[cat.id] || [],
    }));

    return res.json({ categories });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/menu/categories
// Lightweight endpoint — just the category list with no items.
// Used by the Flutter app on initial load to render tab headers before items
// finish loading, or for the Staff web app's "add item" category dropdown.
// ─────────────────────────────────────────────────────────────────────────────
async function getCategories(req, res, next) {
  try {
    const result = await db.query(
      `SELECT id, name, display_order
       FROM   menu_categories
       ORDER  BY display_order ASC, id ASC`
    );

    return res.json({ categories: result.rows });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/menu/:id
// Single menu item — used when the Flutter app navigates to an item detail
// screen, or before adding to cart to verify current availability.
// Returns 404 if the item is soft-deleted.
// ─────────────────────────────────────────────────────────────────────────────
async function getMenuItem(req, res, next) {
  try {
    const itemId = parseInt(req.params.id, 10);

    if (isNaN(itemId)) {
      return res.status(400).json({ message: 'Invalid menu item ID.' });
    }

    const result = await db.query(
      `SELECT
         mi.id,
         mi.category_id,
         mc.name  AS category_name,
         mi.name,
         mi.description,
         mi.price,
         mi.image_url,
         mi.is_available,
         mi.display_order
       FROM   menu_items    mi
       JOIN   menu_categories mc ON mc.id = mi.category_id
       WHERE  mi.id = $1
         AND  mi.is_deleted = FALSE`,
      [itemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Menu item not found.' });
    }

    const item = result.rows[0];
    return res.json({
      id:            item.id,
      category_id:   item.category_id,
      category_name: item.category_name,
      name:          item.name,
      description:   item.description,
      price:         parseFloat(item.price),
      image_url:     item.image_url || null,
      is_available:  item.is_available,
      display_order: item.display_order,
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/menu/availability-check
// Accepts a JSON body { item_ids: [1, 2, 3] } and returns the current
// is_available status for each. Used by the Flutter cart screen before
// checkout to catch items that went unavailable while in the cart.
//
// Query param version also supported: /api/menu/availability-check?ids=1,2,3
// ─────────────────────────────────────────────────────────────────────────────
async function checkAvailability(req, res, next) {
  try {
    // Support both query param (?ids=1,2,3) and JSON body ({ item_ids: [1,2,3] })
    let rawIds;
    if (req.query.ids) {
      rawIds = req.query.ids.split(',').map((s) => parseInt(s.trim(), 10));
    } else if (Array.isArray(req.body?.item_ids)) {
      rawIds = req.body.item_ids.map((id) => parseInt(id, 10));
    } else {
      return res.status(400).json({ message: 'Provide item_ids[] in the request body or ?ids= in the query.' });
    }

    // Sanitise — drop NaN
    const itemIds = rawIds.filter((id) => !isNaN(id));

    if (itemIds.length === 0) {
      return res.status(400).json({ message: 'No valid item IDs provided.' });
    }

    if (itemIds.length > 50) {
      return res.status(400).json({ message: 'Too many IDs — max 50 per request.' });
    }

    // Use unnest + ANY for a clean parameterised query
    const result = await db.query(
      `SELECT id, name, is_available
       FROM   menu_items
       WHERE  id = ANY($1::int[])
         AND  is_deleted = FALSE`,
      [itemIds]
    );

    return res.json({ items: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMenu,
  getCategories,
  getMenuItem,
  checkAvailability,
};