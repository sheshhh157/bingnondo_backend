'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

let aiCallCount;
let savedMessages;

const fakeDb = {
  query: async (sql, params = []) => {
    const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (statement.startsWith('select id from chatbot_conversations')) {
      return { rows: [{ id: 9 }] };
    }
    if (statement.startsWith('select sender, content from chatbot_messages')) {
      return { rows: [] };
    }
    if (statement.startsWith('select mi.name')) {
      return {
        rows: [{
          item_name: 'Shanghai Roll',
          category: 'Snacks',
          price: '120',
          description: 'Crispy pork roll',
          is_available: true,
        }],
      };
    }
    if (statement.startsWith('insert into chatbot_messages')) {
      savedMessages = params;
      return { rows: [] };
    }

    throw new Error(`Unexpected SQL in test: ${statement}`);
  },
};

const controllerPath = require.resolve('../src/modules/chatbot/chatbot.controller');
const originalLoad = Module._load;
Module._load = function loadWithChatbotStubs(request, parent, isMain) {
  if (parent?.filename === controllerPath) {
    if (request === '../../config/db') return fakeDb;
    if (request === '../../utils/aiClient') {
      return {
        callWithFallback: async () => {
          aiCallCount += 1;
          return { text: 'AI response' };
        },
      };
    }
  }
  return originalLoad.call(this, request, parent, isMain);
};

const {
  sendMessage,
  isWithinChatbotScope,
  OUT_OF_SCOPE_REPLY,
} = require(controllerPath);
Module._load = originalLoad;

const menuContext = '[Snacks]\n  • Shanghai Roll | PHP 120.00 — Crispy pork roll (Available)';

test('allows questions about Bingnondo and known menu items', () => {
  assert.equal(isWithinChatbotScope('What is the delivery fee?', ''), true);
  assert.equal(isWithinChatbotScope('How much is Shanghai Roll?', menuContext), true);
  assert.equal(isWithinChatbotScope('Can I place an order?', ''), true);
});

test('rejects unrelated questions, including unrelated uses of the word order', () => {
  assert.equal(isWithinChatbotScope('What is the capital of France?', menuContext), false);
  assert.equal(isWithinChatbotScope('What is the order of the planets?', menuContext), false);
});

test('returns a redirect for unrelated messages without calling the AI', async () => {
  aiCallCount = 0;
  savedMessages = null;
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await sendMessage(
    { customerId: 7, body: { message: 'Tell me about quantum physics.' } },
    response,
  );

  assert.equal(response.statusCode, null);
  assert.equal(response.body.reply, OUT_OF_SCOPE_REPLY);
  assert.equal(aiCallCount, 0);
  assert.deepEqual(savedMessages, [9, 'Tell me about quantum physics.', OUT_OF_SCOPE_REPLY]);
});
