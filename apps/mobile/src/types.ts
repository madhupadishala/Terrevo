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

export type TradeCall = {
  id: string;
  visitId: string;
  callType: "chemist" | "stockist";
  outcome: string;
  remarks: string | null;
  nextAction: string | null;
  updatedAt: string;
};

export type RcpaLine = {
  sequence: number;
  productId: string | null;
  competitorBrand: string | null;
  prescriptionCount: number;
  stockQuantity: number;
  salesQuantity: number;
};

export type RcpaReport = {
  id: string;
  visitId: string;
  chemistId: string;
  lines: RcpaLine[];
  updatedAt: string;
};

export type OrderLine = {
  sequence: number;
  productId: string;
  quantity: number;
  remarks: string | null;
};

export type SalesOrder = {
  id: string;
  visitId: string;
  customerType: "chemist" | "stockist";
  customerId: string;
  customerCode: string;
  customerName: string;
  status: "BOOKED";
  lines: Array<OrderLine & { productCode: string; productName: string }>;
  updatedAt: string;
};

export type AttendanceRow = {
  workDate: string;
  status: "WORKING" | "PRESENT" | "SHORT_DAY" | "LEAVE" | "HALF_DAY_LEAVE";
  workedMinutes: number | null;
  requiredMinutes: number | null;
  shortDayReason: string | null;
  leaveRequestId: string | null;
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  orgUnitId: string;
  leaveType: "FULL_DAY" | "HALF_DAY";
  startDate: string;
  endDate: string;
  reason: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
  managerComment: string | null;
  reviewedAt: string | null;
};

export type ExpenseCategory = "TRAVEL" | "MEAL" | "LODGING" | "LOCAL_CONVEYANCE" | "OTHER";

export type ExpenseLine = {
  sequence: number;
  category: ExpenseCategory;
  amount: number;
  remarks: string | null;
  receiptReference: string | null;
};

export type ExpenseClaim = {
  id: string;
  executionId: string;
  employeeId: string;
  orgUnitId: string;
  workDate: string;
  currencyCode: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "RETURNED";
  totalAmount: number;
  submissionComment: string | null;
  reviewComment: string | null;
  lines: ExpenseLine[];
};

export type JointWork = {
  id: string;
  targetEmployeeId: string;
  targetOrgUnitId: string;
  participantEmployeeId: string;
  workDate: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  executionId: string | null;
  joinedAt: string | null;
  leftAt: string | null;
  selfRole: "TARGET" | "PARTICIPANT" | null;
};

export type AccessContext = {
  roles: Array<{ roleKey: "TENANT_ADMIN" | "MANAGER" | "MR"; scopeOrgUnitId: string | null }>;
  permissions: string[];
  orgAssignments: Array<{ orgUnitId: string; isPrimary: boolean }>;
};

export type ManagerCommandCenter = {
  serverNow: string;
  localDate: string;
  teamMembers: number;
  activeTours: number;
  submittedToursToday: number;
  shortDaysToday: number;
  activeJointWork: number;
  pending: {
    tourApprovals: number;
    gpsExceptions: number;
    weeklyTimesheets: number;
    leaves: number;
    expenses: number;
  };
  queues: {
    tourApprovals: Array<{ id: string; employeeId: string; weekStart: string }>;
    gpsExceptions: Array<{ id: string; employeeId: string; workDate: string }>;
    weeklyTimesheets: Array<{ id: string; employeeId: string; weekStart: string }>;
    leaves: Array<{ id: string; employeeId: string; startDate: string; endDate: string }>;
    expenses: Array<{ id: string; employeeId: string; workDate: string; totalAmount: number; currencyCode: string }>;
  };
};

export type ManagerAnalytics = {
  generatedAt: string;
  localDate: string;
  period: { days: number; startDate: string; endDate: string };
  teamMembers: number;
  tours: { submitted: number; shortDays: number; totalWorkedMinutes: number; averageWorkedMinutes: number };
  coverage: {
    plannedStops: number;
    completedVisits: number;
    coveragePercent: number;
    doctorCalls: number;
    uniqueDoctorsCovered: number;
    chemistCalls: number;
    stockistCalls: number;
    callsPerSubmittedTour: number;
  };
  orders: { count: number; units: number };
  rcpa: { reports: number; prescriptionCount: number; stockQuantity: number; salesQuantity: number };
  attendance: {
    presentDays: number;
    shortDays: number;
    approvedFullDayLeaveDays: number;
    approvedHalfDayLeaveDays: number;
  };
  expenses: Array<{ currencyCode: string; claimCount: number; totalAmount: number }>;
};
