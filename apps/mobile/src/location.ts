import * as Location from "expo-location";
import type { PresencePoint } from "./presence";

function toPoint(location: Location.LocationObject): PresencePoint {
  const accuracy = location.coords.accuracy;
  if (accuracy == null || !Number.isFinite(accuracy)) {
    throw new Error("GPS accuracy is unavailable. Move to an open area and retry.");
  }
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyMeters: accuracy,
    capturedAt: new Date(location.timestamp).toISOString(),
    mocked: typeof location.mocked === "boolean" ? location.mocked : null,
  };
}

export async function captureFreshLocation(): Promise<PresencePoint> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") {
    throw new Error("Location permission is required for field check-in and check-out.");
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new Error("Turn on device location services and retry.");
  }
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Highest,
    mayShowUserSettingsDialog: true,
  });
  return toPoint(location);
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function collectDepartureSamples(
  onSample: (point: PresencePoint, sampleNumber: number) => void | Promise<void>,
  sampleCount = 4,
): Promise<PresencePoint[]> {
  const samples: PresencePoint[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    await wait(index === 0 ? 15_000 : 30_000);
    const point = await captureFreshLocation();
    samples.push(point);
    await onSample(point, index + 1);
  }
  return samples;
}
