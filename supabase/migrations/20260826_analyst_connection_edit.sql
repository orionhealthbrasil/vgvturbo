-- Allow analyst role to edit (connect/disconnect) WhatsApp connection
UPDATE role_permissions
SET can_edit = true
WHERE role = 'analyst'
  AND permission = 'connection'
  AND organization_id IS NULL;
