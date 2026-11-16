/** 30 June schools that have reported cases so far. Other schools are typed in by hand. */
export const JUNE_SCHOOLS = [
  {code:"11",name:"قباء الخاصة (دمنهور)",city:"Beheira"},
  {code:"15",name:"الأمين الخاصة",city:"Beheira"},
  {code:"23",name:"فضل الخاصة (الهرم)",city:"Giza"},
  {code:"35",name:"المصرية الإنجليزية",city:"Sharqia"},
  {code:"39",name:"الفردوس الخاصة",city:"Gharbia"},
  {code:"44",name:"الجيل المسلم بالسنطة",city:"Gharbia"},
  {code:"45",name:"الجيل المسلم الخاصة (كفر الزيات)",city:"Gharbia"},
  {code:"52",name:"التقوى الإسلامية الابتدائية الخاصة بالفيوم",city:"Faiyum"},
  {code:"79",name:"المساعي الخاصة العبور",city:"Qalyubia"},
  {code:"110",name:"روضة الدعوة الإسلامية بني سويف",city:"Beni Suef"},
] as const;
export const SCHOOL_ISSUE_AREAS = [
  {value:"subscription",label:"No active subscription"},
  {value:"access",label:"Cannot log in / not activated"},
  {value:"classes",label:"Classes missing or duplicated"},
  {value:"grade",label:"Grade not promoted"},
  {value:"content",label:"Subject or questions missing"},
  {value:"other",label:"Other"},
] as const;
export const SCHOOL_UPDATE_REQUESTED = [
  {value:"yes",label:"Yes"},{value:"no",label:"No"},{value:"unknown",label:"Not sure"},
] as const;
export const SCHOOL_CONTEXT_KEYS = ["school_code","school_user_ids","school_issue_area","school_update_requested"] as const;
export type SchoolContextKey = typeof SCHOOL_CONTEXT_KEYS[number];
export const SCHOOL_CONTEXT_LABELS:Record<SchoolContextKey,string> = {
  school_code:"School code",school_user_ids:"Affected user IDs",school_issue_area:"Issue type",school_update_requested:"MySchool update already requested?",
};
const VALUE_LABELS:Partial<Record<SchoolContextKey,readonly {value:string;label:string}[]>> = {school_issue_area:SCHOOL_ISSUE_AREAS,school_update_requested:SCHOOL_UPDATE_REQUESTED};
export function schoolContextEntries(value:unknown):[string,string][] {
  if(!value||typeof value!=="object"||Array.isArray(value))return [];
  const record=value as Record<string,unknown>;
  return SCHOOL_CONTEXT_KEYS.flatMap(key=>{
    const raw=record[key];if(typeof raw!=="string"||!raw.trim())return [];
    return [[SCHOOL_CONTEXT_LABELS[key],VALUE_LABELS[key]?.find(item=>item.value===raw)?.label||raw]];
  });
}
/** Keep school facts structured, and discard hidden values for other sources. */
export function intakeRecord<T extends object>(input:T,source:string) {
  const data={...input} as Record<string,unknown>;const context:Record<string,string>={};
  for(const key of SCHOOL_CONTEXT_KEYS){const value=data[key];if(source==="june_schools"&&typeof value==="string"&&value.trim())context[key]=value.trim();delete data[key];}
  return {...data,school_context:Object.keys(context).length?context:null};
}
/**
 * The 30 June form asks only about the school and the problem. The customer is the
 * school itself, and app-version and Fawry questions do not apply to MySchool accounts.
 */
export function juneIntakeDraft<T extends Record<string,string>>(draft:T,source:string):T {
  if(source!=="june_schools")return draft;
  return {...draft,customer_name:(draft.school_name||"").trim(),is_latest_version:"unknown",fawry_payment:"no"};
}
