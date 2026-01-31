import ModuleCard from '../components/ModuleCard'
import { Stethoscope, FlaskConical, Pill, FileText, PhoneIncoming } from 'lucide-react'
import { useRef } from 'react'
import './home.css'

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null)
  const onHeroMove = (e: React.MouseEvent) => {
    const el = heroRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const midX = rect.width / 2
    const midY = rect.height / 2
    const rotX = ((midY - y) / midY) * 6
    const rotY = ((x - midX) / midX) * 6
    el.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg)`
  }
  const onHeroLeave = () => {
    const el = heroRef.current
    if (el) el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)'
  }

  const modules = [
    { to: '/hospital/login', title: 'Hospital', description: 'Appointments, admissions, billing, and EMR.', icon: <Stethoscope className="size-7 text-sky-600" />, tone: 'sky' as const },
    { to: '/finance', title: 'Finance', description: 'Financial management and accounting.', icon: <FileText className="size-7 text-amber-600" />, tone: 'amber' as const },
    { to: '/reception', title: 'Reception', description: 'Front-desk, patient registration, and triage.', icon: <PhoneIncoming className="size-7 text-teal-600" />, tone: 'teal' as const },
  ]

  const featureSections = [
    {
      title: 'OPD',
      description:
        'Optimize patient flow with an efficient appointment scheduling and token management system to significantly reduce waiting times. Manage daily patient volume effortlessly, maintaining comprehensive digital records of visits, vitals, and initial prescriptions in one view.',
    },
    {
      title: 'Finance',
      description:
        'Streamlines your billing process by generating accurate invoices, tracking daily revenue, and managing payment history, ensuring complete financial control and transparency.',
    },
    {
      title: 'IPD',
      description:
        'Streamline the entire admission-to-discharge journey with real-time bed management, nursing notes, and round-the-clock patient monitoring. Ensure accurate billing for room charges and services while maintaining seamless coordination between wards and clinical departments.',
    },
    {
      title: 'Doctor portal',
      description:
        'Empower physicians with a dedicated interface to view daily schedules, access patient EMRs, and prescribe treatments digitally from any device. Easy access to e-prescription and facilitate better time management and remote access to critical patient data, allowing for faster and more accurate consultations.',
    },
    {
      title: 'Staff management',
      description:
        'Maintains employee records, duty rosters, and shift schedules. Tracks attendance, performance, and payroll integrations. Ensures efficient staff utilization across all departments.',
    },
  ]

  return (
    <div className="min-h-dvh relative overflow-hidden">
      <div className="home-grid" />
      <div className="home-spotlight" />
      <div className="home-orb" style={{ left: '-160px', top: '-120px' }} />
      <div className="home-orb secondary" style={{ right: '-140px', bottom: '-160px' }} />

      <header className="relative z-10 mx-auto max-w-6xl px-6 pt-12 text-center home-hero">
        <div ref={heroRef} onMouseMove={onHeroMove} onMouseLeave={onHeroLeave} className="home-hero-tilt mx-auto">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight"
            style={{
              transform: 'translateZ(60px)',
              backgroundImage: 'linear-gradient(90deg, #0f2d5c 0%, #3b82f6 50%, #0f2d5c 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Complete Hospital Management System
          </h1>
          <p className="mt-3 text-slate-600" style={{ transform: 'translateZ(24px)' }}>Select a module to start</p>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-6 md:grid-cols-2">
          {modules.map((m, i) => (
            <div key={m.title} className="home-card-appear" style={{ animationDelay: `${i * 90}ms` }}>
              <ModuleCard {...m} />
            </div>
          ))}
        </div>
        <section className="mt-12 space-y-8">
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900 text-center md:text-left">
            Hospital workflows at a glance
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featureSections.map((section) => (
              <div
                key={section.title}
                className="rounded-2xl bg-white/80 backdrop-blur border border-slate-200 p-5 shadow-sm"
              >
                <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
                <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{section.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

