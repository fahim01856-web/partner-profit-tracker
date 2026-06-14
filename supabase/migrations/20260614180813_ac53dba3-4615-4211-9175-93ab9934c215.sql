
CREATE OR REPLACE FUNCTION public.get_system_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  db_size bigint;
  tables jsonb;
  total_rows bigint := 0;
BEGIN
  SELECT pg_database_size(current_database()) INTO db_size;

  SELECT COALESCE(jsonb_agg(t ORDER BY (t->>'size_bytes')::bigint DESC), '[]'::jsonb)
  INTO tables
  FROM (
    SELECT jsonb_build_object(
      'name', c.relname,
      'rows', c.reltuples::bigint,
      'size_bytes', pg_total_relation_size(c.oid)
    ) AS t
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  ) s;

  SELECT COALESCE(SUM((v->>'rows')::bigint), 0) INTO total_rows
  FROM jsonb_array_elements(tables) v;

  RETURN jsonb_build_object(
    'db_size_bytes', db_size,
    'total_rows', total_rows,
    'tables', tables
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_stats() TO authenticated, service_role;
