'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';
import {
  formatAttendanceTime,
  getBranchAttendanceOverview,
  getLiveLocations,
  type BranchAttendanceOverview,
  type LiveLocationsOverview,
} from '@/lib/attendance';
import { getOrganizationSubscription } from '@/lib/billing';
import { isHrRole, isOrgAdminRole } from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

const LiveLocationMap = dynamic(
  () =>
    import('@/components/attendance/live-location-map').then(
      (module) => module.LiveLocationMap,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[560px] w-full rounded-2xl" />,
  },
);

const LIVE_LOCATION_REFRESH_MS = 5 * 60 * 1000;

export default function AttendancePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [overview, setOverview] = useState<BranchAttendanceOverview | null>(
    null,
  );
  const [liveLocations, setLiveLocations] =
    useState<LiveLocationsOverview | null>(null);
  const [branchId, setBranchId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [liveTrackingEnabled, setLiveTrackingEnabled] = useState(false);
  const branchIdRef = useRef(branchId);

  useEffect(() => {
    branchIdRef.current = branchId;
  }, [branchId]);

  const refreshAttendanceData = useCallback(async () => {
    if (!team) {
      return;
    }

    const isAdmin = isOrgAdminRole(team.currentMember?.role);
    const selectedBranch = isAdmin
      ? branchIdRef.current || undefined
      : undefined;

    const [nextOverview, subscription] = await Promise.all([
      getBranchAttendanceOverview(selectedBranch),
      getOrganizationSubscription(),
    ]);

    const hasLiveTracking = subscription.activeFeatures.includes('live_tracking');
    setLiveTrackingEnabled(hasLiveTracking);

    let nextLive: LiveLocationsOverview = {
      updatedAt: new Date().toISOString(),
      branchId: selectedBranch ?? null,
      employees: [],
    };

    if (hasLiveTracking) {
      nextLive = await getLiveLocations(selectedBranch);
    }

    setOverview(nextOverview);
    setLiveLocations(nextLive);
    setLastRefreshedAt(new Date().toISOString());
    setError(null);
  }, [team]);

  useEffect(() => {
    if (!session) {
      return;
    }

    void getTeamOverview()
      .then((nextTeam) => {
        const role = nextTeam.currentMember?.role ?? 'member';
        const canView = isOrgAdminRole(role) || isHrRole(role);

        if (!canView) {
          router.replace('/dashboard');
          return;
        }

        setTeam(nextTeam);
        const defaultBranch =
          nextTeam.currentMember?.assignedBranchId ??
          nextTeam.branches[0]?._id ??
          '';
        setBranchId(defaultBranch);

        const overviewBranch = isOrgAdminRole(role)
          ? defaultBranch || undefined
          : undefined;

        return getBranchAttendanceOverview(overviewBranch).then(
          async (nextOverview) => {
            const subscription = await getOrganizationSubscription();
            const hasLiveTracking =
              subscription.activeFeatures.includes('live_tracking');
            setLiveTrackingEnabled(hasLiveTracking);
            setOverview(nextOverview);

            if (!hasLiveTracking) {
              setLiveLocations({
                updatedAt: new Date().toISOString(),
                branchId: nextOverview.branchId,
                employees: [],
              });
              setLastRefreshedAt(new Date().toISOString());
              return;
            }

            const nextLive = await getLiveLocations(overviewBranch);
            setLiveLocations(nextLive);
            setLastRefreshedAt(new Date().toISOString());
          },
        );
      })
      .catch(() => router.replace('/dashboard'));
  }, [router, session]);

  useEffect(() => {
    if (!team || !isOrgAdminRole(team.currentMember?.role)) {
      return;
    }

    void refreshAttendanceData().catch((loadError) => {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load attendance.',
      );
    });
  }, [branchId, refreshAttendanceData, team]);

  useEffect(() => {
    if (!team) {
      return;
    }

    if (!liveTrackingEnabled) {
      return;
    }

    const refresh = () => {
      void refreshAttendanceData().catch(() => {
        // Keep the previous map; refresh failures are non-fatal.
      });
    };

    const timer = window.setInterval(refresh, LIVE_LOCATION_REFRESH_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [liveTrackingEnabled, refreshAttendanceData, team]);

  const branchNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const branch of team?.branches ?? []) {
      names[branch._id] = branch.name;
    }
    return names;
  }, [team]);

  if (!team || !overview) {
    return (
      <div className="space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-[560px] w-full rounded-2xl" />
      </div>
    );
  }

  const isAdmin = isOrgAdminRole(team.currentMember?.role);

  return (
    <div className="space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Attendance today
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who is on duty across your branch, including live location.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {isAdmin ? (
        <label className="block max-w-sm space-y-2">
          <span className="text-sm text-muted-foreground">Branch</span>
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none ring-ring focus:ring-2"
          >
            <option value="">All branches</option>
            {team.branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Employees</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {overview.employees.length}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Clocked in</p>
          <p className="mt-2 text-3xl font-semibold text-primary">
            {overview.employees.filter((employee) => employee.isClockedIn).length}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Live on map</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">
            {liveLocations?.employees.length ?? 0}
          </p>
        </article>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Live location
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {liveTrackingEnabled
                ? 'Map data refreshes every 5 minutes. Employee pins update when they share location from the portal (~every minute while on duty).'
                : 'Live tracking is not on your subscription. Ask your organization admin to add it from Subscription settings.'}
            </p>
          </div>
          {liveTrackingEnabled && lastRefreshedAt ? (
            <p className="text-xs text-muted-foreground">
              Last refreshed {formatAttendanceTime(lastRefreshedAt)}
            </p>
          ) : null}
        </div>
        {liveTrackingEnabled ? (
          <LiveLocationMap
            employees={liveLocations?.employees ?? []}
            branchNames={branchNames}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
            Enable the Live tracking add-on to see on-duty employees on the map.
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Roster</h2>
        {overview.employees.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No employees found for this branch.
          </p>
        ) : (
          overview.employees.map((employee) => (
            <article
              key={employee.userId}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-medium text-foreground">{employee.name}</p>
                {employee.email ? (
                  <p className="text-sm text-muted-foreground">{employee.email}</p>
                ) : null}
                {employee.lastEvent ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Last {employee.lastEvent.type.replace('_', ' ')} ·{' '}
                    {formatAttendanceTime(employee.lastEvent.recordedAt)}
                    {employee.lastEvent.biometricVerified
                      ? ' · Biometric verified'
                      : ''}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    No activity today
                  </p>
                )}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  employee.isClockedIn
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {employee.isClockedIn ? 'On duty' : 'Off duty'}
              </span>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
