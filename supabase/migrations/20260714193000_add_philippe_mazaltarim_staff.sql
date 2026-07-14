-- Ajoute Philippe Mazaltarim à la whitelist staff (mêmes droits que Marcel)
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND lower(email) IN (
        'marcel.mazaltarim@gmail.com',
        'pmazaltarim@neuromtl.com',
        'duboisgilles31@gmail.com',
        'duboisgilles31@franchir.eu',
        'erik.boulard@franchir.eu',
        'yves.merillon@franchir.eu'
      )
      AND role::text IN ('marcel', 'franchir', 'gilles', 'admin')
  );
$$;
