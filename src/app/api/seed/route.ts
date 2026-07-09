import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

// POST /api/seed — re-seed the database with minimal data
export async function POST() {
  try {
    // Clear all data
    await db.execute('DELETE FROM OptIn')
    await db.execute('DELETE FROM Assignment')
    await db.execute('DELETE FROM EventSkill')
    await db.execute('DELETE FROM Event')
    await db.execute('DELETE FROM User')
    await db.execute('DELETE FROM Profile')

    // Seed profiles
    const profiles = [
      ['Jelani Payne', 'Male', 'Chief Instructor', 'Chief', 'Complex STEM,Robotics,Coding', 'July, August, September', 1],
      ['Nathan Reid', 'Male', 'Senior Instructor', 'Senior', 'Complex STEM,Robotics,Coding', 'June 17 - August 31', 1],
      ['Taria Jackman', 'Female', 'Senior Instructor', 'Senior', 'Complex STEM,Robotics,Coding', 'July 13 - August 25', 1],
      ['Chloe Cave', 'Female', 'Assistant / Junior Instructor', 'Assistant', 'Complex STEM,Coding,Comp Sci', 'July, August, September', 1],
      ['Ormalleo Outram', 'Male', 'Assistant / Junior Instructor', 'Assistant', 'Complex STEM,Robotics,Coding', 'June 5 - August 31', 1],
      ['Ceejay Cumberbatch', 'Male', 'Assistant / Junior Instructor', 'Assistant', 'Complex STEM,Robotics', 'July, August, September', 1],
      ['Alvin Herbert', 'Male', 'Junior / Senior Instructor', 'Senior', 'Complex STEM,Robotics,Coding', 'July, August', 1],
      ['Cheryse Greenidge', 'Female', 'Senior Instructor', 'Senior', 'Complex STEM', 'July, August', 1],
      ['Annison Roachford', 'Male', 'Intern', 'Intern', 'Foundation STEM', 'July, August', 1],
      ['Darrel Springer', 'Male', 'Instructor', 'Junior', 'Robotics', 'July, August', 0],
    ]

    for (const p of profiles) {
      await db.execute({
        sql: `INSERT INTO Profile (id, name, sex, role, roleTier, skills, available, contractSigned, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        args: [crypto.randomUUID(), ...p],
      })
    }

    // Create admin user
    const passwordHash = await bcrypt.hash('changeme', 10)
    const jelaniResult = await db.execute({ sql: "SELECT id FROM Profile WHERE name = 'Jelani Payne'" })
    const jelaniId = (jelaniResult.rows[0] as any).id

    await db.execute({
      sql: `INSERT INTO User (id, name, email, role, passwordHash, profileId, inviteToken, claimedAt, createdAt, updatedAt)
            VALUES (?, 'Jelani Payne', 'jelani@robotadventure.local', 'admin', ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`,
      args: [crypto.randomUUID(), passwordHash, jelaniId, crypto.randomUUID()],
    })

    return NextResponse.json({ ok: true, message: 'Database seeded' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
