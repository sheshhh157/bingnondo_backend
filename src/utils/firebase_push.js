'use strict';

const pool = require('../config/db');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

const FIREBASE_APP_NAME = 'bingnondo-push';
let missingCredentialsLogged = false;
let invalidCredentialsLogged = false;

const NOTIFICATION_TITLES = {
  order_confirmed: 'Order Confirmed',
  order_pending: 'Order Confirmed',
  order_status: 'Order Confirmed',
  order_preparing: 'Being Prepared',
  order_ready: 'Ready for Delivery',
  order_out_for_delivery: 'Rider is on the Way',
  order_completed: 'Order Delivered',
  order_cancelled: 'Order Cancelled',
  payment_received: 'Payment Received',
  payment_status: 'Payment Received',
  payment_failed: 'Payment Failed',
  payment_rejected: 'Payment Failed',
  support_message: 'New Message from Staff',
};

function getFirebaseMessaging() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    if (!missingCredentialsLogged) {
      console.warn('[firebase_push] Push notifications disabled: FIREBASE_SERVICE_ACCOUNT_JSON is not set.');
      missingCredentialsLogged = true;
    }
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('Service account JSON must include project_id, client_email, and private_key.');
    }

    const app = getApps().find((candidate) => candidate.name === FIREBASE_APP_NAME)
      || initializeApp({ credential: cert(serviceAccount) }, FIREBASE_APP_NAME);
    return getMessaging(app);
  } catch (err) {
    if (!invalidCredentialsLogged) {
      console.error('[firebase_push] Invalid Firebase service account configuration:', err.message);
      invalidCredentialsLogged = true;
    }
    return null;
  }
}

function buildPushMessage(notification, tokens) {
  return {
    tokens,
    notification: {
      title: NOTIFICATION_TITLES[notification.type] || 'Bingnondo',
      body: notification.message,
    },
    data: {
      notification_id: String(notification.id),
      type: String(notification.type),
      reference_id: notification.reference_id == null ? '' : String(notification.reference_id),
      message: notification.message,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'bingnondo_notifications',
      },
    },
    apns: {
      payload: {
        aps: { sound: 'default' },
      },
    },
  };
}

async function sendCustomerPush(customerId, notification) {
  const messaging = getFirebaseMessaging();
  if (!messaging) return;

  try {
    const { rows } = await pool.query(
      'SELECT id, fcm_token FROM customer_fcm_tokens WHERE customer_id = $1',
      [customerId]
    );
    if (rows.length === 0) return;

    for (let offset = 0; offset < rows.length; offset += 500) {
      const batch = rows.slice(offset, offset + 500);
      const response = await messaging.sendEachForMulticast(
        buildPushMessage(notification, batch.map((row) => row.fcm_token))
      );
      const invalidTokenIds = [];

      response.responses.forEach((result, index) => {
        if (result.success) return;
        const code = result.error?.code;
        if (code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token') {
          invalidTokenIds.push(batch[index].id);
        } else {
          console.error(`[firebase_push] FCM delivery failed for customer ${customerId}:`, code || result.error?.message);
        }
      });

      if (invalidTokenIds.length > 0) {
        await pool.query(
          'DELETE FROM customer_fcm_tokens WHERE id = ANY($1::int[])',
          [invalidTokenIds]
        );
      }
    }
  } catch (err) {
    console.error(`[firebase_push] Failed to send notification to customer ${customerId}:`, err.message);
  }
}

module.exports = { buildPushMessage, sendCustomerPush };
