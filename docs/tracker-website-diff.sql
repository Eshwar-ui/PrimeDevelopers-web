-- READ-ONLY. Tracker DB. Mirrors WebsiteSyncService.load() + buildSnapshot() + toRows().
BEGIN TRANSACTION READ ONLY;

-- 1. One row per unit the sync would send, with the website row it would land in.
WITH u AS (
  SELECT p."websiteSlug" AS website_slug, p.name AS project, b.id AS building_id, b.name AS building,
         b."sortOrder" AS building_order, un.id AS unit_id, un."unitNumber" AS unit_number,
         un.status::text AS tracker_status, un."unitType" AS unit_type, un.sqft,
         un."askingRent" AS asking_rent_psf_mo, un."askingPrice" AS asking_price,
         ll."tenantBrand" AS lease_brand, ll."tenantName" AS lease_tenant,
         ll."monthlyRent" AS lease_monthly_rent, ll."rentPerSqft" AS lease_rent_psf, ll."leaseEnd" AS lease_end,
         ld.ref AS lease_ref, ls.status AS sale_status, ls.buyer AS buyer_internal_only,
         ls."salePrice" AS sale_price, sd.ref AS sale_ref
  FROM projects p
  JOIN buildings b ON b."projectId" = p.id AND b."deletedAt" IS NULL
  JOIN units un ON un."buildingId" = b.id AND un."deletedAt" IS NULL AND un."mergedIntoId" IS NULL
  LEFT JOIN LATERAL (SELECT * FROM leases l
      WHERE l."unitId" = un.id AND l."deletedAt" IS NULL AND l.status = 'ACTIVE' AND l."terminationDate" IS NULL
      ORDER BY l."leaseStart" DESC LIMIT 1) ll ON true
  LEFT JOIN LATERAL (SELECT NULLIF(btrim(l."combinedDealRef"), '') AS ref FROM leases l
      WHERE l."unitId" = un.id AND l."deletedAt" IS NULL AND l.status = 'ACTIVE' AND l."terminationDate" IS NULL
        AND COALESCE(l."combinedDealRef", '') <> ''
      ORDER BY l."leaseStart" DESC LIMIT 1) ld ON true
  LEFT JOIN LATERAL (SELECT * FROM sales s
      WHERE s."unitId" = un.id AND s."deletedAt" IS NULL AND s.status <> 'CANCELLED'
      ORDER BY s."createdAt" DESC LIMIT 1) ls ON true
  LEFT JOIN LATERAL (SELECT NULLIF(btrim(s."combinedDealRef"), '') AS ref FROM sales s
      WHERE s."unitId" = un.id AND s."deletedAt" IS NULL AND s.status <> 'CANCELLED'
        AND COALESCE(s."combinedDealRef", '') <> ''
      ORDER BY s."createdAt" DESC LIMIT 1) sd ON true
  WHERE p."websiteSlug" IS NOT NULL AND p."deletedAt" IS NULL
), d AS (
  SELECT u.*,
    CASE tracker_status WHEN 'AVAILABLE' THEN 'available' WHEN 'UNDER_CONSTRUCTION' THEN 'coming-soon'
                        WHEN 'SOLD' THEN 'sold' WHEN 'UNDER_CONTRACT' THEN 'sold' ELSE 'leased' END AS website_status,
    CASE WHEN tracker_status = 'SOLD' THEN 'SALE:' || sale_ref ELSE 'LEASE:' || lease_ref END AS deal_ref,
    CASE WHEN tracker_status IN ('LEASED', 'OCCUPIED')
         THEN COALESCE(NULLIF(btrim(lease_brand), ''), NULLIF(btrim(lease_tenant), '')) END AS occupant_sent,
    regexp_replace(btrim(unit_number), '\s*\+\s*', '+', 'g') AS part_label
  FROM u
), g AS (
  SELECT d.*,
    deal_ref IS NOT NULL AND count(*) OVER w > 1 AND min(website_status) OVER w = max(website_status) OVER w AS grouped,
    string_agg(part_label, '+') OVER (PARTITION BY building_id, deal_ref ORDER BY length(part_label), part_label
                                      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS group_label
  FROM d WINDOW w AS (PARTITION BY building_id, deal_ref)
)
SELECT website_slug, project, building,
       CASE WHEN grouped THEN group_label ELSE part_label END AS website_row_label,
       unit_number, tracker_status, website_status, sqft, unit_type,
       asking_rent_psf_mo, asking_price, lease_monthly_rent, lease_rent_psf, lease_end,
       occupant_sent, lease_tenant, sale_status, sale_price, buyer_internal_only,
       deal_ref, unit_id, building_id
FROM g
ORDER BY website_slug, building_order, building, length(part_label), part_label;

-- 2. Headline per project: the tracker header's way vs the sync's way.
SELECT p."websiteSlug" AS website_slug, p.name,
  count(*)                                                                         AS header_units,
  count(*) FILTER (WHERE un.status IN ('SOLD', 'LEASED', 'OCCUPIED'))               AS header_taken,
  count(*) FILTER (WHERE un.status = 'AVAILABLE')                                   AS available,
  count(*) FILTER (WHERE un.status IN ('UNDER_CONTRACT', 'LEASE_PENDING', 'UNDER_CONSTRUCTION')) AS website_counts_as_sold,
  count(*) FILTER (WHERE b."deletedAt" IS NOT NULL)                                 AS in_archived_buildings_not_sent,
  string_agg(DISTINCT b.name, ' | ') FILTER (WHERE b."deletedAt" IS NULL)           AS building_names_sent
FROM projects p
JOIN buildings b ON b."projectId" = p.id
JOIN units un ON un."buildingId" = b.id AND un."deletedAt" IS NULL
WHERE p."websiteSlug" IS NOT NULL AND p."deletedAt" IS NULL
GROUP BY p."websiteSlug", p.name;

-- 3. Which projects could be published, and whether any slug is set yet.
SELECT p.id, p.name, p.slug, p."websiteSlug", count(DISTINCT b.id) AS buildings, count(un.id) AS units
FROM projects p
LEFT JOIN buildings b ON b."projectId" = p.id AND b."deletedAt" IS NULL
LEFT JOIN units un ON un."buildingId" = b.id AND un."deletedAt" IS NULL
WHERE p."deletedAt" IS NULL
GROUP BY p.id ORDER BY p.name;

ROLLBACK;
