#!/bin/bash

echo "🚀 Running subscription migration via WSL..."

# Get the Windows path and convert it to WSL path
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/.."

cd "$PROJECT_ROOT"

# Database connection info
DB_USER="coldy"
DB_PASSWORD="coldy_dev_password"
DB_NAME="coldy"
DB_HOST="localhost"
DB_PORT="5432"

export PGPASSWORD="$DB_PASSWORD"

echo "📄 Applying SQL migration..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f migrations/011_subscriptions.sql

if [ $? -ne 0 ]; then
    echo "❌ SQL migration failed"
    exit 1
fi

echo "✅ SQL migration applied"

echo "🌱 Seeding plans..."
bun run src/modules/subscriptions/seed-plans.ts

if [ $? -ne 0 ]; then
    echo "❌ Plans seeding failed"
    exit 1
fi

echo "✅ Plans seeded"

echo "🏢 Creating subscriptions for existing organizations..."
bun run -e "
import { db } from './src/shared';
import { organization } from './src/shared/db/schema';
import { subscriptionService } from './src/modules/subscriptions/subscription.service';

async function createSubscriptions() {
  const organizations = await db.select().from(organization);
  let createdCount = 0;
  
  for (const org of organizations) {
    try {
      const existing = await subscriptionService.getByOrganization(org.id);
      
      if (!existing) {
        await subscriptionService.createFreeSubscription(org.id);
        createdCount++;
        console.log(\`  ✓ Created free subscription for organization: \${org.name}\`);
      } else {
        console.log(\`  - Subscription already exists for: \${org.name}\`);
      }
    } catch (error) {
      console.error(\`  ✗ Failed to create subscription for \${org.name}:\`, error);
    }
  }
  
  console.log(\`✅ Created \${createdCount} new subscriptions\`);
}

await createSubscriptions();
"

echo "🎉 Subscription migration completed successfully!"
