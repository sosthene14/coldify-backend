# Architecture Backend - Structure Modulaire

## 📁 Structure du projet

```
src/
├── modules/                    # Modules fonctionnels
│   ├── folder/                # Gestion des dossiers
│   │   ├── folder.controller.ts
│   │   ├── folder.service.ts
│   │   ├── folder.schema.ts
│   │   └── index.ts
│   ├── campaign/              # Gestion des campagnes
│   │   ├── campaign.controller.ts
│   │   ├── campaign.service.ts
│   │   ├── campaign.schema.ts
│   │   └── index.ts
│   ├── lead/                  # Gestion des leads
│   │   ├── lead.controller.ts
│   │   ├── lead.service.ts
│   │   ├── lead.schema.ts
│   │   └── index.ts
│   ├── conversation/          # Gestion des conversations
│   │   ├── conversation.controller.ts
│   │   ├── conversation.service.ts
│   │   ├── conversation.schema.ts
│   │   └── index.ts
│   ├── calendar-event/        # Gestion des événements calendrier
│   │   ├── calendar-event.controller.ts
│   │   ├── calendar-event.service.ts
│   │   ├── calendar-event.schema.ts
│   │   └── index.ts
│   ├── template/              # Gestion des templates
│   │   ├── template.controller.ts
│   │   ├── template.schema.ts
│   │   └── index.ts
│   ├── reporting/             # Reporting et analyses
│   │   ├── reporting.controller.ts
│   │   ├── reporting.service.ts
│   │   ├── reporting.schema.ts
│   │   └── index.ts
│   ├── organization-custom-field/  # Champs personnalisés
│   │   ├── organization-custom-field.controller.ts
│   │   ├── organization-custom-field.service.ts
│   │   ├── organization-custom-field.schema.ts
│   │   └── index.ts
│   ├── usage/                 # Suivi d'utilisation
│   │   ├── usage.controller.ts
│   │   ├── usage.service.ts
│   │   └── index.ts
│   └── notifications/         # Système de notifications
│       ├── notifications.controller.ts
│       ├── notifications.service.ts
│       ├── notifications.schema.ts
│       └── index.ts
│
├── shared/                    # Code partagé entre modules
│   ├── db/                   # Configuration de la base de données
│   │   ├── index.ts
│   │   └── schema/
│   │       ├── index.ts      # Export de tous les schémas
│   │       ├── auth.ts       # Schéma d'authentification
│   │       └── limits.ts     # Schéma des limites
│   ├── lib/                  # Bibliothèques partagées
│   │   ├── auth.ts           # Configuration Better Auth
│   │   ├── email.ts          # Service d'email
│   │   ├── redis.ts          # Configuration Redis
│   │   ├── permissions.ts    # Gestion des permissions
│   │   ├── queues/           # Files d'attente
│   │   │   └── email.queue.ts
│   │   └── email/
│   │       └── template.ts
│   ├── plugins/              # Plugins Elysia
│   │   └── tenant.ts         # Plugin multi-tenant
│   ├── templates/            # Templates email
│   │   └── emailTemplate.ts
│   └── workers/              # Background workers
│       └── email.worker.ts
│
└── index.ts                  # Point d'entrée de l'application
```

## 🏗️ Organisation modulaire

### Modules fonctionnels (`modules/`)
Chaque module représente un domaine métier distinct et contient :
- **controller** : Routes et validation des requêtes HTTP
- **service** : Logique métier et accès aux données
- **schema** : Définition des tables de base de données (Drizzle ORM)
- **index.ts** : Exports publics du module

**Avantages :**
- ✅ Séparation claire des responsabilités
- ✅ Modules indépendants et réutilisables
- ✅ Facilite les tests unitaires
- ✅ Évolutivité et maintenabilité

### Code partagé (`shared/`)
Contient tout le code utilisé par plusieurs modules :
- **db/** : Configuration et schémas de base de données communs
- **lib/** : Utilitaires et services partagés (auth, email, redis, etc.)
- **plugins/** : Plugins Elysia réutilisables
- **workers/** : Processus background

## 🔄 Flux de données

```
Request → Controller → Service → Database
                ↓          ↓
            Validation  Business Logic
```

1. **Controller** : Gère les requêtes HTTP, valide les entrées avec Elysia
2. **Service** : Applique la logique métier et interagit avec la BDD
3. **Schema** : Définit la structure des données (Drizzle ORM)

## 🚀 Comment ajouter un nouveau module

1. Créer le dossier du module dans `src/modules/`
2. Créer les fichiers :
   - `[module].controller.ts` : Routes et validation
   - `[module].service.ts` : Logique métier
   - `[module].schema.ts` : Schéma de BDD
   - `index.ts` : Exports
3. Importer et utiliser le contrôleur dans `src/index.ts`

**Exemple :**
```typescript
// src/modules/nouveau-module/index.ts
export { nouveauModuleController } from './nouveau-module.controller';
export { nouveauModuleService } from './nouveau-module.service';
export * from './nouveau-module.schema';

// src/index.ts
import { nouveauModuleController } from "./modules/nouveau-module";
app.use(nouveauModuleController);
```

## 📦 Technologies utilisées

- **Elysia** : Framework web rapide et type-safe
- **Drizzle ORM** : ORM TypeScript-first
- **Better Auth** : Authentification complète
- **BullMQ** : File d'attente pour jobs asynchrones
- **Redis** : Cache et gestion des sessions
- **PostgreSQL** : Base de données principale

## 🔐 Multi-tenancy

Le système utilise un plugin de tenant (`shared/plugins/tenant.ts`) qui :
- Extrait l'organisation du contexte utilisateur
- Applique automatiquement le filtre sur les requêtes
- Gère les permissions par rôle (admin, member, viewer)

## 📝 Conventions de code

- **Nommage** : camelCase pour fichiers, PascalCase pour classes
- **Imports** : Utiliser les exports depuis `index.ts` des modules
- **Services** : Toujours injecter les dépendances nécessaires
- **Controllers** : Garder légers, déléguer la logique aux services
