import { Elysia } from "elysia";
import { tenantPlugin } from "../../shared";
import { usageService } from "./usage.service";
 
export const usageController = new Elysia({ prefix: "/usage" })
  .use(tenantPlugin)
 
  .get("/", async ({ tenant }) => {
    return usageService.getUsageSummary(tenant.organizationId);
  });
 