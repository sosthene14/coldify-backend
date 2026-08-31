# API de Subscription - Guide Frontend

## Endpoints disponibles

### 1. Récupérer la subscription actuelle

```typescript
GET /subscriptions/current

Response: {
  id: string;
  organizationId: string;
  planId: "free" | "pro" | "unlimited";
  status: "active" | "trialing" | "past_due" | "paused" | "canceled";
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
  paddlePriceId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  plan: {
    id: string;
    name: string;
    emailsPerDay: number | null; // null = illimité
    maxConnectedProviders: number | null; // null = illimité
    historyDays: number | null; // null = illimité
    hasPrioritySupport: boolean;
    hasIntegrationApi: boolean;
    priceCents: number;
  };
}
```

### 2. Récupérer les statistiques complètes

```typescript
GET /subscriptions/stats

Response: {
  plan: {
    id: string;
    name: string;
    emailsPerDay: number | null;
    maxConnectedProviders: number | null;
    historyDays: number | null;
    hasPrioritySupport: boolean;
    hasIntegrationApi: boolean;
    priceCents: number;
  };
  status: string;
  currentPeriodEnd: Date | null;
  providers: {
    current: number;
    max: number | null;
    canAdd: boolean;
  };
  features: {
    prioritySupport: boolean;
    integrationApi: boolean;
  };
}
```

### 3. Lister tous les plans disponibles

```typescript
GET /subscriptions/plans

Response: Array<{
  id: string;
  name: string;
  paddlePriceIdMonthly: string | null;
  emailsPerDay: number | null;
  maxConnectedProviders: number | null;
  historyDays: number | null;
  hasPrioritySupport: boolean;
  hasIntegrationApi: boolean;
  priceCents: number;
  createdAt: Date;
  updatedAt: Date;
}>
```

### 4. Vérifier si on peut ajouter un provider

```typescript
GET /subscriptions/can-add-provider

Response: {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  maxAllowed?: number | null;
}

// Exemples de réponses :

// ✅ Peut ajouter
{
  allowed: true,
  currentCount: 1,
  maxAllowed: 2
}

// ❌ Limite atteinte
{
  allowed: false,
  reason: "Provider limit reached. Your Free plan allows 2 provider(s).",
  currentCount: 2,
  maxAllowed: 2
}

// ✅ Illimité
{
  allowed: true,
  currentCount: 5,
  maxAllowed: null
}
```

### 5. Vérifier l'accès à une feature

```typescript
GET /subscriptions/features/:feature
// feature = "priority_support" | "integration_api"

Response: {
  feature: string;
  hasAccess: boolean;
}
```

## Exemples d'utilisation Frontend

### 1. Afficher le plan actuel dans les settings

```typescript
// services/subscription.service.ts
export const subscriptionService = {
  async getCurrentSubscription() {
    const response = await axios.get(
      `${API_URL}/subscriptions/current`,
      { withCredentials: true }
    );
    return response.data;
  },

  async getStats() {
    const response = await axios.get(
      `${API_URL}/subscriptions/stats`,
      { withCredentials: true }
    );
    return response.data;
  },
};

// components/SubscriptionCard.tsx
function SubscriptionCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: () => subscriptionService.getCurrentSubscription(),
  });

  if (isLoading) return <Skeleton />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan actuel : {data.plan.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div>
            <span className="font-medium">Emails/jour :</span>
            {data.plan.emailsPerDay ?? 'Illimité'}
          </div>
          <div>
            <span className="font-medium">Providers max :</span>
            {data.plan.maxConnectedProviders ?? 'Illimité'}
          </div>
          <div>
            <span className="font-medium">Prix :</span>
            {data.plan.priceCents / 100}$/mois
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 2. Afficher l'usage des providers

```typescript
function ProviderUsage() {
  const { data } = useQuery({
    queryKey: ['subscription', 'stats'],
    queryFn: () => subscriptionService.getStats(),
  });

  const percentage = data?.providers.max
    ? (data.providers.current / data.providers.max) * 100
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span>Providers connectés</span>
        <span>
          {data?.providers.current} / {data?.providers.max ?? '∞'}
        </span>
      </div>
      
      {data?.providers.max && (
        <Progress value={percentage} />
      )}
      
      {!data?.providers.canAdd && (
        <Alert variant="warning">
          <AlertDescription>
            Vous avez atteint la limite de providers.
            <Button variant="link">Upgrader vers Pro</Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

### 3. Bloquer l'ajout de provider si limite atteinte

```typescript
function ConnectProviderButton() {
  const { data: canAdd } = useQuery({
    queryKey: ['subscription', 'can-add-provider'],
    queryFn: async () => {
      const response = await axios.get(
        `${API_URL}/subscriptions/can-add-provider`,
        { withCredentials: true }
      );
      return response.data;
    },
  });

  const handleConnect = async () => {
    if (!canAdd?.allowed) {
      toast.error(canAdd?.reason || 'Cannot add more providers');
      return;
    }

    // Continuer avec la connexion
    // ...
  };

  return (
    <Button
      onClick={handleConnect}
      disabled={!canAdd?.allowed}
    >
      {canAdd?.allowed ? 'Connect Provider' : 'Upgrade to add more'}
    </Button>
  );
}
```

### 4. Afficher un comparatif de plans

```typescript
function PricingTable() {
  const { data: plans } = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: async () => {
      const response = await axios.get(
        `${API_URL}/subscriptions/plans`,
        { withCredentials: true }
      );
      return response.data;
    },
  });

  return (
    <div className="grid grid-cols-3 gap-4">
      {plans?.map((plan) => (
        <Card key={plan.id}>
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>
              {plan.priceCents / 100}$/mois
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li>
                ✉️ {plan.emailsPerDay ?? '∞'} emails/jour
              </li>
              <li>
                🔌 {plan.maxConnectedProviders ?? '∞'} providers
              </li>
              <li>
                📅 {plan.historyDays ?? '∞'} jours d'historique
              </li>
              {plan.hasPrioritySupport && (
                <li>⭐ Support prioritaire</li>
              )}
              {plan.hasIntegrationApi && (
                <li>🔗 API d'intégration</li>
              )}
            </ul>
          </CardContent>
          <CardFooter>
            <Button>Choisir ce plan</Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
```

### 5. Afficher les limites d'emails dans le quota

```typescript
// Modifier le quota.service.ts existant
export const quotaService = {
  async getStats(): Promise<QuotaStats> {
    const response = await axios.get(`${API_URL}/quota`, {
      withCredentials: true,
    });
    return response.data;
  },

  // Nouveau : combiner avec les infos de subscription
  async getFullStats() {
    const [quotaStats, subscriptionStats] = await Promise.all([
      this.getStats(),
      subscriptionService.getStats(),
    ]);

    return {
      quota: quotaStats,
      plan: subscriptionStats.plan,
    };
  },
};

// Component
function EmailQuotaCard() {
  const { data } = useQuery({
    queryKey: ['quota', 'full-stats'],
    queryFn: () => quotaService.getFullStats(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Quota d'emails - Plan {data?.plan.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span>Aujourd'hui</span>
              <span>
                {data?.quota.dailyUsed} / {data?.quota.dailyLimit}
              </span>
            </div>
            <Progress
              value={(data?.quota.dailyUsed / data?.quota.dailyLimit) * 100}
            />
          </div>

          {data?.quota.dailyUsed >= data?.quota.dailyLimit && (
            <Alert variant="destructive">
              <AlertDescription>
                Limite quotidienne atteinte.
                {data?.plan.id === 'free' && (
                  <> <Button variant="link">Upgrader vers Pro</Button></>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

## Store Zustand pour Subscription

```typescript
// stores/subscription.store.ts
import { create } from 'zustand';
import { subscriptionService } from '../services/subscription.service';

interface SubscriptionState {
  subscription: any | null;
  stats: any | null;
  loading: boolean;
  error: string | null;
  fetchSubscription: () => Promise<void>;
  fetchStats: () => Promise<void>;
  canAddProvider: () => Promise<boolean>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  subscription: null,
  stats: null,
  loading: false,
  error: null,

  fetchSubscription: async () => {
    set({ loading: true, error: null });
    try {
      const subscription = await subscriptionService.getCurrentSubscription();
      set({ subscription, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await subscriptionService.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  canAddProvider: async () => {
    const response = await subscriptionService.canAddProvider();
    return response.allowed;
  },
}));
```

## Gestion des erreurs

### Erreur 403 - Limite atteinte

```typescript
try {
  await mailboxService.connectGmail();
} catch (error: any) {
  if (error.response?.status === 403) {
    // Limite de providers atteinte
    toast.error(error.response.data.error);
    // Rediriger vers la page de pricing
    router.push('/pricing');
  }
}
```

## Types TypeScript

```typescript
// types/subscription.ts
export type PlanId = 'free' | 'pro' | 'unlimited';

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'paused'
  | 'canceled';

export interface Plan {
  id: PlanId;
  name: string;
  paddlePriceIdMonthly: string | null;
  emailsPerDay: number | null; // null = unlimited
  maxConnectedProviders: number | null; // null = unlimited
  historyDays: number | null; // null = unlimited
  hasPrioritySupport: boolean;
  hasIntegrationApi: boolean;
  priceCents: number;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  plan: Plan;
  currentPeriodEnd: Date | null;
  // ... autres champs
}

export interface SubscriptionStats {
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  providers: {
    current: number;
    max: number | null;
    canAdd: boolean;
  };
  features: {
    prioritySupport: boolean;
    integrationApi: boolean;
  };
}
```
