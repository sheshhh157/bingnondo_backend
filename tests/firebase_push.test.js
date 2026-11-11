'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const pushPath = require.resolve('../src/utils/firebase_push');
const originalLoad = Module._load;
Module._load = function loadWithDatabaseStub(request, parent, isMain) {
  if (parent?.filename === pushPath && request === '../config/db') {
    return { query: async () => ({ rows: [] }) };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { buildPushMessage } = require(pushPath);
Module._load = originalLoad;

test('uses the saved in-app notification message as the FCM notification body', () => {
  const savedNotification = {
    id: 42,
    type: 'order_preparing',
    reference_id: 17,
    message: 'The kitchen is now preparing your order.',
  };

  const push = buildPushMessage(savedNotification, ['device-token']);

  assert.equal(push.notification.title, 'Being Prepared');
  assert.equal(push.notification.body, savedNotification.message);
  assert.equal(push.data.message, savedNotification.message);
  assert.equal(push.data.notification_id, String(savedNotification.id));
});
