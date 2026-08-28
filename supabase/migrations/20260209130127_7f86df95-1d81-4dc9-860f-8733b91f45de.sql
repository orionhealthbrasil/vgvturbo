
-- =============================================
-- MERGE 74 DUPLICATE PAIRS (12-digit vs 13-digit phones)
-- Then normalize ALL remaining 12-digit phones to 13-digit
-- =============================================

-- Step 1: Create temp mapping of short (12-digit) → long (13-digit) contacts
CREATE TEMP TABLE dup_map AS
SELECT 
  CASE WHEN LENGTH(c1.phone) = 12 THEN c1.id ELSE c2.id END AS short_id,
  CASE WHEN LENGTH(c1.phone) = 13 THEN c1.id ELSE c2.id END AS long_id,
  CASE WHEN LENGTH(c1.phone) = 12 THEN c1.phone ELSE c2.phone END AS short_phone,
  CASE WHEN LENGTH(c1.phone) = 13 THEN c1.phone ELSE c2.phone END AS long_phone
FROM contacts c1
JOIN contacts c2 ON c1.organization_id = c2.organization_id 
  AND c1.id < c2.id
  AND (
    (LENGTH(c1.phone) = 13 AND LENGTH(c2.phone) = 12 AND c1.phone = '55' || LEFT(c2.phone, 4) || '9' || RIGHT(c2.phone, 8))
    OR (LENGTH(c2.phone) = 13 AND LENGTH(c1.phone) = 12 AND c2.phone = '55' || LEFT(c1.phone, 4) || '9' || RIGHT(c1.phone, 8))
  )
WHERE c1.id != c2.id;

-- Wait, the phone format: 559180334518 (12 digits) → 55 + 91 + 80334518
-- Normalized: 55 + 91 + 9 + 80334518 = 5591980334518 (13 digits)
-- So: LEFT(short_phone, 4) = '5591', RIGHT(short_phone, 8) = '80334518'
-- long_phone = LEFT(short_phone, 4) || '9' || RIGHT(short_phone, 8)

-- Actually let me redo the mapping with correct logic
DROP TABLE IF EXISTS dup_map;

CREATE TEMP TABLE dup_map AS
SELECT 
  CASE WHEN LENGTH(c1.phone) = 12 THEN c1.id ELSE c2.id END AS short_id,
  CASE WHEN LENGTH(c1.phone) = 13 THEN c1.id ELSE c2.id END AS long_id
FROM contacts c1
JOIN contacts c2 ON c1.organization_id = c2.organization_id 
  AND c1.id < c2.id
  AND (
    (LENGTH(c1.phone) = 13 AND LENGTH(c2.phone) = 12 
     AND c1.phone = LEFT(c2.phone, 4) || '9' || RIGHT(c2.phone, 8))
    OR 
    (LENGTH(c2.phone) = 13 AND LENGTH(c1.phone) = 12 
     AND c2.phone = LEFT(c1.phone, 4) || '9' || RIGHT(c1.phone, 8))
  );

-- Step 2: Move messages from short to long
UPDATE messages SET contact_id = dm.long_id
FROM dup_map dm
WHERE messages.contact_id = dm.short_id;

-- Step 3: Move contact_tags (avoid duplicates)
INSERT INTO contact_tags (contact_id, tag_id)
SELECT dm.long_id, ct.tag_id
FROM contact_tags ct
JOIN dup_map dm ON ct.contact_id = dm.short_id
WHERE NOT EXISTS (
  SELECT 1 FROM contact_tags existing 
  WHERE existing.contact_id = dm.long_id AND existing.tag_id = ct.tag_id
);

DELETE FROM contact_tags WHERE contact_id IN (SELECT short_id FROM dup_map);

-- Step 4: Move contact_custom_fields (avoid duplicates)
INSERT INTO contact_custom_fields (contact_id, field_name, field_value, organization_id)
SELECT dm.long_id, cf.field_name, cf.field_value, cf.organization_id
FROM contact_custom_fields cf
JOIN dup_map dm ON cf.contact_id = dm.short_id
WHERE NOT EXISTS (
  SELECT 1 FROM contact_custom_fields existing 
  WHERE existing.contact_id = dm.long_id AND existing.field_name = cf.field_name
);

DELETE FROM contact_custom_fields WHERE contact_id IN (SELECT short_id FROM dup_map);

-- Step 5: Consolidate data into long contact (notes, unread, last_message_at)
UPDATE contacts c SET
  notes = COALESCE(c.notes, '') || CASE 
    WHEN short.notes IS NOT NULL AND short.notes != '' 
    THEN E'\n---\n' || short.notes 
    ELSE '' 
  END,
  unread_count = c.unread_count + short.unread_count,
  last_message_at = GREATEST(c.last_message_at, short.last_message_at)
FROM dup_map dm
JOIN contacts short ON short.id = dm.short_id
WHERE c.id = dm.long_id;

-- Step 6: Clean up references to short contacts
UPDATE broadcast_recipients SET contact_id = dm.long_id
FROM dup_map dm WHERE broadcast_recipients.contact_id = dm.short_id;

UPDATE scheduled_messages SET contact_id = dm.long_id
FROM dup_map dm WHERE scheduled_messages.contact_id = dm.short_id;

-- Step 7: Delete the short (12-digit) contacts
DELETE FROM contacts WHERE id IN (SELECT short_id FROM dup_map);

-- Step 8: Normalize ALL remaining 12-digit Brazilian phones to 13-digit
-- This prevents future duplicates even without webhook involvement
UPDATE contacts 
SET phone = LEFT(phone, 4) || '9' || RIGHT(phone, 8)
WHERE LENGTH(phone) = 12 
  AND phone LIKE '55%'
  AND NOT EXISTS (
    -- Only update if the 13-digit version doesn't already exist (safety)
    SELECT 1 FROM contacts c2 
    WHERE c2.organization_id = contacts.organization_id 
    AND c2.phone = LEFT(contacts.phone, 4) || '9' || RIGHT(contacts.phone, 8)
  );

DROP TABLE IF EXISTS dup_map;
