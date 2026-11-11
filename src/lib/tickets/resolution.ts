export const RESOLUTION_FIELDS = [
  ["requestTypeId", "Request type"], ["topicId", "Topic"], ["trackerCauseId", "Cause"],
  ["trackerActionId", "Action"], ["outcomeId", "Outcome"], ["resolutionNotes", "Technical Support response"],
] as const;
export type ResolutionField = typeof RESOLUTION_FIELDS[number][0];
export function resolutionReadiness(values: Record<ResolutionField, string>) {
  return RESOLUTION_FIELDS.map(([key, label]) => ({ key, label, ready: key === "resolutionNotes" ? values[key].trim().length >= 5 : /^[1-9]\d*$/.test(values[key]) }));
}
