-- Reserve stock only when an administrator accepts an order.
-- All availability checks and mutations execute in the same SQLite transaction.
CREATE TRIGGER IF NOT EXISTS order_status_guard
BEFORE UPDATE OF status ON orders
WHEN NEW.status != OLD.status
BEGIN
 SELECT CASE WHEN OLD.status IN ('ملغي','مكتمل') THEN RAISE(ABORT,'order_closed') END;
 SELECT CASE WHEN OLD.status='بانتظار الإرسال' AND NEW.status NOT IN ('تم الاستلام من المحل','ملغي') THEN RAISE(ABORT,'accept_order_first') END;
 SELECT CASE WHEN OLD.status!='بانتظار الإرسال' AND NEW.status='بانتظار الإرسال' THEN RAISE(ABORT,'invalid_status_transition') END;
END;

CREATE TRIGGER IF NOT EXISTS reserve_stock_on_accept
BEFORE UPDATE OF status ON orders
WHEN OLD.status='بانتظار الإرسال' AND NEW.status='تم الاستلام من المحل'
BEGIN
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM json_each(NEW.items) AS item
  LEFT JOIN product_variants AS variant ON variant.id=json_extract(item.value,'$.id')
  WHERE variant.id IS NULL OR variant.available<>1
    OR (variant.stock IS NOT NULL AND variant.stock < CAST(json_extract(item.value,'$.quantity') AS INTEGER))
 ) THEN RAISE(ABORT,'insufficient_stock_or_legacy_order') END;
 UPDATE product_variants
 SET stock=stock-(
  SELECT SUM(CAST(json_extract(item.value,'$.quantity') AS INTEGER))
  FROM json_each(NEW.items) AS item
  WHERE json_extract(item.value,'$.id')=product_variants.id
 )
 WHERE stock IS NOT NULL AND id IN (
  SELECT json_extract(item.value,'$.id') FROM json_each(NEW.items) AS item
 );
END;

CREATE TRIGGER IF NOT EXISTS restore_stock_on_cancel
BEFORE UPDATE OF status ON orders
WHEN NEW.status='ملغي' AND OLD.status NOT IN ('بانتظار الإرسال','ملغي','مكتمل')
BEGIN
 UPDATE product_variants
 SET stock=stock+(
  SELECT SUM(CAST(json_extract(item.value,'$.quantity') AS INTEGER))
  FROM json_each(NEW.items) AS item
  WHERE json_extract(item.value,'$.id')=product_variants.id
 )
 WHERE stock IS NOT NULL AND id IN (
  SELECT json_extract(item.value,'$.id') FROM json_each(NEW.items) AS item
 );
END;
