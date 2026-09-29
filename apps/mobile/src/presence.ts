export type PresencePoint = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  mocked: boolean | null;
};

export type DepartureIntegrityStatus = "CONSISTENT" | "REVIEW_REQUIRED" | "SPOOF_SUSPECTED";

export type DepartureIntegritySample = {
  sequence: number;
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  mocked: boolean | null;
  distanceFromPreviousMeters: number;
  speedFromPreviousKph: number | null;
};

export type DepartureIntegrity = {
  id: string;
  visitId: string;
  executionId: string;
  status: DepartureIntegrityStatus;
  sampleCount: number;
  totalDistanceMeters: number;
  maxSegmentSpeedKph: number;
  mockedDetected: boolean;
  reason: string;
  deviceId: string | null;
  serverDelaySeconds: number;
  recordedAt: string;
  samples: DepartureIntegritySample[];
};

export function presenceStatusMessage(status: DepartureIntegrityStatus): string {
  if (status === "CONSISTENT") return "Check-out complete. Server presence verification is consistent.";
  if (status === "SPOOF_SUSPECTED") return "Check-out retained, but server presence verification detected suspicious location evidence.";
  return "Check-out complete. Server presence verification requires review.";
}
