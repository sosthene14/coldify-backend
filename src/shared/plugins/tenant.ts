import { Elysia } from "elysia";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { auth } from "../lib/auth"; // ton instance better-auth
import { member, session as sessionTable } from "../db/schema";

export type Role = "admin" | "member" | "viewer";

export type TenantContext = {
  userId: string;
  organizationId: string;
  role: Role;
  isSuperAdmin: boolean;
};

const isValidRole = (role: string): role is Role =>
  role === "admin" || role === "member" || role === "viewer";

// better-auth attribue automatiquement "owner" au créateur d'une org —
// ce n'est pas un rôle de notre système, on le traite comme admin
const normalizeRole = (role: string): string => (role === "owner" ? "admin" : role);

export const tenantPlugin = new Elysia({ name: "tenant" }).derive(
  { as: "scoped" },
  async ({ request, status }) => {
    // 1. Session better-auth (contient user + activeOrganizationId)
    const authSession = await auth.api.getSession({
      headers: request.headers,
    });

    if (!authSession) return status(401, "Non authentifié");

    const { user, session: userSession } = authSession;

    let organizationId = userSession.activeOrganizationId;

    // Fallback si activeOrganizationId n'est pas encore défini sur la session
    if (!organizationId) {
      const [userMember] = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, user.id))
        .limit(1);

      if (userMember) {
        organizationId = userMember.organizationId;
        // Mettre à jour la session en arrière-plan pour les prochains appels
        db.update(sessionTable)
          .set({ activeOrganizationId: organizationId })
          .where(eq(sessionTable.id, userSession.id))
          .catch(() => {});
      }
    }

    if (!organizationId) {
      return status(400, "Aucune organisation active sur la session");
    }

    // 2. Superadmin: bypass total, pas besoin de ligne member
    if ((user as any).isSuperAdmin) {
      const ctx: TenantContext = {
        userId: user.id,
        organizationId,
        role: "admin", // traité comme admin sur l'org courante
        isSuperAdmin: true,
      };
      return { tenant: ctx };
    }

    // 3. Sinon, résoudre le rôle via la table member (better-auth org plugin)
    const [membership] = await db
      .select()
      .from(member)
      .where(
        and(eq(member.userId, user.id), eq(member.organizationId, organizationId)),
      )
      .limit(1);

    if (!membership) return status(403, "Aucun accès à cette organisation");

    // Normaliser le rôle (owner -> admin)
    const normalizedRole = normalizeRole(membership.role);

    if (!isValidRole(normalizedRole)) {
      // rôle stocké en base ne fait pas partie de admin/member/viewer après normalisation
      return status(403, "Rôle non reconnu");
    }

    const ctx: TenantContext = {
      userId: user.id,
      organizationId,
      role: normalizedRole,
      isSuperAdmin: false,
    };

    return { tenant: ctx };
  },
);

/** Guard: bloque si le rôle n'est pas dans la liste autorisée */
export const requireRole = (...roles: Role[]) =>
  new Elysia().derive({ as: "scoped" }, ({ tenant, error }: any) => {
    if (!roles.includes(tenant.role) && !tenant.isSuperAdmin) {
      return error(403, "Rôle insuffisant");
    }
    return {};
  });