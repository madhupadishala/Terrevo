export type PresencePoint = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  mocked: boolean | null;
};

export type DepartureIntegrityStatus = "CONSISTENT" | "REVIEW_REQUIRED" | "SPOOF_SUSPECTED";

export type DepartureIntegrity = {
  status: DepartureIntegrityStatus;
  sampleCount: number;
  totalDistanceMeters: number;
  maxSegmentSpeedKph: number;
  mockedDetected: boolean;
  reason: string;
};

const EARTH_RADIUS_METERS = 6_371_000;
const REVIEW_SPEED_KPH = 180;
const REVIEW_ACCURACY_METERS = 100;

const rad = (degrees: number) => degrees * Math.PI / 180;

export function distanceMeters(a: PresencePoint, b: PresencePoint): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const lat1 = rad(a.latitude);
  const lat2 = rad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function evaluateDeparture(anchor: PresencePoint, samples: PresencePoint[]): DepartureIntegrity {
  const points = [anchor, ...samples].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
  );

  const mockedDetected = points.some((point) => point.mocked === true);
  let totalDistanceMeters = 0;
  let maxSegmentSpeedKph = 0;
  let invalidTime = false;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const elapsedSeconds = (new Date(current.capturedAt).getTime() - new Date(previous.capturedAt).getTime()) / 1000;
    const segmentDistance = distanceMeters(previous, current);
    totalDistanceMeters += segmentDistance;

    if (elapsedSeconds <= 0) {
      invalidTime = true;
      continue;
    }

    maxSegmentSpeedKph = Math.max(maxSegmentSpeedKph, segmentDistance / elapsedSeconds * 3.6);
  }

  const poorAccuracy = points.some((point) => point.accuracyMeters > REVIEW_ACCURACY_METERS);

  if (mockedDetected) {
    return {
      status: "SPOOF_SUSPECTED",
      sampleCount: samples.length,
      totalDistanceMeters,
      maxSegmentSpeedKph,
      mockedDetected,
      reason: "Android reported a mocked location during the departure check.",
    };
  }

  if (invalidTime || maxSegmentSpeedKph > REVIEW_SPEED_KPH || poorAccuracy || samples.length < 3) {
    const reason = invalidTime
      ? "Location timestamps were not sequential."
      : maxSegmentSpeedKph > REVIEW_SPEED_KPH
        ? "The departure trace contains an implausible location jump."
        : poorAccuracy
          ? "One or more departure samples had poor GPS accuracy."
          : "Too few departure samples were captured.";
    return {
      status: "REVIEW_REQUIRED",
      sampleCount: samples.length,
      totalDistanceMeters,
      maxSegmentSpeedKph,
      mockedDetected,
      reason,
    };
  }

  return {
    status: "CONSISTENT",
    sampleCount: samples.length,
    totalDistanceMeters,
    maxSegmentSpeedKph,
    mockedDetected,
    reason: "The sampled movement is physically plausible. Stationary or irregular nearby movement is allowed.",
  };
}
