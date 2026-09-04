// src/lib/permissions.ts
import { createAccessControl } from "better-auth/plugins/access"
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access"

const statement = {
  ...defaultStatements,
  campaign: ["create", "read", "update", "delete"],
  lead: ["create", "read", "update", "delete"],
} as const

export const ac = createAccessControl(statement)

export const superadmin = ac.newRole({
  ...ownerAc.statements,
  campaign: ["create", "read", "update", "delete"],
  lead: ["create", "read", "update", "delete"],
})

export const admin = ac.newRole({
  ...adminAc.statements,
  campaign: ["create", "read", "update", "delete"],
  lead: ["create", "read", "update", "delete"],
})

export const member = ac.newRole({
  ...memberAc.statements,
  campaign: ["create", "read", "update"],
  lead: ["create", "read", "update"],
})

export const viewer = ac.newRole({
  campaign: ["read"],
  lead: ["read"],
})
