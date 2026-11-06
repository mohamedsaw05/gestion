import { useEffect, useRef } from 'react';

export function ChristmasBackgroundWorkshop() {
  const countRef1 = useRef<HTMLElement>(null);
  const countRef2 = useRef<HTMLElement>(null);
  const totalGifts = useRef(340);

  // Le système travaille tout seul en arrière-plan sans aucun lag de re-rendu React
  useEffect(() => {
    const interval = setInterval(() => {
      totalGifts.current += Math.floor(Math.random() * 4 + 2);
      if (countRef1.current) countRef1.current.textContent = String(totalGifts.current);
      if (countRef2.current) countRef2.current.textContent = `${totalGifts.current} paquets`;
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="christmas-bg-workshop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        overflow: 'hidden',
        userSelect: 'none',
        fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
      }}
      aria-hidden="true"
    >
      {/* Ciel nocturne d'hiver boréal */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 50%, #030712 100%)',
          opacity: 0.92,
        }}
      />

      {/* Aurore boréale féerique animée */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '45vh',
          background: 'radial-gradient(ellipse at 50% 10%, rgba(16, 185, 129, 0.18) 0%, rgba(59, 130, 246, 0.12) 40%, transparent 75%)',
          filter: 'blur(35px)',
          animation: 'auroraGlow 8s infinite alternate ease-in-out',
        }}
      />

      {/* Silhouette des montagnes enneigées et sapins au loin */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '240px',
          background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.4) 60%, transparent 100%)',
        }}
      />

      {/* ══════════════════════════════════════════════════════════════
          BANDEAU SUPÉRIEUR AMBIANT : L'ATELIER EN DIRECT
         ══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute',
          top: '18px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(251, 191, 36, 0.4)',
          backdropFilter: 'blur(12px)',
          borderRadius: '30px',
          padding: '8px 24px',
          color: '#ffffff',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 15px rgba(245, 158, 11, 0.2)',
          zIndex: 2,
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span style={{ fontSize: '1.25rem', animation: 'bellRing 1.5s infinite alternate' }}>🎅</span>
          <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#fef08a', letterSpacing: '0.5px' }}>
            Atelier Secret de Noël VTM
          </span>
          <span
            style={{
              fontSize: '0.68rem',
              background: '#dc2626',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 800,
              boxShadow: '0 0 10px rgba(220, 38, 38, 0.8)',
            }}
          >
            ● EN DIRECT
          </span>
        </div>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.25)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0' }}>
          <span>🎁</span>
          <strong ref={countRef1} style={{ color: '#fbbf24', fontSize: '0.95rem' }}>340</strong>
          <span>cadeaux chargés sans arrêt pour votre boutique !</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SCÈNE ANIMÉE EN BAS DE L'ÉCRAN : LES AMIS DU PÈRE NOËL AU TRAVAIL
         ══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute',
          bottom: '22px',
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          padding: '0 3rem',
          zIndex: 2,
        }}
      >
        {/* Chalet de l'atelier du Père Noël à gauche */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
          <div style={{ position: 'relative', textAlign: 'center' }}>
            {/* Fumée de cheminée animée */}
            <div
              style={{
                position: 'absolute',
                top: '-25px',
                right: '15px',
                fontSize: '1.2rem',
                opacity: 0.7,
                animation: 'chimneySmoke 2.5s infinite linear',
              }}
            >
              💨
            </div>
            <div style={{ fontSize: '3.8rem', filter: 'drop-shadow(0 4px 15px rgba(251, 191, 36, 0.4))' }}>
              🏠🎄
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8' }}>
              Fabrique des Cadeaux
            </div>
          </div>

          {/* Lutin chef qui charge vers le traîneau */}
          <div style={{ textAlign: 'center', animation: 'elfWorkLeft 2.2s infinite ease-in-out' }}>
            <div style={{ fontSize: '2.8rem' }}>
              🧝‍♂️
            </div>
            <div style={{ fontSize: '0.68rem', background: 'rgba(220, 38, 38, 0.8)', color: '#fff', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>
              Lutin Barnabé
            </div>
          </div>
        </div>

        {/* Le Grand Chariot / Traîneau au centre qui se remplit tout seul */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(127, 29, 29, 0.85) 0%, rgba(153, 27, 27, 0.9) 100%)',
            border: '2px solid #fbbf24',
            borderRadius: '20px',
            padding: '0.85rem 1.8rem',
            boxShadow: '0 8px 30px rgba(245, 158, 11, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ fontSize: '2.8rem', animation: 'sleighRock 1.8s infinite alternate ease-in-out' }}>
            🛷
          </div>

          <div>
            <div style={{ fontSize: '1.6rem', animation: 'giftPileHop 0.4s infinite alternate' }}>
              🎁 📦 🎀 🧸 🚂
            </div>
            <div style={{ fontSize: '0.84rem', fontWeight: 900, color: '#fef08a', marginTop: '0.15rem' }}>
              Chariot en cours de remplissage : <span ref={countRef2} style={{ color: '#ffffff' }}>340 paquets</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#fecaca', fontWeight: 600 }}>
              « Prêt pour l'envol dès votre connexion ! »
            </div>
          </div>
        </div>

        {/* Lutine fée et renne à droite */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
          <div style={{ textAlign: 'center', animation: 'elfWorkRight 2s infinite ease-in-out' }}>
            <div style={{ fontSize: '2.8rem' }}>
              🧝‍♀️
            </div>
            <div style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.8)', color: '#fff', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>
              Lutine Étoile
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3.4rem', animation: 'reindeerCheer 1.2s infinite alternate ease-in-out' }}>
              🦌✨
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8' }}>
              Éclair & Rodolphe
            </div>
          </div>
        </div>
      </div>

      {/* Styles des animations de l'arrière-plan */}
      <style>{`
        @keyframes auroraGlow {
          0% { transform: translateY(0) scale(1); opacity: 0.6; }
          50% { transform: translateY(-10px) scale(1.08); opacity: 0.9; }
          100% { transform: translateY(5px) scale(1); opacity: 0.6; }
        }
        @keyframes elfWorkLeft {
          0% { transform: translateX(0) scaleX(1); }
          45% { transform: translateX(40px) scaleX(1); }
          50% { transform: translateX(40px) scaleX(-1); }
          95% { transform: translateX(0) scaleX(-1); }
          100% { transform: translateX(0) scaleX(1); }
        }
        @keyframes elfWorkRight {
          0% { transform: translateX(0) scaleX(-1); }
          45% { transform: translateX(-40px) scaleX(-1); }
          50% { transform: translateX(-40px) scaleX(1); }
          95% { transform: translateX(0) scaleX(1); }
          100% { transform: translateX(0) scaleX(-1); }
        }
        @keyframes sleighRock {
          from { transform: rotate(-1.5deg); }
          to { transform: rotate(1.5deg); }
        }
        @keyframes giftPileHop {
          from { transform: translateY(0); }
          to { transform: translateY(-3px) scale(1.04); }
        }
        @keyframes chimneySmoke {
          0% { transform: translate(0, 0) scale(0.8); opacity: 0.8; }
          50% { transform: translate(8px, -18px) scale(1.2); opacity: 0.5; }
          100% { transform: translate(16px, -36px) scale(1.6); opacity: 0; }
        }
        @keyframes reindeerCheer {
          from { transform: translateY(0); }
          to { transform: translateY(-6px); }
        }
        @keyframes bellRing {
          0% { transform: rotate(-8deg); }
          100% { transform: rotate(8deg); }
        }
      `}</style>
    </div>
  );
}
