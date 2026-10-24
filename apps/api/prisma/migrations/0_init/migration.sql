-- Baseline: the website schema exactly as prisma/schema.prisma described it on
-- 24 Oct 2026, when the AWS database stopped being managed by `prisma db push`.
--
-- The AWS database already has all of this — scripts/aws/02-deploy-api.sh marks this
-- migration as applied there instead of running it. A new database gets it from
-- `prisma migrate deploy` like any other migration.
--
-- Supabase (the Render deployment) is still managed by supabase/migrations/*.sql;
-- until it is retired, a schema change needs a file in both places.

-- CreateTable
CREATE TABLE "website_admin_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_admin_refresh_tokens" (
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_admin_refresh_tokens_pkey" PRIMARY KEY ("token_hash")
);

-- CreateTable
CREATE TABLE "content" (
    "section" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_pkey" PRIMARY KEY ("section")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Retail',
    "buildings" INTEGER NOT NULL DEFAULT 0,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT,
    "gallery" JSONB NOT NULL DEFAULT '[]',
    "detail" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tracker_project_id" TEXT,
    "tracker_synced_at" TIMESTAMPTZ(6),

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_tracker_syncs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "property_id" UUID NOT NULL,
    "tracker_project_id" TEXT NOT NULL,
    "report" JSONB NOT NULL,
    "previous_floor_plans" JSONB,
    "previous_totals" JSONB NOT NULL,
    "forced" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_tracker_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "cover_image" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_leads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "source" TEXT NOT NULL DEFAULT 'contact',
    "context" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_lead_unit_attributions" (
    "lead_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "unit_label" TEXT NOT NULL,
    "building_label" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_lead_unit_attributions_pkey" PRIMARY KEY ("lead_id","unit_label")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_admin_users_email_key" ON "website_admin_users"("email");

-- CreateIndex
CREATE INDEX "website_admin_refresh_tokens_user_id_idx" ON "website_admin_refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "website_admin_refresh_tokens_expires_at_idx" ON "website_admin_refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "properties_tracker_project_id_key" ON "properties"("tracker_project_id");

-- CreateIndex
CREATE INDEX "website_tracker_syncs_property_idx" ON "website_tracker_syncs"("property_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "news_slug_key" ON "news"("slug");

-- AddForeignKey
ALTER TABLE "website_admin_refresh_tokens" ADD CONSTRAINT "website_admin_refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "website_admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_tracker_syncs" ADD CONSTRAINT "website_tracker_syncs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_lead_unit_attributions" ADD CONSTRAINT "website_lead_unit_attributions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "website_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_lead_unit_attributions" ADD CONSTRAINT "website_lead_unit_attributions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

