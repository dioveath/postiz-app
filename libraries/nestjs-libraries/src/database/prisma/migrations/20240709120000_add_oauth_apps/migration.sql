-- Create table for storing OAuth application credentials
CREATE TABLE "OAuthApp" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "providerIdentifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT,
    "additionalData" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "OAuthApp_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OAuthApp"
  ADD CONSTRAINT "OAuthApp_organizationId_fkey"
  FOREIGN KEY ("organizationId")
  REFERENCES "Organization"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE UNIQUE INDEX "OAuthApp_organizationId_providerIdentifier_name_key"
  ON "OAuthApp"("organizationId", "providerIdentifier", "name");
CREATE INDEX "OAuthApp_organizationId_idx" ON "OAuthApp"("organizationId");
CREATE INDEX "OAuthApp_providerIdentifier_idx" ON "OAuthApp"("providerIdentifier");
CREATE INDEX "OAuthApp_deletedAt_idx" ON "OAuthApp"("deletedAt");

-- Extend integrations with optional OAuth app reference
ALTER TABLE "Integration"
  ADD COLUMN IF NOT EXISTS "oauthAppId" TEXT;

CREATE INDEX IF NOT EXISTS "Integration_oauthAppId_idx" ON "Integration"("oauthAppId");

ALTER TABLE "Integration"
  ADD CONSTRAINT "Integration_oauthAppId_fkey"
  FOREIGN KEY ("oauthAppId")
  REFERENCES "OAuthApp"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Remove legacy credential column if present
ALTER TABLE "Integration"
  DROP COLUMN IF EXISTS "appCredentials";
