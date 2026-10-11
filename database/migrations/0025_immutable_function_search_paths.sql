begin;
-- Both functions use pg_catalog-only math/RAISE and require no mutable search_path.
alter function public.geo_distance_meters(double precision,double precision,double precision,double precision)
  set search_path = 'pg_catalog';
alter function public.reject_presence_integrity_mutation()
  set search_path = 'pg_catalog';
commit;
