import { useEffect, useRef, useState } from 'react';

interface ChristmasCinematicProps {
  onComplete?: () => void;
  autoCloseTimeoutMs?: number;
}

export function ChristmasCinematic({ onComplete, autoCloseTimeoutMs = 8000 }: ChristmasCinematicProps) {
  // Séquence exacte demandée par l'utilisateur :
  // 1. LOADING_GIFTS : Les amis du Père Noël (lutins avec bonnets) chargent les cadeaux sans arrêt dans le chariot
  // 2. SANTA_DEPARTURE : Le chargement est fini, le Père Noël sort, monte dans son chariot
  // 3. SLEIGH_CIRCLE : Le chariot avec son animal (les rennes) court, saute, s'envole et fait un grand cercle dans le ciel
  // 4. WRITE_JOYEUX_NOEL : Traçage céleste étincelant avec écriture magnifique "Joyeux Noël" & déblocage des fonctionnalités
  const [phase, setPhase] = useState<'LOADING_GIFTS' | 'SANTA_DEPARTURE' | 'SLEIGH_CIRCLE' | 'WRITE_JOYEUX_NOEL'>('LOADING_GIFTS');
  const [giftCount, setGiftCount] = useState(38);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // 1. Les lutins chargent les cadeaux à toute vitesse pendant 2.4s
    const giftInterval = setInterval(() => {
      setGiftCount((prev) => prev + Math.floor(Math.random() * 12 + 8));
    }, 120);

    // 2. À 2.4s : Le chargement est fini, le Père Noël sort et monte dans son chariot
    const t1 = setTimeout(() => {
      clearInterval(giftInterval);
      setPhase('SANTA_DEPARTURE');
    }, 2400);

    // 3. À 4.2s : Les rennes courent, sautent et font le grand cercle céleste
    const t2 = setTimeout(() => {
      setPhase('SLEIGH_CIRCLE');
    }, 4200);

    // 4. À 6.2s : Le cercle est tracé, écriture céleste féerique de "Joyeux Noël"
    const t3 = setTimeout(() => {
      setPhase('WRITE_JOYEUX_NOEL');
    }, 6200);

    // Redirection automatique à la fin de l'animation obligatoire
    const t4 = setTimeout(() => {
      if (onComplete) onComplete();
    }, autoCloseTimeoutMs);

    return () => {
      clearInterval(giftInterval);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete, autoCloseTimeoutMs]);

  // Canvas d'effets célestes : ciel étoilé, poussière d'or, cercle lumineux et traînée magique
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Étoiles de fond
    const stars = Array.from({ length: 90 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.2 + 0.8,
      alpha: Math.random() * 0.8 + 0.2,
      speed: Math.random() * 0.04 + 0.01,
    }));

    // Particules de poussière magique dorée
    const sparkles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      color: string;
    }> = [];

    let circleAngle = -Math.PI / 2;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Ciel de nuit d'hiver féerique
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#030712');
      bgGrad.addColorStop(0.4, '#0f172a');
      bgGrad.addColorStop(0.8, '#1e1b4b');
      bgGrad.addColorStop(1, '#311042');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Étoiles scintillantes
      for (const s of stars) {
        s.alpha += s.speed;
        if (s.alpha > 1 || s.alpha < 0.2) s.speed = -s.speed;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, s.alpha)})`;
        ctx.fill();
      }

      // Traînée du cercle céleste tracé par le traîneau volant
      if (phase === 'SLEIGH_CIRCLE' || phase === 'WRITE_JOYEUX_NOEL') {
        const centerX = width * 0.5;
        const centerY = height * 0.38;
        const radiusX = Math.min(width * 0.36, 340);
        const radiusY = Math.min(height * 0.22, 150);

        if (phase === 'SLEIGH_CIRCLE') {
          circleAngle += 0.065;
        }

        const sleighX = centerX + Math.cos(circleAngle) * radiusX;
        const sleighY = centerY + Math.sin(circleAngle) * radiusY;

        // Trace du cercle lumineux
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 12]);
        ctx.stroke();
        ctx.restore();

        // Émission d'étincelles dorées
        for (let i = 0; i < 8; i++) {
          sparkles.push({
            x: sleighX + (Math.random() * 24 - 12),
            y: sleighY + (Math.random() * 24 - 12),
            vx: (Math.random() - 0.5) * 2 - Math.sin(circleAngle) * 2.5,
            vy: (Math.random() - 0.5) * 2 + Math.cos(circleAngle) * 2.5,
            size: Math.random() * 3.5 + 1.5,
            alpha: 1,
            color: Math.random() > 0.3 ? '#fef08a' : '#f59e0b',
          });
        }
      }

      // Rendu de la poussière d'or
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const sp = sparkles[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.alpha -= 0.016;
        if (sp.alpha <= 0) {
          sparkles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fillStyle = sp.color;
        ctx.globalAlpha = sp.alpha;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [phase]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        color: '#ffffff',
        fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
        }}
      />



      {/* ══════════════════════════════════════════════════════════════
          ÉTAPE 1 : LES LUTINS CHARGENT LES CADEAUX DANS LE CHARIOT
         ══════════════════════════════════════════════════════════════ */}
      {phase === 'LOADING_GIFTS' && (
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            maxWidth: '580px',
            padding: '2rem',
            animation: 'fadeIn 0.4s ease',
          }}
        >
          <div
            style={{
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              color: '#fef08a',
              fontWeight: 800,
              marginBottom: '0.6rem',
            }}
          >
            🎅 Atelier Magique de Noël VTM
          </div>

          <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 0.5rem', textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
            Les Amis du Père Noël Chargent les Cadeaux !
          </h2>

          <p style={{ fontSize: '0.92rem', color: '#cbd5e1', margin: '0 0 1.25rem' }}>
            Les lutins remplissent le chariot sans arrêt avec tous les cadeaux, privilèges et remises de la boutique...
          </p>

          {/* Animation des lutins et de la hotte / chariot */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1.25rem',
              margin: '1.5rem 0',
            }}
          >
            {/* Lutin 1 avec bonnet */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3.6rem', animation: 'elfLoadLeft 0.35s infinite alternate' }}>
                🧝‍♂️
              </div>
              <span style={{ fontSize: '0.74rem', background: '#dc2626', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>
                Lutin Chef
              </span>
            </div>

            {/* Chariot débordant de vrais cadeaux */}
            <div
              style={{
                position: 'relative',
                background: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
                border: '3px solid #fbbf24',
                borderRadius: '18px',
                padding: '1.25rem 2.2rem',
                boxShadow: '0 10px 35px rgba(245, 158, 11, 0.45)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: '2.8rem', animation: 'giftPile 0.25s infinite alternate' }}>
                🎁 📦 🎀 🧸 🚂
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fef08a', marginTop: '0.4rem' }}>
                {giftCount} Cadeaux chargés !
              </div>
              <div style={{ fontSize: '0.74rem', color: '#fecaca', fontWeight: 700 }}>
                Ça déborde de surprises !
              </div>
            </div>

            {/* Lutin 2 avec bonnet */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3.6rem', animation: 'elfLoadRight 0.38s infinite alternate' }}>
                🧝‍♀️
              </div>
              <span style={{ fontSize: '0.74rem', background: '#16a34a', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>
                Lutine Fée
              </span>
            </div>
          </div>

          {/* Barre de chargement étincelante */}
          <div
            style={{
              width: '100%',
              height: '12px',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              overflow: 'hidden',
              marginTop: '1rem',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #10b981, #f59e0b, #dc2626)',
                borderRadius: '12px',
                animation: 'loadingProgress 2.4s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ÉTAPE 2 : LE PÈRE NOËL SORT ET MONTE DANS SON CHARIOT
         ══════════════════════════════════════════════════════════════ */}
      {phase === 'SANTA_DEPARTURE' && (
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            maxWidth: '650px',
            padding: '2rem',
            animation: 'fadeIn 0.5s ease',
          }}
        >
          <div
            style={{
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              color: '#34d399',
              fontWeight: 800,
              marginBottom: '0.5rem',
            }}
          >
            ✓ CHARGEMENT TERMINÉ AVEC SUCCÈS !
          </div>

          <h2 style={{ fontSize: '2.2rem', fontWeight: 900, margin: '0 0 1rem', textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
            Le Père Noël sort et monte dans son Chariot !
          </h2>

          <div
            style={{
              fontSize: '5rem',
              margin: '1.5rem 0',
              animation: 'santaBoarding 1.8s ease-in-out',
            }}
          >
            🚪 🚶‍♂️🎅 ➜ 🛷🎁
          </div>

          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 800,
              color: '#fef08a',
              textShadow: '0 2px 8px rgba(0,0,0,0.7)',
            }}
          >
            « Ho ! Ho ! Ho ! Tout est prêt ! Attachez vos ceintures ! »
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ÉTAPE 3 : LES RENNES COURENT, SAUTENT ET FONT UN GRAND CERCLE
         ══════════════════════════════════════════════════════════════ */}
      {phase === 'SLEIGH_CIRCLE' && (
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            maxWidth: '700px',
            padding: '1rem',
            animation: 'fadeIn 0.4s ease',
          }}
        >
          <div
            style={{
              fontSize: '0.88rem',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              color: '#fbbf24',
              fontWeight: 800,
              marginBottom: '0.5rem',
            }}
          >
            ★ L'ENVOL MAGIQUE DANS LE CIEL ★
          </div>

          <h2 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 1rem' }}>
            Les Rennes Galopent, Sautent et Tracent un Cercle Céleste !
          </h2>

          {/* Animation du traîneau qui court, saute et tourne */}
          <div
            style={{
              fontSize: '5.2rem',
              animation: 'reindeerGallopAndJump 2s infinite ease-in-out',
              filter: 'drop-shadow(0 8px 25px rgba(245, 158, 11, 0.7))',
              display: 'inline-block',
              margin: '1rem 0',
            }}
          >
            🦌🦌 🛷🎅✨
          </div>

          <div style={{ fontSize: '1.15rem', color: '#e2e8f0', fontWeight: 700 }}>
            Les étincelles d'or s'illuminent dans le ciel...
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ÉTAPE 4 : ÉCRITURE MAGIQUE CÉLESTE DE « JOYEUX NOËL »
         ══════════════════════════════════════════════════════════════ */}
      {phase === 'WRITE_JOYEUX_NOEL' && (
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            textAlign: 'center',
            maxWidth: '820px',
            padding: '2rem',
            animation: 'fadeIn 0.6s ease',
          }}
        >
          {/* Traîneau en vol stationnaire au-dessus */}
          <div
            style={{
              fontSize: '4.2rem',
              animation: 'floatHover 3s infinite alternate ease-in-out',
              filter: 'drop-shadow(0 8px 25px rgba(245, 158, 11, 0.8))',
              marginBottom: '0.5rem',
            }}
          >
            🦌🦌 🛷🎅✨
          </div>

          <div
            style={{
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '5px',
              color: '#fbbf24',
              fontWeight: 900,
              marginBottom: '0.4rem',
              animation: 'glowPulse 1.5s infinite alternate',
            }}
          >
            ★ CÉLÉBRATION OFFICIELLE VTM ★
          </div>

          {/* Écriture calligraphique animée et étincelante */}
          <h1
            style={{
              fontSize: '4.2rem',
              fontWeight: 900,
              margin: '0.2rem 0',
              background: 'linear-gradient(135deg, #ffffff 0%, #fef08a 35%, #f59e0b 70%, #ffffff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '2px',
              textShadow: '0 0 50px rgba(245, 158, 11, 0.9), 0 0 90px rgba(220, 38, 38, 0.7)',
              animation: 'calligraphyPop 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
          >
            ✨ Joyeux Noël ! ✨
          </h1>

          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: '#f8fafc',
              marginTop: '0.5rem',
              textShadow: '0 2px 10px rgba(0,0,0,0.8)',
            }}
          >
            Nous vous souhaitons prospérité, ventes records et bonheur !
          </div>

          {/* Badge fonctionnalités débloquées */}
          <div
            style={{
              marginTop: '1.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.8rem',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '2px solid rgba(251, 191, 36, 0.6)',
              backdropFilter: 'blur(12px)',
              borderRadius: '35px',
              padding: '0.65rem 1.8rem',
              boxShadow: '0 6px 25px rgba(245, 158, 11, 0.35)',
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>🎁</span>
            <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#fef08a' }}>
              Fonctionnalités & Cadeaux Débloqués : Vœux IA, Reçus Féeriques & Roue de la Fortune !
            </span>
          </div>

          {/* Transition automatique vers le gestionnaire */}
          <div style={{ marginTop: '2rem' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                border: '1px solid rgba(251, 191, 36, 0.5)',
                borderRadius: '12px',
                padding: '0.75rem 1.8rem',
                fontSize: '0.95rem',
                fontWeight: 800,
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
              }}
            >
              <span>✨</span>
              <span>Finalisation de la célébration... Ouverture automatique de votre gestionnaire</span>
            </div>
          </div>
        </div>
      )}

      {/* Style des animations CSS */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes elfLoadLeft {
          from { transform: translateY(0) rotate(-6deg); }
          to { transform: translateY(-16px) rotate(6deg); }
        }
        @keyframes elfLoadRight {
          from { transform: translateY(0) rotate(6deg); }
          to { transform: translateY(-16px) rotate(-6deg); }
        }
        @keyframes giftPile {
          from { transform: scale(1); }
          to { transform: scale(1.1) rotate(2deg); }
        }
        @keyframes loadingProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes santaBoarding {
          0% { opacity: 0; transform: translateX(-40px); }
          50% { opacity: 1; transform: translateX(0); }
          100% { transform: scale(1.08); }
        }
        @keyframes reindeerGallopAndJump {
          0% { transform: translate(-40px, 15px) rotate(-8deg) scale(0.95); }
          25% { transform: translate(0px, -30px) rotate(6deg) scale(1.15); }
          50% { transform: translate(40px, 10px) rotate(-4deg) scale(1); }
          75% { transform: translate(0px, -20px) rotate(4deg) scale(1.1); }
          100% { transform: translate(-40px, 15px) rotate(-8deg) scale(0.95); }
        }
        @keyframes floatHover {
          from { transform: translateY(0); }
          to { transform: translateY(-12px); }
        }
        @keyframes calligraphyPop {
          0% { opacity: 0; transform: scale(0.65) translateY(40px); filter: blur(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); }
        }
        @keyframes glowPulse {
          from { opacity: 0.7; filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.6)); }
          to { opacity: 1; filter: drop-shadow(0 0 20px rgba(251, 191, 36, 1)); }
        }
      `}</style>
    </div>
  );
}

