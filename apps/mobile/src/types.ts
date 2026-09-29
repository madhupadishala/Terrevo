import type { PresencePoint } from "./presence";

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

export type CheckInInput = PresencePoint & {
  operationId: string;
  planStopId: string;
  exceptionReason: string | null;
};

export type CheckOutInput = PresencePoint & {
  operationId: string;
};
