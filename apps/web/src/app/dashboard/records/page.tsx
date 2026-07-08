'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth-client';
import {
  formatEmploymentType,
  listEmployeeRecords,
  type EmployeeRecord,
} from '@/lib/employees';
import { isHrRole, isOrgAdminRole } from '@/lib/org-roles';
import { getTeamOverview, type TeamOverview } from '@/lib/team';

function getHeadOfficeBranchId(team: TeamOverview): string {
  return (
    team.branches.find((branch) => branch.isHeadOffice)?._id ??
    team.branches[0]?._id ??
    ''
  );
}

function formatBranchName(branch: TeamOverview['branches'][number]): string {
  return `${branch.name}${branch.isHeadOffice ? ' (Head office)' : ''}${
    branch.city ? ` — ${branch.city}` : ''
  }`;
}

function canAccessEmployeeRecords(team: TeamOverview): boolean {
  const member = team.currentMember;
  if (!member) {
    return false;
  }

  return (
    member.canManageTeam ||
    member.canInviteEmployees ||
    isHrRole(member.role)
  );
}

export default function EmployeeRecordsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const isAdmin = isOrgAdminRole(team?.currentMember?.role);

  useEffect(() => {
    if (!session) {
      return;
    }

    void getTeamOverview()
      .then((overview) => {
        if (!canAccessEmployeeRecords(overview)) {
          router.replace('/dashboard');
          return;
        }

        setTeam(overview);

        const defaultBranchId = isOrgAdminRole(overview.currentMember?.role)
          ? getHeadOfficeBranchId(overview)
          : overview.currentMember?.assignedBranchId ??
            getHeadOfficeBranchId(overview);

        if (defaultBranchId) {
          setBranchFilter(defaultBranchId);
        } else if (overview.branches[0]) {
          setBranchFilter(overview.branches[0]._id);
        }

        return listEmployeeRecords();
      })
      .then((records) => {
        if (records) {
          setEmployees(records.employees);
        }
      })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setLoading(false));
  }, [router, session]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      if (branchFilter && employee.branchId !== branchFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query) ||
        (employee.profile.jobTitle ?? '').toLowerCase().includes(query)
      );
    });
  }, [branchFilter, employees, search]);

  const selectedBranch = useMemo(
    () => team?.branches.find((branch) => branch._id === branchFilter) ?? null,
    [branchFilter, team],
  );

  if (loading || !team) {
    return (
      <div className="space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Employee records</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Profiles, documents, and linked attendance history for your workforce.
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {isAdmin ? (
            <label className="block space-y-2">
              <span className="text-sm text-muted-foreground">Branch</span>
              <select
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                className="flex h-10 w-full min-w-[220px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {team.branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {formatBranchName(branch)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Branch
              </p>
              <p className="mt-1 font-medium text-foreground">
                {selectedBranch?.name ?? 'Assigned branch'}
              </p>
            </div>
          )}

          <label className="block space-y-2 sm:min-w-[280px]">
            <span className="text-sm text-muted-foreground">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, or job title"
                className="pl-9"
              />
            </div>
          </label>
        </div>

        <p className="text-sm text-muted-foreground">
          {filteredEmployees.length}{' '}
          {filteredEmployees.length === 1 ? 'employee' : 'employees'}
          {selectedBranch ? ` · ${selectedBranch.name}` : ''}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Job title</th>
              <th className="px-4 py-3 font-medium">Employment</th>
              <th className="px-4 py-3 font-medium">Hire date</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No employees match your filters.
                </td>
              </tr>
            ) : (
              filteredEmployees.map((employee) => (
                <tr
                  key={employee.userId}
                  className="border-b border-border/70 last:border-b-0"
                >
                  <td className="px-4 py-4">
                    <p className="font-medium text-foreground">{employee.name}</p>
                    <p className="mt-1 text-muted-foreground">{employee.email}</p>
                  </td>
                  <td className="px-4 py-4 text-foreground">
                    {employee.profile.jobTitle ?? '—'}
                  </td>
                  <td className="px-4 py-4 text-foreground">
                    {formatEmploymentType(employee.profile.employmentType)}
                  </td>
                  <td className="px-4 py-4 text-foreground">
                    {employee.profile.hireDate}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/dashboard/employees/${employee.userId}`}
                      className="text-sm font-medium text-primary transition hover:text-primary/80"
                    >
                      Open record
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
