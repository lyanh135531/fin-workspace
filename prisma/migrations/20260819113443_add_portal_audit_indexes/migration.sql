CREATE INDEX CONCURRENTLY "AUDIT_LOG_actor_user_id_created_at_idx"
ON "AUDIT_LOG"("actor_user_id", "created_at");

CREATE INDEX CONCURRENTLY "AUDIT_LOG_created_at_idx"
ON "AUDIT_LOG"("created_at");
