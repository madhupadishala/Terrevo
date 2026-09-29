export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string | null };
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "inactive";
};

export type TourStop = {
  planStopId: string;
  sequence: number;
  type: "doctor" | "chemist" | "stockist";
  targetId: string;
  targetName: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
};

export type TourProgress = {
  executionId: string;
  workDate: string;
  territoryId: string;
  startedAt: string;
  serverNow: string;
  requiredMinutes: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  plannedCount: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  stops: TourStop[];
};

export type StartTourOption = {
  planId: string;
  planDayId: string;
  workDate: string;
  territoryId: string;
};

export type Visit = {
  id: string;
  executionId: string;
  planStopId: string;
  territoryId: string;
  status: "CHECKED_IN" | "CHECKED_OUT";
  verification: "VERIFIED" | "OUTSIDE_GEOFENCE" | "LOW_ACCURACY" | "NO_TARGET_COORDINATES";
  exceptionStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
  distanceMeters: number | null;
  geofenceRadiusMeters: number;
  checkinAt: string;
  checkoutAt: string | null;
};

export type FieldMasterKind = "products" | "samples" | "gifts";

export type MasterItem = {
  id: string;
  code: string;
  name: string;
  status: "active" | "inactive";
};

export type DoctorCallProductInput = {
  sequence: number;
  productId: string;
  detailNotes: string | null;
};

export type DoctorCall = {
  id: string;
  visitId: string;
  doctorId: string;
  callOutcome: string;
  remarks: string | null;
  nextAction: string | null;
  products: DoctorCallProductInput[];
  updatedAt: string;
};

export type InventoryItemType = "sample" | "gift";

export type InventoryBalance = {
  id: string;
  employeeId: string;
  itemType: InventoryItemType;
  itemId: string;
  quantity: number;
};

export type DistributionLine = {
  itemType: InventoryItemType;
  itemId: string;
  quantity: number;
};

export type VisitDistribution = DistributionLine & {
  id: string;
  visitId: string;
  createdAt: string;
};

export type SubmitTourResult = {
  id: string;
  status: "SUBMITTED";
  startedAt: string;
  submittedAt: string;
  requiredMinutes: number;
  workedMinutes: number;
  shortDayReason: string | null;
};


export type DailyTimesheet = {
  id: string;
  executionId: string;
  workDate: string;
  startedAt: string;
  submittedAt: string;
  totalMinutes: number;
  visitMinutes: number;
  unclassifiedMinutes: number;
  callCount: number;
  status: "GENERATED" | "REVIEWED";
  remarks: string | null;
  reviewedAt: string | null;
};

export type WeeklyTimesheet = {
  id: string;
  employeeId: string;
  orgUnitId: string;
  weekStart: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED";
  dailyCount: number;
  totalMinutes: number;
  visitMinutes: number;
  unclassifiedMinutes: number;
  callCount: number;
  submissionComment: string | null;
  submittedAt: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
};
