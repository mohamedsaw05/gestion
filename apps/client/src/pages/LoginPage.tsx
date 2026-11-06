import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Core1Verification } from '../lib/fiveCoreAuth';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lockedEmail, setLockedEmail] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [showPassword, setShowPassword] = useState(false);

  const { login, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const normalizedEmail = email.trim().toLowerCase();
  const isCurrentAccountLocked = Boolean(lockedEmail && lockedEmail === normalizedEmail && lockedUntil && lockedUntil > clock);

  useEffect(() => {
    if (!loading && profile) navigate('/', { replace: true });
  }, [loading, profile, navigate]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  useEffect(() => {
    if (lockedUntil && clock >= lockedUntil) {
      setLockedEmail(null);
      setLockedUntil(null);
      setError(null);
    }
  }, [clock, lockedUntil]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isCurrentAccountLocked) return;
    setError(null);

    const verification = Core1Verification.verifyInput(email, password);
    if (!verification.valid) {
      setError(verification.errorMessage || 'Vérifiez votre adresse e-mail et votre mot de passe.');
      return;
    }

    setSubmitting(true);
    setActiveStage('Connexion sécurisée en cours…');
    try {
      const requestedPath = (location.state as { from?: { pathname: string } })?.from?.pathname;
      const { targetUrl } = await login(verification.sanitizedEmail, password, undefined, requestedPath);
      setActiveStage('Ouverture de votre espace…');
      navigate(targetUrl, { replace: true });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'La connexion n’a pas abouti.';
      const normalizedMessage = rawMsg.toLocaleLowerCase('fr-FR');
      if (normalizedMessage.includes('verrouill')) {
        const seconds = Number(rawMsg.match(/(\d+)\s*seconde/i)?.[1] ?? 300);
        setLockedEmail(verification.sanitizedEmail);
        setLockedUntil(Date.now() + seconds * 1000);
        setError(rawMsg);
      } else if (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError') || rawMsg.includes('Load failed')) {
        setError('Connexion Internet indisponible. Le gestionnaire fonctionne en ligne : vos données restent intactes, mais connectez-vous au réseau pour continuer.');
      } else if (rawMsg.includes('401') || normalizedMessage.includes('identifiants') || normalizedMessage.includes('mot de passe')) {
        setError('Adresse e-mail ou mot de passe incorrect. Vérifiez votre saisie puis réessayez.');
      } else if (rawMsg.includes('500') || normalizedMessage.includes('internal')) {
        setError('Le service de connexion est momentanément indisponible. Réessayez dans quelques instants.');
      } else {
        setError(rawMsg);
      }
    } finally {
      setSubmitting(false);
      setActiveStage(null);
    }
  };

  return (
    <div className="login-experience">
      <section className="login-showcase" aria-label="Gestion commerciale">
        <div className="login-showcase-top">
          <div className="login-brand-mark" aria-hidden="true"><span>V</span><i /></div>
          <span className="login-brand-name">Gestionnaire <strong>Commercial</strong></span>
        </div>
        <div className="login-showcase-copy">
          <span className="login-kicker"><span className="login-kicker-dot" /> Un espace, toute votre activité</span>
          <h1>Votre commerce, plus simple à piloter.</h1>
          <p>Retrouvez vos ventes, vos stocks et vos opérations dans un espace sécurisé, où que vous travailliez.</p>
          <div className="login-feature-list">
            <div><span className="login-feature-icon">↗</span><span><b>Ventes et encaissements</b><small>Suivez l’activité au fil de la journée</small></span></div>
            <div><span className="login-feature-icon">▦</span><span><b>Stocks et produits</b><small>Gardez une vue claire sur vos articles</small></span></div>
            <div><span className="login-feature-icon">⌂</span><span><b>Accessible sur vos appareils</b><small>Une connexion Internet suffit</small></span></div>
          </div>
        </div>
        <div className="login-showcase-art" aria-hidden="true"><span /><i /><b /><em /></div>
        <div className="login-showcase-footer">Vos données sont liées à votre organisation.</div>
      </section>

      <main className="login-form-side">
        <form className="login-form-card" onSubmit={handleSubmit} noValidate>
          <div className="login-form-heading">
            <div className="login-mobile-brand"><span className="login-brand-mark small"><span>V</span><i /></span><span>Gestionnaire Commercial</span></div>
            <span className={`login-connection ${isOnline ? 'is-online' : 'is-offline'}`}>
              <i />{isOnline ? 'Connexion Internet active' : 'Hors connexion'}
            </span>
            <h2>Ravi de vous retrouver</h2>
            <p>Connectez-vous à votre espace de travail.</p>
          </div>

          {error && <div className={`login-message ${isCurrentAccountLocked ? 'is-lockout' : ''}`} role="alert">
            <span className="login-message-icon" aria-hidden="true">{isCurrentAccountLocked ? '!' : 'i'}</span>
            <span>{error}</span>
          </div>}

          <div className="login-field">
            <label htmlFor="login-email">Adresse e-mail</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => {
                const next = event.target.value;
                setEmail(next);
                setError(null);
                if (next.trim().toLowerCase() !== lockedEmail) { setLockedEmail(null); setLockedUntil(null); }
              }}
              placeholder="nom@entreprise.com"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              disabled={submitting}
            />
          </div>

          <div className="login-field">
            <div className="login-password-label"><label htmlFor="login-password">Mot de passe</label><span>Protégé et confidentiel</span></div>
            <div className="login-password-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Saisissez votre mot de passe"
                autoComplete="current-password"
                required
                disabled={submitting}
              />
              <button className="login-password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </div>

          {activeStage && <div className="login-progress" role="status"><span className="login-spinner" />{activeStage}</div>}

          <button className="login-submit" type="submit" disabled={submitting || isCurrentAccountLocked || !isOnline}>
            <span>{isCurrentAccountLocked ? 'Compte temporairement verrouillé' : submitting ? 'Connexion en cours…' : 'Se connecter'}</span>
            {!isCurrentAccountLocked && !submitting && <span aria-hidden="true">→</span>}
          </button>
          <p className="login-online-note">Une connexion Internet est nécessaire pour accéder aux données et enregistrer vos opérations.</p>
          <div className="login-form-footer"><span>Besoin d’aide ?</span><a href="mailto:support@vtm.cloud?subject=Assistance%20Connexion">Contacter l’assistance</a></div>
        </form>
        <footer className="login-legal">Accès réservé aux utilisateurs autorisés de l’organisation.</footer>
      </main>
    </div>
  );
}
