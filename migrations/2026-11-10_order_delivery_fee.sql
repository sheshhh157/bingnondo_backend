-- Store the delivery fee charged for each order.
-- Pickup orders store 0; delivery orders store the configured fee.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) DEFAULT 0;

-- Persist the checkout choice so pickup and delivery can have different
-- customer-facing progress flows. Existing orders default to delivery.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_preference VARCHAR(20) NOT NULL DEFAULT 'own_delivery';

UPDATE orders o
   SET delivery_preference = d.delivery_preference
  FROM deliveries d
 WHERE d.order_id = o.id
   AND o.delivery_preference = 'own_delivery'
   AND d.delivery_preference IN ('own_delivery', 'lalamove');
