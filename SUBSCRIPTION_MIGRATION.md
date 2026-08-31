# Migration vers le modèle de Subscription

## Vue d'ensemble

Cette migration déplace la gestion des quotas d'emails et des limites de providers depuis des tables/valeurs en dur vers le système de **subscription** basé sur les plans (Free, Pro, Unlimited).

## Changements principaux

### 1. Modèle de données

#### Nouvelles tables :
- **`plans`** : Définit les différents plans d'abonnement (free, pro, unlimited)
  - `emailsPerDay` : Limite quotidienne d'emails (`null` = illimité)
  - `maxConnectedProviders` : Nombre max de providers (`null` = illimité)
  - `historyDays` : Rétention de l'historique (`null` = illimité)
  - `hasPrioritySupport` : Accès au support prioritaire
  - `hasIntegrationApi` : Accès à l'API d'intégration

- **`subscriptions`** : Abonnement actif pour chaque organisation
  - Lié à un plan via `planId`
  - Contient les infos Paddle (customer_id, subscription_id, etc.)
  - Statut : `active`, `trialing`, `past_due`, `paused`, `canceled`

- **`subscription_events`** : Log des webhooks Paddle pour audit

### 2. Services

#### `subscription.service.ts`
Nouveau service qui gère :
- ✅ Récupération de la subscription d'une organisation
- ✅ Création automatique d'une subscription "free" pour les nouvelles organisations
- ✅ Vérification des limites de providers avant ajout
- ✅ Récupération des limites d'emails depuis le plan
- ✅ Vérification des features (priority_support, integration_api)

#### Modifications de `organization-quota.service.ts`
- Utilise maintenant `subscriptionService.getEmailLimits()` pour obtenir les limites
- Plus de valeurs en dur (500 emails/jour)

#### Modifications de `mailbox.controller.ts`
- Vérifie la limite de providers avant de connecter un nouveau mailbox
- Retourne une erreur 403 si la limite est atteinte

### 3. Création d'organisation

**Avant :**
```typescript
createPersonalOrganization(user) {
  // Crée l'organisation
  // Crée le member
  // ❌ Pas de subscription
}
```

**Après :**
```typescript
createPersonalOrganization(user) {
  // Crée l'organisation
  // Crée le member
  // ✅ Crée une subscription "free" automatiquement
  await subscriptionService.createFreeSubscription(organizationId);
}
```

### 4. Nouveaux endpoints API

```
GET /subscriptions/current
  → Récupère la subscription actuelle avec détails du plan

GET /subscriptions/stats
  → Stats complètes : plan, usage providers, features

GET /subscriptions/plans
  → Liste tous les plans disponibles

GET /subscriptions/can-add-provider
  → Vérifie si on peut ajouter un provider

GET /subscriptions/features/:feature
  → Vérifie l'accès à une feature (priority_support, integration_api)
```

## Plans disponibles

### Free Plan
```typescript
{
  emailsPerDay: 5,
  maxConnectedProviders: 2,
  historyDays: 7,
  hasPrioritySupport: false,
  hasIntegrationApi: false,
  priceCents: 0
}
```

### Pro Plan
```typescript
{
  emailsPerDay: 100,
  maxConnectedProviders: 10,
  historyDays: null, // illimité
  hasPrioritySupport: true,
  hasIntegrationApi: false,
  priceCents: 500 // 5$/mois
}
```

### Unlimited Plan
```typescript
{
  emailsPerDay: null, // illimité
  maxConnectedProviders: null, // illimité
  historyDays: null, // illimité
  hasPrioritySupport: true,
  hasIntegrationApi: true,
  priceCents: 1000 // 10$/mois
}
```

## Migration

### Exécuter la migration

```bash
# 1. Appliquer la migration SQL
bun run scripts/run-subscription-migration.ts

# 2. Le script :
#    - Crée les tables (plans, subscriptions, subscription_events)
#    - Seed les 3 plans (free, pro, unlimited)
#    - Crée une subscription "free" pour toutes les organisations existantes
```

### Vérification post-migration

```sql
-- Vérifier que tous les plans existent
SELECT * FROM plans;

-- Vérifier que toutes les organisations ont une subscription
SELECT o.id, o.name, s.plan_id, s.status 
FROM organization o
LEFT JOIN subscriptions s ON s.organization_id = o.id;

-- Doit retourner 0 organisation sans subscription
SELECT COUNT(*) 
FROM organization o
LEFT JOIN subscriptions s ON s.organization_id = o.id
WHERE s.id IS NULL;
```

## Flux d'utilisation

### 1. Création d'un nouveau user
1. User s'inscrit
2. `createPersonalOrganization()` est appelé
3. Une organisation est créée
4. ✅ Une subscription "free" est automatiquement créée

### 2. Ajout d'un provider (Gmail/SMTP)
1. User clique sur "Connect Gmail" ou "Add SMTP"
2. Backend appelle `subscriptionService.canAddProvider()`
3. Si limite atteinte → ❌ Erreur 403 avec message du plan
4. Si OK → ✅ Provider connecté

### 3. Envoi d'emails
1. `emailSendService.sendEmail()` est appelé
2. `organizationQuotaService.canSend()` vérifie les quotas
3. Les limites viennent de `subscriptionService.getEmailLimits()`
4. Si quota dépassé → ❌ Erreur
5. Si OK → ✅ Email envoyé

## Compatibilité

### Backwards compatibility
✅ La table `organization_email_quota` est conservée pour le comptage des emails
✅ Les compteurs (dailySent, monthlySent) continuent de fonctionner
✅ Seules les **limites** (dailyLimit, monthlyLimit) viennent maintenant du plan de subscription

### Frontend
Le frontend devra :
1. Afficher le plan actuel dans les settings
2. Afficher l'usage des providers (2/2 pour free, 5/10 pour pro, etc.)
3. Bloquer l'ajout de providers si limite atteinte avec CTA pour upgrade
4. Afficher les limites d'emails selon le plan

## Prochaines étapes

1. ✅ Migration exécutée
2. 🔄 Intégration des webhooks Paddle pour gérer les upgrades/downgrades
3. 🔄 Page de billing dans le frontend
4. 🔄 Gestion du changement de plan
5. 🔄 Gestion de l'annulation/renouvellement

## Notes importantes

- Les valeurs `null` dans les plans signifient **illimité**
- Le plan "free" n'a pas de `paddlePriceId` car pas de facturation
- Tous les nouveaux users commencent avec le plan "free"
- La limite de providers est vérifiée **avant** la connexion OAuth/SMTP
