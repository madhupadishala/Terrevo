begin;
do $cutover$
declare
 t uuid:='f6000000-0000-4000-8000-000000000001';
 mr uuid:='f6000000-0000-4000-8000-000000000002';
 mgr uuid:='f6000000-0000-4000-8000-000000000003';
 outsider uuid:='f6000000-0000-4000-8000-000000000004';
 company uuid:='f6000000-0000-4000-8000-000000000005';
 division uuid:='f6000000-0000-4000-8000-000000000006';
 zone uuid:='f6000000-0000-4000-8000-000000000007';
 region uuid:='f6000000-0000-4000-8000-000000000008';
 area uuid:='f6000000-0000-4000-8000-000000000009';
 territory uuid:='f6000000-0000-4000-8000-000000000010';
 mr_emp uuid:='f6000000-0000-4000-8000-000000000011';
 mgr_emp uuid:='f6000000-0000-4000-8000-000000000012';
 doctor uuid:='f6000000-0000-4000-8000-000000000013';
 product uuid:='f6000000-0000-4000-8000-000000000014';
 sample uuid:='f6000000-0000-4000-8000-000000000015';
 asset uuid:='f6000000-0000-4000-8000-000000000016';
 slide uuid:='f6000000-0000-4000-8000-000000000017';
 town uuid:='f6000000-0000-4000-8000-000000000018';
 start_op uuid:='f6000000-0000-4000-8000-000000000019';
 checkin_op uuid:='f6000000-0000-4000-8000-000000000020';
 clm_op uuid:='f6000000-0000-4000-8000-000000000021';
 dist_op uuid:='f6000000-0000-4000-8000-000000000022';
 call_op uuid:='f6000000-0000-4000-8000-000000000023';
 checkout_op uuid:='f6000000-0000-4000-8000-000000000024';
 nca_op uuid:='f6000000-0000-4000-8000-000000000025';
 submit_op uuid:='f6000000-0000-4000-8000-000000000026';
 v_plan uuid;v_day uuid;v_stop uuid;v_exec uuid;v_visit uuid;v_clm uuid;v_nca uuid;v_dcr uuid;
 monday date:=date_trunc('week',current_date)::date;
begin
 insert into auth.users(id,email) values
 (mr,'ci-live-cutover-mr@example.invalid'),(mgr,'ci-live-cutover-manager@example.invalid'),(outsider,'ci-live-cutover-outsider@example.invalid');
 insert into public.tenants(id,name,slug,time_zone) values(t,'CI Live Cutover','ci-live-cutover','UTC');
 insert into public.tenant_memberships(tenant_id,user_id) values(t,mr),(t,mgr);
 insert into public.organization_units(id,tenant_id,type,code,name) values(company,t,'company','CUT_COMP','Cutover Company');
 insert into public.organization_units(id,tenant_id,parent_id,type,code,name) values
 (division,t,company,'division','CUT_DIV','Cutover Division'),
 (zone,t,division,'zone','CUT_ZONE','Cutover Zone'),
 (region,t,zone,'region','CUT_REG','Cutover Region'),
 (area,t,region,'area','CUT_AREA','Cutover Area'),
 (territory,t,area,'territory','CUT_TERR','Cutover Territory');
 insert into public.user_role_assignments(tenant_id,user_id,role_key,scope_org_unit_id) values
 (t,mr,'MR',territory),(t,mgr,'MANAGER',territory);
 insert into public.employees(id,tenant_id,user_id,code,name,designation,org_unit_id,reporting_manager_employee_id) values
 (mgr_emp,t,mgr,'CUT_MGR','Cutover Manager','Manager',territory,null),
 (mr_emp,t,mr,'CUT_MR','Cutover Representative','MR',territory,mgr_emp);
 insert into public.doctors(id,tenant_id,code,name,specialty,territory_id,latitude,longitude)
 values(doctor,t,'CUT_DOC','Cutover Doctor','Cardiology',territory,17.385,78.4867);
 insert into public.products(id,tenant_id,code,name,division_id) values(product,t,'CUT_PROD','Cutover Product',division);
 insert into public.samples(id,tenant_id,code,name,product_id,division_id,unit) values(sample,t,'CUT_SMP','Cutover Sample',product,division,'tablet');
 insert into public.inventory_balances(tenant_id,employee_id,item_type,sample_id,quantity) values(t,mr_emp,'sample',sample,10);

 insert into public.clm_assets(id,tenant_id,code,title,version,category,status,division_id,effective_from,expires_at)
 values(asset,t,'CUT-CLM-001','Cutover Approved Aid','1.0','Brand Aid','APPROVED',division,current_date-1,current_date+30);
 insert into public.clm_asset_products(tenant_id,asset_id,product_id) values(t,asset,product);
 insert into public.clm_slides(id,tenant_id,asset_id,sequence_no,title,body) values(slide,t,asset,1,'Slide 1','Approved content');

 insert into public.nca_categories(tenant_id,code,label,active) values(t,'MEETING','Meeting',true);
 insert into public.nca_towns(id,tenant_id,territory_id,name,active) values(town,t,territory,'Hyderabad',true);

 v_plan:=public.admin_save_tour_plan(t,mr,null,monday,jsonb_build_array(jsonb_build_object(
   'date',current_date::text,'territoryId',territory::text,'remarks','Cutover day',
   'stops',jsonb_build_array(jsonb_build_object('sequence',1,'type','doctor','targetId',doctor::text,'remarks','CLM + sample'))
 )));
 perform public.admin_submit_tour_plan(t,mr,v_plan);
 perform public.admin_decide_tour_plan(t,mgr,v_plan,'APPROVE',null);
 select id into v_day from public.tour_plan_days where tenant_id=t and tour_plan_id=v_plan and plan_date=current_date;
 select id into v_stop from public.tour_plan_stops where tenant_id=t and tour_plan_day_id=v_day and doctor_id=doctor;

 v_exec:=public.admin_start_tour(t,mr,start_op,v_day,clock_timestamp(),17.385,78.4867,8,'cutover','wifi','terrevo-final');
 v_visit:=public.admin_checkin_visit(t,mr,checkin_op,v_stop,17.385,78.4867,8,null);

 v_clm:=public.admin_save_clm_detailing(t,mr,clm_op,v_visit,asset,clock_timestamp()-interval '2 minutes',clock_timestamp(),'POSITIVE',
   jsonb_build_array(jsonb_build_object('slideId',slide::text,'durationMs',45000)));
 perform public.admin_distribute_visit_inventory(t,mr,v_visit,dist_op,
   jsonb_build_array(jsonb_build_object('itemType','sample','itemId',sample::text,'quantity',2)));
 perform public.admin_save_doctor_call(t,mr,v_visit,call_op,'Detailed','Accepted live contract',null,'[]'::jsonb);
 perform public.admin_checkout_visit(t,mr,v_visit,checkout_op,17.385,78.4867,8);

 select id into v_dcr from public.dcrs where tenant_id=t and visit_id=v_visit;
 if v_dcr is null then raise exception 'DCR not generated';end if;
 if not exists(select 1 from public.dcr_clm_sessions where tenant_id=t and dcr_id=v_dcr and clm_session_id=v_clm and asset_id=asset and reaction='POSITIVE')
 then raise exception 'CLM evidence not snapshotted into DCR';end if;
 if not exists(select 1 from public.dcr_distributions where tenant_id=t and dcr_id=v_dcr and sample_id=sample and quantity=2)
 then raise exception 'sample evidence not snapshotted into DCR';end if;
 if (select quantity from public.inventory_balances where tenant_id=t and employee_id=mr_emp and sample_id=sample)<>8
 then raise exception 'inventory balance did not decrement atomically';end if;

 v_nca:=public.admin_create_nca(t,mr,nca_op,current_date,territory,'PLAN','MEETING',town,'Post-call team meeting','Qualified NCA',30);
 perform public.admin_submit_nca(t,mr,v_nca);
 perform public.admin_decide_nca(t,mgr,v_nca,'APPROVE',null);
 if not exists(select 1 from public.nca_records where tenant_id=t and id=v_nca and status='APPROVED' and reviewed_by=mgr)
 then raise exception 'manager NCA approval did not persist';end if;
 if not exists(select 1 from public.nca_decisions where tenant_id=t and nca_id=v_nca and actor_user_id=mgr and decision='APPROVE')
 then raise exception 'NCA decision audit missing';end if;

 perform public.admin_submit_tour_execution(t,mr,submit_op,'Controlled qualification');
 if not exists(select 1 from public.tour_executions where tenant_id=t and id=v_exec and status='SUBMITTED')
 then raise exception 'End My Day did not lock execution';end if;

 perform set_config('request.jwt.claim.sub',mr::text,true);set local role authenticated;
 if (select count(*) from public.clm_detailing_sessions where tenant_id=t and id=v_clm)<>1
    or (select count(*) from public.dcrs where tenant_id=t and id=v_dcr)<>1
    or (select count(*) from public.nca_records where tenant_id=t and id=v_nca)<>1
 then raise exception 'MR cannot read own live evidence';end if;
 reset role;

 perform set_config('request.jwt.claim.sub',mgr::text,true);set local role authenticated;
 if (select count(*) from public.clm_detailing_sessions where tenant_id=t and id=v_clm)<>1
    or (select count(*) from public.dcrs where tenant_id=t and id=v_dcr)<>1
 then raise exception 'Manager cannot read scoped live evidence';end if;
 reset role;

 perform set_config('request.jwt.claim.sub',outsider::text,true);set local role authenticated;
 if exists(select 1 from public.clm_detailing_sessions where tenant_id=t)
    or exists(select 1 from public.dcrs where tenant_id=t)
    or exists(select 1 from public.nca_records where tenant_id=t)
 then raise exception 'Outsider crossed live provider tenant boundary';end if;
 reset role;
end;$cutover$;
rollback;
