'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const jwt = require('jsonwebtoken');

process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const {
  getNextManilaMidnightEpoch,
  signCustomerAccessToken,
  signCustomerRefreshToken,
} = require('../src/utils/jwt');

test('expires at the next midnight in the Asia/Manila timezone', () => {
  const now = new Date('2026-11-12T15:51:31.000Z');
  const expiry = new Date(getNextManilaMidnightEpoch(now) * 1000);

  assert.equal(expiry.toISOString(), '2026-11-12T16:00:00.000Z');
});

test('a session started at Manila midnight expires the following midnight', () => {
  const now = new Date('2026-11-11T16:00:00.000Z');
  const expiry = new Date(getNextManilaMidnightEpoch(now) * 1000);

  assert.equal(expiry.toISOString(), '2026-11-12T16:00:00.000Z');
});

test('access and refresh tokens use the same session expiry', () => {
  const expiresAt = getNextManilaMidnightEpoch(new Date('2026-11-12T15:00:00.000Z'));

  assert.equal(jwt.decode(signCustomerAccessToken(1, expiresAt)).exp, expiresAt);
  assert.equal(jwt.decode(signCustomerRefreshToken(1, expiresAt)).exp, expiresAt);
});
