// Seed Robot Adventure scheduler with real data extracted from the source PDF.
// Run: bun run scripts/seed.ts
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const tursoUrl = process.env.TURSO_URL
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN

let db: PrismaClient
if (tursoUrl) {
  const libsql = createClient({ url: tursoUrl, authToken: tursoAuthToken })
  const adapter = new PrismaLibSql(libsql)
  db = new PrismaClient({ adapter } as any)
} else {
  db = new PrismaClient()
}

type StaffSeed = {
  name: string
  sex?: string
  role: string
  roleTier: string
  skills: string
  available?: string
  unavailable?: string // comma-separated YYYY-MM-DD
  contractSigned?: boolean
  notes?: string
}

const STAFF: StaffSeed[] = [
  { name: 'Jelani Payne', sex: 'Male', role: 'Chief Instructor', roleTier: 'Chief', skills: 'Complex STEM,Robotics,Coding', available: 'July, August, September', contractSigned: true },
  { name: 'Zavier Brathwaite', sex: 'Male', role: 'Junior / Lead Instructor', roleTier: 'Junior', skills: 'Foundation STEM', available: 'August, September', contractSigned: true, notes: 'Volunteering at labs some weekends' },
  { name: 'Michaela Gittens', sex: 'Female', role: 'Junior / Lead Instructor', roleTier: 'Junior', skills: 'Foundation STEM,Complex STEM,Comp Sci', available: 'July, August', contractSigned: true, unavailable: '2026-07-06,2026-07-10,2026-07-20,2026-07-14' },
  { name: 'Owen Waldron', sex: 'Male', role: 'Junior / Lead Instructor', roleTier: 'Junior', skills: 'Complex STEM,Engineering', available: 'July, August, September', contractSigned: false },
  { name: 'Nathan Reid', sex: 'Male', role: 'Senior Instructor', roleTier: 'Senior', skills: 'Complex STEM,Robotics,Coding', available: 'June 17 - August 31', contractSigned: true, unavailable: '2026-07-09,2026-07-11,2026-07-03' },
  { name: 'Chloe Cave', sex: 'Female', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Complex STEM,Coding,Comp Sci', available: 'July, August, September', contractSigned: true, notes: 'September schedule TBC due to university' },
  { name: 'Rhianne Gill', sex: 'Female', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Complex STEM,Robotics,Coding', available: 'Awaiting confirmation', contractSigned: false },
  { name: 'Taria Jackman', sex: 'Female', role: 'Senior Instructor', roleTier: 'Senior', skills: 'Complex STEM,Robotics,Coding', available: 'July 13 - August 25', contractSigned: true },
  { name: 'Rashawn Mayers', sex: 'Male', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Complex STEM,Robotics,Coding', available: 'July, August, September', contractSigned: true },
  { name: 'Ormalleo Outram', sex: 'Male', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Complex STEM,Robotics,Coding', available: 'June 5 - August 31', contractSigned: true },
  { name: 'Cleopatra Edwards', sex: 'Female', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Complex STEM', available: 'July 5 - September', contractSigned: true, unavailable: '2026-07-01,2026-07-02,2026-07-03,2026-07-04,2026-07-05,2026-07-10,2026-07-11,2026-07-12' },
  { name: 'Terje Barker', sex: 'Male', role: 'Intern', roleTier: 'Intern', skills: 'Foundation STEM,Coding,Robotics', available: 'July, August', contractSigned: false },
  { name: 'Alvin Herbert', sex: 'Male', role: 'Junior / Senior Instructor', roleTier: 'Senior', skills: 'Complex STEM,Robotics,Coding', available: 'July, August', contractSigned: true, unavailable: '2026-08-06' },
  { name: 'Terrence Mayers', sex: 'Male', role: 'Intern', roleTier: 'Intern', skills: 'Foundation STEM', available: 'July, August', contractSigned: false },
  { name: 'Ceejay Cumberbatch', sex: 'Male', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Complex STEM,Robotics', available: 'July, August, September', contractSigned: true, unavailable: '2026-07-13,2026-07-14,2026-07-15,2026-07-16,2026-07-17,2026-07-18,2026-07-19,2026-07-20,2026-07-21,2026-07-22,2026-07-23,2026-07-24' },
  { name: 'Cheryse Greenidge', sex: 'Female', role: 'Senior Instructor', roleTier: 'Senior', skills: 'Complex STEM', available: 'July, August', contractSigned: true, unavailable: '2026-07-08' },
  { name: 'deVere James', sex: 'Male', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Robotics,Coding', available: 'July 17 onwards', contractSigned: true, notes: 'Available from 17 July' },
  { name: 'Krea Edwards', sex: 'Female', role: 'Intern', roleTier: 'Intern', skills: 'Foundation STEM', available: 'July, August', contractSigned: true, unavailable: '2026-07-11,2026-07-12,2026-07-13,2026-07-14,2026-07-15,2026-07-16,2026-07-17' },
  { name: 'Annison Roachford', sex: 'Male', role: 'Intern', roleTier: 'Intern', skills: 'Foundation STEM', available: 'July, August', contractSigned: true, unavailable: '2026-07-12,2026-07-13,2026-07-14,2026-07-15,2026-07-16,2026-07-17,2026-07-18,2026-07-19,2026-07-20,2026-07-21' },
  // Added Darrel Springer — appears on the July calendar (Church VBS, Liliplum workshop)
  // but wasn't in the original instructor table. Role guessed; boss can edit in the Events/staff view.
  { name: 'Darrel Springer', sex: 'Male', role: 'Instructor', roleTier: 'Junior', skills: 'Robotics', available: 'July, August', contractSigned: false, notes: 'Appears on July calendar; not in original staff table' },
]

type EventSeed = {
  code?: string
  name: string
  host: string
  hostColor: string
  location?: string
  description?: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  status?: string
  specificDates?: string[] // if set, event only shows on these dates
  ageRange?: string
  participantCount?: number
  requiredInstructors: number
  skills: string[]
  notes?: string
  lengthDays?: number
}

const EVENTS: EventSeed[] = [
  // ----- DEFINITIVE events (show on calendar) -----
  {
    code: 'WSB-1', name: 'WSB — Aerial Robotics', host: 'TVETC / WSB', hostColor: 'teal',
    location: 'Samuel Jackman Prescod Institute (SJPI)',
    description: 'Aerial Robotics (Drones / UAS) + Python programming',
    startDate: '2026-07-06', endDate: '2026-07-10', startTime: '09:00', endTime: '15:00',
    status: 'Confirmed', ageRange: '10-16', participantCount: 25, requiredInstructors: 5,
    skills: ['Aerial Robotics', 'Python', 'Robotics'],
    notes: 'Drone hardware + Python programming'
  },
  {
    code: 'WSB-2', name: 'WSB — 3D Printing & Digital Design', host: 'TVETC / WSB', hostColor: 'teal',
    location: 'Samuel Jackman Prescod Institute (SJPI)',
    description: 'Computer Aided Design (CAD), 3D Printing',
    startDate: '2026-07-20', endDate: '2026-07-24', startTime: '09:00', endTime: '15:00',
    status: 'Confirmed', ageRange: '10-16', participantCount: 17, requiredInstructors: 5,
    skills: ['CAD', '3D Printing', 'Electronics']
  },
  {
    code: 'MEdT-4', name: 'True Blue Summer', host: 'MEdT', hostColor: 'emerald',
    location: 'Oceana Innovation Hub, Bay Street',
    description: 'STEAM, Renewable Energy, Energy Science',
    startDate: '2026-07-27', endDate: '2026-08-28', startTime: '09:00', endTime: '15:00',
    status: 'Confirmed', ageRange: '13-18', participantCount: 25, requiredInstructors: 4, lengthDays: 25,
    skills: ['Robotics', 'Renewable Energy', 'Energy Science', 'Electronics'],
    notes: 'Sargassum Seaweed Cleanup Prototype project'
  },
  {
    code: 'LPK-10', name: 'Liliplum Kids — Workshop 1 (Chameleon)', host: 'Liliplum Kids', hostColor: 'pink',
    location: 'Dwellings, St. Thomas',
    description: 'KidzRobotix Chameleon — build a crawling robotic reptile',
    startDate: '2026-07-11', endDate: '2026-07-11', startTime: '13:00', endTime: '14:30',
    status: 'Confirmed', ageRange: '8-11', participantCount: 12, requiredInstructors: 2,
    skills: ['Robotics']
  },
  {
    code: 'LPK-11', name: 'Liliplum Kids — Workshop 2 (Hydrant Robot)', host: 'Liliplum Kids', hostColor: 'pink',
    location: 'Dwellings, St. Thomas',
    description: 'KidzRobotix Hydrant Robot — 4M kit build',
    startDate: '2026-08-22', endDate: '2026-08-22', startTime: '13:00', endTime: '14:30',
    status: 'Confirmed', ageRange: '8-11', participantCount: 10, requiredInstructors: 2,
    skills: ['Robotics']
  },
  {
    code: 'DYC-12', name: 'SDC Girls Summer Programme', host: 'Division of Youth & Culture', hostColor: 'rose',
    location: 'St. Giles Primary School',
    description: 'Renewable Energy (Solar) + Mobile Robotics',
    startDate: '2026-07-27', endDate: '2026-07-31', startTime: '09:00', endTime: '15:00',
    status: 'Confirmed', ageRange: '10-15', participantCount: 20, requiredInstructors: 3,
    skills: ['Renewable Energy', 'Robotics', 'Mobile Robotics', 'Programming']
  },
  {
    code: 'DYC-14', name: 'National Youth Day', host: 'Division of Youth & Culture', hostColor: 'rose',
    location: 'TBD',
    description: 'Renewable Energy + Mobile + Aerial + Underwater Robotics showcase',
    startDate: '2026-08-12', endDate: '2026-08-12', startTime: '09:00', endTime: '15:00',
    status: 'Confirmed', ageRange: '4-15', participantCount: 2500, requiredInstructors: 9,
    skills: ['Renewable Energy', 'Robotics', 'Mobile Robotics', 'Aerial Robotics']
  },
  // The July 8 event the user pointed out was missing — Church VBS.
  {
    code: 'EXT-VBS', name: 'Church VBS — Robotics Session', host: 'External', hostColor: 'slate',
    location: 'TBD',
    description: 'Robotics session at a church Vacation Bible School programme',
    startDate: '2026-07-08', endDate: '2026-07-08', startTime: '09:00', endTime: '12:00',
    status: 'Confirmed', ageRange: '4-12', requiredInstructors: 3,
    skills: ['Robotics']
  },
  // The July 15 Oceana Tour — appears on the source calendar but is distinct
  // from the MEdT-3 Underwater Robotics exhibition (which runs longer with TBD dates).
  {
    code: 'MEdT-TOUR', name: 'Oceana Innovation Hub Tour', host: 'MEdT', hostColor: 'emerald',
    location: 'Oceana Innovation Hub, Bay Street',
    description: 'Guided tour of the Oceana Innovation Hub facilities',
    startDate: '2026-07-15', endDate: '2026-07-15', startTime: '09:00', endTime: '11:00',
    status: 'Confirmed', ageRange: 'Varies', requiredInstructors: 4,
    skills: []
  },

  // ----- DRAFT events (dates not confirmed — do NOT show on calendar) -----
  {
    code: 'MEdT-3', name: 'Exhibitions — Underwater Robotics', host: 'MEdT', hostColor: 'emerald',
    location: 'Oceana Innovation Hub, Bay Street',
    description: 'Renewable Energy, Mobile Robotics, Solar, Wind — 2-week exhibition',
    startDate: '2026-07-15', endDate: '2026-07-28', startTime: '09:00', endTime: '15:00',
    status: 'Draft', ageRange: 'TBD', requiredInstructors: 4, lengthDays: 10,
    skills: ['Robotics', 'Renewable Energy', 'Solar', 'Wind'],
    notes: 'Specific dates TBD — set in the Events tab once confirmed'
  },
  {
    code: 'MYSCE-5', name: 'Energy Camp 1 — MYSCE', host: 'MYSCE', hostColor: 'amber',
    location: 'TBD', description: 'Energy Science Day — Solar focus',
    startDate: '2026-07-13', endDate: '2026-07-13', startTime: '09:00', endTime: '12:00',
    status: 'Draft', ageRange: '8-15', participantCount: 44, requiredInstructors: 6,
    skills: ['Energy Science', 'Solar', 'Renewable Energy']
  },
  {
    code: 'MYSCE-6', name: 'Energy Camp 2 — MYSCE', host: 'MYSCE', hostColor: 'amber',
    location: 'TBD', description: 'Energy Science Day — Solar focus',
    startDate: '2026-07-13', endDate: '2026-07-13', startTime: '09:00', endTime: '12:00',
    status: 'Draft', ageRange: '8-15', participantCount: 44, requiredInstructors: 6,
    skills: ['Energy Science', 'Solar', 'Renewable Energy']
  },
  {
    code: 'MYSCE-7', name: 'Energy Camp 3 — MYSCE', host: 'MYSCE', hostColor: 'amber',
    location: 'TBD', description: 'Energy Science Day — Solar focus',
    startDate: '2026-07-13', endDate: '2026-07-13', startTime: '09:00', endTime: '12:00',
    status: 'Draft', ageRange: '8-15', participantCount: 44, requiredInstructors: 6,
    skills: ['Energy Science', 'Solar', 'Renewable Energy']
  },
  {
    code: 'MYSCE-8', name: 'Energy Camp 4 — MYSCE', host: 'MYSCE', hostColor: 'amber',
    location: 'TBD', description: 'Energy Science Day — Solar focus',
    startDate: '2026-07-13', endDate: '2026-07-13', startTime: '09:00', endTime: '12:00',
    status: 'Draft', ageRange: '8-15', participantCount: 44, requiredInstructors: 6,
    skills: ['Energy Science', 'Solar', 'Renewable Energy']
  },
  {
    code: 'MYSCE-9', name: 'Energy Camp 5 — MYSCE', host: 'MYSCE', hostColor: 'amber',
    location: 'TBD', description: 'Energy Science Day — Solar focus',
    startDate: '2026-07-13', endDate: '2026-07-13', startTime: '09:00', endTime: '12:00',
    status: 'Draft', ageRange: '8-15', participantCount: 44, requiredInstructors: 6,
    skills: ['Energy Science', 'Solar', 'Renewable Energy']
  },
  {
    code: 'DYC-13', name: 'National Summer Programme', host: 'Division of Youth & Culture', hostColor: 'rose',
    location: 'Various',
    description: 'Mobile Robotics workshops — multi-site, 1-2 days per week for 6 weeks',
    startDate: '2026-07-13', endDate: '2026-08-21', startTime: '09:00', endTime: '15:00',
    status: 'Draft', ageRange: '4-15', requiredInstructors: 4,
    skills: ['Mobile Robotics', 'Programming', 'Robotics'],
    notes: 'Specific weekdays TBD — set in the Events tab once confirmed'
  },
  {
    code: 'MYSCE-15', name: 'Grazettes Community — Robotics', host: 'MYSCE', hostColor: 'amber',
    location: 'Grazettes Community Centre',
    description: 'Mobile Robotics workshop — 1 day per week for 6 weeks',
    startDate: '2026-07-13', endDate: '2026-08-21', startTime: '09:00', endTime: '11:30',
    status: 'Draft', ageRange: '4-15', participantCount: 60, requiredInstructors: 5,
    skills: ['Mobile Robotics', 'Robotics'],
    notes: 'Specific weekday TBD — set in the Events tab once confirmed'
  },
]

// Pre-existing assignments observed in the July calendar of the source PDF.
// Only the days that were explicitly listed.
const PRESET_ASSIGNMENTS: { eventCode: string; date: string; staff: { name: string; alt?: boolean; shirt?: string }[] }[] = [
  { eventCode: 'WSB-1', date: '2026-07-06', staff: [
    { name: 'Nathan Reid', shirt: 'Orange' },
    { name: 'Ormalleo Outram', shirt: 'Orange' },
    { name: 'Cheryse Greenidge', shirt: 'Orange' },
    { name: 'Alvin Herbert', shirt: 'Orange' },
    { name: 'Annison Roachford', shirt: 'Orange' },
  ]},
  { eventCode: 'WSB-1', date: '2026-07-07', staff: [
    { name: 'Nathan Reid', shirt: 'Blue' },
    { name: 'Ormalleo Outram', shirt: 'Blue' },
    { name: 'Cheryse Greenidge', shirt: 'Blue' },
    { name: 'Alvin Herbert', shirt: 'Blue' },
    { name: 'Annison Roachford', shirt: 'Blue' },
  ]},
  { eventCode: 'WSB-1', date: '2026-07-08', staff: [
    { name: 'Nathan Reid', shirt: 'Purple' },
    { name: 'Ormalleo Outram', shirt: 'Purple' },
    { name: 'Alvin Herbert', shirt: 'Purple' },
    { name: 'Annison Roachford', shirt: 'Purple' },
    // Cheryse unavailable Jul 8
  ]},
  { eventCode: 'WSB-1', date: '2026-07-09', staff: [
    { name: 'Ormalleo Outram', shirt: 'Grey' },
    { name: 'Cheryse Greenidge', shirt: 'Grey' },
    { name: 'Alvin Herbert', shirt: 'Grey' },
    { name: 'Annison Roachford', shirt: 'Grey' },
    // Nathan unavailable Jul 9
  ]},
  { eventCode: 'WSB-1', date: '2026-07-10', staff: [
    { name: 'Nathan Reid', shirt: 'Orange' },
    { name: 'Ormalleo Outram', shirt: 'Orange' },
    { name: 'Cheryse Greenidge', shirt: 'Orange' },
    { name: 'Alvin Herbert', shirt: 'Orange' },
    { name: 'Annison Roachford', shirt: 'Orange' },
  ]},
  { eventCode: 'EXT-VBS', date: '2026-07-08', staff: [
    { name: 'Darrel Springer', shirt: 'Purple' },
    { name: 'Ceejay Cumberbatch', shirt: 'Purple' },
    { name: 'Krea Edwards', shirt: 'Purple' },
  ]},
  { eventCode: 'LPK-10', date: '2026-07-11', staff: [
    { name: 'Darrel Springer', shirt: 'Blue' },
    { name: 'Cheryse Greenidge', shirt: 'Blue' },
    { name: 'Annison Roachford', shirt: 'Blue' },
  ]},
  { eventCode: 'MEdT-TOUR', date: '2026-07-15', staff: [
    { name: 'Alvin Herbert', shirt: 'Purple' },
    { name: 'Chloe Cave', shirt: 'Purple' },
    { name: 'Ceejay Cumberbatch', shirt: 'Purple' },
    { name: 'Krea Edwards', shirt: 'Purple' },
  ]},
]

async function main() {
  console.log('Clearing existing data...')
  await db.assignment.deleteMany()
  await db.optIn.deleteMany()
  await db.user.deleteMany()
  await db.eventSkill.deleteMany()
  await db.event.deleteMany()
  await db.profile.deleteMany()

  console.log(`Seeding ${STAFF.length} staff profiles...`)
  const profileMap = new Map<string, string>()
  for (const s of STAFF) {
    const p = await db.profile.create({ data: s })
    profileMap.set(s.name, p.id)
  }

  console.log(`Seeding ${EVENTS.length} events...`)
  const eventCodeMap = new Map<string, string>()
  for (const e of EVENTS) {
    const { skills, startDate, endDate, specificDates, ...rest } = e
    const ev = await db.event.create({
      data: {
        ...rest,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T23:59:59.000Z`),
        specificDates: specificDates?.length ? specificDates.join(',') : null,
      },
    })
    eventCodeMap.set(ev.code!, ev.id)
    for (const skillName of skills) {
      await db.eventSkill.create({ data: { eventId: ev.id, skillName } })
    }
  }

  console.log(`Seeding ${PRESET_ASSIGNMENTS.length} preset assignments...`)
  for (const a of PRESET_ASSIGNMENTS) {
    const eventId = eventCodeMap.get(a.eventCode)
    if (!eventId) {
      console.warn(`  Event not found: ${a.eventCode}`)
      continue
    }
    for (const s of a.staff) {
      const profileId = profileMap.get(s.name)
      if (!profileId) {
        console.warn(`  Staff not found: ${s.name}`)
        continue
      }
      await db.assignment.create({
        data: {
          eventId,
          profileId,
          assignedDate: new Date(`${a.date}T00:00:00.000Z`),
          status: 'Confirmed',
          shirtColor: s.shirt ?? null,
          isAlternative: !!s.alt,
        },
      })
    }
  }

  // Create admin user for Jelani Payne (Chief Instructor = boss)
  // Default password: "changeme" — must be changed on first login
  const bcrypt = await import('bcryptjs')
  const adminPasswordHash = await bcrypt.hash('changeme', 10)
  const jelaniProfile = profileMap.get('Jelani Payne')
  await db.user.create({
    data: {
      name: 'Jelani Payne',
      role: 'admin',
      email: 'jelani@robotadventure.local',
      passwordHash: adminPasswordHash,
      profileId: jelaniProfile ?? null,
      claimedAt: new Date(),
    },
  })

  console.log('\nSeed complete.')
  console.log(`  Profiles:    ${await db.profile.count()}`)
  console.log(`  Events:      ${await db.event.count()}`)
  console.log(`    Confirmed: ${await db.event.count({ where: { status: 'Confirmed' } })}`)
  console.log(`    Draft:     ${await db.event.count({ where: { status: 'Draft' } })}`)
  console.log(`  Skills:      ${await db.eventSkill.count()}`)
  console.log(`  Assignments: ${await db.assignment.count()}`)
  console.log(`  Users:       ${await db.user.count()}`)
  console.log(`\n  Admin login: jelani@robotadventure.local / changeme`)
  console.log(`  ⚠️  Change this password immediately after first login!`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
