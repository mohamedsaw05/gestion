import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/ToastContext';

type Profile = { id: string; name: string; type: string; brand?: string; model?: string; connectionMode: string; terminalId: string; paperFormat: string; locationId?: string | null; cashRegisterId?: string | null; config?: Record<string, unknown> };
type Location = { id: string; name: string };
type CashSession = { id: string; status: string; locationId: string };
const TERMINAL_KEY = 'vtm.peripheral-terminal-id';
const blank = (terminalId = ''): Profile => ({ id: '', name: '', type: 'THERMAL_PRINTER', brand: '', model: '', connectionMode: 'SYSTEM_BROWSER', terminalId, paperFormat: '80mm', locationId: '', cashRegisterId: '', config: {} });

export function SettingsPeripheralsPage() {
  const { addToast } = useToast();
  const [terminalId, setTerminalId] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [form, setForm] = useState<Profile>(blank());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async (terminal: string) => {
    const [deviceRows, locationRows, sessionRows] = await Promise.all([
      api.get<Profile[]>(`/peripherals?terminalId=${encodeURIComponent(terminal)}`),
      api.get<Location[]>('/locations'),
      api.get<CashSession[]>('/cash/sessions').catch(() => []),
    ]);
    setProfiles(deviceRows);
    setLocations(locationRows);
    setSessions(sessionRows.filter((session) => session.status === 'OPEN'));
  };

  useEffect(() => {
    let active = true;
    let terminal = '';
    try {
      terminal = localStorage.getItem(TERMINAL_KEY) || crypto.randomUUID();
      localStorage.setItem(TERMINAL_KEY, terminal);
    } catch { terminal = `session-${crypto.randomUUID()}`; }
    setTerminalId(terminal);
    setForm(blank(terminal));
    void refresh(terminal).catch((cause) => setError(cause instanceof ApiError ? cause.message : 'Impossible de charger les périphériques.')).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const payload = { ...form, terminalId, config: { ...(form.config ?? {}), browserPrint: form.connectionMode === 'SYSTEM_BROWSER' } };
      if (editingId) await api.put(`/peripherals/${editingId}`, payload);
      else await api.post('/peripherals', payload);
      await refresh(terminalId);
      setEditingId(null);
      setForm(blank(terminalId));
      addToast('Périphérique enregistré pour ce terminal.', 'success');
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Enregistrement impossible.'); }
  };

  const remove = async (id: string) => {
    try { await api.delete(`/peripherals/${id}`); await refresh(terminalId); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Suppression impossible.'); }
  };

  const testBrowserPrint = () => {
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) { setError('Autorisez les fenêtres contextuelles pour lancer l’aperçu d’impression.'); return; }
    popup.document.write('<!doctype html><html lang="fr"><meta charset="utf-8"><title>Test impression VTM</title><body style="font:16px sans-serif;padding:24px"><h1>Test logiciel VTM</h1><p>Ce document vérifie l’ouverture de l’impression par le navigateur.</p><p>Terminal : ' + terminalId + '</p><p>Le résultat physique dépend de l’imprimante et du pilote installés.</p><script>window.print()<\/script></body></html>');
    popup.document.close();
  };

  const setField = (key: keyof Profile, value: any) => setForm((current) => ({ ...current, [key]: value }));
  const currentLocationId = form.locationId || '';

  return <div>
    <PageHeader title="Périphériques et impression" subtitle="Profils persistants par terminal, boutique et session de caisse." />
    <div style={{ padding: 14, borderRadius: 9, background: '#fffbeb', border: '1px solid #fcd34d', marginBottom: 16 }}>
      <strong>Compatibilité navigateur :</strong> les lecteurs USB/Bluetooth configurés comme clavier peuvent saisir des codes dans un champ adapté. L’impression navigateur dépend du système et de son pilote. L’accès direct USB/Bluetooth/réseau et ESC/POS n’est pas garanti par cette interface; un agent local sécurisé sera nécessaire pour ces modes. Aucun modèle physique n’a été certifié ici.
    </div>
    {error && <div role="alert" style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</div>}
    {loading ? <p>Chargement…</p> : <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) minmax(300px,1.1fr)', gap: 18 }}>
      <form onSubmit={(event) => void save(event)} style={{ display: 'grid', gap: 10, padding: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <h2 style={{ margin: 0 }}>{editingId ? 'Modifier un profil' : 'Ajouter un périphérique'}</h2>
        <label>Nom du profil<input required maxLength={100} value={form.name} onChange={(event) => setField('name', event.target.value)} /></label>
        <label>Type<select value={form.type} onChange={(event) => setField('type', event.target.value)}><option value="THERMAL_PRINTER">Imprimante thermique</option><option value="OFFICE_PRINTER">Imprimante bureautique / multifonction</option><option value="BARCODE_SCANNER">Lecteur de codes</option></select></label>
        <label>Marque<input value={form.brand ?? ''} onChange={(event) => setField('brand', event.target.value)} /></label>
        <label>Modèle<input value={form.model ?? ''} onChange={(event) => setField('model', event.target.value)} /></label>
        <label>Mode de connexion<select value={form.connectionMode} onChange={(event) => setField('connectionMode', event.target.value)}>{['SYSTEM_BROWSER','USB','NETWORK','WIFI','BLUETOOTH','LOCAL_AGENT','CAMERA'].map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
        <label>Format papier<select value={form.paperFormat} onChange={(event) => setField('paperFormat', event.target.value)}>{['A4','A5','58mm','80mm','CUSTOM','NONE'].map((paper) => <option key={paper}>{paper}</option>)}</select></label>
        <label>Boutique<select value={form.locationId ?? ''} onChange={(event) => setField('locationId', event.target.value)}><option value="">Aucune association</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
        <label>Caisse / session ouverte<select value={form.cashRegisterId ?? ''} onChange={(event) => setField('cashRegisterId', event.target.value)}><option value="">Aucune association</option>{sessions.filter((session) => !currentLocationId || session.locationId === currentLocationId).map((session) => <option key={session.id} value={session.id}>{session.id}</option>)}</select></label>
        <label>Identifiant de ce terminal<input readOnly value={terminalId} /></label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn btn-primary" type="submit">Enregistrer le profil</button>{editingId && <button type="button" className="btn btn-outline-secondary" onClick={() => { setEditingId(null); setForm(blank(terminalId)); }}>Annuler</button>}</div>
        {form.type !== 'BARCODE_SCANNER' && <button type="button" className="btn btn-outline-secondary" onClick={testBrowserPrint}>Lancer le test d’impression navigateur</button>}
        <button type="button" className="btn btn-outline-secondary" onClick={() => addToast(window.isSecureContext ? 'Contexte HTTPS disponible. Cela ne confirme pas la connexion physique.' : 'Un contexte HTTPS est requis par certaines API matérielles du navigateur.', 'info')}>Vérifier le contexte de connexion</button>
      </form>
      <section style={{ display: 'grid', alignContent: 'start', gap: 10 }}><h2 style={{ margin: '0 0 4px' }}>Profils de ce terminal</h2>{profiles.map((profile) => <article key={profile.id} style={{ padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}><strong>{profile.name}</strong><div>{profile.type} · {profile.brand || 'Marque non renseignée'} {profile.model}</div><div>{profile.connectionMode} · {profile.paperFormat} · {profile.terminalId}</div><div>Boutique : {locations.find((location) => location.id === profile.locationId)?.name ?? 'non associée'} · Caisse/session : {profile.cashRegisterId || 'non associée'}</div><div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button className="btn btn-sm btn-outline-secondary" onClick={() => { setEditingId(profile.id); setForm({ ...profile, locationId: profile.locationId ?? '', cashRegisterId: profile.cashRegisterId ?? '', terminalId }); }}>Modifier</button><button className="btn btn-sm btn-outline-danger" onClick={() => void remove(profile.id)}>Supprimer</button></div></article>)}{profiles.length === 0 && <p>Aucun périphérique enregistré pour ce terminal.</p>}</section>
    </div>}
  </div>;
}
