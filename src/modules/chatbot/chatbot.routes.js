/**
 * chatbot.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes for the AI chatbot (Ndo).
 *
 *   POST /api/chatbot/message   — send a message, get a reply
 *   GET  /api/chatbot/history   — load recent conversation history
 *
 * Both routes require a valid customer JWT (auth middleware).
 * A per-IP rate limiter is also applied to prevent abuse and protect API quota.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express     = require('express');
const rateLimit   = require('express-rate-limit');
const { requireCustomer } = require('../../middleware/auth');
const { sendMessage, getHistory } = require('./chatbot.controller');

const router = express.Router();

// ── Rate Limiter ──────────────────────────────────────────────────────────────
// 30 messages per minute per IP. Generous enough for normal use; tight enough
// to prevent a customer from blowing through the OpenAI quota.
const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many messages. Please wait a moment before sending another.',
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────

// All chatbot routes: must be an authenticated customer
router.use(requireCustomer);
router.use(chatbotLimiter);

router.post('/message', sendMessage);
router.get('/history',  getHistory);

module.exports = router;