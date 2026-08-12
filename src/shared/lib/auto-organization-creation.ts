// organization-auto-setup.ts
import { db } from "../db";
import { organization as organizationTable, member } from "../db/schema";

export async function createPersonalOrganization(user: { id: string; name?: string | null }) {
  const [org] = await db.insert(organizationTable).values({
    id: crypto.randomUUID(),
    name: `${user.name ?? "Mon"} espace`,
    slug: `org-${user.id.slice(0, 8)}`,
    createdAt: new Date(),
  }).returning();

await db.insert(member).values({
  id: crypto.randomUUID(),
  organizationId: org.id,
  userId: user.id,
  role: "owner",
  createdAt: new Date(),
});

  return org;
}