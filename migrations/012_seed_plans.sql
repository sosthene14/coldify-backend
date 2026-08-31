-- Seed plans data
INSERT INTO plans (id, name, paddle_price_id_monthly, emails_per_day, max_connected_providers, history_days, has_priority_support, has_integration_api, price_cents)
VALUES 
  ('free', 'Free', NULL, 5, 2, 7, false, false, 0),
  ('pro', 'Pro', 'pri_01m175bj5j63tve069m5a03yph', 100, 10, NULL, true, false, 500),
  ('unlimited', 'Unlimited', 'pri_01m1758cr788r8tnjtvc69fe2v', NULL, NULL, NULL, true, true, 1000)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  paddle_price_id_monthly = EXCLUDED.paddle_price_id_monthly,
  emails_per_day = EXCLUDED.emails_per_day,
  max_connected_providers = EXCLUDED.max_connected_providers,
  history_days = EXCLUDED.history_days,
  has_priority_support = EXCLUDED.has_priority_support,
  has_integration_api = EXCLUDED.has_integration_api,
  price_cents = EXCLUDED.price_cents,
  updated_at = NOW();