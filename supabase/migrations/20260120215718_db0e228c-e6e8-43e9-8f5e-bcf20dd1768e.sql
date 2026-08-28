-- Add policies for managing salespeople
CREATE POLICY "Anyone can create salespeople" 
ON public.salespeople 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update salespeople" 
ON public.salespeople 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete salespeople" 
ON public.salespeople 
FOR DELETE 
USING (true);