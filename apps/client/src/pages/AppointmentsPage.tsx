import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastContext';
import { formatDate, type Appointment, type AppointmentStatus } from '@gestionnaire/shared';

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

interface Location {
  id: string;
  name: string;
}

export function AppointmentsPage() {
  const { addToast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'UPCOMING'>('ALL');

  // Modal Création / Édition
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formLocationId, setFormLocationId] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formServiceName, setFormServiceName] = useState('');
  const [formScheduledAt, setFormScheduledAt] = useState('');
  const [formDurationMinutes, setFormDurationMinutes] = useState(30);
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formCustomerEmail, setFormCustomerEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<AppointmentStatus>('CONFIRMED');

  const loadData = async () => {
    setLoading(true);
    try {
      const [aptsRes, custsRes, locsRes] = await Promise.all([
        api.get<Appointment[]>('/appointments'),
        api.get<Customer[]>('/customers').catch(() => []),
        api.get<Location[]>('/locations').catch(() => []),
      ]);
      setAppointments(aptsRes);
      setCustomers(custsRes);
      setLocations(locsRes);
      if (locsRes.length > 0 && !formLocationId) {
        setFormLocationId(locsRes[0].id);
      }
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur de chargement des rendez-vous', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setFormTitle('');
    setFormServiceName('');
    setFormCustomerId('');
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormCustomerEmail('');
    setFormNotes('');
    setFormStatus('CONFIRMED');
    setFormDurationMinutes(30);

    // Date par défaut : aujourd'hui dans 1 heure
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setFormScheduledAt(localIso);

    if (locations.length > 0) {
      setFormLocationId(locations[0].id);
    }
    setModalOpen(true);
  };

  const openEditModal = (apt: Appointment) => {
    setEditingId(apt.id);
    setFormLocationId(apt.locationId);
    setFormCustomerId(apt.customerId || '');
    setFormTitle(apt.title);
    setFormServiceName(apt.serviceName || '');
    setFormCustomerName(apt.customerName || '');
    setFormCustomerPhone(apt.customerPhone || '');
    setFormCustomerEmail(apt.customerEmail || '');
    setFormNotes(apt.notes || '');
    setFormStatus(apt.status);
    setFormDurationMinutes(apt.durationMinutes || 30);

    const d = new Date(apt.scheduledAt);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setFormScheduledAt(localIso);
    setModalOpen(true);
  };

  const handleSelectCustomer = (custId: string) => {
    setFormCustomerId(custId);
    const c = customers.find((cust) => cust.id === custId);
    if (c) {
      setFormCustomerName(c.name);
      setFormCustomerPhone(c.phone || '');
      setFormCustomerEmail(c.email || '');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      addToast('Veuillez renseigner un titre ou motif de rendez-vous', 'warning');
      return;
    }
    if (!formScheduledAt) {
      addToast('Veuillez spécifier la date et heure du rendez-vous', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        locationId: formLocationId,
        customerId: formCustomerId || undefined,
        title: formTitle.trim(),
        serviceName: formServiceName.trim() || undefined,
        scheduledAt: new Date(formScheduledAt).toISOString(),
        durationMinutes: Number(formDurationMinutes) || 30,
        customerName: formCustomerName.trim() || undefined,
        customerPhone: formCustomerPhone.trim() || undefined,
        customerEmail: formCustomerEmail.trim() || undefined,
        notes: formNotes.trim() || undefined,
        status: formStatus,
      };

      if (editingId) {
        await api.patch(`/appointments/${editingId}`, payload);
        addToast('Rendez-vous mis à jour avec succès.', 'success');
      } else {
        await api.post('/appointments', payload);
        addToast('Rendez-vous / réservation créé avec succès.', 'success');
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur lors de l’enregistrement', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatus = async (id: string, newStatus: AppointmentStatus) => {
    try {
      await api.patch(`/appointments/${id}`, { status: newStatus });
      addToast(`Statut mis à jour : ${newStatus}`, 'success');
      loadData();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur de mise à jour', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Voulez-vous vraiment annuler et supprimer ce rendez-vous ?')) return;
    try {
      await api.delete(`/appointments/${id}`);
      addToast('Rendez-vous supprimé.', 'success');
      loadData();
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : 'Erreur de suppression', 'error');
    }
  };

  // Filtrage
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const filteredAppointments = appointments.filter((apt) => {
    if (statusFilter !== 'ALL' && apt.status !== statusFilter) return false;

    const aptDate = new Date(apt.scheduledAt);
    if (timeFilter === 'TODAY') {
      if (aptDate < startOfToday || aptDate > endOfToday) return false;
    } else if (timeFilter === 'UPCOMING') {
      if (aptDate < now) return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = apt.title.toLowerCase().includes(q);
      const matchCustomer = (apt.customerName || '').toLowerCase().includes(q);
      const matchPhone = (apt.customerPhone || '').includes(q);
      const matchService = (apt.serviceName || '').toLowerCase().includes(q);
      if (!matchTitle && !matchCustomer && !matchPhone && !matchService) return false;
    }

    return true;
  });

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="badge badge-success" style={{ fontSize: '0.78rem' }}>✓ Confirmé</span>;
      case 'PENDING':
        return <span className="badge badge-warning" style={{ fontSize: '0.78rem' }}>⏳ En attente</span>;
      case 'COMPLETED':
        return <span className="badge" style={{ background: '#3b82f6', color: '#fff', fontSize: '0.78rem' }}>★ Terminé</span>;
      case 'CANCELLED':
        return <span className="badge badge-danger" style={{ fontSize: '0.78rem' }}>✕ Annulé</span>;
      case 'NO_SHOW':
        return <span className="badge" style={{ background: '#6b7280', color: '#fff', fontSize: '0.78rem' }}>Absence (No-Show)</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Réservations & Rendez-vous"
        subtitle="Planification de créneaux clients, prises de rendez-vous et gestion du carnet de visites"
        primaryAction={{
          label: '+ Nouveau Rendez-vous',
          onClick: openCreateModal,
        }}
      />

      {/* Cartes métriques rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Rendez-vous Aujourd’hui</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--primary)' }}>
            {appointments.filter((a) => {
              const d = new Date(a.scheduledAt);
              return d >= startOfToday && d <= endOfToday && a.status !== 'CANCELLED';
            }).length}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>À Venir (Confirmés)</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.2rem', color: '#10b981' }}>
            {appointments.filter((a) => new Date(a.scheduledAt) >= now && a.status === 'CONFIRMED').length}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>En Attente de Confirmation</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.2rem', color: '#f59e0b' }}>
            {appointments.filter((a) => a.status === 'PENDING').length}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Enregistrés</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.2rem', color: 'var(--text)' }}>
            {appointments.length}
          </div>
        </div>
      </div>

      {/* Barre de filtres et recherche */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="🔍 Rechercher client, téléphone, prestation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '280px', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
          />

          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
          >
            <option value="ALL">Toutes les dates</option>
            <option value="TODAY">Aujourd’hui</option>
            <option value="UPCOMING">À venir uniquement</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
          >
            <option value="ALL">Tous les statuts</option>
            <option value="CONFIRMED">Confirmés</option>
            <option value="PENDING">En attente</option>
            <option value="COMPLETED">Terminés</option>
            <option value="CANCELLED">Annulés</option>
            <option value="NO_SHOW">Absences</option>
          </select>
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {filteredAppointments.length} résultat{filteredAppointments.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Liste des Rendez-vous */}
      {loading ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Chargement des rendez-vous...</p>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📅</div>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Aucun rendez-vous trouvé</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 1rem' }}>
            Aucun créneau ne correspond à vos filtres actuels.
          </p>
          <button type="button" onClick={openCreateModal} className="primary" style={{ padding: '0.5rem 1rem' }}>
            + Prendre le premier rendez-vous
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
          {filteredAppointments.map((apt) => {
            const dateObj = new Date(apt.scheduledAt);
            const isToday = dateObj >= startOfToday && dateObj <= endOfToday;
            const isPast = dateObj < now && apt.status === 'CONFIRMED';

            return (
              <div
                key={apt.id}
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  borderLeft: isToday ? '4px solid var(--primary)' : isPast ? '4px solid #f59e0b' : '4px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{apt.title}</h4>
                    {apt.serviceName && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600, marginTop: '0.15rem' }}>
                        ⚙️ {apt.serviceName}
                      </div>
                    )}
                  </div>
                  {getStatusBadge(apt.status)}
                </div>

                {/* Date & Heure */}
                <div style={{ background: 'var(--bg)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', fontWeight: 600 }}>
                    <span>🗓️</span>
                    <span>{formatDate(apt.scheduledAt)}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    ⏱️ {apt.durationMinutes} min
                  </div>
                </div>

                {/* Client info */}
                <div style={{ fontSize: '0.86rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                    <span>👤</span>
                    <span>{apt.customerName || 'Client occasionnel'}</span>
                  </div>
                  {apt.customerPhone && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '1.4rem' }}>
                      📞 {apt.customerPhone}
                    </div>
                  )}
                  {apt.customerEmail && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '1.4rem' }}>
                      ✉️ {apt.customerEmail}
                    </div>
                  )}
                </div>

                {/* Notes */}
                {apt.notes && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.02)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                    « {apt.notes} »
                  </div>
                )}

                {/* Actions */}
                <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {apt.status !== 'COMPLETED' && apt.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={() => handleQuickStatus(apt.id, 'COMPLETED')}
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                      title="Marquer comme honoré et terminé"
                    >
                      ✓ Honoré
                    </button>
                  )}

                  {apt.status === 'PENDING' && (
                    <button
                      type="button"
                      onClick={() => handleQuickStatus(apt.id, 'CONFIRMED')}
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem', background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Confirmer
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openEditModal(apt)}
                    className="btn-secondary"
                    style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                  >
                    ✏️ Modifier
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(apt.id)}
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem', background: 'transparent', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}
                    title="Annuler le rendez-vous"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Création & Modification */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => !saving && setModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '580px', padding: '1.75rem' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                {editingId ? 'Modifier le Rendez-vous' : 'Nouveau Rendez-vous / Réservation'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Titre / Motif du Rendez-vous *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Réparation iPhone 13, Consultation, Retrait commande..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Date et Heure du créneau *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formScheduledAt}
                    onChange={(e) => setFormScheduledAt(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Durée estimée (minutes)
                  </label>
                  <select
                    value={formDurationMinutes}
                    onChange={(e) => setFormDurationMinutes(Number(e.target.value))}
                    style={{ width: '100%' }}
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 heure (60 min)</option>
                    <option value={90}>1 heure 30 (90 min)</option>
                    <option value={120}>2 heures (120 min)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Prestation / Service associé
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Changement batterie, Coupe..."
                    value={formServiceName}
                    onChange={(e) => setFormServiceName(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Boutique / Emplacement
                  </label>
                  <select
                    value={formLocationId}
                    onChange={(e) => setFormLocationId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sélection Client */}
              <div style={{ background: 'var(--bg)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Client (Fichier ou Saisie Libre)
                </label>
                <select
                  value={formCustomerId}
                  onChange={(e) => handleSelectCustomer(e.target.value)}
                  style={{ width: '100%', marginBottom: '0.5rem' }}
                >
                  <option value="">-- Client occasionnel (saisie libre) --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Nom du client"
                    value={formCustomerName}
                    onChange={(e) => setFormCustomerName(e.target.value)}
                  />
                  <input
                    type="tel"
                    placeholder="Téléphone client"
                    value={formCustomerPhone}
                    onChange={(e) => setFormCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Statut du créneau
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    style={{ width: '100%' }}
                  >
                    <option value="CONFIRMED">Confirmé</option>
                    <option value="PENDING">En attente</option>
                    <option value="COMPLETED">Honoré / Terminé</option>
                    <option value="CANCELLED">Annulé</option>
                    <option value="NO_SHOW">Absence</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Email client (optionnel)
                  </label>
                  <input
                    type="email"
                    placeholder="email@exemple.com"
                    value={formCustomerEmail}
                    onChange={(e) => setFormCustomerEmail(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Notes ou instructions particulières
                </label>
                <textarea
                  rows={2}
                  placeholder="ex: Le client apporte son chargeur..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="primary"
                  style={{ padding: '0.5rem 1.25rem', fontWeight: 700 }}
                >
                  {saving ? 'Enregistrement...' : editingId ? 'Enregistrer les modifications' : 'Confirmer le rendez-vous'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
