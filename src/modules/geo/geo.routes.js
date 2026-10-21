'use strict';

/**
 * geo.routes.js  —  § Address picker geo helpers
 * All routes require a valid customer JWT (requireCustomer).
 */

const express = require('express');
const { requireCustomer } = require('../../middleware/auth');
const { reverseGeocode, searchPlaces } = require('./geo.controller');

const router = express.Router();

/**
 * GET /api/geo/reverse?lat=&lng=
 * Reverse geocode a pin → complete address.
 */
router.get('/reverse', requireCustomer, reverseGeocode);

/**
 * GET /api/geo/search?q=&lat=&lng=&viewbox=&bounded=
 * Forward search for a place / street.
 *
 * `viewbox` = "west,north,east,south" bounds the results when `bounded=1`
 * (used to keep the address search inside the delivery area).
 */
router.get('/search', requireCustomer, searchPlaces);

module.exports = router;
