'use strict';

/**
 * customer.routes.js  —  §1.1b + §1.5 Customer Profile routes
 * All routes require a valid customer JWT (requireCustomer).
 */

const express = require('express');
const { requireCustomer } = require('../../middleware/auth');
const { getProfile, updateProfile } = require('./customer.controller');

const router = express.Router();

/**
 * GET /api/customer/profile
 * Returns profile + restriction_level.
 * Used by: CartProvider gate check, Account Settings screen.
 */
router.get('/profile', requireCustomer, getProfile);

/**
 * PUT /api/customer/profile
 * Complete or update profile (first_name, last_name, mobile_number, address).
 * Sets profile_completed = TRUE once all four fields are present.
 */
router.put('/profile', requireCustomer, updateProfile);

module.exports = router;