import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Crypto from "expo-crypto";
import { TerrevoApi } from "./src/api";
import { captureFreshLocation, collectDepartureSamples } from "./src/location";
import { evaluateDeparture, type DepartureIntegrity } from "./src/presence";
import { getInstallationId, loadSession, loadTenantId, saveSession, saveTenantId } from "./src/storage";
import type { AuthSession, StartTourOption, Tenant, TourProgress, TourStop, Visit } from "./src/types";

const APP_VERSION = "0.20.0";

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [progress, setProgress] = useState<TourProgress | null>(null);
  const [startOptions, setStartOptions] = useState<StartTourOption[]>([]);
  const [openVisit, setOpenVisit] = useState<Visit | null>(null);
  const [exceptionReason, setExceptionReason] = useState("");
  const [doctorOutcome, setDoctorOutcome] = useState("");
  const [doctorRemarks, setDoctorRemarks] = useState("");
  const [departure, setDeparture] = useState<DepartureIntegrity | null>(null);
  const [departureSamples, setDepartureSamples] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = useMemo(() => new TerrevoApi(async (nextSession) => {
    setSession(nextSession);
    await saveSession(nextSession);
  }), []);

  useEffect(() => {
    api.configure(session, tenantId);
  }, [api, session, tenantId]);

  useEffect(() => {
    void (async () => {
      try {
        const [storedSession, storedTenant] = await Promise.all([loadSession(), loadTenantId()]);
        setSession(storedSession);
        setTenantId(storedTenant);
        api.configure(storedSession, storedTenant);
        if (storedSession) {
          const accessible = await api.tenants();
          setTenants(accessible);
          const selected = accessible.some((tenant) => tenant.id === storedTenant)
            ? storedTenant
            : accessible.length === 1 ? accessible[0].id : null;
          setTenantId(selected);
          api.setTenant(selected);
          await saveTenantId(selected);
          if (selected) await refreshField(api);
        }
      } catch (cause) {
        setError(toMessage(cause));
      } finally {
        setBooting(false);
      }
    })();
  }, [api]);

  async function refreshField(client = api) {
    const [nextProgress, nextOpenVisit, nextStartOptions] = await Promise.all([
      client.progress(),
      client.openVisit(),
      client.startOptions(),
    ]);
    setProgress(nextProgress);
    setOpenVisit(nextOpenVisit);
    setStartOptions(nextStartOptions);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (cause) {
      setError(toMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    await run(async () => {
      const nextSession = await api.login(email, password);
      api.configure(nextSession, null);
      const accessible = await api.tenants();
      setTenants(accessible);
      setPassword("");
      if (accessible.length === 1) await selectTenant(accessible[0].id, nextSession);
    });
  }

  async function selectTenant(id: string, currentSession = session) {
    setTenantId(id);
    api.configure(currentSession, id);
    await saveTenantId(id);
    await refreshField(api);
  }

  async function handleLogout() {
    await run(async () => {
      await api.logout();
      await saveTenantId(null);
      setTenantId(null);
      setTenants([]);
      setProgress(null);
      setOpenVisit(null);
      setStartOptions([]);
      setDeparture(null);
    });
  }

  function rejectMocked(location: { mocked: boolean | null }) {
    if (location.mocked === true) {
      throw new Error("Location verification failed. Use the registered device with normal location services enabled.");
    }
  }

  async function handleStartTour(option: StartTourOption) {
    await run(async () => {
      const location = await captureFreshLocation();
      rejectMocked(location);
      await api.startTour({
        operationId: Crypto.randomUUID(),
        planDayId: option.planDayId,
        location,
        deviceId: await getInstallationId(),
        appVersion: APP_VERSION,
      });
      await refreshField();
      setMessage("Tour started. Location is captured only during active field actions.");
    });
  }

  async function handleCheckIn(stop: TourStop) {
    await run(async () => {
      const location = await captureFreshLocation();
      rejectMocked(location);
      const visit = await api.checkIn({
        operationId: Crypto.randomUUID(),
        planStopId: stop.planStopId,
        location,
        exceptionReason: exceptionReason.trim() || null,
      });
      setOpenVisit(visit);
      setExceptionReason("");
      await refreshField();
      setMessage(visit.verification === "VERIFIED"
        ? `Checked in to ${stop.targetName}. Presence is GPS verified.`
        : `Checked in to ${stop.targetName}. Location requires manager review.`);
    });
  }

  async function handleCheckOut(stop: TourStop, visit: Visit) {
    setBusy(true);
    setError(null);
    setMessage(null);
    setDeparture(null);
    setDepartureSamples(0);
    let checkoutRecorded = false;
    try {
      if (stop.type === "doctor") {
        if (!doctorOutcome.trim()) throw new Error("Enter the doctor call outcome before check-out.");
        await api.saveDoctorCall(visit.id, {
          operationId: Crypto.randomUUID(),
          callOutcome: doctorOutcome.trim(),
          remarks: doctorRemarks.trim() || null,
        });
      }

      const checkoutLocation = await captureFreshLocation();
      rejectMocked(checkoutLocation);
      await api.checkOut(visit.id, { operationId: Crypto.randomUUID(), location: checkoutLocation });
      checkoutRecorded = true;
      await refreshField();
      setDoctorOutcome("");
      setDoctorRemarks("");
      setMessage("Check-out recorded. Keep Terrevo open while departure continuity is observed for about 2 minutes.");

      const samples = await collectDepartureSamples((_point, count) => setDepartureSamples(count));
      const result = evaluateDeparture(checkoutLocation, samples);
      setDeparture(result);
      setMessage(result.status === "CONSISTENT"
        ? "Check-out complete. Departure movement is physically consistent."
        : result.status === "SPOOF_SUSPECTED"
          ? "Check-out retained, but location integrity requires investigation."
          : "Check-out complete. Departure movement requires review.");
    } catch (cause) {
      if (checkoutRecorded) {
        setMessage("Check-out is already recorded. Departure continuity could not complete, so no continuity conclusion was made.");
      } else {
        setError(toMessage(cause));
      }
    } finally {
      setBusy(false);
    }
  }

  if (booting) {
    return <SafeAreaView style={styles.center}><ActivityIndicator /><Text style={styles.muted}>Opening Terrevo…</Text></SafeAreaView>;
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.login}>
          <Text style={styles.brand}>Terrevo</Text>
          <Text style={styles.title}>Field login</Text>
          <Text style={styles.muted}>Use your assigned company credentials.</Text>
          <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} />
          <TextInput style={styles.input} secureTextEntry placeholder="Password" value={password} onChangeText={setPassword} />
          {error ? <Notice text={error} error /> : null}
          <PrimaryButton label="Sign in" disabled={busy || !email.trim() || !password} onPress={() => void handleLogin()} />
        </View>
      </SafeAreaView>
    );
  }

  if (!tenantId) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.screen}>
          <Text style={styles.eyebrow}>COMPANY</Text>
          <Text style={styles.title}>Select your company</Text>
          {tenants.map((tenant) => (
            <Pressable key={tenant.id} style={styles.card} onPress={() => void run(() => selectTenant(tenant.id))}>
              <Text style={styles.cardTitle}>{tenant.name}</Text>
              <Text style={styles.muted}>{tenant.slug}</Text>
            </Pressable>
          ))}
          <SecondaryButton label="Sign out" onPress={() => void handleLogout()} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const activeStop = progress?.stops.find((stop) => stop.planStopId === openVisit?.planStopId) ?? null;
  const nextStop = progress?.stops.find((stop) => stop.status === "PENDING") ?? null;
  const selectedTenant = tenants.find((tenant) => tenant.id === tenantId);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>Terrevo</Text>
            <Text style={styles.muted}>{selectedTenant?.name ?? "Field operations"}</Text>
          </View>
          <Pressable onPress={() => void handleLogout()}><Text style={styles.link}>Sign out</Text></Pressable>
        </View>

        {error ? <Notice text={error} error /> : null}
        {message ? <Notice text={message} /> : null}

        {!progress ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No active tour</Text>
            <Text style={styles.muted}>Start an approved tour before checking in to a customer.</Text>
            {startOptions.map((option) => (
              <PrimaryButton key={option.planDayId} label={`Start My Tour · ${option.workDate}`} disabled={busy} onPress={() => void handleStartTour(option)} />
            ))}
            {startOptions.length === 0 ? <Text style={styles.small}>No approved tour is available for today.</Text> : null}
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>TODAY'S TOUR</Text>
              <Text style={styles.cardTitle}>{progress.completedCount} of {progress.plannedCount} calls completed</Text>
              <Text style={styles.muted}>{progress.remainingMinutes} of {progress.requiredMinutes} work minutes remaining</Text>
            </View>

            {progress.stops.map((stop) => (
              <View key={stop.planStopId} style={[styles.card, stop.status === "IN_PROGRESS" && styles.activeCard]}>
                <View style={styles.stopRow}>
                  <View style={styles.sequence}><Text style={styles.sequenceText}>{stop.sequence}</Text></View>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>{stop.targetName}</Text>
                    <Text style={styles.muted}>{labelStopType(stop.type)} · {labelStopStatus(stop.status)}</Text>
                  </View>
                </View>

                {stop.status === "PENDING" && !openVisit && nextStop?.planStopId === stop.planStopId ? (
                  <PrimaryButton label="Check In" disabled={busy} onPress={() => void handleCheckIn(stop)} />
                ) : null}

                {stop.status === "PENDING" && !openVisit && nextStop?.planStopId === stop.planStopId ? (
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    multiline
                    placeholder="Location exception reason (only if verification cannot be completed)"
                    value={exceptionReason}
                    onChangeText={setExceptionReason}
                  />
                ) : null}

                {openVisit && activeStop?.planStopId === stop.planStopId ? (
                  <View style={styles.actionArea}>
                    <Text style={styles.verifiedLine}>Check-in: {openVisit.verification.replaceAll("_", " ")}</Text>
                    {openVisit.distanceMeters != null ? <Text style={styles.small}>Distance from registered location: {Math.round(openVisit.distanceMeters)} m</Text> : null}
                    {stop.type === "doctor" ? (
                      <>
                        <TextInput style={styles.input} placeholder="Doctor call outcome" value={doctorOutcome} onChangeText={setDoctorOutcome} />
                        <TextInput style={[styles.input, styles.multiline]} multiline placeholder="Call remarks (optional)" value={doctorRemarks} onChangeText={setDoctorRemarks} />
                      </>
                    ) : null}
                    <PrimaryButton label="Check Out" disabled={busy} onPress={() => void handleCheckOut(stop, openVisit)} />
                  </View>
                ) : null}
              </View>
            ))}
          </>
        )}

        {busy && departureSamples > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Departure continuity</Text>
            <Text style={styles.muted}>Captured {departureSamples} of 4 post-checkout location samples.</Text>
            <ActivityIndicator style={styles.spinner} />
          </View>
        ) : null}

        {departure ? (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>PRESENCE INTEGRITY</Text>
            <Text style={styles.cardTitle}>{departure.status.replaceAll("_", " ")}</Text>
            <Text style={styles.muted}>{departure.reason}</Text>
            <Text style={styles.small}>Samples: {departure.sampleCount} · Path: {Math.round(departure.totalDistanceMeters)} m · Max segment speed: {Math.round(departure.maxSegmentSpeedKph)} km/h</Text>
          </View>
        ) : null}

        <View style={styles.privacy}>
          <Text style={styles.small}>Presence verification uses fresh GPS only around field actions. Departure continuity observes four samples for about two minutes after check-out. This build does not perform 24/7 tracking.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.primaryButton, disabled && styles.disabled]} disabled={disabled} onPress={onPress}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable style={styles.secondaryButton} onPress={onPress}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>;
}

function Notice({ text, error: isError = false }: { text: string; error?: boolean }) {
  return <View style={[styles.notice, isError && styles.errorNotice]}><Text style={isError ? styles.errorText : styles.noticeText}>{text}</Text></View>;
}

function labelStopType(type: TourStop["type"]) {
  if (type === "doctor") return "Doctor";
  if (type === "chemist") return "Chemist";
  return "Stockist";
}

function labelStopStatus(status: TourStop["status"]) {
  if (status === "IN_PROGRESS") return "Checked in";
  if (status === "COMPLETED") return "Completed";
  return "Pending";
}

function toMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Something went wrong. Please retry.";
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#F5F7FA" },
  screen: { padding: 18, gap: 14, paddingBottom: 40 },
  login: { flex: 1, justifyContent: "center", padding: 24, gap: 14, backgroundColor: "#F5F7FA" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  brand: { fontSize: 24, fontWeight: "800", color: "#0E2A47", letterSpacing: -0.4 },
  title: { fontSize: 26, fontWeight: "700", color: "#132238", marginTop: 4 },
  eyebrow: { fontSize: 11, fontWeight: "800", color: "#506784", letterSpacing: 1.2 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: "#E3E8EF" },
  activeCard: { borderColor: "#2B67F6", borderWidth: 2 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#132238" },
  muted: { fontSize: 14, lineHeight: 20, color: "#66758A" },
  small: { fontSize: 12, lineHeight: 18, color: "#66758A" },
  input: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CDD5DF", borderRadius: 10, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, color: "#132238" },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  primaryButton: { backgroundColor: "#1F5FE0", borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center", marginTop: 2 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  secondaryButton: { borderRadius: 10, borderWidth: 1, borderColor: "#CDD5DF", paddingVertical: 12, alignItems: "center" },
  secondaryButtonText: { color: "#263A52", fontWeight: "700" },
  disabled: { opacity: 0.5 },
  link: { color: "#1F5FE0", fontSize: 14, fontWeight: "700" },
  notice: { backgroundColor: "#EDF4FF", borderRadius: 10, padding: 12 },
  noticeText: { color: "#214C8A", fontSize: 13, lineHeight: 19 },
  errorNotice: { backgroundColor: "#FFF0F0" },
  errorText: { color: "#A32626", fontSize: 13, lineHeight: 19 },
  stopRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  sequence: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#EAF0FF", alignItems: "center", justifyContent: "center" },
  sequenceText: { color: "#1F5FE0", fontWeight: "800" },
  flex: { flex: 1 },
  actionArea: { gap: 10, marginTop: 4 },
  verifiedLine: { color: "#265D3D", fontSize: 13, fontWeight: "700" },
  spinner: { marginTop: 4 },
  privacy: { paddingHorizontal: 4, paddingTop: 4 },
});
