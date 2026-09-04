import { db } from "../../shared"
import { plans } from "./subscription.schema"

// Price ID Paddle à remplacer par ceux générés dans ton dashboard sandbox
// (Developer Tools > products-v2 > copier le pri_xxx de chaque prix mensuel)
const PADDLE_PRICE_ID_PRO = "pri_01m175bj5j63tve069m5a03yph"
const PADDLE_PRICE_ID_UNLIMITED = "pri_01m1758cr788r8tnjtvc69fe2v"

export async function seedPlans() {
  await db
    .insert(plans)
    .values([
      {
        id: "free",
        name: "Free",
        paddlePriceIdMonthly: null, // pas de facturation Paddle pour le plan gratuit
        emailsPerDay: 5,
        maxConnectedProviders: 2,
        historyDays: 7,
        hasPrioritySupport: false,
        hasIntegrationApi: false,
        priceCents: 0,
      },
      {
        id: "pro",
        name: "Pro",
        paddlePriceIdMonthly: PADDLE_PRICE_ID_PRO,
        emailsPerDay: 100,
        maxConnectedProviders: 10,
        historyDays: null, // illimité
        hasPrioritySupport: true,
        hasIntegrationApi: false,
        priceCents: 500, // 5$/mois
      },
      {
        id: "unlimited",
        name: "Unlimited",
        paddlePriceIdMonthly: PADDLE_PRICE_ID_UNLIMITED,
        emailsPerDay: null, // illimité
        maxConnectedProviders: null, // illimité
        historyDays: null, // illimité
        hasPrioritySupport: true,
        hasIntegrationApi: true,
        priceCents: 1000, // 10$/mois
      },
    ])
    .onConflictDoUpdate({
      target: plans.id,
      set: {
        name: plans.name,
        paddlePriceIdMonthly: plans.paddlePriceIdMonthly,
        emailsPerDay: plans.emailsPerDay,
        maxConnectedProviders: plans.maxConnectedProviders,
        historyDays: plans.historyDays,
        hasPrioritySupport: plans.hasPrioritySupport,
        hasIntegrationApi: plans.hasIntegrationApi,
        priceCents: plans.priceCents,
        updatedAt: new Date(),
      },
    })

  console.log("✅ Plans seedés : free, pro, unlimited")
}

// Exécution directe : `tsx scripts/seed-plans.ts` ou équivalent selon ton setup
if (require.main === module) {
  seedPlans()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Erreur seed plans :", err)
      process.exit(1)
    })
}
