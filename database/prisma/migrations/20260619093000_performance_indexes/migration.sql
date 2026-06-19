CREATE INDEX IF NOT EXISTS "Account_customerId_createdAt_idx"
  ON "Account" ("customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "Account_status_createdAt_idx"
  ON "Account" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "Beneficiary_customerId_active_createdAt_idx"
  ON "Beneficiary" ("customerId", "active", "createdAt");

CREATE INDEX IF NOT EXISTS "Card_customerId_createdAt_idx"
  ON "Card" ("customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "Card_status_createdAt_idx"
  ON "Card" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "Card_type_status_idx"
  ON "Card" ("type", "status");

CREATE INDEX IF NOT EXISTS "Transfer_customerId_createdAt_idx"
  ON "Transfer" ("customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "Transfer_status_scheduledFor_idx"
  ON "Transfer" ("status", "scheduledFor");

CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx"
  ON "AuditLog" ("createdAt");

CREATE INDEX IF NOT EXISTS "KycRequest_documentStatus_complianceStatus_riskStatus_branchStatus_idx"
  ON "KycRequest" (
    "documentStatus",
    "complianceStatus",
    "riskStatus",
    "branchStatus"
  );

CREATE INDEX IF NOT EXISTS "KycRequest_updatedAt_idx"
  ON "KycRequest" ("updatedAt");

CREATE INDEX IF NOT EXISTS "CardTransaction_cardId_createdAt_idx"
  ON "CardTransaction" ("cardId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_customerId_read_createdAt_idx"
  ON "Notification" ("customerId", "read", "createdAt");

CREATE INDEX IF NOT EXISTS "Ticket_customerId_updatedAt_idx"
  ON "Ticket" ("customerId", "updatedAt");

CREATE INDEX IF NOT EXISTS "Ticket_status_updatedAt_idx"
  ON "Ticket" ("status", "updatedAt");
