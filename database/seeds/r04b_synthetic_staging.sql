-- R04-B: controlled SYNTHETIC staging fixtures. Do not run against production.
-- This file is idempotent for the named fixture UUIDs; its tenant guard fails closed.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id='10000000-0000-4000-8000-000000000101' AND slug='r04b-staging-alpha') OR
    NOT EXISTS (SELECT 1 FROM public.tenants WHERE id='10000000-0000-4000-8000-000000000102' AND slug='r04b-staging-beta')
 THEN RAISE EXCEPTION 'R04-B staging tenants absent; abort fixture seed'; END IF;
END $$;
INSERT INTO public.organization_units(id,tenant_id,parent_id,type,code,name,status) VALUES ('60000000-0000-4000-8000-000000000610','10000000-0000-4000-8000-000000000101',NULL,'company','R04B_A_COMPANY','R04B Synthetic A company','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.organization_units(id,tenant_id,parent_id,type,code,name,status) VALUES ('60000000-0000-4000-8000-000000000611','10000000-0000-4000-8000-000000000101','60000000-0000-4000-8000-000000000610','division','R04B_A_DIVISION','R04B Synthetic A division','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.organization_units(id,tenant_id,parent_id,type,code,name,status) VALUES ('60000000-0000-4000-8000-000000000612','10000000-0000-4000-8000-000000000101','60000000-0000-4000-8000-000000000611','zone','R04B_A_ZONE','R04B Synthetic A zone','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.organization_units(id,tenant_id,parent_id,type,code,name,status) VALUES ('60000000-0000-4000-8000-000000000613','10000000-0000-4000-8000-000000000101','60000000-0000-4000-8000-000000000612','region','R04B_A_REGION','R04B Synthetic A region','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.organization_units(id,tenant_id,parent_id,type,code,name,status) VALUES ('60000000-0000-4000-8000-000000000614','10000000-0000-4000-8000-000000000101','60000000-0000-4000-8000-000000000613','area','R04B_A_AREA','R04B Synthetic A area','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.organization_units(id,tenant_id,parent_id,type,code,name,status) VALUES ('60000000-0000-4000-8000-000000000620','10000000-0000-4000-8000-000000000102',NULL,'company','R04B_B_COMPANY','R04B Synthetic B company','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.organization_units(id,tenant_id,parent_id,type,code,name,status) VALUES ('60000000-0000-4000-8000-000000000621','10000000-0000-4000-8000-000000000102','60000000-0000-4000-8000-000000000620','division','R04B_B_DIVISION','R04B Synthetic B division','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.organization_units(id,tenant_id,parent_id,type,code,name,status) VALUES ('60000000-0000-4000-8000-000000000622','10000000-0000-4000-8000-000000000102','60000000-0000-4000-8000-000000000621','zone','R04B_B_ZONE','R04B Synthetic B zone','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.organization_units(id,tenant_id,parent_id,type,code,name,status) VALUES ('60000000-0000-4000-8000-000000000623','10000000-0000-4000-8000-000000000102','60000000-0000-4000-8000-000000000622','region','R04B_B_REGION','R04B Synthetic B region','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.organization_units(id,tenant_id,parent_id,type,code,name,status) VALUES ('60000000-0000-4000-8000-000000000624','10000000-0000-4000-8000-000000000102','60000000-0000-4000-8000-000000000623','area','R04B_B_AREA','R04B Synthetic B area','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.organization_units(id,tenant_id,parent_id,type,code,name,status) VALUES ('60000000-0000-4000-8000-000000000601','10000000-0000-4000-8000-000000000101','60000000-0000-4000-8000-000000000614','territory','R04B_A_NORTH','R04B Synthetic North','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.organization_units(id,tenant_id,parent_id,type,code,name,status) VALUES ('60000000-0000-4000-8000-000000000602','10000000-0000-4000-8000-000000000101','60000000-0000-4000-8000-000000000614','territory','R04B_A_SOUTH','R04B Synthetic South','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.organization_units(id,tenant_id,parent_id,type,code,name,status) VALUES ('60000000-0000-4000-8000-000000000603','10000000-0000-4000-8000-000000000102','60000000-0000-4000-8000-000000000624','territory','R04B_B_SOUTH','R04B Synthetic South','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.doctors(id,tenant_id,code,name,specialty,territory_id,status) VALUES ('40000000-0000-4000-8000-000000000401','10000000-0000-4000-8000-000000000101','R04B_A_D01','R04B Synthetic Alpha Doctor','General Medicine','60000000-0000-4000-8000-000000000601','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.doctors(id,tenant_id,code,name,specialty,territory_id,status) VALUES ('40000000-0000-4000-8000-000000000402','10000000-0000-4000-8000-000000000102','R04B_B_D01','R04B Synthetic Beta Doctor','General Medicine','60000000-0000-4000-8000-000000000603','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.chemists(id,tenant_id,code,name,territory_id,status) VALUES ('50000000-0000-4000-8000-000000000501','10000000-0000-4000-8000-000000000101','R04B_A_C01','R04B Synthetic Alpha North Chemist','60000000-0000-4000-8000-000000000601','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.chemists(id,tenant_id,code,name,territory_id,status) VALUES ('50000000-0000-4000-8000-000000000502','10000000-0000-4000-8000-000000000101','R04B_A_C02','R04B Synthetic Alpha South Chemist','60000000-0000-4000-8000-000000000602','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.chemists(id,tenant_id,code,name,territory_id,status) VALUES ('50000000-0000-4000-8000-000000000503','10000000-0000-4000-8000-000000000101','R04B_A_C03','R04B Synthetic Alpha Pending Chemist','60000000-0000-4000-8000-000000000601','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.chemists(id,tenant_id,code,name,territory_id,status) VALUES ('50000000-0000-4000-8000-000000000504','10000000-0000-4000-8000-000000000102','R04B_B_C01','R04B Synthetic Beta South Chemist','60000000-0000-4000-8000-000000000603','active') ON CONFLICT(id) DO NOTHING;
UPDATE public.business_customer_links SET source_id='40000000-0000-4000-8000-000000000402' WHERE id='30000000-0000-4000-8000-000000000304' AND tenant_id='10000000-0000-4000-8000-000000000102' AND source_id='40000000-0000-4000-8000-000000000401';
INSERT INTO public.employees(id,tenant_id,code,name,designation,org_unit_id,status) VALUES ('70000000-0000-4000-8000-000000000701','10000000-0000-4000-8000-000000000101','R04B_A_MGR','R04B Synthetic Alpha Manager','Area Manager','60000000-0000-4000-8000-000000000601','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.employees(id,tenant_id,code,name,designation,org_unit_id,status) VALUES ('70000000-0000-4000-8000-000000000702','10000000-0000-4000-8000-000000000101','R04B_A_MR','R04B Synthetic Alpha Representative','Medical Representative','60000000-0000-4000-8000-000000000601','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.employees(id,tenant_id,code,name,designation,org_unit_id,status) VALUES ('70000000-0000-4000-8000-000000000703','10000000-0000-4000-8000-000000000102','R04B_B_MGR','R04B Synthetic Beta Manager','Area Manager','60000000-0000-4000-8000-000000000603','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.employees(id,tenant_id,code,name,designation,org_unit_id,status) VALUES ('70000000-0000-4000-8000-000000000704','10000000-0000-4000-8000-000000000102','R04B_B_MR','R04B Synthetic Beta Representative','Medical Representative','60000000-0000-4000-8000-000000000603','active') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.user_role_assignments(id,tenant_id,user_id,role_key,scope_org_unit_id,status) VALUES
('80000000-0000-4000-8000-000000000801','10000000-0000-4000-8000-000000000101','07d1ff28-0c9c-4e46-b039-e25ee146b411','MR','60000000-0000-4000-8000-000000000601','active'),
('80000000-0000-4000-8000-000000000802','10000000-0000-4000-8000-000000000102','c6989451-998b-48cd-8ea0-d88876302a47','MR','60000000-0000-4000-8000-000000000603','active') ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
IF (SELECT count(*) FROM public.organization_units WHERE code LIKE 'R04B_%') < 13 OR
 (SELECT count(*) FROM public.employees WHERE code LIKE 'R04B_%') < 4 OR
 (SELECT count(*) FROM public.chemists WHERE code LIKE 'R04B_%') < 4
THEN RAISE EXCEPTION 'R04-B fixtures incomplete'; END IF;
END $$;
COMMIT;
