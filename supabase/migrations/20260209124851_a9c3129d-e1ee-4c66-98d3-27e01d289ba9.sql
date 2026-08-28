
-- Merge duplicate contacts: keep 13-digit (with 9th digit), merge data from 12-digit version
-- Strategy: move messages, tags, custom_fields from short phone to long phone contact, then delete short

-- Step 1: Create a temp table with the mapping
CREATE TEMP TABLE dup_map AS
SELECT c1.id as short_id, c2.id as long_id, c1.phone as short_phone, c2.phone as long_phone,
       c1.last_message_at as short_last_msg, c2.last_message_at as long_last_msg,
       c1.name as short_name, c2.name as long_name,
       c1.unread_count as short_unread, c2.unread_count as long_unread,
       c1.notes as short_notes, c2.notes as long_notes,
       c1.kanban_column_id as short_col, c2.kanban_column_id as long_col,
       c1.pipeline_id as short_pipe, c2.pipeline_id as long_pipe,
       c1.assigned_to as short_assigned, c2.assigned_to as long_assigned,
       c1.status as short_status, c2.status as long_status,
       c1.funnel_stage as short_funnel, c2.funnel_stage as long_funnel,
       c1.profile_picture_url as short_pic, c2.profile_picture_url as long_pic
FROM contacts c1
JOIN contacts c2 ON c1.organization_id = c2.organization_id
  AND c1.id < c2.id
  AND LENGTH(c1.phone) = 12 AND LENGTH(c2.phone) = 13
  AND SUBSTRING(c2.phone, 1, 4) = SUBSTRING(c1.phone, 1, 4)
  AND SUBSTRING(c2.phone, 6) = SUBSTRING(c1.phone, 5)
WHERE c1.organization_id = '7483e12d-827c-4e6f-ac12-43d6fe67b0f8';

-- Step 2: Move messages from short contact to long contact
UPDATE messages SET contact_id = dm.long_id
FROM dup_map dm
WHERE messages.contact_id = dm.short_id;

-- Step 3: Move tags (only if not already present on long contact)
INSERT INTO contact_tags (contact_id, tag_id)
SELECT dm.long_id, ct.tag_id
FROM contact_tags ct
JOIN dup_map dm ON ct.contact_id = dm.short_id
WHERE NOT EXISTS (
  SELECT 1 FROM contact_tags existing 
  WHERE existing.contact_id = dm.long_id AND existing.tag_id = ct.tag_id
);

-- Step 4: Delete old tags from short contact
DELETE FROM contact_tags ct
USING dup_map dm
WHERE ct.contact_id = dm.short_id;

-- Step 5: Move custom fields (only if not already present)
INSERT INTO contact_custom_fields (contact_id, organization_id, field_name, field_value)
SELECT dm.long_id, ccf.organization_id, ccf.field_name, ccf.field_value
FROM contact_custom_fields ccf
JOIN dup_map dm ON ccf.contact_id = dm.short_id
WHERE NOT EXISTS (
  SELECT 1 FROM contact_custom_fields existing 
  WHERE existing.contact_id = dm.long_id AND existing.field_name = ccf.field_name
);

-- Step 6: Delete old custom fields from short contact  
DELETE FROM contact_custom_fields ccf
USING dup_map dm
WHERE ccf.contact_id = dm.short_id;

-- Step 7: Update the long contact with best data from short
UPDATE contacts c SET
  last_message_at = GREATEST(c.last_message_at, dm.short_last_msg),
  unread_count = c.unread_count + dm.short_unread,
  name = CASE 
    WHEN c.name ~ '^\d+$' AND NOT (dm.short_name ~ '^\d+$') THEN dm.short_name 
    ELSE c.name 
  END,
  notes = CASE 
    WHEN c.notes IS NULL THEN dm.short_notes 
    WHEN dm.short_notes IS NOT NULL THEN c.notes || E'\n' || dm.short_notes 
    ELSE c.notes 
  END,
  kanban_column_id = COALESCE(c.kanban_column_id, dm.short_col),
  pipeline_id = COALESCE(c.pipeline_id, dm.short_pipe),
  assigned_to = COALESCE(c.assigned_to, dm.short_assigned),
  profile_picture_url = COALESCE(c.profile_picture_url, dm.short_pic),
  status = CASE WHEN dm.short_status = 'open' THEN 'open' ELSE c.status END,
  funnel_stage = CASE 
    WHEN dm.short_last_msg > COALESCE(c.last_message_at, '1970-01-01') THEN dm.short_funnel 
    ELSE c.funnel_stage 
  END
FROM dup_map dm
WHERE c.id = dm.long_id;

-- Step 8: Delete broadcast_recipients referencing short contacts
DELETE FROM broadcast_recipients br
USING dup_map dm
WHERE br.contact_id = dm.short_id;

-- Step 9: Delete scheduled_messages referencing short contacts
DELETE FROM scheduled_messages sm
USING dup_map dm
WHERE sm.contact_id = dm.short_id;

-- Step 10: Delete the short (12-digit) duplicate contacts
DELETE FROM contacts c
USING dup_map dm
WHERE c.id = dm.short_id;

-- Cleanup
DROP TABLE dup_map;
