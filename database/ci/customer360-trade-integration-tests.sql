begin;
do $customer$
declare
 t uuid:='c4000000-0000-4000-8000-000000000001';
 mr uuid:='c4000000-0000-4000-8000-000000000002';
 mgr uuid:='c4000000-0000-4000-8000-000000000003';
 outsider uuid:='c4000000-0000-4000-8000-000000000004';
 company uuid:='c4000000-0000-4000-8000-000000000005';
 division uuid:='c4000000-0000-4000-8000-000000000006';
 zone uuid:='c4000000-0000-4000-8000-000000000007';
 region uuid:='c4000000-0000-4000-8000-000000000008';
 area uuid:='c4000000-0000-4000-8000-000000000009';
 territory uuid:='c4000000-0000-4000-8000-000000000010';
 mr_emp uuid:='c4000000-0000-4000-8000-000000000011';
 mgr_emp uuid:='c4000000-0000-4000-8000-000000000012';
 doctor uuid:='c4000000-0000-4000-8000-000000000013';
 chemist uuid:='c4000000-0000-4000-8000-000000000014';
 stockist uuid:='c4000000-0000-4000-8000-000000000015';
 product uuid:='c4000000-0000-4000-8000-000000000016';
 start_op uuid:='c4000000-0000-4000-8000-000000000017';
 checkin_op uuid:='c4000000-0000-4000-8000-000000000018';
 checkout_op uuid:='c4000000-0000-4000-8000-000000000019';
 rcpa_op uuid:='c4000000-0000-4000-8000-000000000020';
 order_op uuid:='c4000000-0000-4000-8000-000000000021';
 v_plan uuid;v_day uuid;v_stop uuid;v_exec uuid;v_visit uuid;v_doc_chem uuid;v_chem_stock uuid;v_report uuid;v_order uuid;
 monday date:=date_trunc('week',current_date)::date;
begin
 insert into auth.users(id,email) values
 (mr,'ci-customer-mr@example.invalid'),(mgr,'ci-customer-manager@example.invalid'),(outsider,'ci-customer-outsider@example.invalid');
 insert into public.tenants(id,name,slug,time_zone) values(t,'CI Customer Network','ci-customer-network','UTC');
 insert into public.tenant_memberships(tenant_id,user_id) values(t,mr),(t,mgr);
 insert into public.organization_units(id,tenant_id,type,code,name) values(company,t,'company','CI_COMPANY','CI Company');
 insert into public.organization_units(id,tenant_id,parent_id,type,code,name) values
 (division,t,company,'division','CI_DIV','CI Division'),
 (zone,t,division,'zone','CI_ZONE','CI Zone'),
 (region,t,zone,'region','CI_REGION','CI Region'),
 (area,t,region,'area','CI_AREA','CI Area'),
 (territory,t,area,'territory','CI_TERR','CI Territory');
 insert into public.user_role_assignments(tenant_id,user_id,role_key,scope_org_unit_id) values
 (t,mr,'MR',territory),(t,mgr,'MANAGER',territory);
 insert into public.employees(id,tenant_id,user_id,code,name,designation,org_unit_id) values
 (mr_emp,t,mr,'CI_MR','CI Representative','MR',territory),
 (mgr_emp,t,mgr,'CI_MGR','CI Manager','Manager',territory);
 insert into public.doctors(id,tenant_id,code,name,specialty,territory_id,latitude,longitude)
 values(doctor,t,'CI_DOC','CI Doctor','General Medicine',territory,17.385,78.4867);
 insert into public.chemists(id,tenant_id,code,name,territory_id,latitude,longitude)
 values(chemist,t,'CI_CHEM','CI Chemist',territory,17.385,78.4867);
 insert into public.stockists(id,tenant_id,code,name,territory_id,latitude,longitude)
 values(stockist,t,'CI_STOCK','CI Stockist',territory,17.385,78.4867);
 insert into public.products(id,tenant_id,code,name,division_id)
 values(product,t,'CI_PROD','CI Product',division);

 v_plan:=public.admin_save_tour_plan(t,mr,null,monday,
   jsonb_build_array(jsonb_build_object(
     'date',current_date::text,'territoryId',territory::text,'remarks','Trade day',
     'stops',jsonb_build_array(
       jsonb_build_object('sequence',1,'type','chemist','targetId',chemist::text,'remarks','RCPA and POB'),
       jsonb_build_object('sequence',2,'type','stockist','targetId',stockist::text,'remarks','POB')
     )
   )));
 perform public.admin_submit_tour_plan(t,mr,v_plan);
 perform public.admin_decide_tour_plan(t,mgr,v_plan,'APPROVE',null);
 select id into v_day from public.tour_plan_days where tenant_id=t and tour_plan_id=v_plan and plan_date=current_date;
 select id into v_stop from public.tour_plan_stops where tenant_id=t and tour_plan_day_id=v_day and chemist_id=chemist;
 v_exec:=public.admin_start_tour(t,mr,start_op,v_day,clock_timestamp(),17.385,78.4867,8.0,'ci','wifi','terrevo-ci');
 v_visit:=public.admin_checkin_visit(t,mr,checkin_op,v_stop,17.385,78.4867,8.0,null);

 begin
   perform public.admin_save_rcpa(t,mr,v_visit,rcpa_op,jsonb_build_array(jsonb_build_object(
     'sequence',1,'productId',product::text,'competitorBrand',null,'prescriptionCount',5,'stockQuantity',10,'salesQuantity',2
   )));
   raise exception 'RCPA accepted without Doctor to Chemist link';
 exception when others then
   if sqlerrm='RCPA accepted without Doctor to Chemist link' then raise;end if;
 end;

 v_doc_chem:=public.admin_link_customer(t,mr,'doctor',doctor,'chemist',chemist);
 if not exists(select 1 from public.customer_relationships r where r.tenant_id=t and r.id=v_doc_chem and r.relationship='DOCTOR_CHEMIST')
 then raise exception 'Doctor to Chemist link did not persist';end if;

 v_report:=public.admin_save_rcpa(t,mr,v_visit,rcpa_op,jsonb_build_array(jsonb_build_object(
   'sequence',1,'productId',product::text,'competitorBrand',null,'prescriptionCount',5,'stockQuantity',10,'salesQuantity',2
 )));
 if not exists(select 1 from public.rcpa_reports rr join public.rcpa_lines l on l.tenant_id=rr.tenant_id and l.rcpa_report_id=rr.id
   where rr.tenant_id=t and rr.id=v_report and rr.chemist_id=chemist and l.product_id=product and l.prescription_count=5)
 then raise exception 'linked RCPA did not persist';end if;

 begin
   perform public.admin_save_sales_order(t,mr,v_visit,order_op,null,jsonb_build_array(jsonb_build_object(
     'sequence',1,'productId',product::text,'quantity',3,'remarks','CI POB'
   )));
   raise exception 'POB accepted without Chemist to Stockist link';
 exception when others then
   if sqlerrm='POB accepted without Chemist to Stockist link' then raise;end if;
 end;

 v_chem_stock:=public.admin_link_customer(t,mr,'chemist',chemist,'stockist',stockist);
 v_order:=public.admin_save_sales_order(t,mr,v_visit,order_op,null,jsonb_build_array(jsonb_build_object(
   'sequence',1,'productId',product::text,'quantity',3,'remarks','CI POB'
 )));
 if not exists(select 1 from public.sales_orders so join public.sales_order_lines l on l.tenant_id=so.tenant_id and l.sales_order_id=so.id
   where so.tenant_id=t and so.id=v_order and so.chemist_id=chemist and so.status='BOOKED' and l.product_id=product and l.quantity=3)
 then raise exception 'linked POB did not persist';end if;

 if (select count(*) from public.customer_relationship_audit a where a.tenant_id=t and a.action='LINK')<>2
 then raise exception 'relationship audit trail missing';end if;

 perform set_config('request.jwt.claim.sub',mr::text,true);
 set local role authenticated;
 if (select count(*) from public.customer_relationships where tenant_id=t)<>2 then raise exception 'MR cannot read authorized outlet links';end if;
 reset role;

 perform set_config('request.jwt.claim.sub',mgr::text,true);
 set local role authenticated;
 if (select count(*) from public.customer_relationships where tenant_id=t)<>2 then raise exception 'manager cannot read scoped outlet links';end if;
 reset role;

 perform set_config('request.jwt.claim.sub',outsider::text,true);
 set local role authenticated;
 if exists(select 1 from public.customer_relationships where tenant_id=t)
    or exists(select 1 from public.rcpa_reports where tenant_id=t)
    or exists(select 1 from public.sales_orders where tenant_id=t)
 then raise exception 'outsider crossed customer/trade tenant boundary';end if;
 reset role;

 perform public.admin_unlink_customer(t,mr,v_doc_chem);
 if exists(select 1 from public.customer_relationships where tenant_id=t and id=v_doc_chem)
 then raise exception 'unlink did not persist';end if;
 if not exists(select 1 from public.customer_relationship_audit where tenant_id=t and relationship_id=v_doc_chem and action='UNLINK')
 then raise exception 'unlink audit event missing';end if;
end;$customer$;
rollback;
