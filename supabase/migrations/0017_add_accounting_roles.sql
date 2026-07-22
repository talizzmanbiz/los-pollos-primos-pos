-- ============================================================
-- Los Pollos Primos — 0017 add contador + auditor roles
-- Contador: reads accounting, can mark a period 'revisado'.
-- Auditor: read-only, including the audit log.
-- (RLS wiring is in 0018 — a new value can't be used in the same tx.)
-- ============================================================

alter type user_role add value if not exists 'contador';
alter type user_role add value if not exists 'auditor';
