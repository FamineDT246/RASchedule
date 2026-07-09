// Seed Robot Adventure scheduler with real data extracted from the source PDF.
// Run: bun run scripts/seed.ts
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

type StaffSeed = {
  name: string
  sex?: string
  role: string
  roleTier: string
  skills: string
  shirtSize?: string
  shirtType?: string
  shirtColors?: string
  available?: string
  unavailable?: string // comma-separated YYYY-MM-DD
  contractSigned?: boolean
  notes?: string
}

const STAFF: StaffSeed[] = [
  { name: 'Jelani Payne', sex: 'Male', role: 'Chief Instructor', roleTier: 'Chief', skills: 'Complex STEM,Robotics,Coding', shirtSize: 'XL', shirtType: 'Male', available: 'July, August, September', contractSigned: true, shirtColors: 'Orange,Blue,Grey,Purple' },
  { name: 'Zavier Brathwaite', sex: 'Male', role: 'Junior / Lead Instructor', roleTier: 'Junior', skills: 'Foundation STEM', shirtSize: 'M', shirtType: 'Male', available: 'August, September', contractSigned: true, shirtColors: 'Orange,Purple,Grey,Blue', notes: 'Volunteering at labs some weekends' },
  { name: 'Michaela Gittens', sex: 'Female', role: 'Junior / Lead Instructor', roleTier: 'Junior', skills: 'Foundation STEM,Complex STEM,Comp Sci', shirtSize: 'M', shirtType: 'Female', available: 'July, August', contractSigned: true, shirtColors: 'Purple,Grey,Blue', unavailable: '2026-07-06,2026-07-10,2026-07-20,2026-07-14' },
  { name: 'Owen Waldron', sex: 'Male', role: 'Junior / Lead Instructor', roleTier: 'Junior', skills: 'Complex STEM,Engineering', shirtSize: 'M/L', shirtType: 'Male', available: 'July, August, September', contractSigned: false, shirtColors: 'Orange,Turquoise,Grey' },
  { name: 'Nathan Reid', sex: 'Male', role: 'Senior Instructor', roleTier: 'Senior', skills: 'Complex STEM,Robotics,Coding', shirtSize: 'SM', shirtType: 'Male', available: 'June 17 - August 31', contractSigned: true, shirtColors: 'Orange,Purple,Black,Blue', unavailable: '2026-07-09,2026-07-11,2026-07-03' },
  { name: 'Chloe Cave', sex: 'Female', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Complex STEM,Coding,Comp Sci', shirtSize: 'SM', shirtType: 'Female', available: 'July, August, September', contractSigned: true, shirtColors: 'Black,Orange,Purple,Grey', notes: 'September schedule TBC due to university' },
  { name: 'Rhianne Gill', sex: 'Female', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Complex STEM,Robotics,Coding', shirtSize: 'M', shirtType: 'Female', available: 'Awaiting confirmation', contractSigned: false },
  { name: 'Taria Jackman', sex: 'Female', role: 'Senior Instructor', roleTier: 'Senior', skills: 'Complex STEM,Robotics,Coding', shirtSize: 'L', shirtType: 'Female', available: 'July 13 - August 25', contractSigned: true, shirtColors: 'Purple,Blue' },
  { name: 'Rashawn Mayers', sex: 'Male', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Complex STEM,Robotics,Coding', shirtSize: 'L', shirtType: 'Male', available: 'July, August, September', contractSigned: true, shirtColors: 'Purple,Orange,Blue' },
  { name: 'Ormalleo Outram', sex: 'Male', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Complex STEM,Robotics,Coding', shirtSize: 'M', shirtType: 'Male', available: 'June 5 - August 31', contractSigned: true, shirtColors: 'Purple,Orange' },
  { name: 'Cleopatra Edwards', sex: 'Female', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Complex STEM', shirtSize: 'M', shirtType: 'Female', available: 'July 5 - September', contractSigned: true, shirtColors: 'Purple', unavailable: '2026-07-01,2026-07-02,2026-07-03,2026-07-04,2026-07-05,2026-07-10,2026-07-11,2026-07-12' },
  { name: 'Terje Barker', sex: 'Male', role: 'Intern', roleTier: 'Intern', skills: 'Foundation STEM,Coding,Robotics', shirtSize: 'M', shirtType: 'Male', available: 'July, August', contractSigned: false, shirtColors: 'Purple' },
  { name: 'Alvin Herbert', sex: 'Male', role: 'Junior / Senior Instructor', roleTier: 'Senior', skills: 'Complex STEM,Robotics,Coding', shirtSize: 'M', shirtType: 'Male', available: 'July, August', contractSigned: true, shirtColors: 'None', unavailable: '2026-08-06' },
  { name: 'Terrence Mayers', sex: 'Male', role: 'Intern', roleTier: 'Intern', skills: 'Foundation STEM', shirtSize: 'M', shirtType: 'Male', available: 'July, August', contractSigned: false, shirtColors: 'Purple,Grey' },
  { name: 'Ceejay Cumberbatch', sex: 'Male', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Complex STEM,Robotics', shirtSize: 'M', shirtType: 'Male', available: 'July, August, September', contractSigned: true, shirtColors: 'None', unavailable: '2026-07-13,2026-07-14,2026-07-15,2026-07-16,2026-07-17,2026-07-18,2026-07-19,2026-07-20,2026-07-21,2026-07-22,2026-07-23,2026-07-24' },
  { name: 'Cheryse Greenidge', sex: 'Female', role: 'Senior Instructor', roleTier: 'Senior', skills: 'Complex STEM', shirtSize: 'M', shirtType: 'Female', available: 'July, August', contractSigned: true, shirtColors: 'None', unavailable: '2026-07-08' },
  { name: 'deVere James', sex: 'Male', role: 'Assistant / Junior Instructor', roleTier: 'Assistant', skills: 'Robotics,Coding', shirtSize: 'L', shirtType: 'Male', available: 'July 17 onwards', contractSigned: true, shirtColors: 'None', notes: 'Available from 17 July' },
  { name: 'Krea Edwards', sex: 'Female', role: 'Intern', roleTier: 'Intern', skills: 'Foundation STEM', shirtSize: 'S', shirtType: 'Female', available: 'July, August', contractSigned: true, shirtColors: 'None', unavailable: '2026-07-11,2026-07-12,2026-07-13,2026-07-14,2026-07-15,2026-07-16,2026-07-17' },
  { name: 'Annison Roachford', sex: 'Male', role: 'Intern', roleTier: 'Intern', skills: 'Foundation STEM', shirtSize: 'M', shirtType: 'Male', available: 'July, August', contractSigned: true, shirtColors: 'None', unavailable: '2026-07-12,2026-07-13,2026-07-14,2026-07-15,2026-07-16,2026-07-17,2026-07-18,2026-07-19,2026-07-20,2026-07-21' },
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
  ageRange?: string
  participantCount?: number
  requiredInstructors: number
  skills: string[]
  notes?: string
  lengthDays?: number
}

const EVENTS: EventSeed[] = [
  {
    code: 'WSB-1', name: 'WSB — Aerial Robotics', host: 'TVETC / WSB', hostColor: 'teal',
    location: 'Samuel Jackman Prescod Institute (SJPI)',
    description: 'Aerial Robotics (Drones / UAS) + Python programming',
    startDate: '2026-07-06', endDate: '2026-07-10', startTime: '09:00', endTime: '15:00',
    ageRange: '10-16', participantCount: 25, requiredInstructors: 5,
    skills: ['Aerial Robotics', 'Python', 'Robotics'],
    notes: 'Drone hardware + Python programming'
  },
  {
    code: 'WSB-2', name: 'WSB — 3D Printing & Digital Design', host: 'TVETC / WSB', hostColor: 'teal',
    location: 'Samuel Jackman Prescod Institute (SJPI)',
    description: 'Computer Aided Design (CAD), 3D Printing',
    startDate: '2026-07-20', endDate: '2026-07-24', startTime: '09:00', endTime: '15:00',
    ageRange: '10-16', participantCount: 17, requiredInstructors: 5,
    skills: ['CAD', '3D Printing', 'Electronics']
  },
  {
    code: 'MEdT-3', name: 'Exhibitions — Underwater Robotics', host: 'MEdT', hostColor: 'emerald',
    location: 'Oceana Innovation Hub, Bay Street',
    description: 'Renewable Energy, Mobile Robotics, Solar, Wind',
    startDate: '2026-07-15', endDate: '2026-07-28', startTime: '09:00', endTime: '15:00',
    status: 'Tentative', ageRange: 'TBD', requiredInstructors: 4, lengthDays: 10,
    skills: ['Robotics', 'Renewable Energy', 'Solar', 'Wind']
  },
  {
    code: 'MEdT-4', name: 'True Blue Summer', host: 'MEdT', hostColor: 'emerald',
    location: 'Oceana Innovation Hub, Bay Street',
    description: 'STEAM, Renewable Energy, Energy Science',
    startDate: '2026-07-27', endDate: '2026-08-28', startTime: '09:00', endTime: '15:00',
    ageRange: '13-18', participantCount: 25, requiredInstructors: 4, lengthDays: 25,
    skills: ['Robotics', 'Renewable Energy', 'Energy Science', 'Electronics'],
    notes: 'Sargassum Seaweed Cleanup Prototype project'
  },
  {
    code: 'MYSCE-5', name: 'Energy Camp 1 — MYSCE', host: 'MYSCE', hostColor: 'amber',
    location: 'TBD', description: 'Energy Science Day — Solar focus',
    startDate: '2026-07-13', endDate: '2026-07-13', startTime: '09:00', endTime: '12:00',
    status: 'Tentative', ageRange: '8-15', participantCount: 44, requiredInstructors: 6,
    skills: ['Energy Science', 'Solar', 'Renewable Energy']
  },
  {
    code: 'MYSCE-6', name: 'Energy Camp 2 — MYSCE', host: 'MYSCE', hostColor: 'amber',
    location: 'TBD', description: 'Energy Science Day — Solar focus',
    startDate: '2026-07-15', endDate: '2026-07-15', startTime: '09:00', endTime: '12:00',
    status: 'Tentative', ageRange: '8-15', participantCount: 44, requiredInstructors: 6,
    skills: ['Energy Science', 'Solar', 'Renewable Energy']
  },
  {
    code: 'MYSCE-7', name: 'Energy Camp 3 — MYSCE', host: 'MYSCE', hostColor: 'amber',
    location: 'TBD', description: 'Energy Science Day — Solar focus',
    startDate: '2026-07-17', endDate: '2026-07-17', startTime: '09:00', endTime: '12:00',
    status: 'Tentative', ageRange: '8-15', participantCount: 44, requiredInstructors: 6,
    skills: ['Energy Science', 'Solar', 'Renewable Energy']
  },
  {
    code: 'MYSCE-8', name: 'Energy Camp 4 — MYSCE', host: 'MYSCE', hostColor: 'amber',
    location: 'TBD', description: 'Energy Science Day — Solar focus',
    startDate: '2026-07-20', endDate: '2026-07-20', startTime: '09:00', endTime: '12:00',
    status: 'Tentative', ageRange: '8-15', participantCount: 44, requiredInstructors: 6,
    skills: ['Energy Science', 'Solar', 'Renewable Energy']
  },
  {
    code: 'MYSCE-9', name: 'Energy Camp 5 — MYSCE', host: 'MYSCE', hostColor: 'amber',
    location: 'TBD', description: 'Energy Science Day — Solar focus',
    startDate: '2026-07-22', endDate: '2026-07-22', startTime: '09:00', endTime: '12:00',
    status: 'Tentative', ageRange: '8-15', participantCount: 44, requiredInstructors: 6,
    skills: ['Energy Science', 'Solar', 'Renewable Energy']
  },
  {
    code: 'LPK-10', name: 'Liliplum Kids — Workshop 1 (Chameleon)', host: 'Liliplum Kids', hostColor: 'pink',
    location: 'Dwellings, St. Thomas',
    description: 'KidzRobotix Chameleon — build a crawling robotic reptile',
    startDate: '2026-07-11', endDate: '2026-07-11', startTime: '13:00', endTime: '14:30',
    ageRange: '8-11', participantCount: 12, requiredInstructors: 2,
    skills: ['Robotics']
  },
  {
    code: 'LPK-11', name: 'Liliplum Kids — Workshop 2 (Hydrant Robot)', host: 'Liliplum Kids', hostColor: 'pink',
    location: 'Dwellings, St. Thomas',
    description: 'KidzRobotix Hydrant Robot — 4M kit build',
    startDate: '2026-08-22', endDate: '2026-08-22', startTime: '13:00', endTime: '14:30',
    ageRange: '8-11', participantCount: 10, requiredInstructors: 2,
    skills: ['Robotics']
  },
  {
    code: 'DYC-12', name: 'SDC Girls Summer Programme', host: 'Division of Youth & Culture', hostColor: 'rose',
    location: 'St. Giles Primary School',
    description: 'Renewable Energy (Solar) + Mobile Robotics',
    startDate: '2026-07-27', endDate: '2026-07-31', startTime: '09:00', endTime: '15:00',
    ageRange: '10-15', participantCount: 20, requiredInstructors: 3,
    skills: ['Renewable Energy', 'Robotics', 'Mobile Robotics', 'Programming']
  },
  {
    code: 'DYC-13', name: 'National Summer Programme', host: 'Division of Youth & Culture', hostColor: 'rose',
    location: 'Various',
    description: 'Mobile Robotics workshops — multi-site',
    startDate: '2026-07-13', endDate: '2026-08-21', startTime: '09:00', endTime: '15:00',
    ageRange: '4-15', requiredInstructors: 4,
    skills: ['Mobile Robotics', 'Programming', 'Robotics']
  },
  {
    code: 'DYC-14', name: 'National Youth Day', host: 'Division of Youth & Culture', hostColor: 'rose',
    location: 'TBD',
    description: 'Renewable Energy + Mobile + Aerial + Underwater Robotics showcase',
    startDate: '2026-08-12', endDate: '2026-08-12', startTime: '09:00', endTime: '15:00',
    ageRange: '4-15', participantCount: 2500, requiredInstructors: 9,
    skills: ['Renewable Energy', 'Robotics', 'Mobile Robotics', 'Aerial Robotics']
  },
  {
    code: 'MYSCE-15', name: 'Grazettes Community — Robotics', host: 'MYSCE', hostColor: 'amber',
    location: 'Grazettes Community Centre',
    description: 'Mobile Robotics workshop — 1 day per week for 6 weeks',
    startDate: '2026-07-13', endDate: '2026-08-21', startTime: '09:00', endTime: '11:30',
    ageRange: '4-15', participantCount: 60, requiredInstructors: 5,
    skills: ['Mobile Robotics', 'Robotics']
  },
]

// Pre-existing assignments observed in the July calendar of the source PDF.
// (Only the ones that were explicitly listed.)
const PRESET_ASSIGNMENTS: { eventCode: string; date: string; staff: string[] }[] = [
  { eventCode: 'WSB-1', date: '2026-07-06', staff: ['Nathan Reid', 'Ormalleo Outram', 'Cheryse Greenidge', 'Alvin Herbert', 'Annison Roachford'] },
  { eventCode: 'WSB-1', date: '2026-07-07', staff: ['Nathan Reid', 'Ormalleo Outram', 'Cheryse Greenidge', 'Alvin Herbert', 'Annison Roachford'] },
  { eventCode: 'WSB-1', date: '2026-07-08', staff: ['Nathan Reid', 'Ormalleo Outram', 'Cheryse Greenidge', 'Alvin Herbert', 'Annison Roachford'] },
  { eventCode: 'WSB-1', date: '2026-07-09', staff: ['Ormalleo Outram', 'Cheryse Greenidge', 'Alvin Herbert', 'Annison Roachford'] }, // Nathan unavailable
  { eventCode: 'WSB-1', date: '2026-07-10', staff: ['Nathan Reid', 'Ormalleo Outram', 'Cheryse Greenidge', 'Alvin Herbert', 'Annison Roachford'] },
  { eventCode: 'LPK-10', date: '2026-07-11', staff: ['Cheryse Greenidge', 'Annison Roachford'] },
  { eventCode: 'MEdT-3', date: '2026-07-15', staff: ['Alvin Herbert', 'Chloe Cave', 'Ceejay Cumberbatch', 'Krea Edwards'] },
]

async function main() {
  console.log('Clearing existing data...')
  await db.assignment.deleteMany()
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
    const { skills, startDate, endDate, ...rest } = e
    const ev = await db.event.create({
      data: {
        ...rest,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T23:59:59.000Z`),
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
    if (!eventId) continue
    for (const staffName of a.staff) {
      const profileId = profileMap.get(staffName)
      if (!profileId) {
        console.warn(`  Staff not found: ${staffName}`)
        continue
      }
      await db.assignment.create({
        data: {
          eventId,
          profileId,
          assignedDate: new Date(`${a.date}T00:00:00.000Z`),
          status: 'Confirmed',
        },
      })
    }
  }

  console.log('\nSeed complete.')
  console.log(`  Profiles: ${await db.profile.count()}`)
  console.log(`  Events:   ${await db.event.count()}`)
  console.log(`  Skills:   ${await db.eventSkill.count()}`)
  console.log(`  Assignments: ${await db.assignment.count()}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
