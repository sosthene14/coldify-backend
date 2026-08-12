# Backend So-mails - Architecture Modulaire

Backend API pour So-mails, construit avec Elysia, Drizzle ORM et BetterAuth.

## 🚀 Démarrage rapide

```bash
# Installation des dépendances
bun install

# Démarrer en mode développement
bun run dev

# L'API sera accessible sur http://localhost:3001
```

## 📁 Structure du projet

Le projet suit une **architecture modulaire** où chaque domaine métier est isolé dans son propre module.

```
src/
├── modules/              # Modules fonctionnels (domaines métier)
│   ├── folder/          # Gestion des dossiers
│   ├── campaign/        # Gestion des campagnes
│   ├── lead/            # Gestion des leads
│   ├── conversation/    # Gestion des conversations
│   ├── calendar-event/  # Événements calendrier
│   ├── template/        # Templates d'emails
│   ├── reporting/       # Reporting et analytics
│   ├── organization-custom-field/  # Champs personnalisés
│   ├── usage/           # Suivi d'utilisation
│   └── notifications/   # Système de notifications
│
├── shared/              # Code partagé entre modules
│   ├── db/             # Configuration base de données
│   ├── lib/            # Utilitaires (auth, email, redis, etc.)
│   ├── plugins/        # Plugins Elysia (tenant, etc.)
│   ├── templates/      # Templates email
│   └── workers/        # Background workers
│
└── index.ts            # Point d'entrée de l'application
```

### Structure d'un module

Chaque module suit la même structure :

```
module-name/
├── module-name.controller.ts  # Routes et validation HTTP
├── module-name.service.ts     # Logique métier et accès BDD
├── module-name.schema.ts      # Schéma de base de données (Drizzle)
└── index.ts                   # Exports publics du module
```

## 🛠️ Technologies

- **[Elysia](https://elysiajs.com/)** - Framework web ultra-rapide et type-safe
- **[Drizzle ORM](https://orm.drizzle.team/)** - ORM TypeScript-first
- **[Better Auth](https://www.better-auth.com/)** - Solution d'authentification complète
- **[BullMQ](https://docs.bullmq.io/)** - File d'attente Redis pour jobs asynchrones
- **[Redis](https://redis.io/)** - Cache et gestion des sessions
- **[PostgreSQL](https://www.postgresql.org/)** - Base de données relationnelle

## 🔧 Configuration

Créer un fichier `.env` à la racine :

```env
DATABASE_URL=postgresql://user:password@localhost:5432/so-mails
REDIS_URL=redis://localhost:6379
```

## 📊 Base de données

### Migrations

```bash
# Générer une nouvelle migration
bun drizzle-kit generate

# Appliquer les migrations
bun drizzle-kit migrate

# Ouvrir Drizzle Studio
bun drizzle-kit studio
```

### Schémas

Les schémas sont organisés par module :
- Schémas spécifiques aux modules : `src/modules/*/schema.ts`
- Schémas partagés : `src/shared/db/schema/`

## 🔐 Authentification & Autorisation

Le système utilise **Better Auth** avec support multi-tenant :

### Rôles disponibles
- `superadmin` - Accès complet sur toutes les organisations
- `admin` - Gestion complète de son organisation
- `member` - Lecture/écriture dans son organisation
- `viewer` - Lecture seule dans son organisation

### Protection des routes

```typescript
// Dans un contrôleur
.guard({ as: "local" }, (app) =>
  app
    .use(requireRole("admin", "member"))  // Autorise admin et member seulement
    .post("/", async ({ tenant, body }) => {
      // Route protégée
    })
)
```

## 📮 Système de queues

Le système utilise **BullMQ** avec Redis pour les tâches asynchrones :

### Queues disponibles
- **Email Queue** (`src/shared/lib/queues/email.queue.ts`) - Envoi d'emails

### Workers
- **Email Worker** (`src/shared/workers/email.worker.ts`) - Traitement des emails

## 🧪 Développement

### Ajouter un nouveau module

1. Créer le dossier dans `src/modules/mon-module/`

2. Créer les fichiers :

```typescript
// mon-module.schema.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const monModule = pgTable("mon_module", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// mon-module.service.ts
import { db } from "../../shared/db";
import { monModule } from "./mon-module.schema";

export const monModuleService = {
  async list() {
    return db.select().from(monModule);
  },
  // ... autres méthodes
};

// mon-module.controller.ts
import { Elysia, t } from "elysia";
import { monModuleService } from "./mon-module.service";

export const monModuleController = new Elysia({ prefix: "/mon-module" })
  .get("/", async () => monModuleService.list());

// index.ts
export { monModuleController } from './mon-module.controller';
export { monModuleService } from './mon-module.service';
export * from './mon-module.schema';
```

3. Importer dans `src/index.ts` :

```typescript
import { monModuleController } from "./modules/mon-module";

app.use(monModuleController);
```

### Bonnes pratiques

- ✅ Garder les contrôleurs légers, la logique doit être dans les services
- ✅ Toujours valider les entrées avec les schémas Elysia (`t.Object`, etc.)
- ✅ Utiliser le plugin `tenantPlugin` pour les routes nécessitant une authentification
- ✅ Gérer correctement les erreurs (404, 403, etc.)
- ✅ Documenter les routes complexes avec des commentaires

## 📚 Documentation complète

Voir [ARCHITECTURE.md](./ARCHITECTURE.md) pour une documentation détaillée de l'architecture.

## 🐛 Debugging

```bash
# Voir les logs en temps réel
bun run dev

# Inspecter la base de données
bun drizzle-kit studio
```

## 📝 Scripts disponibles

```json
{
  "dev": "bun run --watch src/index.ts",  // Développement avec hot-reload
}
```

## 🔗 Liens utiles

- [Documentation Elysia](https://elysiajs.com/introduction.html)
- [Documentation Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Documentation Better Auth](https://www.better-auth.com/docs)
- [Documentation BullMQ](https://docs.bullmq.io/)
