-- Add call type to distinguish waiter calls from check requests
ALTER TABLE service_calls ADD COLUMN call_type TEXT DEFAULT 'waiter';
