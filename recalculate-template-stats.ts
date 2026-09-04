// Script temporaire pour recalculer les statistiques de tous les templates
import { templateService } from "./src/modules/template/template.service"

async function recalculateAllTemplateStats() {
  try {
    console.log("🔄 Recalculating template statistics...")

    // Pour chaque organisation, on pourrait appeler recalculateAllStats
    // Mais pour simplifier, on va juste appeler updateTemplateStats pour chaque template

    // Note: Tu devras adapter ceci selon ton organizationId
    const organizationId = "SnFlsad7KOMsKhXYOxnPQiNwNNlXGI7Y" // Ton organizationId

    await templateService.recalculateAllStats(organizationId)

    console.log("✅ Template statistics recalculated successfully!")
  } catch (error) {
    console.error("❌ Error recalculating template statistics:", error)
  }
  process.exit(0)
}

recalculateAllTemplateStats()
