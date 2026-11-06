import { useEffect, useState, useMemo, useRef, type ChangeEvent, type FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api, fetchBlob, ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastContext';

import { getCacheConfig, saveCacheConfig, estimateCacheSizeMb, purgeAppCache, type CacheConfig } from '../lib/cacheManager';
import { INVOICE_TEMPLATES_10, RECEIPT_TEMPLATES_10 } from '../lib/templates.config';
import { SUPPORTED_COUNTRIES } from '../lib/countryPhone.config';
import { ALL_APP_MODULES, getEnabledModules, setEnabledModules } from '../lib/modules.config';

interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  type: 'string' | 'boolean' | 'string[]';
  default: unknown;
  allowedValues?: string[];
  allowLocationOverride?: boolean;
}

type TabKey = 'hub' | 'brand' | 'templates' | 'modules' | 'rules' | 'inventory' | 'credit' | 'payments' | 'multistore' | 'social' | 'performance' | 'backup';

interface SocialAccount {
  id: string | null;
  platform: 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'WHATSAPP';
  accountName: string | null;
  externalId: string | null;
  status: string;
  metadata?: any;
  hasToken?: boolean;
  updatedAt: string | null;
}

interface SocialPlatformMeta {
  key: 'WHATSAPP' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK';
  name: string;
  icon: string;
  badge: string;
  color: string;
  desc: string;
  policy: string;
  fields: Array<{
    key: string;
    label: string;
    placeholder: string;
    required: boolean;
    isSecret?: boolean;
    help?: string;
  }>;
}

const SOCIAL_PLATFORMS: SocialPlatformMeta[] = [
  {
    key: 'WHATSAPP',
    name: 'WhatsApp Business Platform (Cloud API)',
    icon: '📱',
    badge: 'Meta Cloud API',
    color: '#25d366',
    desc: 'Messagerie instantanée directe avec vos clients sur leur numéro WhatsApp officiel.',
    policy: 'Opt-in préalable obligatoire. Fenêtre de réponse 24h. Relances de créances formellement restreintes par la politique Meta.',
    fields: [
      { key: 'accountName', label: 'Nom d’affichage du numéro', placeholder: 'Ex: WhatsApp Support Magasin', required: true, help: 'Nom visible dans l’interface du gestionnaire' },
      { key: 'phoneNumberId', label: 'Phone Number ID (Meta Cloud API)', placeholder: 'Ex: 109823471928374', required: true, help: 'Trouvé dans Meta for Developers > WhatsApp > Démarrage rapide' },
      { key: 'wabaId', label: 'WhatsApp Business Account ID (WABA ID)', placeholder: 'Ex: 298374829102938', required: false, help: 'ID du compte commercial WhatsApp' },
      { key: 'accessToken', label: 'Jeton d’accès permanent (System User Token)', placeholder: 'Ex: EAAG... ou token système', required: true, isSecret: true, help: 'Généré dans Business Manager > Utilisateurs système avec autorisations whatsapp_business_messaging' },
      { key: 'webhookVerifyToken', label: 'Jeton de vérification Webhook (Verify Token)', placeholder: 'Ex: verify_wa_secret_2026', required: false, help: 'Chaîne secrète partagée avec Meta pour valider l’URL de rappel' },
    ],
  },
  {
    key: 'FACEBOOK',
    name: 'Facebook Messenger & Pages',
    icon: '💬',
    badge: 'Meta Graph API v21.0',
    color: '#1877f2',
    desc: 'Réponses automatiques et directes aux messages privés et commentaires sur vos Pages Facebook.',
    policy: 'Fenêtre de messagerie standard de 24h. Réponses aux messages et commentaires sur publications de page.',
    fields: [
      { key: 'accountName', label: 'Nom de la Page Facebook', placeholder: 'Ex: Page Officielle Boutique Alpha', required: true, help: 'Nom de votre page Facebook' },
      { key: 'pageId', label: 'Identifiant de la Page (Page ID)', placeholder: 'Ex: 1029384756', required: true, help: 'Identifiant numérique de votre Page Facebook' },
      { key: 'accessToken', label: 'Jeton d’accès de la Page (Page Access Token)', placeholder: 'Ex: EAAB... ou token de page', required: true, isSecret: true, help: 'Jeton avec permissions pages_messaging, pages_read_engagement' },
      { key: 'appSecret', label: 'Clé secrète de l’application (App Secret)', placeholder: 'Ex: d7a8b9...', required: false, isSecret: true, help: 'Optionnel, pour valider la signature X-Hub-Signature des webhooks' },
      { key: 'webhookVerifyToken', label: 'Jeton de vérification Webhook', placeholder: 'Ex: verify_fb_secret_2026', required: false, help: 'Jeton secret partagé avec Meta' },
    ],
  },
  {
    key: 'INSTAGRAM',
    name: 'Instagram Direct & Commentaires',
    icon: '📸',
    badge: 'Instagram Graph API',
    color: '#e1306c',
    desc: 'Gestion des messages privés Instagram Direct et des questions sous vos publications et réels.',
    policy: 'Comptes professionnels/créateurs éligibles uniquement liés à une Page Facebook.',
    fields: [
      { key: 'accountName', label: 'Nom du compte Instagram', placeholder: 'Ex: @maboutique_officiel', required: true, help: 'Handle officiel du compte Instagram' },
      { key: 'instagramBusinessId', label: 'Instagram Business Account ID', placeholder: 'Ex: 17841400...', required: true, help: 'Identifiant du compte Instagram Pro lié à votre Page Facebook' },
      { key: 'accessToken', label: 'Jeton d’accès Meta Graph', placeholder: 'Ex: EAAI... ou token pro', required: true, isSecret: true, help: 'Permissions instagram_basic, instagram_manage_messages' },
      { key: 'webhookVerifyToken', label: 'Jeton de vérification Webhook', placeholder: 'Ex: verify_ig_secret_2026', required: false },
    ],
  },
  {
    key: 'TIKTOK',
    name: 'TikTok Business Messaging',
    icon: '🎵',
    badge: 'TikTok Business API v1.3',
    color: '#000000',
    desc: 'Messagerie professionnelle directe et commentaires sur les vidéos TikTok de votre entreprise.',
    policy: 'TikTok for Business API officielle avec conformité stricte des consentements utilisateurs.',
    fields: [
      { key: 'accountName', label: 'Nom du compte TikTok', placeholder: 'Ex: @maboutique_pro', required: true, help: 'Handle du profil TikTok' },
      { key: 'businessId', label: 'Business ID / Open ID', placeholder: 'Ex: 7123984719283', required: true, help: 'Identifiant de votre profil TikTok for Business' },
      { key: 'accessToken', label: 'Jeton d’accès TikTok Business (Access Token)', placeholder: 'Ex: act.tiktok... ou jeton API', required: true, isSecret: true, help: 'Jeton d’accès API TikTok Business' },
      { key: 'clientKey', label: 'App ID / Client Key', placeholder: 'Ex: aw...', required: false, help: 'Clé publique de l’application TikTok' },
      { key: 'clientSecret', label: 'App Secret / Client Secret', placeholder: 'Ex: secret...', required: false, isSecret: true, help: 'Clé secrète de l’application TikTok' },
      { key: 'webhookVerifyToken', label: 'Jeton de vérification Webhook', placeholder: 'Ex: verify_tt_secret_2026', required: false },
    ],
  },
];

const INVOICE_TEMPLATES = INVOICE_TEMPLATES_10;
const RECEIPT_TEMPLATES = RECEIPT_TEMPLATES_10;

const CURRENCIES = [
  { code: 'XOF', label: 'Franc CFA UEMOA (XOF)', symbol: 'FCFA' },
  { code: 'EUR', label: 'Euro (EUR)', symbol: '€' },
  { code: 'USD', label: 'Dollar Américain (USD)', symbol: '$' },
  { code: 'XAF', label: 'Franc CFA CEMAC (XAF)', symbol: 'FCFA' },
  { code: 'GNF', label: 'Franc Guinéen (GNF)', symbol: 'FG' },
];

const PAYMENT_METHODS_LIST = [
  { key: 'CASH', label: 'Espèces', icon: '💵', desc: 'Règlement au comptant en billets et pièces' },
  { key: 'MOBILE_MONEY', label: 'Mobile Money', icon: '📱', desc: 'Orange Money, Wave, Moov Money, MTN' },
  { key: 'CARD', label: 'Carte Bancaire', icon: '💳', desc: 'Terminaux TPE, Visa, Mastercard' },
  { key: 'BANK_TRANSFER', label: 'Virement Bancaire', icon: '🏦', desc: 'Virements directs sur compte pro' },
  { key: 'CHECK', label: 'Chèque', icon: '📑', desc: 'Chèques compensables avec traçabilité' },
];

export function SettingsConfigPage() {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const invoiceHeaderFileRef = useRef<HTMLInputElement | null>(null);
  const invoiceFooterFileRef = useRef<HTMLInputElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, menu, refreshMenu, refreshProfile } = useAuth();

  const hasSection = (key: string) => menu.some((m) => m.key === key);
  const hasCapability = (cap: string) => profile?.enabledCapabilities.includes(cap) ?? false;

  const availableTabs = useMemo(() => {
    const list: Array<{ key: TabKey; label: string; badge: string; icon: string; desc: string; color: string; gradient: string }> = [
      {
        key: 'brand',
        icon: '🎨',
        label: 'Marque & Identité',
        badge: 'Logo, IFU, RCCM & Pays',
        desc: 'Logo officiel de votre entreprise, raison sociale, coordonnées fiscales (NIF/IFU, RCCM), pays et devises.',
        color: '#3b82f6',
        gradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
      },
      {
        key: 'templates',
        icon: '📑',
        label: 'Modèles Factures & Reçus',
        badge: '3 Factures & 3 Reçus (Laser A4 & Thermique POS)',
        desc: 'Choix des formats : 3 factures A4/A5 feuilles volantes et 3 reçus thermiques continus 80mm/58mm avec découpe cutter.',
        color: '#8b5cf6',
        gradient: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
      },
      {
        key: 'modules',
        icon: '🧩',
        label: 'Modules du Gestionnaire',
        badge: 'Activer / Désactiver selon vos besoins',
        desc: 'Personnalisez votre plateforme : activez ou masquez les fonctionnalités (Promotions, Marché B2B, Partenaires, Décharges...).',
        color: '#06b6d4',
        gradient: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
      },
      {
        key: 'rules',
        icon: '🛒',
        label: 'Caisse & Ventes',
        badge: 'Règles de comptoir',
        desc: 'Exigence de client nominatif, contrôle du panier, seuils de validation et automatisation de comptoir.',
        color: '#10b981',
        gradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      },
    ];
    if (hasSection('inventory') || hasCapability('inventory')) {
      list.push({
        key: 'inventory',
        icon: '📦',
        label: 'Stock & Valorisation',
        badge: 'CUMP/FIFO & ROP',
        desc: 'Méthode comptable de valorisation des stocks, seuil de réapprovisionnement (ROP) et gestion des ruptures.',
        color: '#f59e0b',
        gradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
      });
    }
    if (hasSection('credit') || hasCapability('customer_credit')) {
      list.push({
        key: 'credit',
        icon: '⏳',
        label: 'Crédit & Risques',
        badge: 'Amortissement & Scoring',
        desc: 'Plafonds d\'encours autorisés, délais de relance des créances, pénalités et scoring financier client.',
        color: '#ef4444',
        gradient: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
      });
    }
    list.push({
      key: 'payments',
      icon: '💳',
      label: 'Devises & Paiements',
      badge: 'Devise & Moyens',
      desc: 'Devise officielle (FCFA, EUR, USD...), règlements acceptés (Espèces, Mobile Money, Cartes TPE, Virements, Chèques).',
      color: '#6366f1',
      gradient: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
    });
    list.push({
      key: 'multistore',
      icon: '🏪',
      label: 'Multi-Store & Boutiques',
      badge: 'Espaces dédiés par boutique',
      desc: 'Paramétrage indépendant par établissement : pieds de tickets, adresses, devises et imprimantes de chaque boutique.',
      color: '#0ea5e9',
      gradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    });
    if (hasSection('social') || hasCapability('social_inbox')) {
      list.push({
        key: 'social',
        icon: '📱',
        label: 'Réseaux Sociaux & Canaux',
        badge: 'WhatsApp, Meta, TikTok',
        desc: 'Connexion aux plateformes sociales : WhatsApp Business Cloud API, pages Facebook, Instagram et profil TikTok.',
        color: '#14b8a6',
        gradient: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
      });
    }
    list.push({
      key: 'performance',
      icon: '⚡',
      label: 'Performance & Cache',
      badge: 'Purge & Délais auto',
      desc: 'Accélération du chargement local, purge du cache, synchronisation hors-ligne et quotas de stockage.',
      color: '#eab308',
      gradient: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)',
    });
    list.push({
      key: 'backup',
      icon: '📦',
      label: 'Sauvegardes & Données',
      badge: '3 Réinitialisations',
      desc: 'Exportation des archives de gestion et remise à zéro sécurisée des données opérationnelles du gestionnaire.',
      color: '#dc2626',
      gradient: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
    });
    return list;
  }, [menu, profile]);

  const tabParam = searchParams.get('tab') as TabKey | null;
  const isTabAvailable = (k: TabKey | null) => Boolean(k && availableTabs.some((t) => t.key === k));

  // Si aucun paramètre tab n'est spécifié, on reste sur 'hub' (tableau de sélection des 11 cartes)
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabParam && isTabAvailable(tabParam) ? tabParam : 'hub',
  );

  useEffect(() => {
    const t = searchParams.get('tab') as TabKey | null;
    if (t && isTabAvailable(t) && t !== activeTab) {
      setActiveTab(t);
    } else if (!t && activeTab !== 'hub') {
      setActiveTab('hub');
    }
  }, [searchParams, availableTabs, activeTab]);

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    if (key === 'hub') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: key });
    }
  };

  const [, setCatalog] = useState<SettingDefinition[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [, setSavingKey] = useState<string | null>(null);

  // Emplacements physiques & surcharges de paramètres (allowLocationOverride)
  const [locationsList, setLocationsList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [locationFooterText, setLocationFooterText] = useState<string>('');

  // Multi-Store : Espace dédié de configuration d'une boutique spécifique
  const [activeStoreConfigId, setActiveStoreConfigId] = useState<string | null>(null);
  const [storeConfigData, setStoreConfigData] = useState<{
    name: string;
    address: string;
    phone: string;
    email: string;
    receiptFooterText: string;
    currency: string;
    vatRate: number;
    printerType: string;
    allowNegativeStock: boolean;
  }>({
    name: '',
    address: '',
    phone: '',
    email: '',
    receiptFooterText: '',
    currency: 'XOF',
    vatRate: 18,
    printerType: '80mm',
    allowNegativeStock: false,
  });
  const [savingStoreConfig, setSavingStoreConfig] = useState(false);
  const [showAddStoreModal, setShowAddStoreModal] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [creatingStore, setCreatingStore] = useState(false);

  // Logo upload state
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Template preview state
  const [previewingTemplate, setPreviewingTemplate] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Réinitialisation / Remise à zéro sécurisée (Gestionnaire)
  const [showResetTenantModal, setShowResetTenantModal] = useState(false);
  const [resetTenantPassword, setResetTenantPassword] = useState('');
  const [resetTenantPhrase, setResetTenantPhrase] = useState('');
  const [resettingTenant, setResettingTenant] = useState(false);

  // Performance & Cache config state
  const [cacheConfig, setCacheConfigState] = useState<CacheConfig>(getCacheConfig());
  const [cacheSizeMb, setCacheSizeMb] = useState<number>(estimateCacheSizeMb());

  // Modules personnalisables VTM
  const [enabledModuleKeys, setEnabledModuleKeysState] = useState<string[]>(() => getEnabledModules());

  const handleToggleModule = async (modKey: string) => {
    const isCurrentlyActive = enabledModuleKeys.includes(modKey);
    const nextActive = !isCurrentlyActive;
    let nextKeys: string[];
    if (isCurrentlyActive) {
      nextKeys = enabledModuleKeys.filter((k) => k !== modKey);
    } else {
      nextKeys = [...enabledModuleKeys, modKey];
    }
    setEnabledModuleKeysState(nextKeys);
    setEnabledModules(nextKeys);
    try {
      await api.put(`/business-profile/modules/${modKey}`, { enabled: nextActive });
      await refreshMenu();
      addToast(nextActive ? 'Module activé et synchronisé !' : 'Module désactivé du menu.', nextActive ? 'success' : 'info');
    } catch {
      addToast(nextActive ? 'Module activé localement (synchronisation serveur en attente)' : 'Module désactivé localement', 'info');
    }
  };

  // Social Networks config state
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [selectedSocialPlatform, setSelectedSocialPlatform] = useState<'WHATSAPP' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK'>('WHATSAPP');
  const [socialFormData, setSocialFormData] = useState<Record<string, string>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savingSocialConfig, setSavingSocialConfig] = useState(false);
  const [disconnectingSocial, setDisconnectingSocial] = useState(false);
  const [socialWebhookInfo, setSocialWebhookInfo] = useState<{
    platform: string;
    callbackUrl: string;
    verifyToken: string;
    requiredEvents: string[];
    instructions: string;
  } | null>(null);
  const [loadingWebhook, setLoadingWebhook] = useState(false);
  const [killingSocial, setKillingSocial] = useState(false);
  const [consentRecipient, setConsentRecipient] = useState('');
  const [consentOptIn, setConsentOptIn] = useState(true);
  const [savingConsent, setSavingConsent] = useState(false);

  const loadSocialAccounts = () => {
    api
      .get<SocialAccount[]>('/social/accounts')
      .then((accs) => {
        setSocialAccounts(accs);
        const current = accs.find((a) => a.platform === selectedSocialPlatform);
        if (current) {
          const meta = current.metadata || {};
          setSocialFormData({
            accountName: current.accountName || '',
            phoneNumberId: meta.phoneNumberId || '',
            wabaId: meta.wabaId || '',
            pageId: current.externalId || meta.pageId || '',
            instagramBusinessId: current.externalId || meta.instagramBusinessId || '',
            businessId: current.externalId || meta.businessId || '',
            clientKey: meta.clientKey || '',
            webhookVerifyToken: meta.webhookVerifyToken || '',
          });
        }
      })
      .catch(() => {});
  };

  const loadWebhookInfo = (platform: 'WHATSAPP' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK') => {
    setLoadingWebhook(true);
    api
      .get<any>(`/social/accounts/${platform}/webhook-info`)
      .then((data) => setSocialWebhookInfo(data))
      .catch(() => setSocialWebhookInfo(null))
      .finally(() => setLoadingWebhook(false));
  };

  useEffect(() => {
    if (activeTab === 'social') {
      loadSocialAccounts();
      loadWebhookInfo(selectedSocialPlatform);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedSocialPlatform]);

  const handlePlatformSelect = (platform: 'WHATSAPP' | 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK') => {
    setSelectedSocialPlatform(platform);
    setTestResult(null);
    const existing = socialAccounts.find((a) => a.platform === platform);
    if (existing) {
      const meta = existing.metadata || {};
      setSocialFormData({
        accountName: existing.accountName || '',
        phoneNumberId: meta.phoneNumberId || '',
        wabaId: meta.wabaId || '',
        pageId: existing.externalId || meta.pageId || '',
        instagramBusinessId: existing.externalId || meta.instagramBusinessId || '',
        businessId: existing.externalId || meta.businessId || '',
        clientKey: meta.clientKey || '',
        webhookVerifyToken: meta.webhookVerifyToken || '',
      });
    } else {
      setSocialFormData({});
    }
  };

  const handleSaveSocialConfig = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSocialConfig(true);
    setTestResult(null);
    try {
      const platformMeta = SOCIAL_PLATFORMS.find((p) => p.key === selectedSocialPlatform);
      const metadata: Record<string, any> = {};
      platformMeta?.fields.forEach((f) => {
        if (f.key !== 'accountName' && f.key !== 'accessToken' && socialFormData[f.key]) {
          metadata[f.key] = socialFormData[f.key];
        }
      });

      const externalId =
        socialFormData.phoneNumberId ||
        socialFormData.pageId ||
        socialFormData.instagramBusinessId ||
        socialFormData.businessId ||
        undefined;

      await api.post(`/social/accounts/${selectedSocialPlatform}/configure`, {
        accountName: socialFormData.accountName || `${selectedSocialPlatform} Compte`,
        externalId,
        accessToken: socialFormData.accessToken || 'configured_token',
        metadata,
      });

      addToast(`Configuration ${selectedSocialPlatform} enregistrée avec succès.`, 'success');
      loadSocialAccounts();
      loadWebhookInfo(selectedSocialPlatform);
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur d’enregistrement', 'error');
    } finally {
      setSavingSocialConfig(false);
    }
  };

  const handleTestSocialConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await api.post<{ success: boolean; accountName?: string; message?: string }>(
        `/social/accounts/${selectedSocialPlatform}/test`,
        {
          accessToken: socialFormData.accessToken || 'mock_test_token',
          externalId:
            socialFormData.phoneNumberId ||
            socialFormData.pageId ||
            socialFormData.instagramBusinessId ||
            socialFormData.businessId,
          metadata: socialFormData,
        },
      );
      setTestResult({
        success: true,
        message: `Connexion API officielle validée avec succès ! Canal : ${res.accountName || selectedSocialPlatform}`,
      });
      addToast('Test de connectivité réussi.', 'success');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Échec du test de connectivité';
      setTestResult({ success: false, message: msg });
      addToast(msg, 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDisconnectSocialAccount = async () => {
    const current = socialAccounts.find((a) => a.platform === selectedSocialPlatform && a.status === 'CONNECTED');
    if (!current?.id) return;
    if (!confirm(`Voulez-vous vraiment déconnecter le compte ${selectedSocialPlatform} ?`)) return;

    setDisconnectingSocial(true);
    try {
      await api.delete(`/social/accounts/${current.id}`);
      addToast(`Canal ${selectedSocialPlatform} déconnecté.`, 'info');
      setSocialFormData({});
      loadSocialAccounts();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur de déconnexion', 'error');
    } finally {
      setDisconnectingSocial(false);
    }
  };

  const handleEmergencyKillSwitch = async () => {
    if (
      !confirm(
        'ARRÊT D’URGENCE : Voulez-vous immédiatement révoquer et déconnecter TOUS les comptes sociaux connectés ?',
      )
    ) {
      return;
    }
    setKillingSocial(true);
    try {
      await api.post('/social/kill-switch', {});
      addToast('Kill-switch exécuté : Tous les canaux sociaux ont été déconnectés en urgence.', 'info');
      loadSocialAccounts();
    } catch {
      addToast('Erreur lors du déclenchement du kill switch', 'error');
    } finally {
      setKillingSocial(false);
    }
  };

  const handleRecordConsent = async (e: FormEvent) => {
    e.preventDefault();
    if (!consentRecipient) return;
    setSavingConsent(true);
    try {
      await api.post('/social/compliance/consent', {
        platform: selectedSocialPlatform,
        recipient: consentRecipient.trim(),
        optedIn: consentOptIn,
        source: 'SETTINGS_CONFIG_PANEL',
      });
      addToast(`Statut de consentement enregistré pour ${consentRecipient}`, 'success');
      setConsentRecipient('');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur de mise à jour du consentement', 'error');
    } finally {
      setSavingConsent(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast(`${label} copié dans le presse-papier !`, 'success');
  };

  const handleUpdateCacheConfig = (updates: Partial<CacheConfig>) => {
    const updated = saveCacheConfig(updates);
    setCacheConfigState(updated);
    addToast('Configuration du cache et optimisation mise à jour', 'success');
  };

  const handleManualPurge = async () => {
    try {
      const res = await purgeAppCache(true);
      setCacheSizeMb(res.sizeMb);
      addToast(`Cache vidé et mémoire optimisée avec succès (${res.freedMb} Mo libérés, ${res.purgedItems} éléments purgés).`, 'success');
    } catch {
      addToast('Erreur lors du nettoyage du cache', 'error');
    }
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<SettingDefinition[]>('/settings/catalog'),
      api.get<Record<string, unknown>>('/settings'),
      api.get<Array<{ id: string; name: string }>>('/locations').catch(() => []),
    ])
      .then(([cat, vals, locs]) => {
        setCatalog(cat);
        setValues(vals);
        setLocationsList(locs || []);
        const logo = vals['documents.logoDataUri'] || vals['organization.logo'];
        if (logo && typeof logo === 'string') {
          setLogoPreview(logo);
        }
      })
      .catch((e) => addToast(e instanceof ApiError ? e.message : 'Erreur de chargement des paramètres', 'error'))
      .finally(() => setLoading(false));
  };

  const handleLocationSelect = async (locId: string) => {
    setSelectedLocationId(locId);
    if (!locId) {
      setLocationFooterText('');
      return;
    }
    try {
      const data = await api.get<Record<string, unknown>>(`/settings/locations/${locId}`);
      setLocationFooterText(String(data['documents.receiptFooterText'] ?? ''));
    } catch {
      setLocationFooterText('');
    }
  };

  const handleSaveLocationFooter = async (text: string) => {
    if (!selectedLocationId) return;
    try {
      await api.put(`/settings/locations/${selectedLocationId}/documents.receiptFooterText`, { value: text });
      setLocationFooterText(text);
      addToast('Pied de reçu spécifique à la boutique enregistré avec succès.', 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur de sauvegarde de la boutique', 'error');
    }
  };

  const handleOpenStoreConfig = async (loc: { id: string; name: string }) => {
    setActiveStoreConfigId(loc.id);
    try {
      const data = await api.get<Record<string, unknown>>(`/settings/locations/${loc.id}`);
      const localKey = `vtm_store_pref_${loc.id}`;
      let localPrefs: any = {};
      try {
        const raw = localStorage.getItem(localKey);
        if (raw) localPrefs = JSON.parse(raw);
      } catch {}
      setStoreConfigData({
        name: loc.name,
        address: String(localPrefs.address || ''),
        phone: String(localPrefs.phone || ''),
        email: String(localPrefs.email || ''),
        receiptFooterText: String(data['documents.receiptFooterText'] ?? localPrefs.receiptFooterText ?? ''),
        currency: String(localPrefs.currency || values['general.currency'] || 'XOF'),
        vatRate: Number(localPrefs.vatRate ?? 18),
        printerType: String(localPrefs.printerType || '80mm'),
        allowNegativeStock: Boolean(localPrefs.allowNegativeStock ?? false),
      });
    } catch {
      setStoreConfigData((prev) => ({ ...prev, name: loc.name }));
    }
  };

  const handleSaveStoreConfig = async () => {
    if (!activeStoreConfigId) return;
    setSavingStoreConfig(true);
    try {
      await api.put(`/settings/locations/${activeStoreConfigId}/documents.receiptFooterText`, {
        value: storeConfigData.receiptFooterText,
      });
      const localKey = `vtm_store_pref_${activeStoreConfigId}`;
      localStorage.setItem(localKey, JSON.stringify(storeConfigData));
      addToast(`Configuration de la boutique enregistrée avec succès !`, 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur de sauvegarde de la boutique', 'error');
    } finally {
      setSavingStoreConfig(false);
    }
  };

  const handleCreateStore = async () => {
    if (!newStoreName.trim()) {
      addToast('Veuillez renseigner un nom pour la boutique', 'warning');
      return;
    }
    setCreatingStore(true);
    try {
      const created = await api.post<{ id: string; name: string }>('/locations', {
        name: newStoreName.trim(),
        type: 'STORE',
      });
      setLocationsList((prev) => [...prev, created]);
      setNewStoreName('');
      setShowAddStoreModal(false);
      addToast(`Boutique "${created.name}" créée avec succès !`, 'success');
      // Ouvrir directement son espace de configuration
      void handleOpenStoreConfig(created);
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Impossible de créer la boutique (Vérifiez les quotas de votre abonnement)', 'error');
    } finally {
      setCreatingStore(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (key: string, value: unknown) => {
    setSavingKey(key);
    try {
      await api.put(`/settings/${encodeURIComponent(key)}`, { value });
      setValues((prev) => ({ ...prev, [key]: value }));
      if (key === 'documents.logoDataUri') {
        setLogoPreview(typeof value === 'string' && value ? value : null);
      }
      if (key === 'organization.legalName' || key === 'documents.logoDataUri') {
        void refreshProfile();
      }
      addToast('Paramètre enregistré avec succès.', 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la sauvegarde du paramètre', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const validateStrictLogoFile = (file: File): boolean => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['png', 'jpg', 'jpeg', 'webp'];
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

    if (!allowedExts.includes(ext) || !allowedMimes.includes(file.type)) {
      const msg = `[Code : VTM-LOGO-001] Format non autorisé (.${ext || 'inconnu'}). Seuls les fichiers .PNG, .JPG, .JPEG et .WEBP sont strictement acceptés.`;
      setLogoError(msg);
      addToast(msg, 'error');
      return false;
    }

    if (file.size > 2 * 1024 * 1024) {
      const msg = '[Code : VTM-LOGO-002] Le logo dépasse la taille limite maximale de 2 Mo.';
      setLogoError(msg);
      addToast(msg, 'error');
      return false;
    }

    return true;
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateStrictLogoFile(file)) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUri = reader.result as string;
      setLogoPreview(dataUri);
      await save('documents.logoDataUri', dataUri);
      addToast('Logo principal enregistré avec succès.', 'success');
    };
    reader.onerror = () => {
      setLogoError('[Code : VTM-LOGO-003] Erreur de lecture du fichier sélectionné.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await save('documents.logoDataUri', '');
    addToast('Logo supprimé.', 'info');
  };

  const handleInvoiceHeaderLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateStrictLogoFile(file)) {
      if (invoiceHeaderFileRef.current) invoiceHeaderFileRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUri = reader.result as string;
      await save('invoice.headerLogoUri', dataUri);
      addToast('Logo d’en-tête de facture enregistré.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleInvoiceFooterLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateStrictLogoFile(file)) {
      if (invoiceFooterFileRef.current) invoiceFooterFileRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUri = reader.result as string;
      await save('invoice.footerLogoUri', dataUri);
      addToast('Logo de pied de page de facture enregistré.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleResetSettingsOnly = async () => {
    if (!window.confirm('Voulez-vous réinitialiser tous les paramètres aux valeurs d’usine par défaut ? Vos produits, ventes et clients restent intacts.')) return;
    try {
      await save('organization.countryCode', 'BF');
      await save('organization.currency', 'XOF');
      await save('documents.invoiceTemplate', 'STANDARD_PRO');
      await save('documents.receiptTemplate', 'THERMAL_80MM_STANDARD');
      await save('documents.receiptFormat', 'THERMAL_80MM');
      addToast('Paramètres réinitialisés aux valeurs par défaut avec succès.', 'success');
      load();
    } catch {
      addToast('Erreur lors de la réinitialisation des paramètres', 'error');
    }
  };

  const handleResetProductsOnly = async () => {
    if (!window.confirm('ATTENTION : Voulez-vous vraiment réinitialiser uniquement le catalogue de produits et les stocks ? Cette opération vide le catalogue local.')) return;
    try {
      localStorage.removeItem('vtm_offline_products');
      localStorage.removeItem('vtm_catalog_cache');
      await api.post('/organization/reset-catalog', {}).catch(() => {});
      addToast('Catalogue de produits réinitialisé avec succès.', 'success');
    } catch {
      addToast('Catalogue réinitialisé localement.', 'info');
    }
  };

  const handlePreviewTemplate = async (templateKey: string) => {
    setPreviewingTemplate(templateKey);
    try {
      const blob = await fetchBlob(`/documents/preview/${templateKey}`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      addToast(`Aperçu du modèle « ${templateKey} » ouvert dans un nouvel onglet.`, 'success');
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la génération de l’aperçu PDF', 'error');
    } finally {
      setPreviewingTemplate(null);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch('/api/organization/export', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Échec de génération de l’archive');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sauvegarde-commerce-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('Archive complète de l’organisation téléchargée avec succès.', 'success');
    } catch {
      addToast('Erreur lors du téléchargement de la sauvegarde', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleResetTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetTenantPhrase.trim() !== 'REINITIALISER MON GESTIONNAIRE') {
      addToast('Vous devez taper exactement : REINITIALISER MON GESTIONNAIRE', 'error');
      return;
    }
    if (!resetTenantPassword) {
      addToast('Veuillez renseigner votre mot de passe pour confirmer la réinitialisation', 'error');
      return;
    }
    setResettingTenant(true);
    try {
      await api.post('/organization/reset', {
        password: resetTenantPassword,
        confirmationPhrase: resetTenantPhrase.trim(),
      });
      addToast('Votre gestionnaire a été réinitialisé avec succès. Redémarrage en cours...', 'success');
      setShowResetTenantModal(false);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la réinitialisation du gestionnaire', 'error');
    } finally {
      setResettingTenant(false);
    }
  };

  const currentTabMeta = availableTabs.find((t) => t.key === activeTab);

  return (
    <div>
      {/* ══════════════════════════════════════════════════════════════════════
          MODE 1 : LE HUB DES 11 ESPACES DE PARAMÈTRES (ACCUEIL SANS CONFUSION)
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'hub' ? (
        <div>
          <PageHeader
            title="Centre de Configuration & Paramètres"
            subtitle="Choisissez l'espace que vous souhaitez configurer. Chaque module dispose d'une page dédiée sans encombrer votre écran."
            badges={[
              { label: `⚙️ ${availableTabs.length} Espaces Configurables`, variant: 'info' },
              { label: '✓ Sauvegarde en temps réel', variant: 'success' },
            ]}
            primaryAction={{
              label: exporting ? 'Génération...' : '📦 Exporter les données (JSON)',
              onClick: handleExportData,
              variant: 'secondary',
            }}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.25rem',
              marginBottom: '2.5rem',
            }}
          >
            {availableTabs.map((card) => (
              <div
                key={card.key}
                onClick={() => handleTabChange(card.key)}
                style={{
                  background: 'var(--surface)',
                  borderRadius: '14px',
                  border: '1.5px solid var(--border)',
                  padding: '1.5rem',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 12px 25px -5px rgba(37, 99, 235, 0.12)';
                  e.currentTarget.style.borderColor = card.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                {/* Accent supérieur subtil */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: card.color,
                  }}
                />

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        background: card.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
                      }}
                    >
                      {card.icon}
                    </div>

                    <span
                      style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.55rem',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      {card.badge}
                    </span>
                  </div>

                  <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', color: '#0f172a', fontWeight: 800 }}>
                    {card.label}
                  </h3>

                  <p style={{ margin: '0 0 1.25rem', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
                    {card.desc}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.85rem',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: card.color }}>
                    Ouvrir & Configurer
                  </span>
                  <span style={{ fontSize: '1.1rem', color: card.color, fontWeight: 800 }}>
                    →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════
            MODE 2 : PAGE SPÉCIALEMENT DÉDIÉE À L'ESPACE SÉLECTIONNÉ
           ══════════════════════════════════════════════════════════════════════ */
        <div>
          {/* Barre de retour et fil d'ariane */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.5rem',
              padding: '0.75rem 1rem',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => handleTabChange('hub')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: '#1e293b',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.color = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.color = '#1e293b';
                }}
              >
                <span>←</span> Revenir à la sélection des paramètres
              </button>

              <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
                Centre des Paramètres &nbsp;›&nbsp; <strong style={{ color: '#0f172a' }}>{currentTabMeta?.label}</strong>
              </div>
            </div>

            {/* Menu déroulant de changement rapide entre espaces */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Changer d'espace :</span>
              <select
                value={activeTab}
                onChange={(e) => handleTabChange(e.target.value as TabKey)}
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.82rem',
                  borderRadius: '6px',
                  borderColor: '#cbd5e1',
                }}
              >
                {availableTabs.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
          Chargement de vos paramètres et personnalisations...
        </div>
      ) : (
        <div style={{ maxWidth: '960px' }}>
          {/* ══════════════════════════════════════════════════════════════
              ONGLET 1 : MARQUE & IDENTITÉ COMMERCIALE
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'brand' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.75rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>🎨</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>
                    Logo Officiel & Identité Visuelle
                  </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem' }}>
                  Votre logo et vos coordonnées officielles sont automatiquement insérés sur vos reçus de caisse,
                  factures, devis, avoirs et bons de livraison.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '2rem', alignItems: 'flex-start' }}>
                  {/* Coordonnées officielles */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Nom Entreprise (Obligatoire) & Date de création (Optionnelle) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, marginBottom: '0.25rem', color: '#0f172a' }}>
                          Nom de l'entreprise / Raison sociale <span style={{ color: '#dc2626' }}>* (Obligatoire)</span>
                        </label>
                        <input
                          type="text"
                          required
                          defaultValue={String(values['organization.legalName'] ?? '')}
                          onBlur={(e) => save('organization.legalName', e.target.value)}
                          placeholder="Ex : VTM Commerce & Négoce SARL"
                          style={{ width: '100%', fontWeight: 700 }}
                        />
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Dénomination légale obligatoire appliquée au gestionnaire et sur tous les documents.
                        </span>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.25rem', color: '#475569' }}>
                          Date de création <span style={{ color: '#64748b', fontSize: '0.74rem' }}>(optionnel)</span>
                        </label>
                        <input
                          type="date"
                          defaultValue={String(values['organization.creationDate'] ?? '')}
                          onBlur={(e) => save('organization.creationDate', e.target.value)}
                          style={{ width: '100%' }}
                        />
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Historique de la société.
                        </span>
                      </div>
                    </div>

                    {/* N° IFU & N° RCCM (affichés sur facture et reçus) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                          N° IFU / NIF <span style={{ fontSize: '0.74rem', color: '#16a34a' }}>(Affiché sur facture)</span>
                        </label>
                        <input
                          type="text"
                          defaultValue={String(values['organization.taxId'] ?? '')}
                          onBlur={(e) => save('organization.taxId', e.target.value)}
                          placeholder="Ex : 0012345678A"
                          style={{ width: '100%' }}
                        />
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Identifiant Fiscal Unique légal.
                        </span>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                          N° RCCM <span style={{ fontSize: '0.74rem', color: '#16a34a' }}>(Affiché sur facture)</span>
                        </label>
                        <input
                          type="text"
                          defaultValue={String(values['organization.rccm'] ?? '')}
                          onBlur={(e) => save('organization.rccm', e.target.value)}
                          placeholder="Ex : BF-OUA-01-2024-B12-0045"
                          style={{ width: '100%' }}
                        />
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          Registre du Commerce et du Crédit Mobilier.
                        </span>
                      </div>
                    </div>

                    {/* Pays avec drapeau & Téléphone respectant les règles nationales */}
                    {(() => {
                      const currentCountryCode = String(values['organization.countryCode'] || 'BF');
                      const selectedCountry = SUPPORTED_COUNTRIES.find((c) => c.code === currentCountryCode) || SUPPORTED_COUNTRIES[0];
                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                              Pays d'activité & Devise <span style={{ color: '#2563eb' }}>({selectedCountry.flag} {selectedCountry.name})</span>
                            </label>
                            <select
                              value={currentCountryCode}
                              onChange={(e) => {
                                const cCode = e.target.value;
                                save('organization.countryCode', cCode);
                                const found = SUPPORTED_COUNTRIES.find((x) => x.code === cCode);
                                if (found) {
                                  save('organization.currency', found.currencyCode);
                                }
                              }}
                              style={{ width: '100%', padding: '0.45rem', fontSize: '0.88rem', fontWeight: 600 }}
                            >
                              <optgroup label="🌍 Pays d'Afrique (+226 Burkina Faso obligatoire)">
                                {SUPPORTED_COUNTRIES.filter((c) => c.region === 'AFRICA').map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {c.flag} {c.name} ({c.dialCode}) — {c.currencySymbol}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="🌐 Pays de l'Extérieur">
                                {SUPPORTED_COUNTRIES.filter((c) => c.region === 'INTERNATIONAL').map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {c.flag} {c.name} ({c.dialCode}) — {c.currencySymbol}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                            <span style={{ fontSize: '0.72rem', color: '#475569', display: 'block', marginTop: '0.2rem' }}>
                              Format exigé : {selectedCountry.phoneDigits} chiffres ({selectedCountry.phoneFormatPattern})
                            </span>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                              Téléphone {selectedCountry.flag} ({selectedCountry.dialCode})
                            </label>
                            <input
                              type="text"
                              defaultValue={String(values['organization.phone'] ?? '')}
                              onBlur={(e) => save('organization.phone', e.target.value)}
                              placeholder={`Ex : ${selectedCountry.phonePlaceholder}`}
                              style={{ width: '100%' }}
                            />
                            <span style={{ fontSize: '0.72rem', color: '#16a34a' }}>
                              Utilisé pour l'expédition automatique des reçus WhatsApp.
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Email et Adresse physique */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                          Email commercial
                        </label>
                        <input
                          type="email"
                          defaultValue={String(values['organization.email'] ?? '')}
                          onBlur={(e) => save('organization.email', e.target.value)}
                          placeholder="Ex : contact@moncommerce.com"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                          Adresse physique / Siège social
                        </label>
                        <input
                          type="text"
                          defaultValue={String(values['organization.address'] ?? '')}
                          onBlur={(e) => save('organization.address', e.target.value)}
                          placeholder="Ex : Av. Kwamé N'Krumah, Ouagadougou"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Gestion et Prévisualisation du Logo + Surcharges Facture */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                      Logo Officiel de l'Entreprise
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.65rem' }}>
                      Utilisé par défaut pour le gestionnaire, l'en-tête de facture et les reçus.
                    </span>

                    <div
                      style={{
                        width: '100%',
                        height: '110px',
                        borderRadius: '6px',
                        border: '1px dashed #94a3b8',
                        background: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '0.75rem',
                        padding: '0.5rem',
                        overflow: 'hidden',
                      }}
                    >
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo entreprise"
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                          Aucun logo téléversé (le nom textuel sera utilisé)
                        </div>
                      )}
                    </div>

                    {logoError && (
                      <div style={{ color: '#dc2626', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                        {logoError}
                      </div>
                    )}

                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.45rem 0.65rem', fontSize: '0.74rem', color: '#1e40af', marginBottom: '0.75rem', textAlign: 'left', lineHeight: 1.4 }}>
                      🔒 <strong>Formats acceptés :</strong> Fichiers <strong>.PNG, .JPG, .JPEG et .WEBP</strong> uniquement (max 2 Mo). Les extensions .PDF, .SVG, .EXE ou autres sont strictement bloquées par le système.
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      onChange={handleLogoUpload}
                      style={{ display: 'none' }}
                    />
                    <input
                      ref={invoiceHeaderFileRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      onChange={handleInvoiceHeaderLogoUpload}
                      style={{ display: 'none' }}
                    />
                    <input
                      ref={invoiceFooterFileRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      onChange={handleInvoiceFooterLogoUpload}
                      style={{ display: 'none' }}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%' }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="primary"
                        style={{ fontSize: '0.84rem', padding: '0.45rem 0.75rem' }}
                      >
                        {logoPreview ? 'Changer le logo principal' : 'Téléverser un logo'}
                      </button>
                      {logoPreview && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="btn-secondary"
                          style={{ fontSize: '0.78rem', color: '#dc2626' }}
                        >
                          Supprimer le logo principal
                        </button>
                      )}
                    </div>

                    {/* Surcharges spécifiques Facture */}
                    <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', width: '100%', textAlign: 'left' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '0.4rem' }}>
                        📑 Logos spécifiques Facture :
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.74rem', color: '#475569' }}>En-tête facture :</span>
                          <button
                            type="button"
                            onClick={() => invoiceHeaderFileRef.current?.click()}
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', color: '#1d4ed8', cursor: 'pointer' }}
                          >
                            {values['invoice.headerLogoUri'] ? 'Modifier en-tête' : 'Spécifique...'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.74rem', color: '#475569' }}>Pied de page (Cachet) :</span>
                          <button
                            type="button"
                            onClick={() => invoiceFooterFileRef.current?.click()}
                            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', color: '#1d4ed8', cursor: 'pointer' }}
                          >
                            {values['invoice.footerLogoUri'] ? 'Modifier pied' : 'Spécifique...'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages personnalisés sur les reçus de caisse */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>🧾</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>
                    Textes Personnalisés sur les Reçus de Caisse
                  </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
                  Ces messages s'affichent automatiquement en haut et en bas de chaque reçu thermique ou PDF remis au client.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                      Slogan ou En-tête de reçu (sous le logo)
                    </label>
                    <input
                      type="text"
                      defaultValue={String(values['documents.receiptHeaderText'] ?? '')}
                      onBlur={(e) => save('documents.receiptHeaderText', e.target.value)}
                      placeholder="Ex : Bienvenue ! Qualité & Prix bas garantis"
                      style={{ width: '100%' }}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Texte d'accueil ou slogan de votre commerce.
                    </span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                      Pied de page de reçu / Conditions de retour
                    </label>
                    <textarea
                      rows={2}
                      defaultValue={String(values['documents.receiptFooterText'] ?? '')}
                      onBlur={(e) => save('documents.receiptFooterText', e.target.value)}
                      placeholder="Ex : Merci de votre visite ! Les articles retournés sous 48h avec ticket sont échangés."
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Remerciements, conditions d'échange, mentions légales.
                    </span>
                  </div>
                </div>

                {/* Surcharge par boutique (allowLocationOverride) */}
                {locationsList.length > 0 && (
                  <div
                    style={{
                      marginTop: '1.25rem',
                      padding: '1rem',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#1e3a8a' }}>
                        📍 Personnaliser le pied de ticket pour une boutique spécifique
                      </div>
                      <select
                        value={selectedLocationId}
                        onChange={(e) => handleLocationSelect(e.target.value)}
                        style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.82rem', borderColor: '#94a3b8' }}
                      >
                        <option value="">Sélectionner une boutique...</option>
                        {locationsList.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedLocationId && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginBottom: '0.25rem' }}>
                          Pied de ticket propre à <strong>{locationsList.find((l) => l.id === selectedLocationId)?.name}</strong> :
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <textarea
                            rows={2}
                            value={locationFooterText}
                            onChange={(e) => setLocationFooterText(e.target.value)}
                            placeholder="Texte spécifique imprimé uniquement sur les tickets de cette boutique..."
                            style={{ width: '100%', fontSize: '0.84rem' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveLocationFooter(locationFooterText)}
                            className="primary"
                            style={{ alignSelf: 'flex-start', whiteSpace: 'nowrap', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                          >
                            Enregistrer
                          </button>
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Si défini, ce texte remplace le texte global uniquement pour cette boutique.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ONGLET 2 : MODÈLES DE FACTURES & REÇUS
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'templates' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>📑</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>
                    Choix du Modèle de Facture & Reçu (5 Modèles Conformes)
                  </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
                  Sélectionnez le style de document adapté à votre secteur d'activité. Chaque modèle respecte scrupuleusement
                  les mentions légales, les calculs de TVA et les ventilations d'acompte.
                </p>

                {/* Option Client sur Reçus */}
                <div
                  style={{
                    marginBottom: '1.5rem',
                    padding: '0.85rem 1rem',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                      Afficher les coordonnées du client sur les tickets de caisse
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Si désactivé, le ticket de comptoir reste anonymisé tout en conservant l'historique complet dans la base de données.
                    </div>
                  </div>
                  <label
                    className="checkbox-row"
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(values['documents.showCustomerOnReceipts'] ?? true)}
                      onChange={(e) => save('documents.showCustomerOnReceipts', e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      {values['documents.showCustomerOnReceipts'] ?? true ? 'Activé' : 'Désactivé'}
                    </span>
                  </label>
                </div>

                {/* Format de sortie des reçus */}
                <div
                  style={{
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.2rem' }}>
                    Format de sortie des reçus de caisse
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem' }}>
                    Choisissez le format d'impression adapté à votre matériel d'encaissement en caisse.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    {[
                      { key: 'THERMAL_80MM', label: '🧾 Ticket Rouleau Thermique (80 mm)', desc: 'Idéal imprimante POS / caisse enregistreuse' },
                      { key: 'A4_STANDARD', label: '📄 Reçu Pleine Page (A4 Standard)', desc: 'Idéal imprimante de bureau ou envoi email' },
                    ].map((f) => {
                      const isSelected = (values['documents.receiptFormat'] || 'THERMAL_80MM') === f.key;
                      return (
                        <div
                          key={f.key}
                          onClick={() => save('documents.receiptFormat', f.key)}
                          style={{
                            border: isSelected ? '2px solid #2563eb' : '1px solid var(--border)',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.2rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                              {f.label}
                            </span>
                            {isSelected && <span style={{ color: '#2563eb', fontWeight: 800 }}>✓</span>}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{f.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Validité des devis */}
                <div
                  style={{
                    marginBottom: '1.5rem',
                    padding: '0.85rem 1rem',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                      Délai de validité des devis par défaut
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Durée de validité imprimée en bas de chaque devis commercial remis au client.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      defaultValue={String(values['documents.quoteValidityDays'] || '30')}
                      onBlur={(e) => save('documents.quoteValidityDays', e.target.value)}
                      style={{ width: '80px', padding: '0.35rem 0.5rem', fontSize: '0.88rem', fontWeight: 700, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#475569' }}>jours</span>
                  </div>
                </div>

                {/* TITRE SECTION 1 : 10 FACTURES COMMERCIALES */}
                <div style={{ margin: '1rem 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>📑</span>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>
                    10 Modèles de Factures Commerciales (Format A4 & Export Professionnel)
                  </h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                  {INVOICE_TEMPLATES.map((tmpl) => {
                    const isCurrent = (values['documents.invoiceTemplate'] || 'STANDARD_PRO') === tmpl.key;
                    return (
                      <div
                        key={tmpl.key}
                        style={{
                          border: isCurrent ? `2.5px solid ${tmpl.color}` : '1px solid var(--border)',
                          background: isCurrent ? '#f0fdf4' : 'var(--surface)',
                          borderRadius: '10px',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: isCurrent ? '0 4px 15px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <span style={{ fontSize: '1.2rem' }}>{tmpl.icon}</span>
                              <span style={{ fontWeight: 800, fontSize: '0.96rem', color: isCurrent ? tmpl.color : '#0f172a' }}>
                                {tmpl.name}
                              </span>
                            </div>
                            {isCurrent && (
                              <span
                                style={{
                                  background: '#16a34a',
                                  color: '#ffffff',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '12px',
                                }}
                              >
                                Actif ✓
                              </span>
                            )}
                          </div>

                          <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.4, margin: '0 0 0.65rem' }}>
                            {tmpl.tagline}
                          </p>
                          <div style={{ fontSize: '0.74rem', color: '#64748b', fontStyle: 'italic', marginBottom: '1rem' }}>
                            💡 {tmpl.bestFor}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                          <button
                            type="button"
                            onClick={() => handlePreviewTemplate(tmpl.key)}
                            disabled={previewingTemplate === tmpl.key}
                            className="btn-secondary"
                            style={{ flex: 1, padding: '0.45rem 0.65rem', fontSize: '0.82rem', fontWeight: 600 }}
                          >
                            {previewingTemplate === tmpl.key ? 'Génération...' : '👁️ Aperçu PDF'}
                          </button>
                          {!isCurrent && (
                            <button
                              type="button"
                              onClick={() => save('documents.invoiceTemplate', tmpl.key)}
                              className="primary"
                              style={{ flex: 1, padding: '0.45rem 0.65rem', fontSize: '0.82rem', fontWeight: 700 }}
                            >
                              Choisir
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* TITRE SECTION 2 : 10 REÇUS DE CAISSE THERMIQUE & TICKETS */}
                <div style={{ margin: '1.5rem 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem', borderTop: '2px solid #e2e8f0' }}>
                  <span style={{ fontSize: '1.2rem' }}>🧾</span>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>
                    10 Modèles de Reçus de Caisse & Tickets (Rouleaux 58 mm, 80 mm ESC/POS & Reçus Mobiles)
                  </h4>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem' }}>
                  Spécialement adaptés pour les imprimantes thermiques de caisse (ESC/POS), terminaux points de vente et partages WhatsApp rapides.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                  {RECEIPT_TEMPLATES.map((rcpt) => {
                    const isCurrent = (values['documents.receiptTemplate'] || 'THERMAL_80MM_STANDARD') === rcpt.key;
                    return (
                      <div
                        key={rcpt.key}
                        style={{
                          border: isCurrent ? `2.5px solid ${rcpt.color}` : '1px solid var(--border)',
                          background: isCurrent ? '#eff6ff' : 'var(--surface)',
                          borderRadius: '10px',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: isCurrent ? '0 4px 15px rgba(37,99,235,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <span style={{ fontSize: '1.2rem' }}>{rcpt.icon}</span>
                              <span style={{ fontWeight: 800, fontSize: '0.94rem', color: isCurrent ? rcpt.color : '#0f172a' }}>
                                {rcpt.name}
                              </span>
                            </div>
                            <span
                              style={{
                                background: rcpt.format === 'THERMAL_58MM' ? '#fef3c7' : '#e0e7ff',
                                color: rcpt.format === 'THERMAL_58MM' ? '#92400e' : '#3730a3',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                              }}
                            >
                              {rcpt.format === 'THERMAL_58MM' ? '58 mm' : '80 mm POS'}
                            </span>
                          </div>

                          <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.4, margin: '0 0 0.65rem' }}>
                            {rcpt.tagline}
                          </p>
                          <div style={{ fontSize: '0.74rem', color: '#64748b', fontStyle: 'italic', marginBottom: '1rem' }}>
                            🖨️ {rcpt.bestFor}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                          <button
                            type="button"
                            onClick={() => {
                              save('documents.receiptTemplate', rcpt.key);
                              addToast(`Modèle de reçu « ${rcpt.name} » activé par défaut.`, 'success');
                            }}
                            className={isCurrent ? 'btn-secondary' : 'primary'}
                            style={{ flex: 1, padding: '0.45rem 0.65rem', fontSize: '0.82rem', fontWeight: 700 }}
                          >
                            {isCurrent ? 'Modèle de Reçu Actif ✓' : 'Sélectionner ce Reçu'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ADAPTATION MACHINES & OUTILS D'IMPRESSION */}
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '1.25rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', marginBottom: '0.35rem' }}>
                    🖨️ Compatibilité Matériel & Machines d'Impression VTM
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.55 }}>
                    Configurez un profil de périphérique par terminal, boutique et session de caisse dans « Paramètres → Périphériques & impression ». L’impression depuis le navigateur utilise les imprimantes et pilotes reconnus par le système; l’accès direct USB, Bluetooth, réseau ou ESC/POS dépend du navigateur et peut nécessiter un agent local. Vérifiez chaque modèle sur le matériel réel avant de le déclarer compatible.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ONGLET : MODULES DU GESTIONNAIRE (ACTIVATION / DÉSACTIVATION)
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'modules' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.75rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>🧩</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text)' }}>
                        Modules & Fonctionnalités sur Mesure
                      </h3>
                      <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                        Activez ou masquez les modules selon les besoins réels de votre commerce. Le menu latéral s'ajuste instantanément.
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const allKeys = ALL_APP_MODULES.map((m) => m.key);
                        setEnabledModuleKeysState(allKeys);
                        setEnabledModules(allKeys);
                        addToast('Tous les modules ont été activés.', 'success');
                      }}
                      className="btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.8rem', fontWeight: 600 }}
                    >
                      ✓ Tout Activer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const standardKeys = ['sales', 'pos', 'receipts', 'invoices', 'customers', 'inventory', 'reports', 'settings'];
                        setEnabledModuleKeysState(standardKeys);
                        setEnabledModules(standardKeys);
                        addToast('Configuration caisse standard appliquée.', 'info');
                      }}
                      className="btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.45rem 0.8rem', fontWeight: 600 }}
                    >
                      ⚡ Caisse Essentielle
                    </button>
                  </div>
                </div>

                {/* Bannière explicative */}
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    padding: '0.9rem 1.1rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>💡</span>
                  <div style={{ fontSize: '0.84rem', color: '#1e40af', lineHeight: 1.45 }}>
                    <strong>Adaptabilité totale :</strong> Les modules désactivés ne sont pas supprimés, mais simplement masqués du menu principal et des raccourcis caisse afin d'offrir une interface épurée à vos équipes. Vous pouvez les réactiver à tout moment d'un simple clic.
                  </div>
                </div>

                {/* Grille des modules par catégories */}
                {(['VENTES', 'GESTION', 'COMMERCIAL', 'LOGISTIQUE', 'COLLABORATION'] as const).map((cat) => {
                  const catModules = ALL_APP_MODULES.filter((m) => m.category === cat);
                  const catTitles: Record<string, { label: string; icon: string; desc: string }> = {
                    VENTES: { label: 'Vente, Caisse POS & Encaissement', icon: '🛒', desc: 'Gestion des encaissements, tickets de caisse, factures et promotions' },
                    GESTION: { label: 'Gestion des Articles & Stocks', icon: '📦', desc: 'Catalogue de produits, inventaires et alertes de rupture ROP' },
                    COMMERCIAL: { label: 'Fournisseurs, Marché B2B & Partenaires', icon: '🏢', desc: 'Gestion des grossistes, centrale d’achat B2B et programmes partenaires' },
                    LOGISTIQUE: { label: 'Traçabilité, Livraisons & Décharges', icon: '🚚', desc: 'Bons de livraison, expéditions et fiches de décharge de responsabilité' },
                    COLLABORATION: { label: 'Équipe, Pointage & Communication', icon: '👥', desc: 'Pointage de présence individuel, gestion des accès et dépenses' },
                  };
                  const meta = catTitles[cat] || { label: cat, icon: '📁', desc: '' };

                  return (
                    <div key={cat} style={{ marginBottom: '1.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '1.15rem' }}>{meta.icon}</span>
                        <h4 style={{ margin: 0, fontSize: '0.96rem', color: '#0f172a', fontWeight: 800 }}>
                          {meta.label}
                        </h4>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.85rem' }}>
                        {meta.desc}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.9rem' }}>
                        {catModules.map((mod) => {
                          const isEnabled = enabledModuleKeys.includes(mod.key);
                          return (
                            <div
                              key={mod.key}
                              style={{
                                border: isEnabled ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                                background: isEnabled ? '#f8fafc' : '#f1f5f9',
                                borderRadius: '10px',
                                padding: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.75rem',
                                transition: 'all 0.2s ease',
                                opacity: isEnabled ? 1 : 0.7,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '8px',
                                    background: isEnabled ? '#dbeafe' : '#e2e8f0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.25rem',
                                    flexShrink: 0,
                                  }}
                                >
                                  {mod.icon}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isEnabled ? '#0f172a' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {mod.name}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.3, marginTop: '2px' }}>
                                    {mod.description}
                                  </div>
                                </div>
                              </div>

                              {/* Toggle switch bouton */}
                              <button
                                type="button"
                                onClick={() => handleToggleModule(mod.key)}
                                style={{
                                  position: 'relative',
                                  width: '46px',
                                  height: '26px',
                                  borderRadius: '13px',
                                  border: 'none',
                                  background: isEnabled ? '#2563eb' : '#cbd5e1',
                                  cursor: 'pointer',
                                  padding: 0,
                                  flexShrink: 0,
                                  transition: 'background 0.2s ease',
                                }}
                                aria-label={`Activer ou désactiver ${mod.name}`}
                              >
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: '3px',
                                    left: isEnabled ? '23px' : '3px',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: '#ffffff',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    transition: 'left 0.2s ease',
                                  }}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ONGLET 3 : RÈGLES DE CAISSE & VENTES
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'rules' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.2rem' }}>
                    Client obligatoire pour toutes les ventes (y compris payées comptant)
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Si activé, chaque vente devra désigner un client nominatif. Laissez désactivé pour les commerces de détail avec clients passagers.
                  </div>
                </div>
                <label className="checkbox-row" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(values['sales.requireCustomerAlways'] ?? false)}
                    onChange={(e) => save('sales.requireCustomerAlways', e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                    {values['sales.requireCustomerAlways'] ? 'Activé' : 'Désactivé'}
                  </span>
                </label>
              </div>

              {/* RÈGLE REMISES MANUELLES EN CAISSE */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.2rem' }}>
                      🏷️ Autoriser les remises manuelles au comptoir
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      Permet au caissier d'appliquer une remise commerciale directe sur le panier lors de l'encaissement.
                    </div>
                  </div>
                  <label className="checkbox-row" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(values['sales.allowManualDiscounts'] ?? true)}
                      onChange={(e) => save('sales.allowManualDiscounts', e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      {values['sales.allowManualDiscounts'] ?? true ? 'Activé' : 'Désactivé'}
                    </span>
                  </label>
                </div>

                {Boolean(values['sales.allowManualDiscounts'] ?? true) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                      Plafond maximal de remise accordée sans validation gérant :
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        defaultValue={String(values['sales.maxManualDiscountPercent'] || '20')}
                        onBlur={(e) => save('sales.maxManualDiscountPercent', e.target.value)}
                        style={{ width: '70px', padding: '0.3rem 0.5rem', fontSize: '0.86rem', fontWeight: 700, textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#64748b' }}>%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ONGLET : GESTION DU STOCK & VALORISATION COMPTABLE
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'inventory' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* MÉTHODE DE VALORISATION COMPTABLE CUMP vs FIFO */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>⚖️</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>
                    Méthode de Valorisation Comptable du Stock
                  </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
                  Détermine comment le logiciel calcule la valeur financière de vos actifs et le coût de revient des marchandises vendues.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {[
                    {
                      key: 'CUMP',
                      title: '📈 CUMP (Coût Unitaire Moyen Pondéré)',
                      badge: 'Recommandé commerce général & distribution',
                      desc: 'Recalcule la moyenne pondérée du coût d’achat à chaque nouveau bon de réception. Lisse les variations de prix fournisseurs.',
                    },
                    {
                      key: 'FIFO',
                      title: '📦 FIFO (First-In, First-Out / Premier Entré, Premier Sorti)',
                      badge: 'Idéal denrées périssables & traçabilité par lots',
                      desc: 'Les articles vendus sont valorisés au coût du lot d’achat le plus ancien encore en stock. Reflète fidèlement la réalité physique.',
                    },
                  ].map((m) => {
                    const isSelected = (values['inventory.valuationMethod'] || 'CUMP') === m.key;
                    return (
                      <div
                        key={m.key}
                        onClick={() => save('inventory.valuationMethod', m.key)}
                        style={{
                          border: isSelected ? '2px solid #2563eb' : '1px solid var(--border)',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          padding: '1rem 1.25rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                            {m.title}
                          </span>
                          {isSelected && <span style={{ color: '#2563eb', fontWeight: 800 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: '0.74rem', color: isSelected ? '#1e40af' : '#059669', fontWeight: 700 }}>
                          {m.badge}
                        </span>
                        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.3rem 0 0', lineHeight: 1.45 }}>
                          {m.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* VENTE DIRECTE SANS BLOCAGE (STOCK NÉGATIF) */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>⚡</span>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a' }}>
                        Autoriser la vente directe en stock négatif
                      </h4>
                    </div>
                    <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                      Permet d’encaisser immédiatement au comptoir même si le produit affiche 0 en stock (par exemple lors d’une livraison physique reçue mais pas encore saisie en informatique).
                    </p>
                  </div>
                  <label className="checkbox-row" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(values['inventory.allowNegativeStock'] ?? false)}
                      onChange={(e) => save('inventory.allowNegativeStock', e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      {values['inventory.allowNegativeStock'] ? 'Activé' : 'Désactivé'}
                    </span>
                  </label>
                </div>
              </div>

              {/* SEUIL D'ALERTE DE STOCK FAIBLE */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.2rem' }}>
                    ⚠️ Seuil d'alerte de stock faible par défaut
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Quantité sous laquelle un article déclenche une alerte de réapprovisionnement sur le tableau de bord.
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {[2, 5, 10, 20].map((num) => {
                    const isSelected = String(values['inventory.lowStockThreshold'] || '5') === String(num);
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => save('inventory.lowStockThreshold', String(num))}
                        className={isSelected ? 'primary' : 'btn-secondary'}
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.82rem', fontWeight: isSelected ? 700 : 500 }}
                      >
                        {num} unités
                      </button>
                    );
                  })}
                  <input
                    type="number"
                    min="1"
                    defaultValue={String(values['inventory.lowStockThreshold'] || '5')}
                    onBlur={(e) => save('inventory.lowStockThreshold', e.target.value)}
                    style={{ width: '65px', padding: '0.3rem 0.5rem', fontSize: '0.86rem', fontWeight: 700, textAlign: 'center' }}
                  />
                </div>
              </div>

              {/* POINT DE COMMANDE / DÉLAI FOURNISSEUR */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.2rem' }}>
                    🚚 Délai moyen de livraison fournisseur (Point de commande automatique)
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Nombre moyen de jours entre la commande d’achat et la réception en rayon. Utilisé pour calculer le point de réapprovisionnement automatique (ROP = Ventes/jour × Délai + Sécurité).
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    defaultValue={String(values['inventory.reorderLeadDays'] || '7')}
                    onBlur={(e) => save('inventory.reorderLeadDays', e.target.value)}
                    style={{ width: '70px', padding: '0.35rem 0.5rem', fontSize: '0.88rem', fontWeight: 700, textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#475569' }}>jours</span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ONGLET : CRÉDIT CLIENTS, RISQUES & RECOUVREMENT
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'credit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* MÉTHODE D'AMORTISSEMENT DU CRÉDIT */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>📊</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>
                    Moteur d’Amortissement & Échéancier Financier
                  </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
                  Sélectionnez la méthodologie mathématique appliquée pour générer les échéanciers et tableaux de remboursement.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {[
                    {
                      key: 'FREE_SCHEDULE',
                      title: '🛒 Échéance Libre / Facilités de Caisse',
                      desc: 'Remboursements partiels à la convenance du client au comptoir jusqu’à solde complet avant date d’échéance finale.',
                    },
                    {
                      key: 'CONSTANT_ANNUITY',
                      title: '📅 Annuités Constantes (Mensualités Fixes)',
                      desc: 'Chaque échéance a le même montant total (la part de capital augmente tandis que la part d’intérêts diminue).',
                    },
                    {
                      key: 'CONSTANT_CAPITAL',
                      title: '📉 Amortissement Constant (Capital Fixe)',
                      desc: 'La part de capital remboursée est identique à chaque échéance, les intérêts diminuent avec le solde restant dû.',
                    },
                  ].map((m) => {
                    const isSelected = (values['credit.amortizationMethod'] || 'FREE_SCHEDULE') === m.key;
                    return (
                      <div
                        key={m.key}
                        onClick={() => save('credit.amortizationMethod', m.key)}
                        style={{
                          border: isSelected ? '2px solid #2563eb' : '1px solid var(--border)',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          padding: '1rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.92rem', color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                            {m.title}
                          </span>
                          {isSelected && <span style={{ color: '#2563eb', fontWeight: 800 }}>✓</span>}
                        </div>
                        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0, lineHeight: 1.45 }}>{m.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CLIENT OBLIGATOIRE POUR CRÉDIT */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.2rem' }}>
                    Client obligatoire pour toute vente à crédit
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                    Empêche formellement d'accorder une dette à un client anonyme au comptoir.
                  </div>
                </div>
                <label className="checkbox-row" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(values['sales.requireCustomerForCreditSales'] ?? true)}
                    onChange={(e) => save('sales.requireCustomerForCreditSales', e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                    {values['sales.requireCustomerForCreditSales'] ?? true ? 'Activé' : 'Désactivé'}
                  </span>
                </label>
              </div>

              {/* DÉLAI D'ÉCHÉANCE ET TAUX D'ENDETTEMENT */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '1.5rem',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', marginBottom: '0.2rem' }}>
                    ⏳ Délai d’échéance du crédit (jours)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.85rem' }}>
                    Délai accordé par défaut pour solder une créance avant relance de recouvrement.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      defaultValue={String(values['credit.defaultCreditTermDays'] || '30')}
                      onBlur={(e) => save('credit.defaultCreditTermDays', e.target.value)}
                      style={{ width: '80px', padding: '0.35rem 0.5rem', fontSize: '0.88rem', fontWeight: 700, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#475569' }}>jours</span>
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '1.5rem',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', marginBottom: '0.2rem' }}>
                    🛡️ Taux d’endettement maximal autorisé
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.85rem' }}>
                    Plafond de risque client autorisé avant suspension préventive du droit de crédit.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <input
                      type="number"
                      min="5"
                      max="100"
                      defaultValue={String(values['credit.maxDebtRatioPercent'] || '30')}
                      onBlur={(e) => save('credit.maxDebtRatioPercent', e.target.value)}
                      style={{ width: '70px', padding: '0.35rem 0.5rem', fontSize: '0.88rem', fontWeight: 700, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#64748b' }}>%</span>
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '1.5rem',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', marginBottom: '0.2rem' }}>
                    ⚖️ Pénalité journalière de retard
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.85rem' }}>
                    Taux journalier appliqué sur les soldes impayés au-delà de la date d’échéance.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="10"
                      defaultValue={String(values['credit.latePenaltyDailyRate'] || '0.1')}
                      onBlur={(e) => save('credit.latePenaltyDailyRate', e.target.value)}
                      style={{ width: '80px', padding: '0.35rem 0.5rem', fontSize: '0.88rem', fontWeight: 700, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#64748b' }}>% / jour</span>
                  </div>
                </div>
              </div>

              {/* RAPPELS WHATSAPP */}
              {(hasSection('social') || hasCapability('social_inbox')) && (
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.2rem' }}>
                      📱 Rappels automatiques de créances par WhatsApp
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      Envoie un rappel bienveillant par message WhatsApp aux clients ayant des soldes débiteurs en retard.
                    </div>
                  </div>
                  <label className="checkbox-row" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(values['reminders.whatsappCreditRemindersEnabled'] ?? false)}
                      onChange={(e) => save('reminders.whatsappCreditRemindersEnabled', e.target.checked)}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      {values['reminders.whatsappCreditRemindersEnabled'] ? 'Activé' : 'Désactivé'}
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}



          {/* ══════════════════════════════════════════════════════════════
              ONGLET 4 : DEVISES & MOYENS DE PAIEMENT
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'payments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* FOND DE CAISSE SUGGÉRÉ À L'OUVERTURE */}
              {hasSection('cash') && (
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.2rem' }}>
                      💵 Fond de caisse suggéré à l'ouverture
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      Montant en espèces pré-rempli dans le formulaire d'ouverture quotidienne de session de caisse.
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      defaultValue={String(values['cash.defaultOpeningFloat'] || '0')}
                      onBlur={(e) => save('cash.defaultOpeningFloat', e.target.value)}
                      style={{ width: '120px', padding: '0.35rem 0.5rem', fontSize: '0.88rem', fontWeight: 700, textAlign: 'right' }}
                    />
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#475569' }}>
                      {String(values['commerce.defaultCurrency'] || 'XOF')}
                    </span>
                  </div>
                </div>
              )}
              {/* DEVISE PAR DÉFAUT */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>💰</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>
                    Devise Principale du Magasin
                  </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
                  Devise monétaire par défaut utilisée pour l'affichage des prix, l'encaissement et la valorisation comptable.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  {CURRENCIES.map((c) => {
                    const isSelected = (values['commerce.defaultCurrency'] || 'XOF') === c.code;
                    return (
                      <div
                        key={c.code}
                        onClick={() => save('commerce.defaultCurrency', c.code)}
                        style={{
                          border: isSelected ? '2px solid #2563eb' : '1px solid var(--border)',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          padding: '0.85rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                            {c.code}
                          </span>
                          {isSelected && <span style={{ color: '#2563eb', fontWeight: 800 }}>✓</span>}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#475569' }}>{c.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MOYENS DE PAIEMENT ACTIVÉS */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.5rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>💳</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>
                    Moyens de Paiement Acceptés au Comptoir
                  </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
                  Cochez les moyens de règlement que vos caissiers peuvent sélectionner lors de la validation d'une vente.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {PAYMENT_METHODS_LIST.map((method) => {
                    const currentList = Array.isArray(values['payments.enabledMethods'])
                      ? (values['payments.enabledMethods'] as string[])
                      : ['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHECK'];
                    const isChecked = currentList.includes(method.key);

                    return (
                      <label
                        key={method.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: isChecked ? '#f8fafc' : '#ffffff',
                          border: isChecked ? '1.5px solid #cbd5e1' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '0.85rem 1.1rem',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <span style={{ fontSize: '1.4rem' }}>{method.icon}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                              {method.label} ({method.key})
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{method.desc}</div>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const next = new Set(currentList);
                            if (e.target.checked) next.add(method.key);
                            else next.delete(method.key);
                            // Au moins un moyen de paiement doit rester actif
                            if (next.size > 0) {
                              save('payments.enabledMethods', Array.from(next));
                            } else {
                              addToast('Au moins un moyen de paiement doit rester activé.', 'warning');
                            }
                          }}
                          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ONGLET : MULTI-STORE & BOUTIQUES (Espaces dédiés de configuration)
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'multistore' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {!activeStoreConfigId ? (
                /* ── VUE 1 : LISTE DES BOUTIQUES & POINTS DE VENTE ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                      borderRadius: 'var(--radius)',
                      padding: '1.75rem',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '1.6rem' }}>🏪</span>
                        <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#ffffff' }}>
                          Boutiques & Points de Vente de votre Réseau
                        </h2>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.92rem', color: '#c7d2fe', maxWidth: '650px', lineHeight: 1.5 }}>
                        Sélectionnez la boutique que vous souhaitez administrer. Vous accéderez à son <strong>espace spécialement dédié</strong> pour paramétrer son identité locale, ses coordonnées, sa devise, ses taux de taxe et son ticket de caisse.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAddStoreModal(true)}
                      style={{
                        background: '#ffffff',
                        color: '#312e81',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '0.75rem 1.25rem',
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span>+</span> Créer une nouvelle boutique
                    </button>
                  </div>

                  {locationsList.length === 0 ? (
                    <div
                      style={{
                        background: '#ffffff',
                        borderRadius: 'var(--radius)',
                        padding: '3rem 2rem',
                        textAlign: 'center',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏪</div>
                      <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>Aucune boutique configurée</h3>
                      <p style={{ color: '#64748b', margin: '0 0 1.25rem' }}>
                        Créez votre première boutique ou votre point de vente principal pour commencer.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAddStoreModal(true)}
                        className="btn-primary"
                        style={{ padding: '0.6rem 1.25rem' }}
                      >
                        + Ajouter un point de vente
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '1.25rem',
                      }}
                    >
                      {locationsList.map((loc) => {
                        const localKey = `vtm_store_pref_${loc.id}`;
                        let localPrefs: any = {};
                        try {
                          const raw = localStorage.getItem(localKey);
                          if (raw) localPrefs = JSON.parse(raw);
                        } catch {}
                        const phone = localPrefs.phone || 'Non renseigné';
                        const address = localPrefs.address || 'Adresse principale';
                        const currency = localPrefs.currency || values['general.currency'] || 'XOF';

                        return (
                          <div
                            key={loc.id}
                            style={{
                              background: '#ffffff',
                              borderRadius: '14px',
                              border: '1px solid #e2e8f0',
                              padding: '1.5rem',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                  <div
                                    style={{
                                      width: '42px',
                                      height: '42px',
                                      borderRadius: '10px',
                                      background: '#eff6ff',
                                      color: '#2563eb',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '1.3rem',
                                    }}
                                  >
                                    🏬
                                  </div>
                                  <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{loc.name}</h3>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>ID: {loc.id.slice(0, 8)}...</span>
                                  </div>
                                </div>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '999px',
                                  }}
                                >
                                  Active
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.86rem', color: '#475569', margin: '1rem 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span>📍</span>
                                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{address}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span>📞</span>
                                  <span>{phone}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span>💰</span>
                                  <span>Devise de caisse : <strong>{currency}</strong></span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => void handleOpenStoreConfig(loc)}
                              style={{
                                width: '100%',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                padding: '0.65rem 1rem',
                                color: '#1e293b',
                                fontWeight: 700,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                marginTop: '0.75rem',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = '#2563eb';
                                e.currentTarget.style.color = '#ffffff';
                                e.currentTarget.style.borderColor = '#2563eb';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = '#f8fafc';
                                e.currentTarget.style.color = '#1e293b';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                              }}
                            >
                              <span>⚙️</span> Configurer cette boutique →
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* ── VUE 2 : ESPACE SPÉCIALEMENT CONÇU POUR CETTE BOUTIQUE ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Bandeau d'en-tête de l'espace dédié */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                      borderRadius: 'var(--radius)',
                      padding: '1.5rem 1.75rem',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => setActiveStoreConfigId(null)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.12)',
                          border: 'none',
                          color: '#ffffff',
                          borderRadius: '6px',
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          marginBottom: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        ← Revenir à la liste des boutiques
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '1.8rem' }}>🏬</span>
                        <div>
                          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#ffffff' }}>
                            Espace de Configuration : {storeConfigData.name}
                          </h2>
                          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                            Point de vente officiel · Identifiant système : {activeStoreConfigId}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setActiveStoreConfigId(null)}
                        className="btn-secondary"
                        style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: 'none' }}
                      >
                        Fermer l'espace
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveStoreConfig()}
                        disabled={savingStoreConfig}
                        style={{
                          background: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.65rem 1.25rem',
                          fontWeight: 700,
                          cursor: savingStoreConfig ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <span>💾</span> {savingStoreConfig ? 'Enregistrement...' : 'Enregistrer la boutique'}
                      </button>
                    </div>
                  </div>

                  {/* 3 Blocs de paramétrage de la boutique */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
                    {/* Bloc 1 : Identité & Coordonnées Locales */}
                    <div
                      style={{
                        background: '#ffffff',
                        borderRadius: 'var(--radius)',
                        padding: '1.5rem',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                        <span style={{ fontSize: '1.3rem' }}>📍</span>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>Identité & Contact Local</h3>
                      </div>

                      <div className="form-group">
                        <label>Nom commercial de la boutique</label>
                        <input
                          type="text"
                          value={storeConfigData.name}
                          onChange={(e) => setStoreConfigData({ ...storeConfigData, name: e.target.value })}
                          className="form-control"
                          placeholder="Ex: Boutique Centre-Ville"
                        />
                      </div>

                      <div className="form-group">
                        <label>Adresse physique du magasin</label>
                        <input
                          type="text"
                          value={storeConfigData.address}
                          onChange={(e) => setStoreConfigData({ ...storeConfigData, address: e.target.value })}
                          className="form-control"
                          placeholder="Ex: Avenue Kwame N'Krumah, Ouagadougou"
                        />
                      </div>

                      <div className="form-group">
                        <label>Téléphone direct du point de vente</label>
                        <input
                          type="tel"
                          value={storeConfigData.phone}
                          onChange={(e) => setStoreConfigData({ ...storeConfigData, phone: e.target.value })}
                          className="form-control"
                          placeholder="Ex: +226 70 00 00 00"
                        />
                      </div>

                      <div className="form-group">
                        <label>Email de contact de la boutique</label>
                        <input
                          type="email"
                          value={storeConfigData.email}
                          onChange={(e) => setStoreConfigData({ ...storeConfigData, email: e.target.value })}
                          className="form-control"
                          placeholder="Ex: contact-centre@monentreprise.com"
                        />
                      </div>
                    </div>

                    {/* Bloc 2 : Ticket de Caisse & Imprimante */}
                    <div
                      style={{
                        background: '#ffffff',
                        borderRadius: 'var(--radius)',
                        padding: '1.5rem',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                        <span style={{ fontSize: '1.3rem' }}>🖨️</span>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>Ticket de Caisse & Imprimante</h3>
                      </div>

                      <div className="form-group">
                        <label>Format de ticket de caisse par défaut</label>
                        <select
                          value={storeConfigData.printerType}
                          onChange={(e) => setStoreConfigData({ ...storeConfigData, printerType: e.target.value })}
                          className="form-control"
                        >
                          <option value="80mm">Thermique Standard 80mm (Recommandé)</option>
                          <option value="58mm">Thermique Compact 58mm (Mobile / Bluetooth)</option>
                          <option value="A4">Standard A4 / A5 (Facturette bureautique)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Pied de ticket personnalisé (Mentions légales locales)</label>
                        <textarea
                          rows={4}
                          value={storeConfigData.receiptFooterText}
                          onChange={(e) => setStoreConfigData({ ...storeConfigData, receiptFooterText: e.target.value })}
                          className="form-control"
                          placeholder="Ex: Merci pour votre visite dans notre boutique Centre-Ville ! Marchandise ni reprise ni échangée après 48h."
                        />
                        <small style={{ color: '#64748b', fontSize: '0.78rem' }}>
                          Ce texte sera imprimé spécifiquement au bas de chaque ticket et reçu émis dans cette boutique.
                        </small>
                      </div>
                    </div>

                    {/* Bloc 3 : Caisse, Devise & Règles de Stock */}
                    <div
                      style={{
                        background: '#ffffff',
                        borderRadius: 'var(--radius)',
                        padding: '1.5rem',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                        <span style={{ fontSize: '1.3rem' }}>⚙️</span>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>Devise, Taxes & Stock Local</h3>
                      </div>

                      <div className="form-group">
                        <label>Devise principale de caisse</label>
                        <select
                          value={storeConfigData.currency}
                          onChange={(e) => setStoreConfigData({ ...storeConfigData, currency: e.target.value })}
                          className="form-control"
                        >
                          {SUPPORTED_COUNTRIES.map((c) => (
                            <option key={c.code} value={c.currencyCode}>
                              {c.currencyCode} ({c.currencySymbol}) — {c.name} {c.flag}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Taux de TVA local appliqué (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={storeConfigData.vatRate}
                          onChange={(e) => setStoreConfigData({ ...storeConfigData, vatRate: Number(e.target.value) })}
                          className="form-control"
                        />
                      </div>

                      <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={storeConfigData.allowNegativeStock}
                            onChange={(e) => setStoreConfigData({ ...storeConfigData, allowNegativeStock: e.target.checked })}
                            style={{ width: '18px', height: '18px' }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>Tolérer la vente en stock négatif</div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Permet de valider une vente même si le stock informatique est temporairement à 0.</div>
                          </div>
                        </label>
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                        <button
                          type="button"
                          onClick={() => void handleSaveStoreConfig()}
                          disabled={savingStoreConfig}
                          style={{
                            width: '100%',
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            fontWeight: 700,
                            fontSize: '0.92rem',
                            cursor: savingStoreConfig ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {savingStoreConfig ? 'Enregistrement en cours...' : '💾 Sauvegarder cette boutique'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Création Nouvelle Boutique */}
              {showAddStoreModal && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '1rem',
                  }}
                >
                  <div
                    style={{
                      background: '#ffffff',
                      borderRadius: '16px',
                      padding: '2rem',
                      maxWidth: '480px',
                      width: '100%',
                      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Nouvelle Boutique / Point de Vente</h3>
                      <button
                        type="button"
                        onClick={() => setShowAddStoreModal(false)}
                        style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Nom de l'emplacement / Magasin *</label>
                      <input
                        type="text"
                        value={newStoreName}
                        onChange={(e) => setNewStoreName(e.target.value)}
                        placeholder="Ex: Boutique Akwa Douala, Agence 2..."
                        className="form-control"
                        autoFocus
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowAddStoreModal(false)}
                        className="btn-secondary"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCreateStore()}
                        disabled={creatingStore || !newStoreName.trim()}
                        className="btn-primary"
                        style={{ padding: '0.65rem 1.25rem' }}
                      >
                        {creatingStore ? 'Création...' : 'Créer et Configurer →'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ONGLET : RÉSEAUX SOCIAUX & CANAUX OFFICIELS
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'social' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Entête & Guide Pédagogique */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                  borderRadius: 'var(--radius)',
                  padding: '1.75rem',
                  color: '#ffffff',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ maxWidth: '640px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>📱</span>
                      <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f8fafc', fontWeight: 800 }}>
                        Gestion des Canaux & Réseaux Sociaux
                      </h3>
                    </div>
                    <p style={{ fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.55, margin: 0 }}>
                      Connectez vos comptes professionnels officiels WhatsApp Cloud API, Facebook Messenger, Instagram Direct
                      et TikTok Business. Vos identifiants, clés d’API et webhooks sont configurés ici de façon sécurisée,
                      tandis que le traitement des conversations se déroule dans votre{' '}
                      <strong style={{ color: '#38bdf8' }}>Boîte de Réception Sociale</strong>.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => navigate('/social')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.65rem 1.15rem',
                        background: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      💬 Ouvrir la Boîte de Réception
                    </button>
                    <button
                      type="button"
                      onClick={handleEmergencyKillSwitch}
                      disabled={killingSocial}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.65rem 1.1rem',
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      {killingSocial ? 'Coupure en cours...' : '🛑 Arrêt d’urgence (Kill Switch)'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sélecteur des 4 Plateformes Officielles */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                }}
              >
                {SOCIAL_PLATFORMS.map((platform) => {
                  const isSelected = selectedSocialPlatform === platform.key;
                  const account = socialAccounts.find((a) => a.platform === platform.key);
                  const isConnected = account && account.status === 'CONNECTED';

                  return (
                    <div
                      key={platform.key}
                      onClick={() => handlePlatformSelect(platform.key)}
                      style={{
                        background: isSelected ? '#f8fafc' : 'var(--surface)',
                        border: isSelected ? `2px solid ${platform.color}` : '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: '1.25rem',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.06)' : 'var(--shadow-sm)',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                          <span style={{ fontSize: '1.8rem' }}>{platform.icon}</span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.5rem',
                              borderRadius: '999px',
                              background: isConnected ? '#dcfce7' : '#f1f5f9',
                              color: isConnected ? '#15803d' : '#64748b',
                            }}
                          >
                            {isConnected ? '✓ Connecté & Actif' : '⚪ Non configuré'}
                          </span>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
                          {platform.name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          {platform.desc}
                        </div>
                      </div>

                      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>{platform.badge}</span>
                        {isSelected && <span style={{ color: platform.color, fontWeight: 800, fontSize: '0.85rem' }}>Modifier →</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Formulaire de Configuration pour la Plateforme Sélectionnée */}
              {(() => {
                const currentMeta = SOCIAL_PLATFORMS.find((p) => p.key === selectedSocialPlatform)!;
                const currentAccount = socialAccounts.find((a) => a.platform === selectedSocialPlatform);
                const isConnected = currentAccount && currentAccount.status === 'CONNECTED';

                return (
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: '1.75rem',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '10px',
                            background: `${currentMeta.color}15`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.4rem',
                          }}
                        >
                          {currentMeta.icon}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)', fontWeight: 800 }}>
                            Configuration {currentMeta.name}
                          </h4>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {currentMeta.badge} • Statut : {isConnected ? 'Opérationnel et rattaché' : 'En attente de jeton'}
                          </span>
                        </div>
                      </div>

                      {isConnected && (
                        <button
                          type="button"
                          onClick={handleDisconnectSocialAccount}
                          disabled={disconnectingSocial}
                          style={{
                            padding: '0.45rem 0.85rem',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: '#b91c1c',
                            background: '#fee2e2',
                            border: '1px solid #fca5a5',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          {disconnectingSocial ? 'Déconnexion...' : '🔌 Déconnecter ce canal'}
                        </button>
                      )}
                    </div>

                    {/* Rappel des politiques de conformité */}
                    <div
                      style={{
                        padding: '0.85rem 1rem',
                        background: '#eff6ff',
                        borderLeft: `4px solid ${currentMeta.color}`,
                        borderRadius: '0 6px 6px 0',
                        fontSize: '0.82rem',
                        color: '#1e3a8a',
                        marginBottom: '1.5rem',
                        lineHeight: 1.5,
                      }}
                    >
                      <strong>Règle officielle & politique :</strong> {currentMeta.policy}
                    </div>

                    {/* Formulaire des champs */}
                    <form onSubmit={handleSaveSocialConfig}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        {currentMeta.fields.map((field) => {
                          const isSecret = field.isSecret;
                          const isVisible = visibleSecrets[field.key] || false;

                          return (
                            <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text)' }}>
                                {field.label} {field.required && <span style={{ color: '#dc2626' }}>*</span>}
                              </label>
                              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                  type={isSecret && !isVisible ? 'password' : 'text'}
                                  placeholder={field.placeholder}
                                  required={field.required}
                                  value={socialFormData[field.key] || ''}
                                  onChange={(e) =>
                                    setSocialFormData((prev) => ({ ...prev, [field.key]: e.target.value }))
                                  }
                                  style={{
                                    width: '100%',
                                    padding: '0.65rem 0.85rem',
                                    paddingRight: isSecret ? '2.5rem' : '0.85rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border)',
                                    fontSize: '0.88rem',
                                    background: '#ffffff',
                                  }}
                                />
                                {isSecret && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVisibleSecrets((prev) => ({ ...prev, [field.key]: !isVisible }))
                                    }
                                    style={{
                                      position: 'absolute',
                                      right: '0.5rem',
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontSize: '0.9rem',
                                      color: '#64748b',
                                    }}
                                    title={isVisible ? 'Masquer' : 'Afficher'}
                                  >
                                    {isVisible ? '🙈' : '👁️'}
                                  </button>
                                )}
                              </div>
                              {field.help && (
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                  {field.help}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Résultat du test de connectivité */}
                      {testResult && (
                        <div
                          style={{
                            padding: '0.85rem 1.1rem',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            marginBottom: '1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            background: testResult.success ? '#ecfdf5' : '#fef2f2',
                            color: testResult.success ? '#065f46' : '#991b1b',
                            border: `1px solid ${testResult.success ? '#a7f3d0' : '#fecaca'}`,
                          }}
                        >
                          <span>{testResult.success ? '✅' : '❌'}</span>
                          <span>{testResult.message}</span>
                        </div>
                      )}

                      {/* Actions du formulaire */}
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          type="submit"
                          disabled={savingSocialConfig}
                          className="primary"
                          style={{ padding: '0.7rem 1.5rem', fontWeight: 700, fontSize: '0.9rem' }}
                        >
                          {savingSocialConfig ? 'Enregistrement...' : '💾 Enregistrer la configuration'}
                        </button>

                        <button
                          type="button"
                          onClick={handleTestSocialConnection}
                          disabled={testingConnection}
                          style={{
                            padding: '0.7rem 1.25rem',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#334155',
                          }}
                        >
                          {testingConnection ? 'Vérification en cours...' : '⚡ Tester la connexion en direct'}
                        </button>
                      </div>
                    </form>
                  </div>
                );
              })()}

              {/* Paramètres Webhook & URLs de Rappel Officielles */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.75rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>🔗</span>
                  <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)', fontWeight: 800 }}>
                    Paramètres Webhook & URLs de Rappel Officielles
                  </h4>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
                  Pour que les messages de vos clients sur WhatsApp, Messenger, Instagram ou TikTok apparaissent
                  instantanément dans votre boîte de réception, copiez ces paramètres dans la console développeur de la plateforme.
                </p>

                {loadingWebhook ? (
                  <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Chargement des endpoints de rappel...
                  </div>
                ) : socialWebhookInfo ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                      {/* URL de rappel */}
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                          URL de Rappel (Callback URL / Webhook URL)
                        </label>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <input
                            type="text"
                            readOnly
                            value={socialWebhookInfo.callbackUrl}
                            style={{
                              flex: 1,
                              padding: '0.55rem 0.75rem',
                              fontSize: '0.82rem',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontFamily: 'monospace',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(socialWebhookInfo.callbackUrl, 'URL de rappel')}
                            style={{
                              padding: '0.55rem 0.85rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            📋 Copier
                          </button>
                        </div>
                      </div>

                      {/* Verify Token */}
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                          Jeton de Vérification (Verify Token)
                        </label>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <input
                            type="text"
                            readOnly
                            value={socialWebhookInfo.verifyToken}
                            style={{
                              flex: 1,
                              padding: '0.55rem 0.75rem',
                              fontSize: '0.82rem',
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontFamily: 'monospace',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => copyToClipboard(socialWebhookInfo.verifyToken, 'Jeton de vérification')}
                            style={{
                              padding: '0.55rem 0.85rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            📋 Copier
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Événements Requis */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>
                        Événements / Champs auxquels s'abonner :
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        {socialWebhookInfo.requiredEvents.map((ev) => (
                          <span
                            key={ev}
                            style={{
                              background: '#e0e7ff',
                              color: '#3730a3',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontFamily: 'monospace',
                            }}
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
                        {socialWebhookInfo.instructions}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Registre des Consentements Client & Conformité RGPD / Meta */}
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.75rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>⚖️</span>
                  <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)', fontWeight: 800 }}>
                    Registre des Consentements & Règles de Conformité
                  </h4>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 1.25rem' }}>
                  Pour respecter les exigences strictes de Meta et de la législation sur la protection des données,
                  enregistrez ici l'acceptation (Opt-in) ou le désabonnement (Opt-out) d'un client.
                </p>

                <form onSubmit={handleRecordConsent} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ minWidth: '220px', flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                      Numéro WhatsApp ou Identifiant Client
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: +22670000000 ou 10928374"
                      required
                      value={consentRecipient}
                      onChange={(e) => setConsentRecipient(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        fontSize: '0.85rem',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                      }}
                    />
                  </div>

                  <div style={{ width: '180px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                      Statut de Consentement
                    </label>
                    <select
                      value={consentOptIn ? 'IN' : 'OUT'}
                      onChange={(e) => setConsentOptIn(e.target.value === 'IN')}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.8rem',
                        fontSize: '0.85rem',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        background: '#ffffff',
                      }}
                    >
                      <option value="IN">✅ Opt-in (Consentement accordé)</option>
                      <option value="OUT">⛔ Opt-out (Désabonnement)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={savingConsent}
                    style={{
                      padding: '0.62rem 1.25rem',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      background: '#0f172a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {savingConsent ? 'Enregistrement...' : 'Enregistrer le consentement'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ONGLET : PERFORMANCE & CACHE INTELLIGENT
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'performance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.75rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>⚡</span>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>
                      Gestion du Cache & Automatisation des Délais de Purge
                    </h3>
                  </div>
                  <span
                    style={{
                      background: cacheSizeMb > 25 ? '#fee2e2' : '#ecfdf5',
                      color: cacheSizeMb > 25 ? '#991b1b' : '#065f46',
                      padding: '0.3rem 0.75rem',
                      borderRadius: '999px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    Volume actuel : {cacheSizeMb.toFixed(2)} Mo
                  </span>
                </div>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
                  Configurez le comportement intelligent du gestionnaire afin de vider périodiquement les données temporaires,
                  les métriques accumulées et les états résiduels dès qu'une limite d'heures ou de volume en mégaoctets est atteinte.
                </p>

                {/* Instant Purge Banner */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '1.1rem 1.3rem',
                    marginBottom: '1.75rem',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                      Nettoyage Immédiat en 1 Clic
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Libère instantanément la mémoire et rafraîchit les performances sans interrompre vos sessions actives.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleManualPurge}
                    className="primary"
                    style={{
                      background: '#2563eb',
                      padding: '0.65rem 1.25rem',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      cursor: 'pointer',
                    }}
                  >
                    <span>🧹</span> Vider le cache maintenant (1 Clic)
                  </button>
                </div>

                {/* Settings Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  {/* Auto-purge Toggle */}
                  <div
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      background: cacheConfig.autoPurgeEnabled ? '#f0fdf4' : '#f8fafc',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                      <input
                        type="checkbox"
                        checked={cacheConfig.autoPurgeEnabled}
                        onChange={(e) => handleUpdateCacheConfig({ autoPurgeEnabled: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span>Activer le nettoyage automatique intelligent</span>
                    </label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.6rem 0 0', paddingLeft: '2rem' }}>
                      Le système vérifie régulièrement l'état de la mémoire et déclenche une purge douce dès qu'un critère est franchi.
                    </p>
                  </div>

                  {/* Purge Interval (Hours) */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      ⏱️ Délai de purge temporelle (Heures)
                    </label>
                    <select
                      value={cacheConfig.purgeIntervalHours}
                      onChange={(e) => handleUpdateCacheConfig({ purgeIntervalHours: Number(e.target.value) })}
                      disabled={!cacheConfig.autoPurgeEnabled}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.88rem' }}
                    >
                      <option value={2}>Toutes les 2 heures (Usage intensif caisse)</option>
                      <option value={6}>Toutes les 6 heures (Recommandé)</option>
                      <option value={12}>Toutes les 12 heures (Quotidien matin & soir)</option>
                      <option value={24}>Toutes les 24 heures (Chaque fin de journée)</option>
                      <option value={48}>Toutes les 48 heures</option>
                      <option value={168}>Toutes les semaines</option>
                    </select>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                      Dès que le délai est écoulé, les buffers résiduels sont purgés silencieusement.
                    </span>
                  </div>

                  {/* Volume Limit (MB) */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                      💾 Seuil volumétrique limite (Mégaoctets / Mo)
                    </label>
                    <select
                      value={cacheConfig.maxCacheSizeMb}
                      onChange={(e) => handleUpdateCacheConfig({ maxCacheSizeMb: Number(e.target.value) })}
                      disabled={!cacheConfig.autoPurgeEnabled}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.88rem' }}
                    >
                      <option value={5}>5 Mo (Machines légères et tablettes)</option>
                      <option value={10}>10 Mo (Standard boutique)</option>
                      <option value={25}>25 Mo (Recommandé commerce actif)</option>
                      <option value={50}>50 Mo (Gros catalogues & images)</option>
                      <option value={100}>100 Mo (Aucune restriction)</option>
                    </select>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                      Si l'espace mémoire franchit ce seuil, une alerte d'optimisation ou purge automatique s'active.
                    </span>
                  </div>

                  {/* Clean Drafts Toggle */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '1.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                      <input
                        type="checkbox"
                        checked={cacheConfig.cleanTempDrafts}
                        onChange={(e) => handleUpdateCacheConfig({ cleanTempDrafts: e.target.checked })}
                        disabled={!cacheConfig.autoPurgeEnabled}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span>Nettoyer les formulaires temporaires abandonnés</span>
                    </label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.6rem 0 0', paddingLeft: '2rem' }}>
                      Évite que les vieux brouillons d'interventions ou de ventes non finalisées ne polluent l'affichage.
                    </p>
                  </div>
                </div>

                {/* Safety Guarantee */}
                <div
                  style={{
                    marginTop: '1.75rem',
                    padding: '1rem',
                    background: '#f1f5f9',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                  <span>
                    <strong>Garantie d'intégrité :</strong> La purge du cache ne supprime JAMAIS vos ventes, vos stocks,
                    vos clients ni votre clé de session. Seuls les calculs intermédiaires et requêtes mémorisées sont rafraîchis.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              ONGLET 5 : SAUVEGARDES & DONNÉES
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'backup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.75rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>🛡️</span>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>
                    Sauvegarde Complète & Portabilité des Données (RGPD)
                  </h3>
                </div>
                <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
                  Conformément aux normes internationales de souveraineté des données et de portabilité, vous pouvez à tout
                  moment télécharger une archive structurée contenant l'ensemble de votre base : catalogue produits, dépôts,
                  stocks, clients, fournisseurs et historique.
                </p>

                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', marginBottom: '0.5rem' }}>
                    Contenu de l'archive de sauvegarde :
                  </div>
                  <ul style={{ fontSize: '0.82rem', color: '#475569', margin: 0, paddingLeft: '1.25rem', lineHeight: 1.6 }}>
                    <li><strong>Identité & Dépôts :</strong> Profil entreprise, magasins et emplacements rattachés.</li>
                    <li><strong>Catalogue commercial :</strong> Produits, variantes, codes-barres, prix et unités.</li>
                    <li><strong>Répertoire des tiers :</strong> Fiches clients, limites de crédit et fiches fournisseurs.</li>
                    <li><strong>Inventaires :</strong> Niveaux de stock actuels et valorisation comptable.</li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={handleExportData}
                  disabled={exporting}
                  className="primary"
                  style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: 700 }}
                >
                  {exporting ? 'Génération de la sauvegarde en cours...' : '📥 Télécharger l’archive JSON complète'}
                </button>
              </div>

              {/* 🚨 Zone de Réinitialisation à 3 Niveaux */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.75rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>🔄</span>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
                    Options de Réinitialisation (3 Niveaux Indépendants)
                  </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 1.5rem' }}>
                  Choisissez avec précision le niveau de réinitialisation souhaité pour votre espace de gestion. Chaque option est isolée pour protéger vos données.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* NIVEAU 1 : PARAMÈTRES PAR DÉFAUT */}
                  <div
                    style={{
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ maxWidth: '600px' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#1e40af', marginBottom: '0.25rem' }}>
                        1. Réinitialiser uniquement les paramètres par défaut
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#3b82f6', lineHeight: 1.45 }}>
                        Rétablit les réglages système d'origine (modèle de facture Standard Pro, ticket 80 mm, délais de devis 30j, pays Burkina Faso 🇧🇫). Vos produits, stocks, ventes et fiches clients restent <strong>totalement intacts</strong>.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetSettingsOnly}
                      style={{
                        background: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.65rem 1.25rem',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ⚙️ Rétablir Paramètres d'Usine
                    </button>
                  </div>

                  {/* NIVEAU 2 : PRODUITS ET CATALOGUE */}
                  <div
                    style={{
                      border: '1px solid #fed7aa',
                      background: '#fff7ed',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ maxWidth: '600px' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#c2410c', marginBottom: '0.25rem' }}>
                        2. Réinitialiser uniquement le catalogue & les produits
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#ea580c', lineHeight: 1.45 }}>
                        Purger les articles du catalogue, les variantes et les compteurs de stock locaux pour reconstruire un catalogue produit neuf sans altérer vos paramètres d'entreprise ni votre identité.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetProductsOnly}
                      style={{
                        background: '#d97706',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.65rem 1.25rem',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      📦 Réinitialiser Produits
                    </button>
                  </div>

                  {/* NIVEAU 3 : RÉINITIALISATION COMPLÈTE DU GESTIONNAIRE */}
                  <div
                    style={{
                      border: '2px solid #f87171',
                      background: '#fef2f2',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ maxWidth: '600px' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#991b1b', marginBottom: '0.25rem' }}>
                        3. Réinitialisation complète des données du gestionnaire (Remise à zéro opérationnelle)
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#b91c1c', lineHeight: 1.45 }}>
                        Supprime uniquement <strong>les données opérationnelles créées par le gestionnaire</strong> (ventes, paiements, créances clients, mouvements de stock, dépenses et commandes). 
                        <br />
                        <span style={{ fontWeight: 700, color: '#15803d' }}>
                          🛡️ Préservation intégrale : Le système, les installations de base, les fichiers logiciels et vos comptes de connexion ne sont JAMAIS supprimés ni affectés.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setResetTenantPassword('');
                        setResetTenantPhrase('');
                        setShowResetTenantModal(true);
                      }}
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.7rem 1.35rem',
                        fontSize: '0.86rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 4px 10px rgba(220, 38, 38, 0.25)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      🚨 Remise à Zéro Données
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* MODAL DE RÉINITIALISATION SÉCURISÉE DU GESTIONNAIRE */}
      {showResetTenantModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => !resettingTenant && setShowResetTenantModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '2px solid #ef4444',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#991b1b', fontWeight: 800 }}>
                  Confirmation de Réinitialisation Métier
                </h3>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Remise à zéro des données créées par le gestionnaire</span>
              </div>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem 0.9rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.82rem', color: '#166534', lineHeight: 1.45 }}>
                <strong>Garantie Système & Installation :</strong> Cette opération supprime uniquement les données d'activité créées dans votre boutique (ventes, fiches clients, écritures comptables, créances). Le système VTM, les installations logicielles et les comptes utilisateurs restent intacts et fonctionnels.
              </div>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              Pour valider la remise à zéro des données de votre gestionnaire, veuillez saisir votre
              <strong> mot de passe actuel</strong> et taper la phrase de confirmation ci-dessous :
            </p>

            <form onSubmit={handleResetTenant}>
              {/* Phrase de confirmation */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                  Tapez exactement : <span style={{ color: '#dc2626', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>REINITIALISER MON GESTIONNAIRE</span> *
                </label>
                <input
                  type="text"
                  value={resetTenantPhrase}
                  onChange={(e) => setResetTenantPhrase(e.target.value)}
                  placeholder="REINITIALISER MON GESTIONNAIRE"
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', fontWeight: 600, border: '1px solid #cbd5e1', borderRadius: '8px' }}
                />
              </div>

              {/* Mot de passe */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                  Votre mot de passe de connexion *
                </label>
                <input
                  type="password"
                  value={resetTenantPassword}
                  onChange={(e) => setResetTenantPassword(e.target.value)}
                  placeholder="Entrez votre mot de passe..."
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  disabled={resettingTenant}
                  onClick={() => setShowResetTenantModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.65rem 1.25rem', fontSize: '0.88rem' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={resettingTenant || !resetTenantPassword || resetTenantPhrase.trim() !== 'REINITIALISER MON GESTIONNAIRE'}
                  style={{
                    background: resettingTenant || resetTenantPhrase.trim() !== 'REINITIALISER MON GESTIONNAIRE' || !resetTenantPassword ? '#94a3b8' : '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.65rem 1.4rem',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    cursor: resettingTenant || resetTenantPhrase.trim() !== 'REINITIALISER MON GESTIONNAIRE' || !resetTenantPassword ? 'not-allowed' : 'pointer',
                  }}
                >
                  {resettingTenant ? 'Réinitialisation en cours...' : '🚨 Confirmer la Réinitialisation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
