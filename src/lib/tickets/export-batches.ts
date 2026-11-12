/** Read through API row caps without confusing a short batch with the final page. */
export async function collectExportRows<T>(readBatch:(offset:number)=>Promise<{data:T[];count:number|null}>) {
  const rows:T[]=[];
  for(let offset=0; ; ) {
    const batch=await readBatch(offset);
    if(!batch.data.length) break;
    rows.push(...batch.data);
    offset+=batch.data.length;
    if(batch.count!==null&&offset>=batch.count) break;
  }
  return rows;
}
