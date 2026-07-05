import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { MongoClient, ObjectId } from 'mongodb';

const userId = process.argv[2] ?? '6a4950654ba6daa4441fa1e2';
const year = Number(process.argv[3] ?? '2026');
const month = Number(process.argv[4] ?? '6'); // June

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const uri = env.match(/MONGODB_URI=(.+)/)?.[1]?.trim();
if (!uri) {
  throw new Error('MONGODB_URI not found in .env');
}

function createId() {
  return randomBytes(12).toString('hex');
}

function localDate(year, month, day, hour, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function enumerateWeekdays(year, month) {
  const dates = [];
  const cursor = new Date(year, month - 1, 1);
  while (cursor.getMonth() === month - 1) {
    if (isWeekday(cursor)) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

// Overtime days: every 2nd and 4th Friday + a couple mid-week spikes
function overtimeMinutesForDate(date) {
  const day = date.getDate();
  const weekday = date.getDay();
  if (weekday === 5 && (day === 5 || day === 19)) {
    return 120; // 2 hrs OT on 2nd and 4th Friday
  }
  if (weekday === 3 && day === 10) {
    return 90; // 1.5 hrs OT mid-month Wednesday
  }
  if (weekday === 2 && day === 24) {
    return 60; // 1 hr OT
  }
  return 0;
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const assignment = await db.collection('branch_assignments').findOne({ userId });
  if (!assignment) {
    throw new Error(`No branch assignment for user ${userId}`);
  }

  const user =
    (await db.collection('user').findOne({ _id: userId })) ??
    (await db.collection('user').findOne({ _id: new ObjectId(userId) }));

  const organizationId = String(assignment.organizationId);
  const branchId = String(assignment.branchId);
  const weekdays = enumerateWeekdays(year, month);

  const rangeStart = localDate(year, month, 1, 0);
  const rangeEnd = localDate(year, month + 1, 0, 23, 59);

  const deleted = await db.collection('attendance_events').deleteMany({
    userId,
    recordedAt: { $gte: rangeStart, $lte: rangeEnd },
  });

  const events = [];
  const now = new Date();

  for (const date of weekdays) {
    const day = date.getDate();
    const otMinutes = overtimeMinutesForDate(date);
    const clockIn = localDate(year, month, day, 9, 0);
    const clockOut = localDate(year, month, day, 17 + Math.floor(otMinutes / 60), otMinutes % 60);

    events.push({
      _id: createId(),
      organizationId,
      userId,
      branchId,
      type: 'clock_in',
      recordedAt: clockIn,
      createdAt: now,
    });
    events.push({
      _id: createId(),
      organizationId,
      userId,
      branchId,
      type: 'clock_out',
      recordedAt: clockOut,
      createdAt: now,
    });
  }

  if (events.length > 0) {
    await db.collection('attendance_events').insertMany(events);
  }

  const totalMinutes = weekdays.reduce((sum, date) => {
    return sum + 8 * 60 + overtimeMinutesForDate(date);
  }, 0);

  console.log(
    JSON.stringify(
      {
        user: user
          ? { id: String(user._id), name: user.name, email: user.email }
          : { id: userId },
        organizationId,
        branchId,
        period: `${year}-${String(month).padStart(2, '0')}`,
        weekdaysSeeded: weekdays.length,
        eventsInserted: events.length,
        previousEventsRemoved: deleted.deletedCount,
        totalWorkedHours: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
        overtimeDays: weekdays
          .filter((date) => overtimeMinutesForDate(date) > 0)
          .map((date) => ({
            date: date.toISOString().slice(0, 10),
            overtime: `${overtimeMinutesForDate(date)}m`,
          })),
      },
      null,
      2,
    ),
  );

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
