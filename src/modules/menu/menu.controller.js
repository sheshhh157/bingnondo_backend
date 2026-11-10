/**
 * menu.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles § 1.3 Digital Menu endpoints.
 *
 *   GET  /api/menu              — all categories + their menu items (customer-facing)
 *   GET  /api/menu/categories   — categories list only (for tab rendering)
 *   GET  /api/menu/:id          — single menu item detail (includes variant_groups)
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
// Each item includes its variants (flat list) so the Flutter app can decide
// whether to open the detail sheet or add directly to cart.
// ─────────────────────────────────────────────────────────────────────────────
async function getMenu(req, res, next) {
  try {
    // 1. Fetch all active categories ordered by display_order
    const categoriesResult = await db.query(
      `SELECT id, name, display_order
       FROM   menu_categories
       ORDER  BY display_order ASC, id ASC`
    );

    if (categoriesResult.rows.length === 0) {
      return res.json({ categories: [] });
    }

    // 2. Fetch all non-deleted menu items
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

    // 3. Fetch ALL variants for all items in one query (avoids N+1)
    const variantsResult = await db.query(
      `SELECT
         v.id,
         v.menu_item_id,
         v.name,
         v.price,
         v.is_available,
         v.display_order,
         v.variant_group_id
       FROM   menu_item_variants v
       JOIN   menu_items mi ON mi.id = v.menu_item_id
       WHERE  mi.is_deleted = FALSE
       ORDER  BY v.display_order ASC, v.id ASC`
    );

    // 4. Group variants by menu_item_id
    const variantsByItem = {};
    for (const v of variantsResult.rows) {
      const itemId = v.menu_item_id;
      if (!variantsByItem[itemId]) variantsByItem[itemId] = [];
      variantsByItem[itemId].push({
        id:               v.id,
        menu_item_id:     v.menu_item_id,
        name:             v.name,
        price:            parseFloat(v.price),
        is_available:     v.is_available,
        display_order:    v.display_order,
        variant_group_id: v.variant_group_id,
      });
    }

    // 5. Group items under their category
    const itemsByCategory = {};
    for (const item of itemsResult.rows) {
      const catId = item.category_id;
      if (!itemsByCategory[catId]) itemsByCategory[catId] = [];
      itemsByCategory[catId].push({
        id:            item.id,
        category_id:   item.category_id,
        name:          item.name,
        description:   item.description,
        price:         parseFloat(item.price),
        image_url:     item.image_url || null,
        is_available:  item.is_available,
        display_order: item.display_order,
        variants:      variantsByItem[item.id] || [],
      });
    }

    // 6. Build the response
    const categories = categoriesResult.rows.map((cat) => ({
      id:            cat.id,
      name:          cat.name,
      description:   cat.description ?? null,
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
// Single menu item — includes variant_groups with their variants nested.
// The Flutter detail sheet uses this to render the variant picker.
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

    // Fetch variant groups for this item (via menu_item_variants → variant_groups)
    // Each group can have multiple options (e.g. Hot/Cold with max_options=1).
    const groupsResult = await db.query(
      `SELECT DISTINCT
         vg.id            AS group_id,
         vg.name          AS group_name,
         vg.max_options,
         v.id             AS variant_id,
         v.name           AS variant_name,
         v.price          AS variant_price,
         v.is_available   AS variant_is_available,
         v.display_order  AS variant_display_order
       FROM   menu_item_variants v
       LEFT   JOIN variant_groups vg ON vg.id = v.variant_group_id
       WHERE  v.menu_item_id = $1
       ORDER  BY vg.id ASC NULLS LAST, v.display_order ASC, v.id ASC`,
      [itemId]
    );

    // Build variant_groups structure
    const groupMap = new Map();
    for (const row of groupsResult.rows) {
      const gId = row.group_id ?? 0;
      if (!groupMap.has(gId)) {
        groupMap.set(gId, {
          id:          gId,
          name:        row.group_name || 'Options',
          max_options: row.max_options ?? 1,
          variants:    [],
        });
      }
      groupMap.get(gId).variants.push({
        id:               row.variant_id,
        menu_item_id:     itemId,
        name:             row.variant_name,
        price:            parseFloat(row.variant_price),
        is_available:     row.variant_is_available,
        display_order:    row.variant_display_order,
        variant_group_id: row.group_id,
      });
    }

    return res.json({
      id:             item.id,
      category_id:    item.category_id,
      category_name:  item.category_name,
      name:           item.name,
      description:    item.description,
      price:          parseFloat(item.price),
      image_url:      item.image_url || null,
      is_available:   item.is_available,
      display_order:  item.display_order,
      variant_groups: [...groupMap.values()],
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/menu/availability-check
// ─────────────────────────────────────────────────────────────────────────────
async function checkAvailability(req, res, next) {
  try {
    let rawIds;
    if (req.query.ids) {
      rawIds = req.query.ids.split(',').map((s) => parseInt(s.trim(), 10));
    } else if (Array.isArray(req.body?.item_ids)) {
      rawIds = req.body.item_ids.map((id) => parseInt(id, 10));
    } else {
      return res.status(400).json({ message: 'Provide item_ids[] in the request body or ?ids= in the query.' });
    }

    const itemIds = rawIds.filter((id) => !isNaN(id));

    if (itemIds.length === 0) {
      return res.status(400).json({ message: 'No valid item IDs provided.' });
    }

    if (itemIds.length > 50) {
      return res.status(400).json({ message: 'Too many IDs — max 50 per request.' });
    }

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