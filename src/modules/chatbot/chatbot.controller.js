/**
 * chatbot.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles POST /api/chatbot/message and GET /api/chatbot/history
 *
 * Design rules:
 *  • The bot ("Ndo") only knows what we explicitly give it from the DB.
 *  • We fetch ONLY safe, customer-facing data:
 *      - menu_items (name, price, description, is_available, category name)
 *      - a small FAQ block baked into the system prompt
 *  • We NEVER expose: orders, payments, customers, staff, inventory counts,
 *    violation records, or any other internal tables.
 *  • Conversation history (last N messages) is loaded from chatbot_messages
 *    so the bot remembers context within a session — no "atong" (blank stares).
 *  • Dual-key fallback is handled transparently by aiClient.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const db                = require('../../config/db');
const { callWithFallback } = require('../../utils/aiClient');

// ── Tuneable constants ────────────────────────────────────────────────────────

/** How many previous message pairs (user + bot) to feed as context. */
const HISTORY_WINDOW = 8;

/** Hard cap on menu items sent to the AI to keep the prompt lean. */
const MAX_MENU_ITEMS_IN_PROMPT = 60;

// ── System Prompt Builder ─────────────────────────────────────────────────────

/**
 * buildSystemPrompt(menuContext)
 *
 * Injects live menu data into a strict persona + scope guard.
 * The AI is told explicitly what it may and may NOT answer.
 */
function buildSystemPrompt(menuContext) {
  return `You are Ndo, the friendly AI assistant for Bingnondo Cafe — an authentic Binondo, Manila Chinatown-themed cafe.

Your personality:
- Warm, helpful, and slightly playful — but always professional.
- Proud of the cafe's Binondo heritage. You may reference Chinatown culture naturally.
- You never use emojis in responses (house rule).
- You write in clear, concise English. Short paragraphs are preferred.

Your scope — you MAY answer:
- Questions about the menu: items, prices, descriptions, and current availability.
- General FAQ about the cafe: location, hours, payment methods, delivery options.
- Helping customers decide what to order based on their preferences.
- Explaining how to place an order on the app.

Your scope — you must NEVER answer or reveal:
- Specific order details, order statuses, or tracking info.
  (For those, tell the customer: "For questions about an existing order, please use the Order Chat once you have placed one.")
- Staff names, contact details, or internal operations.
- Inventory levels, stock counts, or ingredient quantities.
- Any customer's personal data, payment details, or account information.
- Business financials, sales data, or analytics.
- How the app or system is built internally.

If a question is completely outside your scope, politely redirect.
If you are unsure, say so honestly rather than guessing.

--- LIVE MENU DATA (as of right now) ---
${menuContext}
--- END OF MENU DATA ---

General FAQ:
- Payment methods: GCash (via in-app payment) and Cash on Delivery.
- Delivery: customers may request Own Delivery (cafe-arranged rider) or Lalamove. Staff confirms assignments after ordering.
- Profile completion is required before placing a first order (name, mobile, address).
- Orders placed via the app are for delivery only. Walk-in counter orders are handled in-store.
- For order-related concerns after placing an order, customers should use the Order Chat (in-app) or contact staff directly.`;
}

// ── Menu Context Fetcher ──────────────────────────────────────────────────────

/**
 * fetchMenuContext()
 *
 * Pulls ONLY the fields the bot needs. Purposely excludes:
 *   - image_url (irrelevant to text chat)
 *   - category_id (replaced by category name for readability)
 *   - created_at / updated_at (internal)
 *   - menu_item_ingredients (would expose inventory)
 *
 * Returns a plain-text summary string suitable for injection into the prompt.
 */
async function fetchMenuContext() {
  const { rows } = await db.query(`
    SELECT
      mi.name          AS item_name,
      mc.name          AS category,
      mi.price,
      mi.description,
      mi.is_available
    FROM menu_items mi
    JOIN menu_categories mc ON mc.id = mi.category_id
    ORDER BY mc.name, mi.name
    LIMIT $1
  `, [MAX_MENU_ITEMS_IN_PROMPT]);

  if (rows.length === 0) {
    return 'No menu items are currently available.';
  }

  // Group by category for readability inside the prompt
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }

  const lines = [];
  for (const [category, items] of Object.entries(grouped)) {
    lines.push(`[${category}]`);
    for (const item of items) {
      const status = item.is_available ? 'Available' : 'Unavailable';
      const desc   = item.description ? ` — ${item.description}` : '';
      lines.push(`  • ${item.item_name} | PHP ${parseFloat(item.price).toFixed(2)}${desc} (${status})`);
    }
  }

  return lines.join('\n');
}

// ── Conversation History Fetcher ──────────────────────────────────────────────

/**
 * fetchHistory(conversationId)
 *
 * Loads the last HISTORY_WINDOW message pairs from the DB and formats them
 * into the OpenAI messages array format.
 */
async function fetchHistory(conversationId) {
  const { rows } = await db.query(`
    SELECT sender, content
    FROM chatbot_messages
    WHERE conversation_id = $1
    ORDER BY sent_at DESC
    LIMIT $2
  `, [conversationId, HISTORY_WINDOW * 2]); // *2 because each "pair" is 2 rows

  // Rows are newest-first; reverse so they're in chronological order
  return rows.reverse().map((row) => ({
    role:    row.sender === 'customer' ? 'user' : 'assistant',
    content: row.content,
  }));
}

// ── Conversation Resolver ─────────────────────────────────────────────────────

/**
 * getOrCreateConversation(customerId)
 *
 * Reuses an existing open conversation for the customer (started today), or
 * creates a new one. One active conversation per customer keeps things simple.
 */
async function getOrCreateConversation(customerId) {
  // Look for a conversation started in the last 24 h (session window)
  const existing = await db.query(`
    SELECT id FROM chatbot_conversations
    WHERE customer_id = $1
      AND started_at >= NOW() - INTERVAL '24 hours'
    ORDER BY started_at DESC
    LIMIT 1
  `, [customerId]);

  if (existing.rows.length > 0) return existing.rows[0].id;

  const created = await db.query(`
    INSERT INTO chatbot_conversations (customer_id) VALUES ($1) RETURNING id
  `, [customerId]);

  return created.rows[0].id;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/chatbot/message
 * Body: { message: string }
 * Auth: customer JWT required (req.user.id from auth middleware)
 */
async function sendMessage(req, res) {
  const customerId = req.customerId;
  const userMessage = (req.body.message || '').trim();

  if (!userMessage) {
    return res.status(400).json({ message: 'Message cannot be empty.' });
  }

  if (userMessage.length > 1000) {
    return res.status(400).json({ message: 'Message is too long. Please keep it under 1000 characters.' });
  }

  try {
    // 1. Get or create the conversation record
    const conversationId = await getOrCreateConversation(customerId);

    // 2. Fetch conversation history and live menu data in parallel
    const [history, menuContext] = await Promise.all([
      fetchHistory(conversationId),
      fetchMenuContext(),
    ]);

    // 3. Build the messages array: history + the new user message
    const messages = [
      ...history,
      { role: 'user', content: userMessage },
    ];

    // 4. Call the AI (with automatic key fallback)
    const systemPrompt = buildSystemPrompt(menuContext);
    const { text: botReply } = await callWithFallback(messages, systemPrompt);

    // 5. Persist both sides of the exchange
    await db.query(`
      INSERT INTO chatbot_messages (conversation_id, sender, content)
      VALUES ($1, 'customer', $2), ($1, 'bot', $3)
    `, [conversationId, userMessage, botReply]);

    // 6. Return the bot's reply
    return res.json({
      conversationId,
      reply: botReply,
    });

  } catch (err) {
    console.error('[chatbot] sendMessage error:', err?.message ?? err);

    // Don't expose raw AI errors to the customer
    return res.status(503).json({
      message: 'Ndo is temporarily unavailable. Please try again in a moment, or use the Order Chat to reach our staff.',
    });
  }
}

/**
 * GET /api/chatbot/history
 * Query: ?limit=20
 * Auth: customer JWT required
 *
 * Returns the customer's recent chatbot messages across all conversations,
 * newest first. Used by the Flutter chatbot screen to populate the history tab.
 */
async function getHistory(req, res) {
  const customerId = req.customerId;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  try {
    const { rows } = await db.query(`
      SELECT
        cm.id,
        cm.sender,
        cm.content,
        cm.sent_at,
        cm.conversation_id
      FROM chatbot_messages cm
      JOIN chatbot_conversations cc ON cc.id = cm.conversation_id
      WHERE cc.customer_id = $1
      ORDER BY cm.sent_at DESC
      LIMIT $2
    `, [customerId, limit]);

    return res.json({ messages: rows });
  } catch (err) {
    console.error('[chatbot] getHistory error:', err?.message ?? err);
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
}

module.exports = { sendMessage, getHistory };