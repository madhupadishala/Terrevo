export type VisitType = "DOCTOR" | "CHEMIST" | "STOCKIST";
export type TourStatus = "ACTIVE" | "SUBMITTED";
export type VisitStatus = "CHECKED_IN" | "CHECKED_OUT";

export type Tour = {
  id: string;
  territory: string;
  startAt: string;
  submittedAt: string | null;
  status: TourStatus;
};
export type Visit = {
  id: string;
  tourId: string;
  account: string;
  type: VisitType;
  status: VisitStatus;
  checkinAt: string;
  checkoutAt: string | null;
  notes: string;
};
export type Workspace = { version: 1; tours: Tour[]; visits: Visit[] };
export const STORAGE_KEY = "terrevo.local-workspace.v1";
export const emptyWorkspace = (): Workspace => ({ version: 1, tours: [], visits: [] });

function requireCondition(ok: boolean, message: string): void {
  if (!ok) throw new Error(message);
}

export function activeTour(workspace: Workspace): Tour | undefined {
  return workspace.tours.find((tour) => tour.status === "ACTIVE");
}

export function openVisit(workspace: Workspace): Visit | undefined {
  return workspace.visits.find((visit) => visit.status === "CHECKED_IN");
}

export function startTour(workspace: Workspace, territory: string, id: string, now: string): Workspace {
  requireCondition(!activeTour(workspace), "Submit the active tour before starting another.");
  requireCondition(territory.trim().length >= 2, "Enter a territory of at least two characters.");
  requireCondition(!workspace.tours.some((tour) => tour.id === id), "Operation already exists.");
  return {
    ...workspace,
    tours: [{ id, territory: territory.trim().slice(0, 100), startAt: now, submittedAt: null, status: "ACTIVE" }, ...workspace.tours],
  };
}

export function checkIn(
  workspace: Workspace,
  account: string,
  type: VisitType,
  id: string,
  now: string,
): Workspace {
  const tour = activeTour(workspace);
  requireCondition(Boolean(tour), "Start a tour before checking in.");
  requireCondition(!openVisit(workspace), "Check out of the current visit first.");
  requireCondition(account.trim().length >= 2, "Enter an account name of at least two characters.");
  requireCondition(["DOCTOR", "CHEMIST", "STOCKIST"].includes(type), "Choose a valid visit type.");
  requireCondition(!workspace.visits.some((visit) => visit.id === id), "Operation already exists.");
  return {
    ...workspace,
    visits: [{
      id, tourId: tour!.id, account: account.trim().slice(0, 160),
      type, status: "CHECKED_IN", checkinAt: now, checkoutAt: null, notes: "",
    }, ...workspace.visits],
  };
}

export function saveNotes(workspace: Workspace, visitId: string, notes: string): Workspace {
  requireCondition(workspace.visits.some((visit) => visit.id === visitId), "Visit not found.");
  requireCondition(notes.length <= 2000, "Notes are limited to 2,000 characters.");
  return { ...workspace, visits: workspace.visits.map((visit) => visit.id === visitId ? { ...visit, notes } : visit) };
}

export function checkOut(workspace: Workspace, visitId: string, now: string): Workspace {
  const visit = workspace.visits.find((row) => row.id === visitId);
  requireCondition(Boolean(visit) && visit!.status === "CHECKED_IN", "An open visit is required.");
  return {
    ...workspace,
    visits: workspace.visits.map((row) => row.id === visitId ? { ...row, status: "CHECKED_OUT", checkoutAt: now } : row),
  };
}

export function submitTour(workspace: Workspace, now: string): Workspace {
  const active = activeTour(workspace);
  requireCondition(Boolean(active), "No active tour to submit.");
  requireCondition(!openVisit(workspace), "Check out of the active visit before submitting the tour.");
  return {
    ...workspace,
    tours: workspace.tours.map((tour) =>
      tour.id === active!.id ? { ...tour, status: "SUBMITTED", submittedAt: now } : tour),
  };
}

export function readWorkspace(storage: Pick<Storage, "getItem">): Workspace {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyWorkspace();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyWorkspace();
    const data = parsed as Partial<Workspace>;
    if (data.version !== 1 || !Array.isArray(data.tours) || !Array.isArray(data.visits)) return emptyWorkspace();
    if (!data.tours.every(t => t && typeof t.id === "string" && typeof t.territory === "string" && ["ACTIVE", "SUBMITTED"].includes(t.status))) return emptyWorkspace();
    if (!data.visits.every(v => v && typeof v.id === "string" && typeof v.account === "string" && ["CHECKED_IN", "CHECKED_OUT"].includes(v.status))) return emptyWorkspace();
    return data as Workspace;
  } catch {
    return emptyWorkspace();
  }
}
