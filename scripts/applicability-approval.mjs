const nonempty = value => typeof value === "string" && value.trim().length > 0;
const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const validEvidenceList = value => Array.isArray(value) && value.length > 0 && value.every(nonempty);

export function validateApplicabilityApproval(applicability, checkId = "check") {
  const failures = [];
  if (!isRecord(applicability)) return [`${checkId} NOT_APPLICABLE requires an applicability record`];
  if (!nonempty(applicability.reviewer)) failures.push(`${checkId} NOT_APPLICABLE requires reviewer`);
  if (!nonempty(applicability.rationale)) failures.push(`${checkId} NOT_APPLICABLE requires rationale`);
  const approval = applicability.approval;
  if (!isRecord(approval)) {
    failures.push(`${checkId} NOT_APPLICABLE requires explicit reviewer approval`);
    return failures;
  }
  if (approval.status !== "APPROVED") failures.push(`${checkId} applicability approval status must be APPROVED`);
  if (!nonempty(approval.approvedBy) || approval.approvedBy !== applicability.reviewer) failures.push(`${checkId} applicability approval must be issued by the named reviewer`);
  if (!nonempty(approval.approvedAt) || Number.isNaN(Date.parse(approval.approvedAt))) failures.push(`${checkId} applicability approval requires a valid approvedAt timestamp`);
  if (!validEvidenceList(approval.evidence)) failures.push(`${checkId} applicability approval requires nonempty evidence`);
  return failures;
}
