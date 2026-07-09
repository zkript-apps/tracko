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
import type { LiveLocationEmployee } from '@/lib/attendance';
import 'leaflet/dist/leaflet.css';

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

function formatUpdatedAgo(iso: string, now: number): string {
  const minutes = Math.max(
    0,
    Math.round((now - new Date(iso).getTime()) / 60_000),
  );

  if (minutes <= 0) {
    return 'Location ping just now';
  }

  if (minutes === 1) {
    return 'Location ping 1 min ago';
  }

  return `Location ping ${minutes} min ago`;
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

  useEffect(() => {
    markerRef.current?.setLatLng(position);
  }, [position]);

  return (
    <Marker ref={markerRef} position={position} icon={markerIcon}>
      <Popup>
        <div className="space-y-1 text-sm">
          <p className="font-medium">{employee.name}</p>
          {employee.email ? (
            <p className="text-muted-foreground">{employee.email}</p>
          ) : null}
          <p className="text-muted-foreground">
            {branchNames[employee.branchId] ?? 'Assigned branch'}
          </p>
          <p className="text-muted-foreground">
            {formatUpdatedAgo(employee.recordedAt, now)}
          </p>
        </div>
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
