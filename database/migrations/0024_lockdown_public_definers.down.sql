begin;
-- Security revocations are intentionally irreversible.
-- Rolling back unrelated schema must never restore anonymous administrative RPC access.
commit;
