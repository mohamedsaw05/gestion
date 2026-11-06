import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, login as apiLogin, loadSession } from '../lib/api';
import { setEnabledModules } from '../lib/modules.config';
import {
  Core1Verification,
  Core3Routing,
  Core4AntiCrash,
  Core5Isolation,
  type FiveCoreHealthStatus,
} from '../lib/fiveCoreAuth';

export interface MenuItem {
  key: string;
  label: string;
  path: string;
}

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  tenantId: string;
  organizationName?: string;
  logoUrl?: string | null;
  role?: string;
  enabledCapabilities: string[];
  enabledModules?: string[];
}

export interface FiveCoreLoginStage {
  step: 1 | 2 | 3 | 4 | 5;
  name: string;
  description: string;
}

interface AuthState {
  profile: Profile | null;
  menu: MenuItem[];
  loading: boolean;
  isSubscriptionExpired: boolean;
  subscriptionStatus: string | null;
  healthStatus: FiveCoreHealthStatus | null;
  checkHealth: () => Promise<FiveCoreHealthStatus>;
  login: (email: string, password: string, tenantId?: string, requestedPath?: string) => Promise<{ targetUrl: string }>;
  logout: () => Promise<void>;
  refreshMenu: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<FiveCoreHealthStatus | null>(null);

  const checkHealth = useCallback(async (): Promise<FiveCoreHealthStatus> => {
    const health = await Core4AntiCrash.checkApiHealth();
    setHealthStatus(health);
    return health;
  }, []);

  const checkSubscription = useCallback(async () => {
    try {
      const sub = await api.get<{
        status: string;
        currentPeriodEnd: string;
      }>('/tenant-subscription/current');
      setSubscriptionStatus(sub.status);
      const isEnded =
        ['SUSPENDED', 'PAST_DUE', 'CANCELLED', 'EXPIRED'].includes(sub.status) ||
        (Boolean(sub.currentPeriodEnd) && new Date(sub.currentPeriodEnd).getTime() < Date.now());
      setIsSubscriptionExpired(Boolean(isEnded));
    } catch {
      // Si aucun abonnement n'est trouvé ou erreur, ne pas bloquer par défaut
      setIsSubscriptionExpired(false);
    }
  }, []);

  const loadProfile = useCallback(async () => {
    if (!loadSession()) {
      setProfile(null);
      setMenu([]);
      setIsSubscriptionExpired(false);
      setSubscriptionStatus(null);
      setLoading(false);
      return;
    }
    try {
      // Tolérance aux pannes Cœur 4 : wrapping résilient
      const [p, m, sub] = await Core4AntiCrash.executeResilientAction(async () => {
        return Promise.all([
          api.get<Profile>('/me'),
          api.get<MenuItem[]>('/me/menu'),
          api
            .get<{
              status: string;
              currentPeriodEnd: string;
            }>('/tenant-subscription/current')
            .catch(() => null),
        ]);
      }, 1);

      setProfile(p);
      setMenu(m);
      if (p.enabledModules && p.enabledModules.length > 0) {
        setEnabledModules(p.enabledModules);
      }
      if (sub) {
        setSubscriptionStatus(sub.status);
        const isEnded =
          ['SUSPENDED', 'PAST_DUE', 'CANCELLED', 'EXPIRED'].includes(sub.status) ||
          (Boolean(sub.currentPeriodEnd) && new Date(sub.currentPeriodEnd).getTime() < Date.now());
        setIsSubscriptionExpired(Boolean(isEnded));
      } else {
        setIsSubscriptionExpired(false);
        setSubscriptionStatus(null);
      }
    } catch (err) {
      // Bouclier Anti-Crash Cœur 4 : Évite tout écran blanc en cas d'indisponibilité momentanée
      Core5Isolation.auditEvent({
        action: 'CRASH_PREVENTED',
        details: `Cœur 4 a intercepté une interruption de chargement profil : ${err instanceof Error ? err.message : 'Erreur'}`,
      });
      setProfile(null);
      setMenu([]);
      setIsSubscriptionExpired(false);
      setSubscriptionStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
    void checkHealth();
  }, [loadProfile, checkHealth]);

  /**
   * Connexion orchestrée via le Système à 5 Cœurs :
   * 1. Cœur 1 : Vérification préalable & Anti-brute force
   * 2. Cœur 2 : Envoi & Chiffrement de session
   * 3. Cœur 3 : Dirigeation & Aiguillage intelligent
   * 4. Cœur 4 : Bouclier Anti-Crash & Tolérance aux pannes
   * 5. Cœur 5 : Isolation Multi-Tenant RLS & Audit
   */
  const login = async (
    rawEmail: string,
    rawPassword: string,
    tenantId?: string,
    requestedPath?: string,
  ): Promise<{ targetUrl: string }> => {
    // ÉTAPE 1 : CŒUR 1 - VÉRIFICATION
    const verification = Core1Verification.verifyInput(rawEmail, rawPassword);
    if (!verification.valid) {
      throw new Error(verification.errorMessage || 'Identifiants invalides');
    }

    Core5Isolation.auditEvent({
      action: 'LOGIN_ATTEMPT',
      email: verification.sanitizedEmail,
      tenantId,
      details: 'Début de connexion orchestrée par le Système 5 Cœurs',
    });

    try {
      // ÉTAPE 2 & 4 : CŒUR 2 (ENVOI) AVEC CŒUR 4 (ANTI-CRASH)
      await Core4AntiCrash.executeResilientAction(async () => {
        await apiLogin(verification.sanitizedEmail, rawPassword, tenantId);
      }, 1);

      // Charger le profil de façon résiliente
      await loadProfile();

      // ÉTAPE 5 : CŒUR 5 - ISOLATION & AUDIT DE CONFIRMATION
      Core5Isolation.auditEvent({
        action: 'LOGIN_SUCCESS',
        email: verification.sanitizedEmail,
        tenantId,
        details: 'Authentification 5 Cœurs validée avec succès et isolation RLS confirmée',
      });

      // ÉTAPE 3 : CŒUR 3 - DIRIGEATION
      const targetUrl = Core3Routing.resolveDestination({
        requestedPath,
        isSubscriptionExpired,
      });

      return { targetUrl };
    } catch (err: unknown) {
      Core5Isolation.auditEvent({
        action: 'LOGIN_FAILURE',
        email: verification.sanitizedEmail,
        tenantId,
        details: err instanceof Error ? err.message : 'Échec de connexion',
      });

      throw err;
    }
  };

  const logout = async () => {
    await Core5Isolation.secureLogout(profile?.tenantId);
    setProfile(null);
    setMenu([]);
    setIsSubscriptionExpired(false);
    setSubscriptionStatus(null);
  };

  const refreshMenu = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([api.get<MenuItem[]>('/me/menu'), api.get<Profile>('/me')]);
      setMenu(m);
      setProfile(p);
      if (p.enabledModules && p.enabledModules.length > 0) {
        setEnabledModules(p.enabledModules);
      }
    } catch {
      // Cœur 4 : Évite de crasser l'affichage
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        profile,
        menu,
        loading,
        isSubscriptionExpired,
        subscriptionStatus,
        healthStatus,
        checkHealth,
        login,
        logout,
        refreshMenu,
        refreshProfile: loadProfile,
        checkSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
