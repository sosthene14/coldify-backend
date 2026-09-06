import { Elysia, t } from "elysia"
import { tenantPlugin } from "../../shared"
import { reportingService } from "./reporting.service"

const dateRangeQuery = t.Object({
  from: t.String(), // "2026-06-29"
  to: t.String(), // "2026-07-29"
})

export const reportingController = new Elysia({ prefix: "/reports" })
  .use(tenantPlugin)

  .get("/overview", async ({ tenant, query }) => reportingService.getOverviewStats(tenant, query.from, query.to), {
    query: dateRangeQuery,
  })

  .get(
    "/engagement",
    async ({ tenant, query }) => reportingService.getEngagementOverTime(tenant, query.from, query.to),
    { query: dateRangeQuery },
  )

  .get("/team", async ({ tenant, query }) => reportingService.getTeamStats(tenant, query.from, query.to), {
    query: dateRangeQuery,
  })

 