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
import { ApiError, TerrevoApi } from "./src/api";
import { buildDistributionLines, buildDoctorProducts, distributionKey, projectedInventoryBalance, weekStartFromDate } from "./src/field";
import { captureFreshLocation, collectDepartureSamples } from "./src/location";
import { presenceStatusMessage, type DepartureIntegrity, type PresencePoint } from "./src/presence";
import {
  clearPendingMutation,
  clearPendingPresence,
  getOrCreatePendingMutation,
  getOrCreatePendingPresence,
  loadPendingMutation,
  loadPendingPresence,
  savePendingPresence,
} from "./src/pending";
import { getInstallationId, loadSession, loadTenantId, saveSession, saveTenantId } from "./src/storage";
import type { AuthSession, DailyTimesheet, InventoryBalance, MasterItem, StartTourOption, Tenant, TourProgress, TourStop, Visit, VisitDistribution, WeeklyTimesheet } from "./src/types";

const APP_VERSION = "0.22.0";

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
  const [doctorNextAction, setDoctorNextAction] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [products, setProducts] = useState<MasterItem[]>([]);
  const [samples, setSamples] = useState<MasterItem[]>([]);
  const [gifts, setGifts] = useState<MasterItem[]>([]);
  const [inventory, setInventory] = useState<InventoryBalance[]>([]);
  const [distributionQuantities, setDistributionQuantities] = useState<Record<string, string>>({});
  const [visitDistributions, setVisitDistributions] = useState<VisitDistribution[]>([]);
  const [shortDayReason, setShortDayReason] = useState("");
  const [dailyTimesheets, setDailyTimesheets] = useState<DailyTimesheet[]>([]);
  const [weeklyTimesheets, setWeeklyTimesheets] = useState<WeeklyTimesheet[]>([]);
  const [dailyRemarks, setDailyRemarks] = useState("");
  const [weeklyComment, setWeeklyComment] = useState("");
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
          if (selected) {
            await loadFieldResources(api);
            await refreshField(api);
            await loadWorkRecords(api);
            await tryResumePendingPresence(api, storedSession, selected);
          }
        }
      } catch (cause) {
        setError(toMessage(cause));
      } finally {
        setBooting(false);
      }
    })();
  }, [api]);

  function resetDoctorDraft() {
    setDoctorOutcome("");
    setDoctorRemarks("");
    setDoctorNextAction("");
    setProductSearch("");
    setSelectedProductIds([]);
    setDistributionQuantities({});
    setVisitDistributions([]);
  }

  async function loadFieldResources(client = api) {
    const [nextProducts, nextSamples, nextGifts, nextInventory] = await Promise.all([
      client.master("products"),
      client.master("samples"),
      client.master("gifts"),
      client.inventory(),
    ]);
    setProducts(nextProducts.filter((item) => item.status === "active"));
    setSamples(nextSamples.filter((item) => item.status === "active"));
    setGifts(nextGifts.filter((item) => item.status === "active"));
    setInventory(nextInventory);
  }

  async function loadWorkRecords(client = api) {
    const [daily, weekly] = await Promise.all([
      client.dailyTimesheets(),
      client.weeklyTimesheets(),
    ]);
    setDailyTimesheets(daily);
    setWeeklyTimesheets(weekly);
  }

  async function loadDoctorContext(client: TerrevoApi, nextProgress: TourProgress | null, nextOpenVisit: Visit | null) {
    const stop = nextProgress?.stops.find((item) => item.planStopId === nextOpenVisit?.planStopId);
    if (!nextOpenVisit || stop?.type !== "doctor") {
      resetDoctorDraft();
      return;
    }
    const [call, distributions] = await Promise.all([
      client.doctorCall(nextOpenVisit.id),
      client.visitDistributions(nextOpenVisit.id),
    ]);
    setDoctorOutcome(call?.callOutcome ?? "");
    setDoctorRemarks(call?.remarks ?? "");
    setDoctorNextAction(call?.nextAction ?? "");
    setSelectedProductIds(call?.products.slice().sort((a, b) => a.sequence - b.sequence).map((item) => item.productId) ?? []);
    setProductSearch("");
    setDistributionQuantities({});
    setVisitDistributions(distributions);
  }

  async function refreshField(client = api) {
    const [nextProgress, nextOpenVisit, nextStartOptions] = await Promise.all([
      client.progress(),
      client.openVisit(),
      client.startOptions(),
    ]);
    setProgress(nextProgress);
    setOpenVisit(nextOpenVisit);
    setStartOptions(nextStartOptions);
    await loadDoctorContext(client, nextProgress, nextOpenVisit);
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
    await loadFieldResources(api);
    await refreshField(api);
    await loadWorkRecords(api);
    await tryResumePendingPresence(api, currentSession, id);
  }

  async function syncPendingPresence(
    client = api,
    currentSession = session,
    currentTenantId = tenantId,
  ): Promise<DepartureIntegrity | null> {
    const pending = await loadPendingPresence<{ samples: PresencePoint[] }>();
    if (!pending || !currentSession || !currentTenantId) return null;
    if (pending.userId !== currentSession.user.id || pending.tenantId !== currentTenantId) return null;

    const result = await client.recordPresence(pending.visitId, {
      operationId: pending.operationId,
      samples: pending.payload.samples,
    });
    await clearPendingPresence();
    setDeparture(result);
    return result;
  }

  async function tryResumePendingPresence(
    client = api,
    currentSession = session,
    currentTenantId = tenantId,
  ): Promise<void> {
    try {
      const result = await syncPendingPresence(client, currentSession, currentTenantId);
      if (result) setMessage(`Pending presence evidence synced: ${result.status.replaceAll("_", " ")}.`);
    } catch {
      setMessage("Presence evidence is safely stored on this device and is waiting to sync.");
    }
  }

  async function requirePendingPresenceSynced(): Promise<void> {
    const pending = await loadPendingPresence<{ samples: PresencePoint[] }>();
    if (!pending) return;
    if (!session || !tenantId || pending.userId !== session.user.id || pending.tenantId !== tenantId) {
      throw new Error("Unsynced presence evidence exists for another account or company on this device.");
    }
    try {
      await syncPendingPresence();
    } catch {
      throw new Error("Previous visit presence evidence is waiting to sync. Reconnect before starting another field visit.");
    }
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
      setProducts([]);
      setSamples([]);
      setGifts([]);
      setInventory([]);
      resetDoctorDraft();
      setShortDayReason("");
      setDailyTimesheets([]);
      setWeeklyTimesheets([]);
      setDailyRemarks("");
      setWeeklyComment("");
      setDeparture(null);
    });
  }

  function rejectMocked(location: { mocked: boolean | null }) {
    if (location.mocked === true) {
      throw new Error("Location verification failed. Use the registered device with normal location services enabled.");
    }
  }

  async function clearPendingOnDefinitiveFailure(scope: string, cause: unknown) {
    if (cause instanceof ApiError && [400, 403, 404].includes(cause.status)) {
      await clearPendingMutation(scope);
    }
  }

  async function handleStartTour(option: StartTourOption) {
    await run(async () => {
      const scope = `start.${option.planDayId}`;
      const pending = await getOrCreatePendingMutation(scope, async () => {
        const location = await captureFreshLocation();
        rejectMocked(location);
        return {
          location,
          deviceId: await getInstallationId(),
          appVersion: APP_VERSION,
        };
      });
      try {
        await api.startTour({
          operationId: pending.operationId,
          planDayId: option.planDayId,
          ...pending.payload,
        });
        await clearPendingMutation(scope);
      } catch (cause) {
        await clearPendingOnDefinitiveFailure(scope, cause);
        throw cause;
      }
      await refreshField();
      setMessage("Tour started. Location is captured only during active field actions.");
    });
  }

  async function handleCheckIn(stop: TourStop) {
    await run(async () => {
      await requirePendingPresenceSynced();
      const scope = `check-in.${stop.planStopId}`;
      const pending = await getOrCreatePendingMutation(scope, async () => {
        const location = await captureFreshLocation();
        rejectMocked(location);
        return {
          location,
          exceptionReason: exceptionReason.trim() || null,
        };
      });
      let visit: Visit;
      try {
        visit = await api.checkIn({
          operationId: pending.operationId,
          planStopId: stop.planStopId,
          ...pending.payload,
        });
        await clearPendingMutation(scope);
      } catch (cause) {
        await clearPendingOnDefinitiveFailure(scope, cause);
        throw cause;
      }
      setOpenVisit(visit);
      setExceptionReason("");
      await refreshField();
      setMessage(visit.verification === "VERIFIED"
        ? `Checked in to ${stop.targetName}. Presence is GPS verified.`
        : `Checked in to ${stop.targetName}. Location requires manager review.`);
    });
  }

  async function handleRecordDistribution(visit: Visit) {
    await run(async () => {
      const items = buildDistributionLines(inventory, distributionQuantities);
      if (items.length === 0) throw new Error("Enter at least one sample or gift quantity.");
      const scope = `distribution.${visit.id}`;
      const pending = await getOrCreatePendingMutation(scope, async () => ({ items }));
      try {
        const distributions = await api.distribute(visit.id, {
          operationId: pending.operationId,
          items: pending.payload.items,
        });
        await clearPendingMutation(scope);
        setVisitDistributions(distributions);
        setDistributionQuantities({});
        setInventory(await api.inventory());
        setMessage("Samples/gifts recorded against this doctor visit.");
      } catch (cause) {
        await clearPendingOnDefinitiveFailure(scope, cause);
        throw cause;
      }
    });
  }

  async function handleSubmitTour(current: TourProgress) {
    await run(async () => {
      await requirePendingPresenceSynced();
      if (current.remainingMinutes > 0 && !shortDayReason.trim()) {
        throw new Error("Enter a short-day reason before submitting this tour.");
      }
      const scope = `submit-tour.${current.executionId}`;
      const pending = await getOrCreatePendingMutation(scope, async () => ({
        shortDayReason: shortDayReason.trim() || null,
      }));
      try {
        const submitted = await api.submitTour({
          operationId: pending.operationId,
          shortDayReason: pending.payload.shortDayReason,
        });
        await clearPendingMutation(scope);
        setShortDayReason("");
        await refreshField();
        await loadWorkRecords();
        setMessage(`Workday closed. Worked time: ${submitted.workedMinutes} minutes. Daily timesheet generated automatically.`);
      } catch (cause) {
        await clearPendingOnDefinitiveFailure(scope, cause);
        throw cause;
      }
    });
  }

  async function handleReviewDaily(timesheet: DailyTimesheet) {
    await run(async () => {
      const scope = `daily-timesheet-review.${timesheet.id}`;
      const pending = await getOrCreatePendingMutation(scope, async () => ({
        remarks: dailyRemarks.trim() || null,
      }));
      try {
        await api.reviewDailyTimesheet(timesheet.id, {
          operationId: pending.operationId,
          remarks: pending.payload.remarks,
        });
        await clearPendingMutation(scope);
      } catch (cause) {
        await clearPendingOnDefinitiveFailure(scope, cause);
        throw cause;
      }
      setDailyRemarks("");
      await loadWorkRecords();
      setMessage("Daily work record reviewed. Calculated field evidence remains unchanged.");
    });
  }

  async function handleGenerateWeekly(workDate: string) {
    await run(async () => {
      const weekStart = weekStartFromDate(workDate);
      await api.generateWeeklyTimesheet(weekStart);
      await loadWorkRecords();
      setMessage(`Weekly timesheet generated from reviewed daily evidence for week of ${weekStart}.`);
    });
  }

  async function handleSubmitWeekly(timesheet: WeeklyTimesheet) {
    await run(async () => {
      const scope = `weekly-timesheet-submit.${timesheet.id}`;
      const pending = await getOrCreatePendingMutation(scope, async () => ({
        comment: weeklyComment.trim() || null,
      }));
      try {
        await api.submitWeeklyTimesheet(timesheet.id, {
          operationId: pending.operationId,
          comment: pending.payload.comment,
        });
        await clearPendingMutation(scope);
      } catch (cause) {
        await clearPendingOnDefinitiveFailure(scope, cause);
        throw cause;
      }
      setWeeklyComment("");
      await loadWorkRecords();
      setMessage("Weekly timesheet submitted from reviewed daily records.");
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
        const pendingDistribution = await loadPendingMutation(`distribution.${visit.id}`);
        if (pendingDistribution) {
          throw new Error("Sample/gift entry is waiting to sync. Retry it before check-out.");
        }
        if (!doctorOutcome.trim()) throw new Error("Enter the doctor call outcome before check-out.");
        const callScope = `doctor-call.${visit.id}`;
        const pendingCall = await getOrCreatePendingMutation(callScope, async () => ({
          callOutcome: doctorOutcome.trim(),
          remarks: doctorRemarks.trim() || null,
          nextAction: doctorNextAction.trim() || null,
          products: buildDoctorProducts(selectedProductIds),
        }));
        try {
          await api.saveDoctorCall(visit.id, {
            operationId: pendingCall.operationId,
            ...pendingCall.payload,
          });
          await clearPendingMutation(callScope);
        } catch (cause) {
          await clearPendingOnDefinitiveFailure(callScope, cause);
          throw cause;
        }
      }

      const checkoutScope = `check-out.${visit.id}`;
      const pendingCheckout = await getOrCreatePendingMutation(checkoutScope, async () => {
        const location = await captureFreshLocation();
        rejectMocked(location);
        return { location };
      });
      if (!session || !tenantId) throw new Error("Session context is unavailable for presence sync.");
      const pendingPresence = await getOrCreatePendingPresence<{ samples: PresencePoint[] }>(
        { userId: session.user.id, tenantId, visitId: visit.id },
        async () => ({ samples: [] }),
      );
      try {
        await api.checkOut(visit.id, {
          operationId: pendingCheckout.operationId,
          ...pendingCheckout.payload,
        });
        checkoutRecorded = true;
        await clearPendingMutation(checkoutScope);
      } catch (cause) {
        const definitive = cause instanceof ApiError && [400, 403, 404].includes(cause.status);
        await clearPendingOnDefinitiveFailure(checkoutScope, cause);
        if (definitive) await clearPendingPresence();
        throw cause;
      }
      const checkoutLocation = pendingCheckout.payload.location;
      await refreshField();
      resetDoctorDraft();
      setMessage("Check-out recorded. Keep Terrevo open while departure continuity is observed for about 2 minutes.");
      await collectDepartureSamples(async (point, count) => {
        pendingPresence.payload.samples = [...pendingPresence.payload.samples, point];
        await savePendingPresence(pendingPresence);
        setDepartureSamples(count);
      });
      let result: DepartureIntegrity;
      try {
        result = await api.recordPresence(visit.id, {
          operationId: pendingPresence.operationId,
          samples: pendingPresence.payload.samples,
        });
        await clearPendingPresence();
      } catch (cause) {
        throw cause;
      }
      setDeparture(result);
      setMessage(presenceStatusMessage(result.status));
    } catch (cause) {
      if (checkoutRecorded) {
        try {
          const partial = await syncPendingPresence();
          if (partial) {
            setMessage(`Check-out is recorded. Incomplete departure evidence was retained for review: ${partial.status.replaceAll("_", " ")}.`);
          } else {
            setMessage("Check-out is recorded. Departure evidence is safely retained and waiting to sync.");
          }
        } catch {
          setMessage("Check-out is recorded. Departure evidence is safely retained and waiting to sync.");
        }
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
  const productQuery = productSearch.trim().toLowerCase();
  const visibleProducts = products
    .filter((item) => !productQuery || item.code.toLowerCase().includes(productQuery) || item.name.toLowerCase().includes(productQuery))
    .slice(0, 8);
  const inventoryRows = inventory.filter((balance) => balance.quantity > 0);
  const hasDistributionDraft = Object.values(distributionQuantities).some((value) => value.trim() !== "");
  const latestDaily = [...dailyTimesheets].sort((a, b) => b.workDate.localeCompare(a.workDate))[0] ?? null;
  const sourceWeek = latestDaily ? weekStartFromDate(latestDaily.workDate) : null;
  const sourceWeekly = sourceWeek ? weeklyTimesheets.find((item) => item.weekStart === sourceWeek) ?? null : null;
  const latestWeekly = [...weeklyTimesheets].sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0] ?? null;

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
            <Text style={styles.cardTitle}>Workday ready</Text>
            <Text style={styles.muted}>Start My Tour is your field-work clock-in. Server time becomes the trusted start of the day.</Text>
            {startOptions.map((option) => (
              <PrimaryButton key={option.planDayId} label={`Start My Tour · Clock In · ${option.workDate}`} disabled={busy} onPress={() => void handleStartTour(option)} />
            ))}
            {startOptions.length === 0 ? <Text style={styles.small}>No approved tour is available for today.</Text> : null}
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>TODAY'S TOUR</Text>
              <Text style={styles.cardTitle}>{progress.completedCount} of {progress.plannedCount} calls completed</Text>
              <Text style={styles.muted}>Workday in progress · {progress.remainingMinutes} of {progress.requiredMinutes} server-timed work minutes remaining</Text>
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
                        <TextInput style={styles.input} placeholder="Next action (optional)" value={doctorNextAction} onChangeText={setDoctorNextAction} />

                        <Text style={styles.sectionTitle}>Products detailed</Text>
                        <TextInput style={styles.input} placeholder="Search product code or name" value={productSearch} onChangeText={setProductSearch} />
                        {visibleProducts.map((item) => {
                          const selectedIndex = selectedProductIds.indexOf(item.id);
                          const selected = selectedIndex >= 0;
                          return (
                            <Pressable
                              key={item.id}
                              style={[styles.choiceRow, selected && styles.choiceSelected]}
                              onPress={() => setSelectedProductIds((current) => {
                                if (current.includes(item.id)) return current.filter((id) => id !== item.id);
                                if (current.length >= 20) {
                                  setError("You can detail up to 20 products in one doctor call.");
                                  return current;
                                }
                                setError(null);
                                return [...current, item.id];
                              })}
                            >
                              <Text style={styles.choiceText}>{item.code} · {item.name}</Text>
                              <Text style={styles.small}>{selected ? `Selected #${selectedIndex + 1}` : "Tap to add"}</Text>
                            </Pressable>
                          );
                        })}
                        {products.length === 0 ? <Text style={styles.small}>No active products are available in your scope.</Text> : null}

                        <Text style={styles.sectionTitle}>Samples & gifts</Text>
                        {inventoryRows.map((balance) => {
                          const item = (balance.itemType === "sample" ? samples : gifts).find((entry) => entry.id === balance.itemId);
                          const key = distributionKey(balance);
                          const projected = projectedInventoryBalance(balance, distributionQuantities);
                          return (
                            <View key={balance.id} style={styles.quantityRow}>
                              <View style={styles.flex}>
                                <Text style={styles.choiceText}>{item ? `${item.code} · ${item.name}` : balance.itemType}</Text>
                                <Text style={styles.small}>{balance.itemType === "sample" ? "Sample" : "Gift"} · Available {balance.quantity} · After this call {projected ?? "—"}</Text>
                              </View>
                              <TextInput
                                style={styles.quantityInput}
                                keyboardType="number-pad"
                                placeholder="0"
                                value={distributionQuantities[key] ?? ""}
                                onChangeText={(value) => setDistributionQuantities((current) => ({ ...current, [key]: value }))}
                              />
                            </View>
                          );
                        })}
                        {inventoryRows.length === 0 ? <Text style={styles.small}>No sample/gift balance is available.</Text> : null}
                        {visitDistributions.length > 0 ? <Text style={styles.small}>{visitDistributions.length} distribution line(s) already recorded for this visit.</Text> : null}
                        <PrimaryButton
                          label="Record Samples & Gifts"
                          disabled={busy || !hasDistributionDraft}
                          onPress={() => void handleRecordDistribution(openVisit)}
                        />
                      </>
                    ) : null}
                    <PrimaryButton label="Check Out" disabled={busy} onPress={() => void handleCheckOut(stop, openVisit)} />
                  </View>
                ) : null}
              </View>
            ))}

            {progress.pendingCount === 0 && progress.inProgressCount === 0 ? (
              <View style={styles.card}>
                <Text style={styles.eyebrow}>END OF DAY</Text>
                <Text style={styles.cardTitle}>Close Workday</Text>
                <Text style={styles.muted}>All planned calls are completed. Submit Tour closes field mutations and generates the daily timesheet from trusted field evidence.</Text>
                {progress.remainingMinutes > 0 ? (
                  <TextInput
                    style={[styles.input, styles.multiline]}
                    multiline
                    placeholder="Short-day reason"
                    value={shortDayReason}
                    onChangeText={setShortDayReason}
                  />
                ) : null}
                <PrimaryButton
                  label="Submit Tour · Clock Out Day"
                  disabled={busy || (progress.remainingMinutes > 0 && !shortDayReason.trim())}
                  onPress={() => void handleSubmitTour(progress)}
                />
              </View>
            ) : null}
          </>
        )}

        {latestDaily ? (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>DAILY WORK RECORD</Text>
            <Text style={styles.cardTitle}>{latestDaily.workDate} · {latestDaily.status}</Text>
            <Text style={styles.muted}>Worked {latestDaily.totalMinutes} min · Calls {latestDaily.callCount} · Visit time {latestDaily.visitMinutes} min</Text>
            <Text style={styles.small}>Unclassified {latestDaily.unclassifiedMinutes} min. Calculated values come from trusted field events and cannot be edited.</Text>
            {latestDaily.status === "GENERATED" ? (
              <>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  multiline
                  placeholder="Optional daily remark"
                  value={dailyRemarks}
                  onChangeText={setDailyRemarks}
                />
                <PrimaryButton label="Review Daily Record" disabled={busy} onPress={() => void handleReviewDaily(latestDaily)} />
              </>
            ) : null}
          </View>
        ) : null}

        {latestDaily?.status === "REVIEWED" && sourceWeek && !sourceWeekly ? (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>WEEKLY RECORD</Text>
            <Text style={styles.cardTitle}>Week of {sourceWeek}</Text>
            <Text style={styles.muted}>Generate the weekly record from reviewed daily evidence. Missing days are not fabricated.</Text>
            <PrimaryButton label="Generate Weekly Timesheet" disabled={busy} onPress={() => void handleGenerateWeekly(latestDaily.workDate)} />
          </View>
        ) : null}

        {latestWeekly ? (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>WEEKLY TIMESHEET</Text>
            <Text style={styles.cardTitle}>Week of {latestWeekly.weekStart} · {latestWeekly.status}</Text>
            <Text style={styles.muted}>{latestWeekly.dailyCount} reviewed day(s) · {latestWeekly.totalMinutes} min · {latestWeekly.callCount} calls</Text>
            <Text style={styles.small}>Visit {latestWeekly.visitMinutes} min · Unclassified {latestWeekly.unclassifiedMinutes} min</Text>
            {latestWeekly.status === "DRAFT" || latestWeekly.status === "RETURNED" ? (
              <>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  multiline
                  placeholder="Optional weekly submission comment"
                  value={weeklyComment}
                  onChangeText={setWeeklyComment}
                />
                <PrimaryButton label="Submit Weekly Timesheet" disabled={busy} onPress={() => void handleSubmitWeekly(latestWeekly)} />
              </>
            ) : null}
          </View>
        ) : null}

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
          <Text style={styles.small}>Presence verification uses fresh GPS only around field actions. Departure continuity observes four samples for about two minutes after check-out and the server derives the integrity result. This build does not perform 24/7 tracking.</Text>
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
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#263A52", marginTop: 4 },
  choiceRow: { borderWidth: 1, borderColor: "#CDD5DF", borderRadius: 10, padding: 11, gap: 3 },
  choiceSelected: { borderColor: "#1F5FE0", backgroundColor: "#EDF4FF" },
  choiceText: { fontSize: 14, fontWeight: "700", color: "#263A52" },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#E3E8EF", borderRadius: 10, padding: 10 },
  quantityInput: { width: 64, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CDD5DF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, textAlign: "center", fontSize: 15, color: "#132238" },
  verifiedLine: { color: "#265D3D", fontSize: 13, fontWeight: "700" },
  spinner: { marginTop: 4 },
  privacy: { paddingHorizontal: 4, paddingTop: 4 },
});
