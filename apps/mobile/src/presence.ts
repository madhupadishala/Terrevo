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
