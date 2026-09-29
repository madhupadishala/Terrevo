export class AnalyticsInputError extends Error {}

export type ManagerAnalytics = {
  generatedAt: string;
  localDate: string;
  period: { days: number; startDate: string; endDate: string };
  teamMembers: number;
  tours: {
    submitted: number;
    shortDays: number;
    totalWorkedMinutes: number;
    averageWorkedMinutes: number;
  };
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
  rcpa: {
    reports: number;
    prescriptionCount: number;
    stockQuantity: number;
    salesQuantity: number;
  };
  attendance: {
    presentDays: number;
    shortDays: number;
    approvedFullDayLeaveDays: number;
    approvedHalfDayLeaveDays: number;
  };
  expenses: Array<{ currencyCode: string; claimCount: number; totalAmount: number }>;
};

export type AnalyticsRepository = {
  getManagerAnalytics(tenantId: string, accessToken: string, days: number): Promise<ManagerAnalytics>;
};

/** Builds the read-only manager analytics service over a tenant-scoped repository. */
export function createAnalyticsService(repository: AnalyticsRepository) {
  return {
    /** Returns a bounded rolling analytics window after validating the requested day count. */
    getManagerAnalytics(tenantId: string, accessToken: string, days = 7) {
      if (!Number.isInteger(days) || days < 1 || days > 90) {
        throw new AnalyticsInputError("Analytics days must be a whole number between 1 and 90.");
      }
      return repository.getManagerAnalytics(tenantId, accessToken, days);
    },
  };
}
