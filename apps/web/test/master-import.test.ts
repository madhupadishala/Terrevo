import assert from "node:assert/strict";
import test from "node:test";
import {CsvImportError,parseMasterCsv} from "../src/master-import.ts";

test("controlled CSV parser handles quoted commas and numeric fields",()=>{
 const rows=parseMasterCsv('code,name,specialty,territory_id,visit_frequency\nD1,"Doctor, One",Cardiology,11111111-1111-4111-8111-111111111111,3\n');
 assert.equal(rows.length,1);assert.equal(rows[0].name,"Doctor, One");assert.equal(rows[0].visit_frequency,3);
});

test("controlled CSV parser handles embedded newlines and escaped quotes",()=>{
 const rows=parseMasterCsv('code,name,address,territory_id\nC1,Chemist,"Line 1\n\"Suite\" 2",11111111-1111-4111-8111-111111111111');
 assert.equal(rows[0].address,'Line 1\n"Suite" 2');
});

test("controlled CSV parser rejects malformed and oversized batches",()=>{
 assert.throws(()=>parseMasterCsv("code,name\nA"),/fields/);
 assert.throws(()=>parseMasterCsv('code,name\n"A,B'),CsvImportError);
 const rows=["code,name",...Array.from({length:201},(_,i)=>"C"+i+",Name")].join("\n");
 assert.throws(()=>parseMasterCsv(rows),/200 rows/);
});
