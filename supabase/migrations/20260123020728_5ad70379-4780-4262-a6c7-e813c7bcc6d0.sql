-- Add farewell message column to organizations
ALTER TABLE public.organizations
ADD COLUMN ticket_farewell_message TEXT DEFAULT 'Obrigado pelo contato! Foi um prazer atendê-lo. 😊 Se precisar de algo mais, estamos à disposição!';