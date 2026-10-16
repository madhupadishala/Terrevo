import { useState } from "react";
import { Button, TextInput } from "@carbon/react";
import type { Master, OrgUnit } from "./terrevo-api";

type Props = {
  kind:string; units:OrgUnit[]; products:Master[];
  disabled:boolean; perform:(payload:Record<string,unknown>)=>Promise<void>;
};
export function MasterEditor({kind,units,products,disabled,perform}:Props){
  const [code,setCode]=useState(""); const [name,setName]=useState("");
  const [scope,setScope]=useState(""); const [specialty,setSpecialty]=useState("");
  const [designation,setDesignation]=useState(""); const [productId,setProductId]=useState("");
  const [address,setAddress]=useState(""); const [genericName,setGenericName]=useState("");
  const [category,setCategory]=useState("");const [unit,setUnit]=useState("");
  const [latitude,setLatitude]=useState("");const [longitude,setLongitude]=useState("");
  const [visitFrequency,setVisitFrequency]=useState(1);
  const requiredScope=kind==="employees" ? "" : ["products","samples","gifts"].includes(kind)?"division":"territory";
  const scoped=units.filter(u=>u.status==="active"&&(!requiredScope||u.type===requiredScope));
  const location=()=>({
    latitude:latitude.trim()?Number(latitude):null,
    longitude:longitude.trim()?Number(longitude):null,
  });
  function payload():Record<string,unknown>{
    const base:Record<string,unknown>={code:code.trim().toUpperCase(),name:name.trim()};
    if(kind==="employees")return {...base,orgUnitId:scope,designation:designation.trim(),userId:null,reportingManagerEmployeeId:null};
    if(kind==="products")return {...base,divisionId:scope,genericName:genericName.trim()||null};
    if(kind==="samples")return {...base,divisionId:scope,productId,unit:unit.trim()||null};
    if(kind==="gifts")return {...base,divisionId:scope,category:category.trim()||null};
    if(kind==="doctors")return {...base,territoryId:scope,specialty:specialty.trim(),category:category.trim()||null,clinic:null,address:address.trim()||null,...location(),visitFrequency};
    return {...base,territoryId:scope,address:address.trim()||null,...location()};
  }
  const canSave=!disabled&&Boolean(code.trim()&&name.trim()&&scope)&&
    (kind!=="employees"||Boolean(designation.trim()))&&
    (kind!=="doctors"||Boolean(specialty.trim()))&&
    (kind!=="samples"||Boolean(productId))&&
    (!latitude.trim()||(Number.isFinite(Number(latitude))&&Math.abs(Number(latitude))<=90))&&
    (!longitude.trim()||(Number.isFinite(Number(longitude))&&Math.abs(Number(longitude))<=180));
  return <div className="tr-master-editor"><h3>Create {kind.slice(0,-1)||kind} master record</h3>
    <p className="tr-detail">Each record is validated, persisted and scope-checked by the existing Terrevo master API.</p>
    <div className="tr-form">
      <TextInput id="master-code" labelText="Unique code" value={code} maxLength={50} onChange={e=>setCode(e.target.value)}/>
      <TextInput id="master-name" labelText="Display name" value={name} maxLength={160} onChange={e=>setName(e.target.value)}/>
      <label className="tr-select-label" htmlFor="master-scope">{kind==="employees"?"Organization unit":requiredScope+" scope"}</label>
      <select className="tr-select" id="master-scope" value={scope} onChange={e=>setScope(e.target.value)}>
        <option value="">Select authorized scope</option>{scoped.map(u=><option key={u.id} value={u.id}>{u.name} ({u.type})</option>)}
      </select>
      {kind==="employees"&&<TextInput id="master-designation" labelText="Designation" value={designation} onChange={e=>setDesignation(e.target.value)}/>}
      {kind==="doctors"&&<><TextInput id="master-specialty" labelText="Medical specialty" value={specialty} onChange={e=>setSpecialty(e.target.value)}/><TextInput id="master-category" labelText="Category (optional)" value={category} onChange={e=>setCategory(e.target.value)}/></>}
      {kind==="products"&&<TextInput id="master-generic" labelText="Generic ingredient (optional)" value={genericName} onChange={e=>setGenericName(e.target.value)}/>}
      {kind==="samples"&&<><label className="tr-select-label" htmlFor="master-product">Related product</label>
        <select className="tr-select" id="master-product" value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Select product</option>
          {products.filter(p=>p.status==="active").map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <TextInput id="master-unit" labelText="Unit (optional)" value={unit} onChange={e=>setUnit(e.target.value)}/></>}
      {kind==="gifts"&&<TextInput id="master-gift-category" labelText="Gift category (optional)" value={category} onChange={e=>setCategory(e.target.value)}/>}
      {["doctors","chemists","stockists"].includes(kind)&&<><TextInput id="master-address" labelText="Address (optional)" value={address} onChange={e=>setAddress(e.target.value)} maxLength={500}/>
        <div className="tr-form-three"><TextInput id="master-latitude" labelText="Latitude" value={latitude} onChange={e=>setLatitude(e.target.value)}/><TextInput id="master-longitude" labelText="Longitude" value={longitude} onChange={e=>setLongitude(e.target.value)}/></div></>}
      {kind==="doctors"&&<TextInput id="master-frequency" type="number" labelText="Monthly visit frequency" value={String(visitFrequency)} onChange={e=>setVisitFrequency(Number(e.target.value))}/>}
      <Button disabled={!canSave} onClick={()=>void perform(payload())}>Create {kind.slice(0,-1)||kind}</Button>
    </div>
  </div>;
}
