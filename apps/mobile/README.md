# Terrevo Field mobile — Check-In / Check-Out slice

Requirement: `TRV-VIS-009`.

This is the first runnable Expo mobile slice for an MR's field day. It uses the existing Terrevo API for authentication, tenant selection, Start My Tour, Show My Tour, check-in, doctor call prerequisite, and check-out.

## Run

```bash
cd apps/mobile
npm install
EXPO_PUBLIC_TERREVO_API_URL=https://terrevo.vercel.app npm run start
```

The API URL defaults to `https://terrevo.vercel.app` when the environment variable is omitted.

## Presence behavior in this slice

- Captures a fresh high-accuracy location on Start My Tour, Check In, and Check Out.
- Rejects an Android location when Expo reports `mocked=true`.
- Uses the server's configured 50/100/200 m geofence and GPS-accuracy rules for check-in.
- After check-out, captures four additional foreground samples over about two minutes (roughly 15s, 45s, 75s, 105s after check-out).
- Departure evaluation allows stationary and irregular nearby movement. It flags a reported mocked point as `SPOOF_SUSPECTED`; poor accuracy, too few samples, non-sequential time, or an implausible location jump becomes `REVIEW_REQUIRED`.
- The departure result in this slice is client-side telemetry only. It must not be used as disciplinary evidence until samples are persisted and verified server-side with app/device attestation.
- Start, check-in, doctor-call and checkout keep the operation ID and mutation payload in device SecureStore until the server acknowledges success. A network-uncertain retry therefore replays the same operation and, for checkout, the same GPS payload.

## Important prerequisites

- Apply `database/migrations/0020a_visit_progress_stop_id.sql` so Show My Tour exposes the server-generated `planStopId` needed by Check In.
- Customer master coordinates must be configured for a normal `VERIFIED` geofence result. If coordinates are missing or GPS quality is insufficient, the current backend requires a location exception reason and manager review.
- Doctor checkout requires a doctor call record; the mobile screen captures a minimal outcome/remarks before invoking checkout.

## Privacy boundary

This slice uses foreground location around explicit field actions and for the short post-checkout continuity observation. It does not enable 24/7 or background tracking.
