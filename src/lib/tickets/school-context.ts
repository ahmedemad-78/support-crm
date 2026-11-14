export const SCHOOL_ISSUE_AREAS = [
  {value:"access",label:"Login / platform activation"},
  {value:"entry",label:"Missing Selah El Telmeez / external resources"},
  {value:"grade",label:"Wrong grade / outdated school data"},
  {value:"content",label:"Content / locked lessons"},
  {value:"assessment",label:"Homework / assessments / tests"},
  {value:"other",label:"Other / not confirmed"},
] as const;
export const SCHOOL_IMPACTS = [
  {value:"one",label:"One account"},{value:"several",label:"Several accounts"},
  {value:"school",label:"Whole school"},{value:"unknown",label:"Not confirmed"},
] as const;
export const SCHOOL_CONTEXT_KEYS = ["school_code","school_user_ids","school_issue_area","school_impact","school_expected_grade","school_shown_grade","school_subject","school_section"] as const;
export type SchoolContextKey = typeof SCHOOL_CONTEXT_KEYS[number];
export const SCHOOL_CONTEXT_LABELS:Record<SchoolContextKey,string> = {
  school_code:"School code",school_user_ids:"MySchool user IDs",school_issue_area:"School issue area",school_impact:"Affected accounts",
  school_expected_grade:"Expected grade",school_shown_grade:"Grade currently shown",school_subject:"Subject / lesson",school_section:"School section / track",
};
export function schoolContextEntries(value:unknown):[string,string][] {
  if(!value||typeof value!=="object"||Array.isArray(value))return [];
  const record=value as Record<string,unknown>;
  return SCHOOL_CONTEXT_KEYS.flatMap(key=>{
    const raw=record[key];if(typeof raw!=="string"||!raw.trim())return [];
    const label=key==="school_issue_area"?SCHOOL_ISSUE_AREAS.find(item=>item.value===raw)?.label:key==="school_impact"?SCHOOL_IMPACTS.find(item=>item.value===raw)?.label:undefined;
    return [[SCHOOL_CONTEXT_LABELS[key],label||raw]];
  });
}
/** Keep school facts structured, and discard hidden values for other sources. */
export function intakeRecord<T extends object>(input:T,source:string) {
  const data={...input} as Record<string,unknown>;const context:Record<string,string>={};
  for(const key of SCHOOL_CONTEXT_KEYS){const value=data[key];if(source==="june_schools"&&typeof value==="string"&&value.trim())context[key]=value.trim();delete data[key];}
  if(context.school_issue_area!=="grade")delete context.school_shown_grade;
  if(!["content","assessment"].includes(context.school_issue_area))delete context.school_subject;
  if(!["grade","content","assessment"].includes(context.school_issue_area))delete context.school_expected_grade;
  return {...data,school_context:Object.keys(context).length?context:null};
}
