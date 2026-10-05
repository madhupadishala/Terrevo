begin;

insert into auth.users(id,email) values
('a1000000-0000-4000-8000-000000000001','wave3-a-mr@example.com'),
('a1000000-0000-4000-8000-000000000002','wave3-a-manager@example.com'),
('a1000000-0000-4000-8000-000000000003','wave3-b-mr@example.com'),
('a1000000-0000-4000-8000-000000000004','wave3-b-manager@example.com')
on conflict do nothing;

insert into public.tenants(id,name,slug,status,time_zone,geofence_radius_meters,max_gps_accuracy_meters) values
('a2000000-0000-4000-8000-000000000001','Wave Three A','wave-three-a','active','Asia/Kolkata',100,50),
('a2000000-0000-4000-8000-000000000002','Wave Three B','wave-three-b','active','Asia/Kolkata',100,50);

insert into public.tenant_memberships(tenant_id,user_id,status) values
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','active'),
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','active'),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','active'),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','active');

insert into public.organization_units(id,tenant_id,parent_id,type,code,name,status) values
('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',null,'company','A3CO','A Company','active'),
('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','division','A3DIV','A Division','active'),
('a3000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002','zone','A3ZONE','A Zone','active'),
('a3000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000003','region','A3REG','A Region','active'),
('a3000000-0000-4000-8000-000000000005','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000004','area','A3AREA','A Area','active'),
('a3000000-0000-4000-8000-000000000006','a2000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000005','territory','A3TER','A Territory','active'),
('b3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002',null,'company','B3CO','B Company','active'),
('b3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001','division','B3DIV','B Division','active'),
('b3000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002','zone','B3ZONE','B Zone','active'),
('b3000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000003','region','B3REG','B Region','active'),
('b3000000-0000-4000-8000-000000000005','a2000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000004','area','B3AREA','B Area','active'),
('b3000000-0000-4000-8000-000000000006','a2000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000005','territory','B3TER','B Territory','active');

insert into public.user_role_assignments(tenant_id,user_id,role_key,scope_org_unit_id,status) values
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','MR','a3000000-0000-4000-8000-000000000006','active'),
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','MANAGER','a3000000-0000-4000-8000-000000000005','active'),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','MR','b3000000-0000-4000-8000-000000000006','active'),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','MANAGER','b3000000-0000-4000-8000-000000000005','active');

insert into public.user_org_assignments(tenant_id,user_id,org_unit_id,is_primary,status) values
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000006',true,'active'),
('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000005',true,'active'),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000006',true,'active'),
('a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','b3000000-0000-4000-8000-000000000005',true,'active');

insert into public.employees(id,tenant_id,user_id,code,name,designation,org_unit_id,status) values
('a4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','A3MR','A MR','MR','a3000000-0000-4000-8000-000000000006','active'),
('a4000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','A3MGR','A Manager','Manager','a3000000-0000-4000-8000-000000000005','active'),
('b4000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003','B3MR','B MR','MR','b3000000-0000-4000-8000-000000000006','active'),
('b4000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000004','B3MGR','B Manager','Manager','b3000000-0000-4000-8000-000000000005','active');

insert into public.chemists(id,tenant_id,code,name,latitude,longitude,territory_id,status) values
('a5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','A3CH','A Chemist',17.4,78.48,'a3000000-0000-4000-8000-000000000006','active'),
('b5000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','B3CH','B Chemist',17.41,78.49,'b3000000-0000-4000-8000-000000000006','active');
insert into public.products(id,tenant_id,code,name,generic_name,division_id,status) values
('a5000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','A3PR','A Product','Generic A','a3000000-0000-4000-8000-000000000002','active'),
('b5000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','B3PR','B Product','Generic B','b3000000-0000-4000-8000-000000000002','active');

insert into public.tour_plans(id,tenant_id,employee_id,week_start,status,submitted_at,reviewed_at,reviewed_by) values
('a6000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','2026-10-05','APPROVED',now(),now(),'a1000000-0000-4000-8000-000000000002'),
('b6000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000001','2026-10-05','APPROVED',now(),now(),'a1000000-0000-4000-8000-000000000004');
insert into public.tour_plan_days(id,tenant_id,tour_plan_id,plan_date,territory_id) values
('a6000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','2026-10-05','a3000000-0000-4000-8000-000000000006'),
('a6000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','2026-10-06','a3000000-0000-4000-8000-000000000006'),
('b6000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000001','2026-10-05','b3000000-0000-4000-8000-000000000006'),
('b6000000-0000-4000-8000-000000000003','a2000000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000001','2026-10-06','b3000000-0000-4000-8000-000000000006');
insert into public.tour_plan_stops(id,tenant_id,tour_plan_day_id,sequence_no,stop_type,chemist_id) values
('a6000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000003',1,'chemist','a5000000-0000-4000-8000-000000000001'),
('b6000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000003',1,'chemist','b5000000-0000-4000-8000-000000000001');

insert into public.tour_executions(id,tenant_id,employee_id,tour_plan_id,tour_plan_day_id,territory_id,work_date,status,operation_id,started_at,required_minutes,start_latitude,start_longitude,start_accuracy_meters)
values('a7000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000006','2026-10-05','ACTIVE','a7000000-0000-4000-8000-000000000011',clock_timestamp()-interval '60 minutes',480,17.4,78.48,10);

insert into public.tour_executions(id,tenant_id,employee_id,tour_plan_id,tour_plan_day_id,territory_id,work_date,status,operation_id,started_at,required_minutes,start_latitude,start_longitude,start_accuracy_meters,submitted_at,submit_operation_id,worked_minutes)
values('b7000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000006','2026-10-05','SUBMITTED','b7000000-0000-4000-8000-000000000011',clock_timestamp()-interval '500 minutes',480,17.41,78.49,10,clock_timestamp(),'b8000000-0000-4000-8000-000000000001',500);
insert into public.tour_executions(id,tenant_id,employee_id,tour_plan_id,tour_plan_day_id,territory_id,work_date,status,operation_id,started_at,required_minutes,start_latitude,start_longitude,start_accuracy_meters)
values('b7000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000006','2026-10-06','ACTIVE','b7000000-0000-4000-8000-000000000012',clock_timestamp()-interval '30 minutes',480,17.41,78.49,10);

insert into public.field_visits(id,tenant_id,execution_id,plan_stop_id,territory_id,status,checkin_operation_id,checkin_at,checkin_latitude,checkin_longitude,checkin_accuracy_meters,target_latitude,target_longitude,distance_meters,geofence_radius_meters,verification,exception_status)
values('b9000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000004','b3000000-0000-4000-8000-000000000006','CHECKED_IN','b9000000-0000-4000-8000-000000000011',clock_timestamp()-interval '15 minutes',17.41,78.49,10,17.41,78.49,0,100,'VERIFIED','NOT_REQUIRED');

insert into public.daily_timesheets(id,tenant_id,execution_id,employee_id,work_date,started_at,submitted_at,total_minutes,visit_minutes,unclassified_minutes,call_count,status,reviewed_at,review_operation_id)
values('b9300000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','2026-10-05',clock_timestamp()-interval '500 minutes',clock_timestamp(),500,0,500,0,'REVIEWED',clock_timestamp(),'b9300000-0000-4000-8000-000000000011');
insert into public.weekly_timesheets(id,tenant_id,employee_id,week_start,status,daily_count,total_minutes,visit_minutes,unclassified_minutes,call_count,submitted_at,reviewed_by,reviewed_at)
values('b9400000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000001','2026-10-05','APPROVED',1,500,0,500,0,clock_timestamp(),'a1000000-0000-4000-8000-000000000004',clock_timestamp());
insert into public.trade_calls(id,tenant_id,visit_id,call_type,outcome)
values('b9100000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','b9000000-0000-4000-8000-000000000001','chemist','B baseline');
insert into public.rcpa_reports(id,tenant_id,visit_id,chemist_id)
values('b9200000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','b9000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001');
insert into public.rcpa_lines(id,tenant_id,rcpa_report_id,sequence_no,product_id,prescription_count,stock_quantity,sales_quantity)
values('b9200000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','b9200000-0000-4000-8000-000000000001',1,'b5000000-0000-4000-8000-000000000002',1,0,0);

do $w3priv$
declare t text; p text;
begin
  foreach t in array array['tour_executions','daily_timesheets','weekly_timesheets','weekly_timesheet_days','weekly_timesheet_decisions','trade_calls','trade_call_operations','rcpa_reports','rcpa_lines','rcpa_operations'] loop
    foreach p in array array['INSERT','UPDATE','DELETE','TRUNCATE'] loop
      if has_table_privilege('authenticated','public.'||t,p) then raise exception 'Wave 3 security failed: authenticated has % on %',p,t; end if;
    end loop;
  end loop;
  if has_function_privilege('authenticated','public.admin_submit_tour_execution(uuid,uuid,uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_review_daily_timesheet(uuid,uuid,uuid,uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_generate_weekly_timesheet(uuid,uuid,date)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_submit_weekly_timesheet(uuid,uuid,uuid,uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_decide_weekly_timesheet(uuid,uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_save_trade_call(uuid,uuid,uuid,uuid,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_save_rcpa(uuid,uuid,uuid,uuid,jsonb)','EXECUTE')
  then raise exception 'Wave 3 security failed: authenticated can execute service mutation RPC'; end if;
end
$w3priv$;

do $w3time$
declare d uuid; w uuid; x uuid;
begin
  begin
    perform public.admin_submit_tour_execution('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001',null);
    raise exception 'TRV-SUBMIT-006 failed';
  exception when others then if position('short day reason required' in sqlerrm)=0 then raise; end if; end;

  x:=public.admin_submit_tour_execution('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001','approved short day');
  if x<>'a7000000-0000-4000-8000-000000000001'::uuid then raise exception 'TRV-SUBMIT wrong execution'; end if;
  if public.admin_submit_tour_execution('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001','approved short day')<>x then raise exception 'TRV-SUBMIT-007 replay failed'; end if;
  begin
    perform public.admin_submit_tour_execution('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001','different');
    raise exception 'TRV-SUBMIT-007 mismatch accepted';
  exception when others then if position('idempotency key reused with different submit payload' in sqlerrm)=0 then raise; end if; end;

  select id into d from public.daily_timesheets where tenant_id='a2000000-0000-4000-8000-000000000001' and execution_id=x;
  if d is null then raise exception 'TRV-DTS-001 failed'; end if;
  perform public.admin_review_daily_timesheet('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',d,'a8000000-0000-4000-8000-000000000002','reviewed');
  perform public.admin_review_daily_timesheet('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',d,'a8000000-0000-4000-8000-000000000002','reviewed');
  begin
    perform public.admin_review_daily_timesheet('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003',d,'a8000000-0000-4000-8000-000000000003',null);
    raise exception 'TRV-DTS tenant escape accepted';
  exception when others then if position('daily timesheet does not belong to user' in sqlerrm)=0 then raise; end if; end;

  w:=public.admin_generate_weekly_timesheet('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','2026-10-05');
  perform public.admin_submit_weekly_timesheet('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',w,'a8000000-0000-4000-8000-000000000004','complete');
  perform public.admin_submit_weekly_timesheet('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',w,'a8000000-0000-4000-8000-000000000004','complete');
  begin
    perform public.admin_decide_weekly_timesheet('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001',w,'APPROVE',null);
    raise exception 'TRV-WTS-006 self approval accepted';
  exception when others then if position('self approval is not allowed' in sqlerrm)=0 then raise; end if; end;
  begin
    perform public.admin_decide_weekly_timesheet('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000004',w,'APPROVE',null);
    raise exception 'TRV-WTS tenant escape accepted';
  exception when others then if position('timesheet approval permission denied' in sqlerrm)=0 then raise; end if; end;
  perform public.admin_decide_weekly_timesheet('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002',w,'APPROVE','approved');
  if (select count(*) from public.weekly_timesheet_decisions where tenant_id='a2000000-0000-4000-8000-000000000001' and weekly_timesheet_id=w)<>1 then raise exception 'TRV-WTS-007 history failed'; end if;
end
$w3time$;

insert into public.tour_executions(id,tenant_id,employee_id,tour_plan_id,tour_plan_day_id,territory_id,work_date,status,operation_id,started_at,required_minutes,start_latitude,start_longitude,start_accuracy_meters)
values('a7000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000006','2026-10-06','ACTIVE','a7000000-0000-4000-8000-000000000012',clock_timestamp()-interval '30 minutes',480,17.4,78.48,10);
insert into public.field_visits(id,tenant_id,execution_id,plan_stop_id,territory_id,status,checkin_operation_id,checkin_at,checkin_latitude,checkin_longitude,checkin_accuracy_meters,target_latitude,target_longitude,distance_meters,geofence_radius_meters,verification,exception_status)
values('a9000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000002','a6000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000006','CHECKED_IN','a9000000-0000-4000-8000-000000000011',clock_timestamp()-interval '10 minutes',17.4,78.48,10,17.4,78.48,0,100,'VERIFIED','NOT_REQUIRED');

do $w3open$
begin
  begin
    perform public.admin_submit_tour_execution('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000020','field continues');
    raise exception 'TRV-SUBMIT-003 open visit accepted';
  exception when others then if position('open visit must be checked out before submitting tour' in sqlerrm)=0 then raise; end if; end;
  begin
    update public.field_visits set status='CHECKED_OUT',checkout_at=clock_timestamp()
     where tenant_id='a2000000-0000-4000-8000-000000000001' and id='a9000000-0000-4000-8000-000000000001';
    raise exception 'TRV-TRADE-005 checkout accepted without call';
  exception when others then if position('chemist/stockist call details required before checkout' in sqlerrm)=0 then raise; end if; end;
end
$w3open$;

do $w3trade$
declare c uuid; r uuid; n integer;
begin
  c:=public.admin_save_trade_call('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000021','Order discussed','stock reviewed','follow up');
  if public.admin_save_trade_call('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000021','Order discussed','stock reviewed','follow up')<>c then raise exception 'TRV-TRADE-004 replay failed'; end if;
  begin
    perform public.admin_save_trade_call('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000021','Different',null,null);
    raise exception 'TRV-TRADE-004 mismatch accepted';
  exception when others then if position('idempotency key reused with different payload' in sqlerrm)=0 then raise; end if; end;
  begin
    perform public.admin_save_trade_call('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','b9000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000022','Cross tenant',null,null);
    raise exception 'TRV-TRADE tenant escape accepted';
  exception when others then if position('open visit not found' in sqlerrm)=0 then raise; end if; end;

  r:=public.admin_save_rcpa('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000023','[{"sequence":1,"productId":"a5000000-0000-4000-8000-000000000002","prescriptionCount":2,"stockQuantity":1,"salesQuantity":1}]'::jsonb);
  if public.admin_save_rcpa('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000023','[{"sequence":1,"productId":"a5000000-0000-4000-8000-000000000002","prescriptionCount":2,"stockQuantity":1,"salesQuantity":1}]'::jsonb)<>r then raise exception 'TRV-RCPA replay failed'; end if;
  select count(*) into n from public.rcpa_lines where tenant_id='a2000000-0000-4000-8000-000000000001' and rcpa_report_id=r;
  begin
    perform public.admin_save_rcpa('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a9000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000024','[{"sequence":1,"productId":"b5000000-0000-4000-8000-000000000002","prescriptionCount":1,"stockQuantity":0,"salesQuantity":0}]'::jsonb);
    raise exception 'TRV-RCPA foreign product accepted';
  exception when others then if position('RCPA product outside employee division' in sqlerrm)=0 then raise; end if; end;
  if (select count(*) from public.rcpa_lines where tenant_id='a2000000-0000-4000-8000-000000000001' and rcpa_report_id=r)<>n then raise exception 'TRV-RCPA rejected payload mutated report'; end if;
  begin
    perform public.admin_save_rcpa('a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','b9000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000025','[{"sequence":1,"competitorBrand":"Competitor X","prescriptionCount":1,"stockQuantity":0,"salesQuantity":0}]'::jsonb);
    raise exception 'TRV-RCPA foreign visit accepted';
  exception when others then if position('open chemist visit not found' in sqlerrm)=0 then raise; end if; end;
end
$w3trade$;

set local role authenticated;
select set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);
do $w3rls$
declare o integer; x integer;
begin
  select count(*) into o from public.daily_timesheets where tenant_id='a2000000-0000-4000-8000-000000000001'; select count(*) into x from public.daily_timesheets where tenant_id='a2000000-0000-4000-8000-000000000002'; if o<>1 or x<>0 then raise exception 'TRV-DTS RLS failed own=% foreign=%',o,x; end if;
  select count(*) into o from public.weekly_timesheets where tenant_id='a2000000-0000-4000-8000-000000000001'; select count(*) into x from public.weekly_timesheets where tenant_id='a2000000-0000-4000-8000-000000000002'; if o<>1 or x<>0 then raise exception 'TRV-WTS RLS failed own=% foreign=%',o,x; end if;
  select count(*) into o from public.trade_calls where tenant_id='a2000000-0000-4000-8000-000000000001'; select count(*) into x from public.trade_calls where tenant_id='a2000000-0000-4000-8000-000000000002'; if o<>1 or x<>0 then raise exception 'TRV-TRADE RLS failed own=% foreign=%',o,x; end if;
  select count(*) into o from public.rcpa_reports where tenant_id='a2000000-0000-4000-8000-000000000001'; select count(*) into x from public.rcpa_reports where tenant_id='a2000000-0000-4000-8000-000000000002'; if o<>1 or x<>0 then raise exception 'TRV-RCPA RLS failed own=% foreign=%',o,x; end if;
  select count(*) into o from public.rcpa_lines where tenant_id='a2000000-0000-4000-8000-000000000001'; select count(*) into x from public.rcpa_lines where tenant_id='a2000000-0000-4000-8000-000000000002'; if o<>1 or x<>0 then raise exception 'TRV-RCPA line RLS failed own=% foreign=%',o,x; end if;
end
$w3rls$;
reset role;

rollback;
