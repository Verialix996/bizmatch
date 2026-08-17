-- The notifications feature (bell icon: components/NotificationBell.js) and its
-- backend insert helper (_shared/notifications.ts's emitNotification) have always
-- targeted four type strings — evidence_added, assessment_requested, match_ready,
-- deal_breaker_flagged — but notification_type's enum never actually gained them
-- (see 20260810140000_drop_swipe_matching_schema.sql's note on this). Every
-- emitNotification call would have failed silently (its own try/catch swallows
-- the enum-violation error) — which is moot today since nothing calls it yet,
-- but it's why the bell has stayed permanently empty even after wiring up callers.
alter type notification_type add value 'evidence_added';
alter type notification_type add value 'assessment_requested';
alter type notification_type add value 'match_ready';
alter type notification_type add value 'deal_breaker_flagged';
