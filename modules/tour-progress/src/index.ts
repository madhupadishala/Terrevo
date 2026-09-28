export type TourProgressStop = {
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
  stops: TourProgressStop[];
};

export type TourProgressRepository = {
  getCurrent(tenantId: string, accessToken: string): Promise<TourProgress | null>;
};

export function createTourProgressService(repository: TourProgressRepository) {
  return {
    getCurrent(tenantId: string, accessToken: string) {
      return repository.getCurrent(tenantId, accessToken);
    },
  };
}
