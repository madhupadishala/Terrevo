// Generates isolated synthetic business fixtures for supported Auth identities.
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
const path=process.argv[2];if(!path)throw Error('Private identity manifest required');
const manifest=JSON.parse(fs.readFileSync(path,'utf8'));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
for(const role of ['MR','MANAGER','TENANT_ADMIN','FOREIGN_MR'])if(!uuid.test(manifest.users.find(u=>u.role===role)?.id??''))throw Error('Supported Auth identity missing');
const ids=Object.fromEntries(['tenant','foreignTenant','company','division','zone','region','area','territory','foreignCompany','foreignDivision','foreignZone','foreignRegion','foreignArea','foreignTerritory','mrEmployee','managerEmployee','doctor','unplannedDoctor','chemist','product'].map(k=>[k,randomUUID()]));
manifest.fixture=ids;fs.writeFileSync(path,JSON.stringify(manifest),{mode:0o600});
const user=role=>manifest.users.find(u=>u.role===role).id;
const q=value=>"'"+value.replaceAll("'","''")+"'";
const sql=['begin;'];
sql.push(`do $$begin if not exists(select 1 from auth.users where id=${q(user('MR'))} and raw_app_meta_data->>'qualification_run'=${q(manifest.runId)}) then raise exception 'Supported qualification identity required';end if;end;$$;`);
sql.push(`insert into public.tenants(id,name,slug,time_zone) values (${q(ids.tenant)},'Synthetic Engineering Qualification',${q(manifest.runId)},'Asia/Kolkata'),(${q(ids.foreignTenant)},'Synthetic Foreign Qualification',${q(manifest.runId+'-foreign')},'Asia/Kolkata');`);
sql.push(`insert into public.tenant_memberships(tenant_id,user_id) values ${['MR','MANAGER','TENANT_ADMIN'].map(r=>`(${q(ids.tenant)},${q(user(r))})`).join(',')},(${q(ids.foreignTenant)},${q(user('FOREIGN_MR'))});`);
for(const prefix of ['','foreign']){
 const tenant=prefix?ids.foreignTenant:ids.tenant;let parent=null;
 for(const [index,type]of ['company','division','zone','region','area','territory'].entries()){
  const id=ids[prefix?prefix+type[0].toUpperCase()+type.slice(1):type];
  sql.push(`insert into public.organization_units(id,tenant_id,parent_id,type,code,name) values (${q(id)},${q(tenant)},${parent?q(parent):'null'},${q(type)},${q('QUAL'+index)},${q('Synthetic Qualification '+type)});`);parent=id;
 }
}
sql.push(`insert into public.user_role_assignments(tenant_id,user_id,role_key,scope_org_unit_id) values (${q(ids.tenant)},${q(user('MR'))},'MR',${q(ids.territory)}),(${q(ids.tenant)},${q(user('MANAGER'))},'MANAGER',${q(ids.territory)}),(${q(ids.tenant)},${q(user('TENANT_ADMIN'))},'TENANT_ADMIN',null),(${q(ids.foreignTenant)},${q(user('FOREIGN_MR'))},'MR',${q(ids.foreignTerritory)});`);
sql.push(`insert into public.user_org_assignments(tenant_id,user_id,org_unit_id) values ${['MR','MANAGER','TENANT_ADMIN'].map(r=>`(${q(ids.tenant)},${q(user(r))},${q(ids.territory)})`).join(',')},(${q(ids.foreignTenant)},${q(user('FOREIGN_MR'))},${q(ids.foreignTerritory)});`);
sql.push(`insert into public.employees(id,tenant_id,user_id,code,name,designation,org_unit_id) values (${q(ids.managerEmployee)},${q(ids.tenant)},${q(user('MANAGER'))},'QUALMANAGER','Synthetic Qualification Manager','Manager',${q(ids.territory)}),(${q(ids.mrEmployee)},${q(ids.tenant)},${q(user('MR'))},'QUALMR','Synthetic Qualification MR','MR',${q(ids.territory)});`);
sql.push(`update public.employees set reporting_manager_employee_id=${q(ids.managerEmployee)} where id=${q(ids.mrEmployee)};`);
sql.push(`insert into public.doctors(id,tenant_id,code,name,specialty,territory_id,latitude,longitude) values (${q(ids.doctor)},${q(ids.tenant)},'QUALDOCTOR','Synthetic Planned Qualification Doctor','Test',${q(ids.territory)},17.385,78.487),(${q(ids.unplannedDoctor)},${q(ids.tenant)},'QUALUNPLANNED','Synthetic Unplanned Qualification Doctor','Test',${q(ids.territory)},17.385,78.487);`);
sql.push(`insert into public.chemists(id,tenant_id,code,name,territory_id) values (${q(ids.chemist)},${q(ids.tenant)},'QUALCHEMIST','Synthetic Qualification Chemist',${q(ids.territory)});`);
sql.push(`insert into public.products(id,tenant_id,code,name,division_id) values (${q(ids.product)},${q(ids.tenant)},'QUALPRODUCT','Synthetic Qualification Product',${q(ids.division)});`);
sql.push(`insert into public.business_customer_link_grants(tenant_id,user_id,territory_id) values (${q(ids.tenant)},${q(user('MR'))},${q(ids.territory)});`);
sql.push(`insert into public.business_customer_links(tenant_id,source_id,target_id,territory_id,relation,approval,evidence_id,verified_at) values (${q(ids.tenant)},${q(ids.doctor)},${q(ids.chemist)},${q(ids.territory)},'QUALIFICATION_ONLY','APPROVED',${q(manifest.runId)},now());`);
sql.push('commit;');console.log(sql.join('\n'));
