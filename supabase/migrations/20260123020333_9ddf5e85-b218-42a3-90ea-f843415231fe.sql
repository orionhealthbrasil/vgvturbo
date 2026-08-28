-- Add reactivation message column to organizations
ALTER TABLE public.organizations
ADD COLUMN snooze_reactivation_message TEXT DEFAULT 'Olá! Voltamos para continuar seu atendimento. 😊';