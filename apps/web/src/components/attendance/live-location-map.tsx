'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Building2,
  Clock3,
  Crosshair,
  Mail,
} from 'lucide-react';
import type { LiveLocationEmployee } from '@/lib/attendance';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';
import './live-location-map.css';

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

type Freshness = 'live' | 'recent' | 'stale';

function getFreshness(recordedAt: string, now: number): Freshness {
  const ageMs = now - new Date(recordedAt).getTime();

  if (ageMs < 2 * 60_000) {
    return 'live';
  }

  if (ageMs < 10 * 60_000) {
    return 'recent';
  }

  return 'stale';
}

function formatRelativePing(recordedAt: string, now: number): string {
  const ageMs = Math.max(0, now - new Date(recordedAt).getTime());
  const seconds = Math.round(ageMs / 1000);

  if (seconds < 60) {
    return 'Updated just now';
  }

  const minutes = Math.round(ageMs / 60_000);

  if (minutes === 1) {
    return 'Updated 1 min ago';
  }

  if (minutes < 60) {
    return `Updated ${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);
  return hours === 1 ? 'Updated 1 hr ago' : `Updated ${hours} hr ago`;
}

function formatExactTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatAccuracy(accuracy: number | null): string | null {
  if (accuracy == null || !Number.isFinite(accuracy)) {
    return null;
  }

  if (accuracy < 1000) {
    return `±${Math.round(accuracy)} m`;
  }

  return `±${(accuracy / 1000).toFixed(1)} km`;
}

function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        freshness === 'live' &&
          'bg-emerald-500/15 text-emerald-700',
        freshness === 'recent' &&
          'bg-amber-500/15 text-amber-700',
        freshness === 'stale' && 'bg-slate-500/15 text-slate-600',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          freshness === 'live' && 'bg-emerald-500',
          freshness === 'recent' && 'bg-amber-500',
          freshness === 'stale' && 'bg-slate-400',
        )}
      />
      {freshness === 'live' ? 'Live' : freshness === 'recent' ? 'Recent' : 'Stale'}
    </span>
  );
}

function MetaRow({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-xs text-slate-600">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
      <span className="min-w-0 wrap-break-word leading-snug">{children}</span>
    </div>
  );
}

function LocationPopupContent({
  employee,
  branchName,
  now,
}: {
  employee: LiveLocationEmployee;
  branchName: string;
  now: number;
}) {
  const freshness = getFreshness(employee.recordedAt, now);
  const accuracyLabel = formatAccuracy(employee.accuracy);

  return (
    <div className="p-3.5 pr-8">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-sm font-semibold text-emerald-800">
          {getInitials(employee.name)}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">
              {employee.name}
            </p>
            <FreshnessBadge freshness={freshness} />
          </div>
          <p className="text-[11px] text-slate-500">
            {formatRelativePing(employee.recordedAt, now)}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
        {employee.email ? (
          <MetaRow icon={Mail}>{employee.email}</MetaRow>
        ) : null}
        <MetaRow icon={Building2}>{branchName}</MetaRow>
        <MetaRow icon={Clock3}>{formatExactTime(employee.recordedAt)}</MetaRow>
        {accuracyLabel ? (
          <MetaRow icon={Crosshair}>{accuracyLabel} accuracy</MetaRow>
        ) : null}
      </div>
    </div>
  );
}

function FitBounds({ employees }: { employees: LiveLocationEmployee[] }) {
  const map = useMap();

  useEffect(() => {
    if (employees.length === 0) {
      return;
    }

    if (employees.length === 1) {
      map.setView(
        [employees[0].latitude, employees[0].longitude],
        15,
        { animate: true },
      );
      return;
    }

    const bounds = L.latLngBounds(
      employees.map((employee) => [employee.latitude, employee.longitude]),
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [employees, map]);

  return null;
}

function EmployeeMarker({
  employee,
  branchNames,
  now,
}: {
  employee: LiveLocationEmployee;
  branchNames: Record<string, string>;
  now: number;
}) {
  const markerRef = useRef<L.Marker>(null);
  const position: [number, number] = [employee.latitude, employee.longitude];
  const branchName = branchNames[employee.branchId] ?? 'Assigned branch';

  useEffect(() => {
    markerRef.current?.setLatLng(position);
  }, [position]);

  return (
    <Marker ref={markerRef} position={position} icon={markerIcon}>
      <Popup className="tracko-map-popup" closeButton>
        <LocationPopupContent
          employee={employee}
          branchName={branchName}
          now={now}
        />
      </Popup>
    </Marker>
  );
}

export function LiveLocationMap({
  employees,
  branchNames,
}: {
  employees: LiveLocationEmployee[];
  branchNames: Record<string, string>;
}) {
  const now = useNow();

  if (employees.length === 0) {
    return (
      <div className="flex h-[560px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center text-sm text-muted-foreground">
        No live locations yet. Employees appear here when they are on duty and
        sharing location from the employee portal.
      </div>
    );
  }

  const center: [number, number] = [
    employees[0].latitude,
    employees[0].longitude,
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        className="h-[560px] w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds employees={employees} />
        {employees.map((employee) => (
          <EmployeeMarker
            key={employee.userId}
            employee={employee}
            branchNames={branchNames}
            now={now}
          />
        ))}
      </MapContainer>
    </div>
  );
}
