DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public' AND rel.relname = 'factures' AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%statut%'
  LOOP
    EXECUTE format('ALTER TABLE public.factures DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.factures ADD CONSTRAINT factures_statut_check CHECK (statut IN ('brouillon','validee','envoyee','payee','annulee'));