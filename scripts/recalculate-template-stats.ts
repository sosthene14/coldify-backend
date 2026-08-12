// Script to recalculate template stats for all templates
import { db } from "../src/shared/db";
import { template } from "../src/shared/db/schema";
import { templateService } from "../src/modules/template/template.service";

async function recalculateAllTemplateStats() {
  try {
    console.log("🔄 Recalculating template stats...");

    // Get all templates
    const allTemplates = await db
      .select({ 
        id: template.id, 
        name: template.name,
        organizationId: template.organizationId 
      })
      .from(template);

    console.log(`📊 Found ${allTemplates.length} templates to process`);

    // Update stats for each template
    let processed = 0;
    for (const tmpl of allTemplates) {
      try {
        await templateService.updateTemplateStats(tmpl.id);
        processed++;
        console.log(`✅ Updated stats for template "${tmpl.name}" (${processed}/${allTemplates.length})`);
      } catch (error) {
        console.error(`❌ Failed to update template "${tmpl.name}":`, error);
      }
    }

    console.log(`🎉 Completed! Successfully updated ${processed}/${allTemplates.length} templates`);
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

recalculateAllTemplateStats();