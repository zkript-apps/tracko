import Link from 'next/link';

const features = [
  'Time in / time out with location context',
  'Automated daily time records (DTR)',
  'Live location tracking for field teams',
  'Leave requests and approvals',
  'Payroll computed from attendance data',
  'Employee records and document storage',
  'Shift reminders and missed check-in alerts',
];

const tiers = [
  { name: 'Small', employees: 'Up to 20', note: 'Entry-level tier' },
  { name: 'Medium', employees: '21–100', note: 'Standard tier' },
  { name: 'Enterprise', employees: '100+', note: 'Custom pricing & support' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-400">
              Tracko
            </p>
            <p className="text-sm text-slate-400">Tracko SaaS Platform</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
            >
              Sign in
            </Link>
            <a
              href="#pricing"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
            >
              View plans
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-3xl space-y-6">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
              Multi-tenant workforce platform
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Digital time tracking, DTR, leave, and payroll — without building from scratch.
            </h1>
            <p className="text-lg leading-8 text-slate-300">
              Tracko gives Philippine SMBs an affordable subscription platform for
              attendance, field monitoring, leave management, and payroll. Each company
              gets a private, isolated environment — like Microsoft 365, but built for
              workforce operations.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#pricing"
                className="rounded-lg bg-emerald-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-emerald-400"
              >
                Subscribe & get started
              </a>
              <a
                href="https://github.com/zkript-apps/tracko"
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-700 px-5 py-3 text-slate-200 transition hover:border-slate-500"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-800 bg-slate-900/40">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-white">What we&apos;re building</h2>
              <p className="text-slate-300">
                A two-part platform: a mobile app for employees to clock in, request
                leave, and view attendance; and a web admin panel for HR and managers
                to monitor teams, approve requests, and export payroll-ready reports.
              </p>
            </div>
            <ul className="grid gap-3">
              {features.map((feature) => (
                <li
                  key={feature}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300"
                >
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="mb-3 text-2xl font-semibold text-white">Subscription tiers</h2>
          <p className="mb-8 max-w-2xl text-slate-400">
            After payment, we send an invitation link to create your admin account
            and set up your organization.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {tiers.map((tier) => (
              <article
                key={tier.name}
                className="rounded-xl border border-slate-800 bg-slate-900 p-6"
              >
                <h3 className="text-lg font-medium text-white">{tier.name}</h3>
                <p className="mt-2 text-emerald-400">{tier.employees} employees</p>
                <p className="mt-3 text-sm text-slate-400">{tier.note}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
