'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

const routesPath = require.resolve('../src/modules/auth/auth.routes');
const originalLoad = Module._load;
Module._load = function loadWithControllerStubs(request, parent, isMain) {
  if (parent?.filename === routesPath && request === './auth.controller') {
    return {
      register: () => {},
      verifyOtpEndpoint: () => {},
      resendOtp: () => {},
      login: () => {},
      forgotPassword: () => {},
      resetPassword: () => {},
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const router = require('../src/modules/auth/auth.routes');
Module._load = originalLoad;

const routePaths = router.stack
  .filter((layer) => layer.route)
  .map((layer) => layer.route.path);

test('keeps email authentication routes and excludes mobile OTP routes', () => {
  assert.deepEqual(routePaths, [
    '/customer/register',
    '/customer/verify-otp',
    '/customer/resend-otp',
    '/customer/login',
    '/forgot-password',
    '/reset-password',
  ]);
});
