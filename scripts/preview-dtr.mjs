import { readFileSync } from 'fs';
import { MongoClient } from 'mongodb';

const userId = '6a4950654ba6daa4441fa1e2';
const env = readFileSync('.env', 'utf8');
const uri = env.match(/MONGODB_URI=(.+)/)?.[1]?.trim();

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function formatMinutes(minutes) {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const events = await db
    .collection('attendance_events')
    .find({
      userId,
      recordedAt: {
        $gte: new Date('2026-06-01T00:00:00'),
        $lte: new Date('2026-06-30T23:59:59'),
      },
    })
    .sort({ recordedAt: 1 })
    .toArray();

  const grouped = new Map();
  for (const event of events) {
    const key = localDateKey(event.recordedAt);
    const bucket = grouped.get(key) ?? [];
    bucket.push(event);
    grouped.set(key, bucket);
  }

  const records = [...grouped.entries()].map(([date, dayEvents]) => {
    const sorted = dayEvents.sort(
      (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
    );
    const clockIn = sorted.find((event) => event.type === 'clock_in');
    const clockOut = [...sorted]
      .reverse()
      .find((event) => event.type === 'clock_out');
    const minutes =
      clockIn && clockOut
        ? Math.round(
            (clockOut.recordedAt.getTime() - clockIn.recordedAt.getTime()) /
              60000,
          )
        : 0;

    return {
      date,
      timeIn: clockIn ? formatTime(clockIn.recordedAt) : '—',
      timeOut: clockOut ? formatTime(clockOut.recordedAt) : '—',
      worked: formatMinutes(minutes),
      ot: minutes > 480 ? `+${formatMinutes(minutes - 480)}` : '',
    };
  });

  const totalMinutes = records.reduce((sum, record) => {
    const match = record.worked.match(/(\d+)h (\d+)m/);
    if (!match) return sum;
    return sum + Number(match[1]) * 60 + Number(match[2]);
  }, 0);

  console.log('Branch 2 Employee — June 2026 DTR preview\n');
  console.log('Date       Time in   Time out  Hours     OT');
  console.log('---------  --------  --------  --------  ------');
  for (const record of records) {
    console.log(
      `${record.date}  ${record.timeIn.padEnd(8)}  ${record.timeOut.padEnd(8)}  ${record.worked.padEnd(8)}  ${record.ot}`,
    );
  }
  console.log(`\nTotal: ${formatMinutes(totalMinutes)} across ${records.length} weekdays`);

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
