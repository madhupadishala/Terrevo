export class CsvImportError extends Error {}

const NUMERIC_FIELDS=new Set(["latitude","longitude","visit_frequency"]);
export function parseMasterCsv(input:string):Array<Record<string,unknown>>{
  if(typeof input!=="string"||!input.trim())throw new CsvImportError("CSV content is required");
  if(input.length>131072)throw new CsvImportError("CSV exceeds 128 KiB");
  const rows:string[][]=[];let row:string[]=[],field="",quoted=false;
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(quoted){
      if(ch==='"'&&input[i+1]==='"'){field+='"';i++;continue;}
      if(ch==='"'){quoted=false;continue;}
      field+=ch;continue;
    }
    if(ch==='"'){if(field.length)throw new CsvImportError("Quote must start a field");quoted=true;continue;}
    if(ch===","){row.push(field);field="";continue;}
    if(ch==="\n"||ch==="\r"){
      if(ch==="\r"&&input[i+1]==="\n")i++;
      row.push(field);field="";
      if(row.some(v=>v.trim()!==""))rows.push(row);
      row=[];continue;
    }
    field+=ch;
  }
  if(quoted)throw new CsvImportError("Unterminated quoted field");
  row.push(field);if(row.some(v=>v.trim()!==""))rows.push(row);
  if(rows.length<2)throw new CsvImportError("CSV needs a header and at least one data row");
  const headers=rows[0].map(v=>v.trim());
  if(headers.some(v=>!v))throw new CsvImportError("CSV headers cannot be blank");
  if(new Set(headers).size!==headers.length)throw new CsvImportError("CSV headers must be unique");
  const data=rows.slice(1);
  if(data.length>200)throw new CsvImportError("Import is limited to 200 rows");
  return data.map((values,index)=>{
    if(values.length!==headers.length)throw new CsvImportError(`Row ${index+2} has ${values.length} fields; expected ${headers.length}`);
    return Object.fromEntries(headers.map((header,column)=>{
      const raw=values[column].trim();
      if(!raw)return [header,null];
      if(NUMERIC_FIELDS.has(header)){
        const n=Number(raw);if(!Number.isFinite(n))throw new CsvImportError(`Row ${index+2}: ${header} must be numeric`);
        return [header,n];
      }
      return [header,raw];
    }));
  });
}
