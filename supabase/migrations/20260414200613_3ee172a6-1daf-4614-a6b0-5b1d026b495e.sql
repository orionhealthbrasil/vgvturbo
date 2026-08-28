
CREATE OR REPLACE FUNCTION public.prevent_duplicate_phone_contacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id UUID;
  v_alt_phone TEXT;
  v_without_country TEXT;
  v_ddd TEXT;
  v_number TEXT;
  v_first_digit TEXT;
BEGIN
  -- Only handle Brazilian numbers
  IF NOT NEW.phone LIKE '55%' THEN
    RETURN NEW;
  END IF;
  
  -- Skip Instagram contacts (ig_ prefix)
  IF NEW.phone LIKE 'ig_%' THEN
    RETURN NEW;
  END IF;

  v_without_country := SUBSTRING(NEW.phone FROM 3);
  
  -- Generate the alternative phone (with/without 9th digit)
  IF LENGTH(v_without_country) = 10 THEN
    -- 12 digits total: check if mobile (first digit after DDD is 6-9)
    v_ddd := SUBSTRING(v_without_country FROM 1 FOR 2);
    v_number := SUBSTRING(v_without_country FROM 3);
    v_first_digit := SUBSTRING(v_number FROM 1 FOR 1);
    IF v_first_digit IN ('6','7','8','9') THEN
      v_alt_phone := '55' || v_ddd || '9' || v_number;
    ELSE
      RETURN NEW; -- Landline, no alternative
    END IF;
  ELSIF LENGTH(v_without_country) = 11 AND SUBSTRING(v_without_country FROM 3 FOR 1) = '9' THEN
    -- 13 digits total: version without the 9
    v_ddd := SUBSTRING(v_without_country FROM 1 FOR 2);
    v_number := SUBSTRING(v_without_country FROM 4);
    v_alt_phone := '55' || v_ddd || v_number;
  ELSE
    RETURN NEW; -- Not a standard Brazilian mobile format
  END IF;

  -- Check if a contact with the alternative phone already exists in same org
  SELECT id INTO v_existing_id
  FROM public.contacts
  WHERE organization_id = NEW.organization_id
    AND phone = v_alt_phone
    AND channel = NEW.channel
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Normalize to the 13-digit version
    IF LENGTH(NEW.phone) = 12 THEN
      -- The existing contact has the correct 13-digit version, block this insert
      RAISE EXCEPTION 'Duplicate contact detected: phone % is equivalent to existing contact % with phone %', 
        NEW.phone, v_existing_id, v_alt_phone
        USING ERRCODE = '23505';
    ELSE
      -- This insert has the 13-digit version, existing has 12-digit
      -- Update the existing contact's phone to the normalized version, then block
      UPDATE public.contacts SET phone = NEW.phone WHERE id = v_existing_id;
      RAISE EXCEPTION 'Duplicate contact detected and existing normalized: phone % merged into contact %',
        NEW.phone, v_existing_id
        USING ERRCODE = '23505';
    END IF;
  END IF;

  -- Also normalize the phone being inserted (ensure 13 digits for mobile)
  IF LENGTH(v_without_country) = 10 THEN
    v_ddd := SUBSTRING(v_without_country FROM 1 FOR 2);
    v_number := SUBSTRING(v_without_country FROM 3);
    v_first_digit := SUBSTRING(v_number FROM 1 FOR 1);
    IF v_first_digit IN ('6','7','8','9') THEN
      NEW.phone := '55' || v_ddd || '9' || v_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_duplicate_phone_contacts
  BEFORE INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_phone_contacts();
