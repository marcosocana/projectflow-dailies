DROP POLICY IF EXISTS "Users can view person billing rates" ON public.person_billing_rates;
DROP POLICY IF EXISTS "Users can create person billing rates" ON public.person_billing_rates;
DROP POLICY IF EXISTS "Users can update person billing rates" ON public.person_billing_rates;
DROP POLICY IF EXISTS "Users can delete person billing rates" ON public.person_billing_rates;

CREATE POLICY "Admin can view person billing rates"
  ON public.person_billing_rates FOR SELECT
  USING (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

CREATE POLICY "Admin can create person billing rates"
  ON public.person_billing_rates FOR INSERT
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

CREATE POLICY "Admin can update person billing rates"
  ON public.person_billing_rates FOR UPDATE
  USING (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com')
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');

CREATE POLICY "Admin can delete person billing rates"
  ON public.person_billing_rates FOR DELETE
  USING (lower(auth.jwt() ->> 'email') = 'mocanat@minsait.com');
