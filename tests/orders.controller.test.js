'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const { test } = require('node:test');

let activeClient;
let activePoolQuery;

const fakePool = {
  connect: async () => activeClient,
  query: (...args) => activePoolQuery(...args),
};

const controllerPath = require.resolve('../src/modules/orders/orders.controller');
const originalLoad = Module._load;
Module._load = function loadWithOrderDependencyStubs(request, parent, isMain) {
  if (parent?.filename === controllerPath) {
    if (request === '../../config/db') return fakePool;
    if (request === '../../sockets/socket') {
      return { getIO: () => null, emitNewOrder: () => {}, emitOrderStatusUpdate: () => {} };
    }
    if (request === '../support-chat/support_chat.controller') {
      return { syncChatLockState: () => {} };
    }
    if (request === '../../utils/order_notifications') {
      return { notifyOrderStatus: async () => {} };
    }
    if (request === '../business-hours/business_hours.controller') {
      return { computeBusinessHoursStatus: async () => ({ is_open: true }) };
    }
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { getOrderTimeline, placeOrder } = require(controllerPath);
Module._load = originalLoad;

function createOrderClient() {
  const calls = [];
  const client = {
    query: async (sql, params = []) => {
      const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      calls.push({ statement, params });

      if (['begin', 'commit', 'rollback'].includes(statement)) {
        return { rows: [] };
      }
      if (statement.startsWith('select count(*) as cnt from orders')) {
        return { rows: [{ cnt: '0' }] };
      }
      if (statement.startsWith('select profile_completed')) {
        return {
          rows: [{
            profile_completed: true,
            address: 'Saved delivery address',
            latitude: '14.6000000',
            longitude: '120.9800000',
            restriction_level: 'none',
          }],
        };
      }
      if (statement.startsWith('select id, price, name, is_available from menu_items')) {
        return { rows: [{ id: 8, price: '100.00', name: 'Test meal', is_available: true }] };
      }
      if (statement.startsWith('select value from system_settings')) {
        return { rows: [{ value: { enabled: true, amount: 49 } }] };
      }
      if (statement.startsWith('alter table')) {
        return { rows: [] };
      }
      if (statement.startsWith('insert into orders')) {
        return { rows: [{ id: 71, status: 'pending' }] };
      }
      if (statement.startsWith('update orders set order_number')) {
        return { rows: [] };
      }
      if (statement.startsWith('insert into order_items')) {
        return { rows: [] };
      }
      if (statement.startsWith('insert into payments')) {
        return { rows: [] };
      }
      if (statement.startsWith('select 1 from riders')) {
        return { rows: [{ '?column?': 1 }] };
      }
      if (statement.startsWith('insert into deliveries')) {
        return { rows: [] };
      }
      if (statement.startsWith('insert into order_status_history')) {
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL in test: ${statement}`);
    },
    release: () => {},
  };
  return { client, calls };
}

async function submitOrder(deliveryPreference) {
  const { client, calls } = createOrderClient();
  activeClient = client;

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
  let nextError;

  await placeOrder({
    customerId: 5,
    body: {
      items: [{ menu_item_id: 8, quantity: 2 }],
      delivery_preference: deliveryPreference,
      payment_method: 'cod',
    },
  }, response, (err) => {
    nextError = err;
  });

  if (nextError) throw nextError;
  return { response, calls };
}

test('pickup saves and returns subtotal with zero delivery fee and no delivery lookup', async () => {
  const { response, calls } = await submitOrder('pickup');
  const orderInsert = calls.find(({ statement }) => statement.startsWith('insert into orders'));
  const paymentInsert = calls.find(({ statement }) => statement.startsWith('insert into payments'));

  assert.equal(response.statusCode, 201);
  assert.equal(orderInsert.params[4], 200);
  assert.equal(orderInsert.params[5], 0);
  assert.equal(orderInsert.params[7], null);
  assert.equal(orderInsert.params[8], null);
  assert.equal(orderInsert.params[9], null);
  assert.equal(orderInsert.params[10], 'pickup');
  assert.equal(paymentInsert.params[2], 200);
  assert.equal(response.body.subtotal, 200);
  assert.equal(response.body.delivery_fee, 0);
  assert.equal(response.body.total_amount, 200);
  assert.equal(calls.some(({ statement }) => statement.startsWith('select value from system_settings')), false);
  assert.equal(calls.some(({ statement }) => statement.startsWith('select 1 from riders')), false);
  assert.equal(calls.some(({ statement }) => statement.startsWith('insert into deliveries')), false);
});

test('delivery keeps configured fee, saved destination, and delivery record', async () => {
  const { response, calls } = await submitOrder('own_delivery');
  const orderInsert = calls.find(({ statement }) => statement.startsWith('insert into orders'));
  const paymentInsert = calls.find(({ statement }) => statement.startsWith('insert into payments'));
  const deliveryInsert = calls.find(({ statement }) => statement.startsWith('insert into deliveries'));

  assert.equal(response.statusCode, 201);
  assert.equal(orderInsert.params[4], 249);
  assert.equal(orderInsert.params[5], 49);
  assert.equal(orderInsert.params[7], 'Saved delivery address');
  assert.equal(orderInsert.params[8], '14.6000000');
  assert.equal(orderInsert.params[9], '120.9800000');
  assert.equal(orderInsert.params[10], 'own_delivery');
  assert.equal(paymentInsert.params[2], 249);
  assert.equal(deliveryInsert.params[1], 'own_delivery');
  assert.equal(response.body.subtotal, 200);
  assert.equal(response.body.delivery_fee, 49);
  assert.equal(response.body.total_amount, 249);
  assert.equal(calls.some(({ statement }) => statement.startsWith('select value from system_settings')), true);
  assert.equal(calls.some(({ statement }) => statement.startsWith('select 1 from riders')), true);
});

async function fetchTimeline(deliveryPreference) {
  const calls = [];
  activePoolQuery = async (sql, params) => {
    const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    calls.push({ statement, params });
    if (statement.startsWith('select o.id, coalesce(o.order_number')) {
      return {
        rows: [{
          order_number: 'BNG-20261110-0001',
          current_status: 'ready',
          delivery_preference: deliveryPreference,
        }],
      };
    }
    if (statement.startsWith('select status, changed_at from order_status_history')) {
      return {
        rows: [
          { status: 'pending', changed_at: '2026-11-10T10:00:00Z' },
          { status: 'confirmed', changed_at: '2026-11-10T10:01:00Z' },
          { status: 'preparing', changed_at: '2026-11-10T10:02:00Z' },
          { status: 'ready', changed_at: '2026-11-10T10:03:00Z' },
        ],
      };
    }
    throw new Error(`Unexpected SQL in timeline test: ${statement}`);
  };

  const response = {
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
  let nextError;

  await getOrderTimeline({
    customerId: 5,
    params: { id: '71' },
  }, response, (err) => {
    nextError = err;
  });

  if (nextError) throw nextError;
  return response.body;
}

test('pickup timeline skips delivery and uses pickup labels', async () => {
  const timeline = await fetchTimeline('pickup');

  assert.equal(timeline.delivery_preference, 'pickup');
  assert.deepEqual(timeline.timeline.map(({ status }) => status), [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'completed',
  ]);
  assert.equal(timeline.timeline.find(({ status }) => status === 'ready').label, 'Ready for Pickup');
  assert.equal(timeline.timeline.find(({ status }) => status === 'completed').label, 'Picked Up');
});

test('delivery timeline retains the delivery step and delivery labels', async () => {
  const timeline = await fetchTimeline('own_delivery');

  assert.equal(timeline.delivery_preference, 'own_delivery');
  assert.deepEqual(timeline.timeline.map(({ status }) => status), [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'out_for_delivery',
    'completed',
  ]);
  assert.equal(timeline.timeline.find(({ status }) => status === 'ready').label, 'Ready for Pickup / Delivery');
  assert.equal(timeline.timeline.find(({ status }) => status === 'completed').label, 'Delivered');
});
