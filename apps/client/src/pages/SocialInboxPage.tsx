import { useEffect, useState, useMemo, useRef, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastContext';
import { Pagination } from '../components/Pagination';

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

interface SocialConversation {
  id: string;
  platform: 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'WHATSAPP';
  contactName: string;
  contactIdentifier: string;
  unreadCount: number;
  lastMessageAt: string;
  internalNotes?: string | null;
  customerId: string | null;
  account?: {
    accountName: string;
    platform: string;
  };
  customer?: {
    id: string;
    name: string;
    phone?: string;
  } | null;
}

interface SocialMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL_NOTE';
  content: string;
  deliveryStatus: string;
  externalMsgId?: string | null;
  attachments?: any;
  sentAt: string;
}

interface CustomerOption {
  id: string;
  name: string;
  phone?: string | null;
}

const PLATFORMS_INFO: Record<string, { label: string; icon: string; color: string }> = {
  WHATSAPP: { label: 'WhatsApp', icon: '📱', color: '#25d366' },
  FACEBOOK: { label: 'Facebook', icon: '💬', color: '#1877f2' },
  INSTAGRAM: { label: 'Instagram', icon: '📸', color: '#e1306c' },
  TIKTOK: { label: 'TikTok', icon: '🎵', color: '#0f172a' },
};

export function SocialInboxPage() {
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [conversations, setConversations] = useState<SocialConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [capabilityDisabled, setCapabilityDisabled] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Mobile navigation view: 'LIST' | 'CHAT'
  const [mobileActiveView, setMobileActiveView] = useState<'LIST' | 'CHAT'>('LIST');

  // Filters & Pagination
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Composer
  const [replyText, setReplyText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // CRM Linking
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkingCustomerId, setLinkingCustomerId] = useState('');
  const [linking, setLinking] = useState(false);

  // Simulation Modal State
  const [simulateModalPlatform, setSimulateModalPlatform] = useState<string | null>(null);
  const [simulateForm, setSimulateForm] = useState({
    type: 'DIRECT_MESSAGE' as 'DIRECT_MESSAGE' | 'COMMENT',
    contactName: 'Moussa Traoré',
    contactIdentifier: '+226 70 12 34 56',
    postTitle: 'Collection Rentrée Scolaire 2026',
    content: 'Bonjour, est-ce que ce modèle est actuellement disponible en magasin ? Merci d’avance !',
  });
  const [simulating, setSimulating] = useState(false);

  const loadAccounts = () => {
    api
      .get<any>('/social/accounts')
      .then((data) => {
        const list: SocialAccount[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setAccounts(list);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setCapabilityDisabled(true);
        }
      });
  };

  const loadConversations = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (platformFilter !== 'ALL') params.set('platform', platformFilter);
    if (unreadOnly) params.set('unreadOnly', 'true');
    if (search.trim()) params.set('search', search.trim());
    params.set('page', String(currentPage));

    api
      .get<any>(`/social/conversations?${params.toString()}`)
      .then((data) => {
        const list: SocialConversation[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setConversations(list);
        if (list.length > 0 && !selectedConversationId) {
          setSelectedConversationId(list[0].id);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) {
          setCapabilityDisabled(true);
        }
        setConversations([]);
      })
      .finally(() => setLoading(false));
  };

  const loadCustomers = () => {
    api
      .get<any>('/customers')
      .then((data) => {
        const list: CustomerOption[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setCustomers(list);
      })
      .catch(() => setCustomers([]));
  };

  useEffect(() => {
    loadAccounts();
    loadCustomers();
  }, []);

  useEffect(() => {
    loadConversations();
  }, [platformFilter, unreadOnly, search, currentPage]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    api
      .get<any>(`/social/conversations/${selectedConversationId}/messages`)
      .then((data) => {
        const list: SocialMessage[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.messages)
          ? data.messages
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setMessages(list);
      })
      .catch(() => setMessages([]))
      .finally(() => setMessagesLoading(false));
  }, [selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedConversation = useMemo(() => {
    const list = Array.isArray(conversations) ? conversations : [];
    return list.find((c) => c.id === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  const isSelectedConversationAComment = useMemo(() => {
    if (!selectedConversation) return false;
    const hasCommentMsg = messages.some(
      (m) => m.attachments?.messageType === 'COMMENT' || !!m.attachments?.commentId,
    );
    const hasCommentNote = selectedConversation.internalNotes?.includes('Commentaire public');
    return hasCommentMsg || !!hasCommentNote;
  }, [selectedConversation, messages]);

  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }, [conversations]);

  const connectedAccountsCount = useMemo(() => {
    return accounts.filter((a) => a.status === 'CONNECTED').length;
  }, [accounts]);

  const handleSimulateInbound = async (e: FormEvent) => {
    e.preventDefault();
    if (!simulateModalPlatform) return;
    setSimulating(true);

    try {
      const res = await api.post<{ conversation: SocialConversation; message: SocialMessage }>(
        `/social/accounts/${simulateModalPlatform}/simulate-inbound`,
        simulateForm,
      );

      addToast('Message / Commentaire de test injecté avec succès !', 'success');
      setSimulateModalPlatform(null);
      loadConversations();
      if (res.conversation?.id) {
        setSelectedConversationId(res.conversation.id);
        setMobileActiveView('CHAT');
      }
    } catch (err: any) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de la simulation', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const handleSend = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedConversationId || !replyText.trim()) return;
    setSending(true);

    try {
      if (isInternalNote) {
        const note = await api.post<SocialMessage>(`/social/conversations/${selectedConversationId}/notes`, {
          content: replyText.trim(),
        });
        setMessages((prev) => [...prev, note]);
        setReplyText('');
        addToast('Note interne enregistrée dans le fil.', 'success');
      } else {
        const sent = await api.post<SocialMessage>(`/social/conversations/${selectedConversationId}/messages`, {
          content: replyText.trim(),
        });
        setMessages((prev) => [...prev, sent]);
        setReplyText('');
        addToast(
          isSelectedConversationAComment
            ? 'Réponse officielle transmise en tant que commentaire public !'
            : 'Message direct transmis via l’API officielle.',
          'success',
        );
      }
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Échec d’envoi du message', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDownComposer = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLinkCustomer = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedConversationId || !linkingCustomerId) return;
    setLinking(true);
    try {
      await api.post(`/social/conversations/${selectedConversationId}/link-customer`, {
        customerId: linkingCustomerId,
      });
      addToast('Conversation rattachée au profil client CRM.', 'success');
      setShowLinkModal(false);
      loadConversations();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur d’association client', 'error');
    } finally {
      setLinking(false);
    }
  };

  const platformsList = ['WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK'] as const;

  return (
    <div className="social-inbox-page">
      <PageHeader
        title="Boîte de Réception Sociale & Canaux"
        subtitle="Messagerie omnicanale en direct : WhatsApp, Facebook Messenger, Instagram Direct & TikTok"
        badges={[
          { label: 'Messagerie Omnicanale', variant: 'info' },
          {
            label: `${connectedAccountsCount}/4 Canaux Connectés`,
            variant: connectedAccountsCount > 0 ? 'success' : 'default',
          },
          ...(totalUnreadCount > 0
            ? [{ label: `${totalUnreadCount} non lus`, variant: 'warning' as const }]
            : []),
        ]}
        primaryAction={{
          label: '⚙️ Configurer les canaux dans les Paramètres',
          variant: 'secondary',
          onClick: () => navigate('/settings/config?tab=social'),
        }}
      />

      {/* Alerte si la capability n'est pas activée */}
      {capabilityDisabled && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 'var(--radius)',
            padding: '0.85rem 1.25rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <strong style={{ color: '#92400e' }}>Module Réseaux Sociaux désactivé</strong>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#78350f' }}>
              Cette fonctionnalité n'est pas activée sur le profil de commerce de cette organisation. Vous pouvez l'activer dans les paramètres.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/settings/business-profile')}
            className="primary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
          >
            Activer dans le Profil
          </button>
        </div>
      )}

      {/* Guide si aucun canal n'est configuré */}
      {connectedAccountsCount === 0 && !loading && (
        <div
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)',
            border: '1px solid #bae6fd',
            borderRadius: 'var(--radius)',
            padding: '1rem 1.25rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
            <div>
              <strong style={{ color: '#0369a1', fontSize: '0.92rem' }}>
                Aucun canal social connecté pour l'instant
              </strong>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#0c4a6e' }}>
                Pour recevoir et répondre aux messages de vos clients, configurez vos clés WhatsApp, Facebook, Instagram ou TikTok dans l'espace Paramètres.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/settings/config?tab=social')}
            className="primary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700 }}
          >
            ⚙️ Ouvrir la Configuration dans les Paramètres
          </button>
        </div>
      )}

      {/* WORKSPACE OPÉRATIONNEL : ESPACE DE TRAVAIL & TRAITEMENT DES MESSAGES */}
      <div className="social-inbox-workspace-wrapper">
        {/* Barre d'État Rapide des Canaux & Bouton Simulateur */}
        <div className="social-channels-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto', flex: 1 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Canaux :
            </span>
            {platformsList.map((plat) => {
              const info = PLATFORMS_INFO[plat];
              const acc = accounts.find((a) => a.platform === plat);
              const isConn = acc?.status === 'CONNECTED';

              return (
                <button
                  key={plat}
                  type="button"
                  onClick={() => setPlatformFilter(platformFilter === plat ? 'ALL' : plat)}
                  className={`social-channel-chip ${isConn ? 'connected' : ''} ${platformFilter === plat ? 'active-filter' : ''}`}
                  style={{
                    border: platformFilter === plat ? `2px solid ${info.color}` : undefined,
                    cursor: 'pointer',
                  }}
                  title={
                    isConn
                      ? `${info.label} : Connecté (${acc?.accountName || 'Actif'}). Cliquer pour filtrer.`
                      : `${info.label} : Non configuré. Configurable dans les Paramètres.`
                  }
                >
                  <span>{info.icon}</span>
                  <span>{info.label}</span>
                  <span style={{ fontSize: '0.65rem', color: isConn ? '#16a34a' : '#94a3b8' }}>
                    {isConn ? '●' : '○'}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Outil opérationnel de test : injecter un message pour tester l'inbox */}
            <button
              type="button"
              onClick={() => {
                setSimulateModalPlatform(platformFilter !== 'ALL' ? platformFilter : 'WHATSAPP');
              }}
              className="btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '0.35rem 0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 600,
              }}
              title="Injecter un message entrant pour tester le flux de communication en direct"
            >
              <span>🧪</span> Simuler un message entrant
            </button>

            <button
              type="button"
              onClick={() => navigate('/settings/config?tab=social')}
              className="btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '0.35rem 0.65rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
              title="Ouvrir la page de configuration des clés d'accès et des webhooks"
            >
              <span>⚙️</span> Gérer les canaux
            </button>
          </div>
        </div>

        {/* Disposition Principale en 2 Colonnes Fluides (Liste des Fils & Zone de Chat) */}
        <div className="social-chat-layout">
          {/* COLONNE GAUCHE : LISTE DES CONVERSATIONS & RECHERCHE */}
          <div
            className={`social-conversations-column ${
              mobileActiveView === 'CHAT' ? 'mobile-hidden' : ''
            }`}
          >
            {/* Barre de Recherche et Filtres */}
            <div className="social-search-header">
              <input
                type="text"
                placeholder="Rechercher un client, téléphone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="social-search-input"
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={unreadOnly}
                    onChange={(e) => setUnreadOnly(e.target.checked)}
                  />
                  <span>Non lus uniquement</span>
                </label>
                {conversations.length > 0 && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {conversations.length} fil{conversations.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Onglets Filtres par Canal */}
            <div className="social-platform-tabs">
              <button
                type="button"
                onClick={() => setPlatformFilter('ALL')}
                className={`social-platform-tab-btn ${platformFilter === 'ALL' ? 'active' : ''}`}
              >
                Tous
              </button>
              {platformsList.map((p) => {
                const info = PLATFORMS_INFO[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatformFilter(p)}
                    className={`social-platform-tab-btn ${platformFilter === p ? 'active' : ''}`}
                  >
                    <span>{info.icon}</span> {info.label}
                  </button>
                );
              })}
            </div>

            {/* Liste Déroulante des Conversations */}
            <div className="social-conversations-list">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Chargement des messages...
                </div>
              ) : conversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1.25rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>📭</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>Aucune conversation</div>
                  <div style={{ fontSize: '0.76rem', marginTop: '0.2rem' }}>
                    {search || platformFilter !== 'ALL' || unreadOnly
                      ? 'Aucun fil ne correspond aux filtres appliqués.'
                      : 'Les messages de vos clients apparaîtront ici.'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSimulateModalPlatform('WHATSAPP')}
                    className="btn-secondary"
                    style={{ marginTop: '1rem', fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                  >
                    🧪 Injecter un message de test
                  </button>
                </div>
              ) : (
                conversations.map((c) => {
                  const isSelected = c.id === selectedConversationId;
                  const platInfo = PLATFORMS_INFO[c.platform] || PLATFORMS_INFO.WHATSAPP;
                  const isComment = c.internalNotes?.includes('Commentaire public');

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedConversationId(c.id);
                        setMobileActiveView('CHAT');
                      }}
                      className={`social-conversation-item ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="social-conv-avatar" style={{ background: `${platInfo.color}15`, color: platInfo.color }}>
                        {platInfo.icon}
                      </div>

                      <div className="social-conv-info">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="social-conv-name">{c.contactName}</span>
                          <span className="social-conv-time">
                            {new Date(c.lastMessageAt).toLocaleDateString([], {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.15rem' }}>
                          <span className="social-conv-preview">
                            {isComment ? '💬 [Commentaire public]' : c.contactIdentifier}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {c.customer && (
                              <span style={{ fontSize: '0.65rem', background: '#e0f2fe', color: '#0369a1', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>
                                CRM
                              </span>
                            )}
                            {c.unreadCount > 0 && (
                              <span className="social-unread-badge">{c.unreadCount}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination si applicable */}
            {conversations.length >= 20 && (
              <div style={{ padding: '0.5rem', borderTop: '1px solid var(--border)' }}>
                <Pagination
                  currentPage={currentPage}
                  totalItems={conversations.length}
                  pageSize={20}
                  onPageChange={setCurrentPage}
                  itemName="conversations"
                />
              </div>
            )}
          </div>

          {/* COLONNE DROITE : FENÊTRE DE DISCUSSION PRINCIPALE */}
          <div
            className={`social-messages-column ${
              mobileActiveView === 'LIST' ? 'mobile-hidden' : ''
            }`}
          >
            {selectedConversation ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Entête de la Conversation Active */}
                <div className="social-chat-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setMobileActiveView('LIST')}
                      className="btn-secondary mobile-only"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                    >
                      ←
                    </button>

                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: `${PLATFORMS_INFO[selectedConversation.platform]?.color || '#2563eb'}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.2rem',
                      }}
                    >
                      {PLATFORMS_INFO[selectedConversation.platform]?.icon || '💬'}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text)' }}>
                          {selectedConversation.contactName}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            background: `${PLATFORMS_INFO[selectedConversation.platform]?.color || '#2563eb'}20`,
                            color: PLATFORMS_INFO[selectedConversation.platform]?.color || '#2563eb',
                          }}
                        >
                          {PLATFORMS_INFO[selectedConversation.platform]?.label || selectedConversation.platform}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{selectedConversation.contactIdentifier}</span>
                        {selectedConversation.customer ? (
                          <span style={{ color: '#0284c7', fontWeight: 600 }}>
                            • Client CRM : {selectedConversation.customer.name}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowLinkModal(true)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: 'underline',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                            }}
                          >
                            • 🔗 Lier au fichier CRM
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Rapides Commerciales */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          selectedConversation.customerId
                            ? `/sales/new?customerId=${selectedConversation.customerId}`
                            : `/sales/new`,
                        )
                      }
                      className="primary"
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 700 }}
                      title="Créer une nouvelle vente ou devis pour ce client"
                    >
                      🛍️ Nouvelle Vente / Devis
                    </button>
                  </div>
                </div>

                {/* Fil des Messages Déroulant */}
                <div className="social-messages-feed">
                  {messagesLoading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      Chargement des messages du fil...
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      Aucun message dans ce fil pour le moment.
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isOut = m.direction === 'OUTBOUND';
                      const isNote = m.direction === 'INTERNAL_NOTE';

                      return (
                        <div
                          key={m.id}
                          className={`social-message-row ${
                            isNote ? 'internal-note' : isOut ? 'outbound' : 'inbound'
                          }`}
                        >
                          <div
                            className={`social-message-bubble ${
                              isNote ? 'bubble-note' : isOut ? 'bubble-outbound' : 'bubble-inbound'
                            }`}
                          >
                            {/* Entête de bulle pour note ou commentaire */}
                            {isNote && (
                              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#92400e', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <span>🔒</span> NOTE INTERNE D’ÉQUIPE (Confidentielle)
                              </div>
                            )}

                            {/* Contenu textuel */}
                            <div style={{ fontSize: '0.88rem', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                              {m.content}
                            </div>

                            {/* Horodatage & Statut */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '0.4rem',
                                fontSize: '0.7rem',
                                color: isNote ? '#92400e' : isOut ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)',
                                marginTop: '0.35rem',
                              }}
                            >
                              <span>{new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isOut && !isNote && <span>• {m.deliveryStatus}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Compositeur de Message Épinglé en Bas */}
                <form onSubmit={handleSend} className="social-composer-wrapper">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.5rem', fontSize: '0.82rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: !isInternalNote ? 700 : 500 }}>
                      <input
                        type="radio"
                        name="replyMode"
                        checked={!isInternalNote}
                        onChange={() => setIsInternalNote(false)}
                      />
                      <span>
                        {isSelectedConversationAComment
                          ? '📢 Répondre publiquement au commentaire'
                          : '📤 Réponse officielle au client'}
                      </span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: isInternalNote ? 700 : 500, color: '#b45309' }}>
                      <input
                        type="radio"
                        name="replyMode"
                        checked={isInternalNote}
                        onChange={() => setIsInternalNote(true)}
                      />
                      <span>🔒 Note interne d’équipe</span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={handleKeyDownComposer}
                      placeholder={
                        isInternalNote
                          ? 'Rédigez une note interne confidentielle (Entrée pour valider)...'
                          : isSelectedConversationAComment
                          ? 'Rédigez votre réponse officielle sous le commentaire public (Entrée pour envoyer)...'
                          : 'Rédigez votre message officiel au client (Entrée pour envoyer, Maj+Entrée pour saut de ligne)...'
                      }
                      rows={2}
                      className="social-composer-textarea"
                      style={{
                        flex: 1,
                        fontSize: '0.9rem',
                        padding: '0.75rem 1rem',
                        borderColor: isInternalNote ? '#f59e0b' : undefined,
                        resize: 'vertical',
                        minHeight: '75px',
                      }}
                      required
                    />

                    <button
                      type="submit"
                      disabled={sending || !replyText.trim()}
                      className="primary"
                      style={{
                        padding: '0 1.5rem',
                        fontWeight: 700,
                        fontSize: '0.92rem',
                        background: isInternalNote ? '#d97706' : undefined,
                      }}
                    >
                      {sending ? 'Envoi...' : isInternalNote ? 'Enregistrer' : 'Envoyer ✈️'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-muted)',
                  padding: '2rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
                <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text)' }}>Sélectionnez une conversation</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '360px', lineHeight: 1.5 }}>
                  Choisissez un fil dans la colonne de gauche pour afficher l'historique des échanges,
                  répondre au client ou ajouter une note d'équipe.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL : ASSOCIER AU FICHIER CLIENT CRM */}
      {showLinkModal && selectedConversation && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                🔗 Lier au Fichier Client CRM
              </h3>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="btn-secondary"
                style={{ padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleLinkCustomer}>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 1rem', lineHeight: 1.5 }}>
                Associez ce contact <strong>{selectedConversation.contactName}</strong> ({selectedConversation.contactIdentifier}) à un client existant dans votre base de données CRM pour consolider l'historique d'achats et le suivi des créances.
              </p>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Sélectionner un Client CRM
                </label>
                <select
                  value={linkingCustomerId}
                  onChange={(e) => setLinkingCustomerId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    background: '#ffffff',
                  }}
                >
                  <option value="">-- Choisir un client dans la liste --</option>
                  {customers.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.name} {cust.phone ? `(${cust.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={linking || !linkingCustomerId}
                  className="primary"
                  style={{ fontWeight: 700 }}
                >
                  {linking ? 'Association...' : 'Valider le rattachement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL : SIMULATEUR OPÉRATIONNEL DE MESSAGES ENTRANTS */}
      {simulateModalPlatform && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '520px', width: '92%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🧪</span> Simuler un message entrant ({PLATFORMS_INFO[simulateModalPlatform]?.label || simulateModalPlatform})
              </h3>
              <button
                type="button"
                onClick={() => setSimulateModalPlatform(null)}
                className="btn-secondary"
                style={{ padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimulateInbound}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem', lineHeight: 1.5 }}>
                Cet outil de test simule l'arrivée instantanée d'un message client ou d'un commentaire public depuis l'API officielle, sans devoir envoyer un vrai message depuis un smartphone.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Canal Social de Test
                  </label>
                  <select
                    value={simulateModalPlatform}
                    onChange={(e) => setSimulateModalPlatform(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      fontSize: '0.85rem',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                    }}
                  >
                    {platformsList.map((p) => (
                      <option key={p} value={p}>
                        {PLATFORMS_INFO[p].icon} {PLATFORMS_INFO[p].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Nom de l'expéditeur (Client)
                  </label>
                  <input
                    type="text"
                    required
                    value={simulateForm.contactName}
                    onChange={(e) => setSimulateForm((prev) => ({ ...prev, contactName: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      fontSize: '0.85rem',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Numéro ou Identifiant Client
                  </label>
                  <input
                    type="text"
                    required
                    value={simulateForm.contactIdentifier}
                    onChange={(e) => setSimulateForm((prev) => ({ ...prev, contactIdentifier: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      fontSize: '0.85rem',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Contenu du message client
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={simulateForm.content}
                    onChange={(e) => setSimulateForm((prev) => ({ ...prev, content: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      fontSize: '0.85rem',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSimulateModalPlatform(null)}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  className="primary"
                  style={{ fontWeight: 700 }}
                >
                  {simulating ? 'Injection...' : '🚀 Injecter le message dans l’inbox'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
