import { db } from "./src/shared"
import { member } from "./src/shared/db/schema"
import { createPersonalOrganization } from "./src/shared/lib/auto-organization-creation"

async function backfill() {
  const usersWithoutOrg = await db.query.user.findMany({
    where: (u, { notInArray }) => notInArray(u.id, db.select({ id: member.userId }).from(member)),
  })

  console.log(`${usersWithoutOrg.length} users sans organisation trouvés`)

  for (const u of usersWithoutOrg) {
    try {
      const org = await createPersonalOrganization(u)
      console.log(`✓ Org créée pour ${u.email}: ${org.id}`)
    } catch (err) {
      console.error(`✗ Échec pour ${u.email}:`, err)
    }
  }
}

backfill()
