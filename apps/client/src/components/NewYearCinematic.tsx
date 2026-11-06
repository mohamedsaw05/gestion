import { useEffect, useRef, useState } from 'react';

interface NewYearCinematicProps {
  onComplete?: () => void;
  durationSeconds?: number;
}

export function NewYearCinematic({ onComplete, durationSeconds = 14 }: NewYearCinematicProps) {
  const [fadingOut, setFadingOut] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Transition fluide et fermeture automatique après la durée féerique
  useEffect(() => {
    // Déclenche le fondu doux 1 seconde avant la fin
    const fadeTimer = setTimeout(() => {
      setFadingOut(true);
    }, Math.max(1000, (durationSeconds - 1.2) * 1000));

    const endTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, durationSeconds * 1000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [durationSeconds, onComplete]);

  // Feux d'artifice doux, étoiles scintillantes et pluie de confettis dorés féeriques
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

    const sparks: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      alpha: number;
      color: string;
      size: number;
      gravity: number;
    }> = [];

    const confetti: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      angle: number;
      spin: number;
      color: string;
      size: number;
    }> = [];

    const warmColors = ['#fde047', '#fbbf24', '#f59e0b', '#fb7185', '#38bdf8', '#34d399', '#ffffff'];

    for (let i = 0; i < 70; i++) {
      confetti.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: Math.random() * 1.2 + 0.8,
        angle: Math.random() * 360,
        spin: (Math.random() - 0.5) * 0.05,
        color: warmColors[Math.floor(Math.random() * warmColors.length)],
        size: Math.random() * 7 + 4,
      });
    }

    let lastSparkBurst = 0;
    const addSoftBurst = (x: number, y: number) => {
      const color = warmColors[Math.floor(Math.random() * warmColors.length)];
      for (let i = 0; i < 35; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3.5 + 1.2;
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color,
          size: Math.random() * 2.5 + 1.5,
          gravity: 0.04,
        });
      }
    };

    const render = (now: number) => {
      ctx.clearRect(0, 0, width, height);

      // Ciel nocturne chaleureux et profond
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#060814');
      bgGrad.addColorStop(0.5, '#0c1228');
      bgGrad.addColorStop(1, '#1a102f');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Déclenchement d'étoiles scintillantes
      if (now - lastSparkBurst > 900) {
        addSoftBurst(Math.random() * width * 0.8 + width * 0.1, Math.random() * height * 0.45 + 50);
        lastSparkBurst = now;
      }

      // Dessin des étincelles douces
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += s.gravity;
        s.alpha -= 0.012;

        if (s.alpha <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.alpha;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      }

      // Pluie douce de confettis
      for (const c of confetti) {
        c.y += c.vy;
        c.x += c.vx;
        c.angle += c.spin;

        if (c.y > height) {
          c.y = -10;
          c.x = Math.random() * width;
        }

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);
        ctx.fillStyle = c.color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        color: '#ffffff',
        fontFamily: "'Outfit', 'Inter', system-ui, -apple-system, sans-serif",
        opacity: fadingOut ? 0 : 1,
        transition: 'opacity 1.2s ease-in-out',
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

      {/* Style d'animation pour les chiffres 2 0 2 7 vivants et joyeux */}
      <style>{`
        @keyframes digit2First {
          0% { transform: translateY(-40px) scale(0.7) rotateY(180deg); opacity: 0; }
          40% { transform: translateY(0) scale(1.1) rotateY(0deg); opacity: 1; }
          70% { transform: rotateY(360deg) scale(1); }
          85% { transform: translateY(-10px) rotate(-6deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes digit0 {
          0% { transform: scale(0) rotate(180deg); opacity: 0; }
          45% { transform: scale(1.2) rotate(0deg); opacity: 1; filter: drop-shadow(0 0 25px #f59e0b); }
          75% { transform: rotateY(360deg) scale(1.05); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes digit2Second {
          0% { transform: translateY(40px) scale(0.6); opacity: 0; }
          40% { transform: translateY(0) scale(1.1) rotate(10deg); opacity: 1; }
          65% { transform: translateY(-12px) rotate(-8deg); }
          85% { transform: rotateY(360deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes digit7 {
          0% { transform: translateX(60px) scale(0.7) rotate(25deg); opacity: 0; }
          45% { transform: translateX(0) scale(1.25) rotate(-5deg); opacity: 1; }
          70% { transform: rotateY(360deg) scale(1.05); }
          88% { transform: scale(1.1) rotate(4deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes auraShine {
          0%, 100% { filter: drop-shadow(0 0 15px rgba(251, 191, 36, 0.6)) drop-shadow(0 0 35px rgba(245, 158, 11, 0.3)); }
          50% { filter: drop-shadow(0 0 30px rgba(251, 191, 36, 0.9)) drop-shadow(0 0 60px rgba(245, 158, 11, 0.5)); }
        }
        @keyframes softCardFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

      {/* Carte Centrale Festive & Bienveillante */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: '740px',
          width: '92%',
          background: 'rgba(15, 23, 42, 0.72)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(251, 191, 36, 0.35)',
          borderRadius: '24px',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 50px rgba(245, 158, 11, 0.25)',
          animation: 'softCardFloat 6s ease-in-out infinite',
        }}
      >
        {/* Étoile de tête */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '999px', padding: '5px 16px', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '1.1rem' }}>✨</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fef08a', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Vœux Chaleureux & Prospérité Commerciale
          </span>
          <span style={{ fontSize: '1.1rem' }}>✨</span>
        </div>

        {/* 🎆 LES CHIFFRES DE 2027 QUI S'AMUSENT, TOURNENT ET SE CRÉENT EN MAGIE 🎆 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            margin: '0.5rem 0 1.25rem',
            perspective: '1000px',
            animation: 'auraShine 3s ease-in-out infinite',
          }}
        >
          {/* Chiffre 2 (1er) */}
          <div
            style={{
              fontSize: 'clamp(4.2rem, 9vw, 6.5rem)',
              fontWeight: 900,
              lineHeight: 1,
              background: 'linear-gradient(135deg, #ffffff 0%, #fef08a 40%, #fbbf24 75%, #d97706 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'digit2First 2.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards, auraShine 3s ease-in-out infinite 0.2s',
              display: 'inline-block',
              transformStyle: 'preserve-3d',
            }}
          >
            2
          </div>

          {/* Chiffre 0 */}
          <div
            style={{
              fontSize: 'clamp(4.2rem, 9vw, 6.5rem)',
              fontWeight: 900,
              lineHeight: 1,
              background: 'linear-gradient(135deg, #ffffff 0%, #fef08a 40%, #f59e0b 75%, #b45309 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'digit0 2.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards 0.25s, auraShine 3s ease-in-out infinite 0.5s',
              display: 'inline-block',
              transformStyle: 'preserve-3d',
            }}
          >
            0
          </div>

          {/* Chiffre 2 (2e) */}
          <div
            style={{
              fontSize: 'clamp(4.2rem, 9vw, 6.5rem)',
              fontWeight: 900,
              lineHeight: 1,
              background: 'linear-gradient(135deg, #ffffff 0%, #fef08a 40%, #fbbf24 75%, #d97706 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'digit2Second 2.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards 0.5s, auraShine 3s ease-in-out infinite 0.7s',
              display: 'inline-block',
              transformStyle: 'preserve-3d',
            }}
          >
            2
          </div>

          {/* Chiffre 7 */}
          <div
            style={{
              fontSize: 'clamp(4.2rem, 9vw, 6.5rem)',
              fontWeight: 900,
              lineHeight: 1,
              background: 'linear-gradient(135deg, #ffffff 0%, #fef08a 40%, #f59e0b 75%, #ea580c 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'digit7 2.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards 0.75s, auraShine 3s ease-in-out infinite 1s',
              display: 'inline-block',
              transformStyle: 'preserve-3d',
            }}
          >
            7
          </div>
        </div>

        {/* Message de célébration chaleureux */}
        <h2
          style={{
            fontSize: 'clamp(1.25rem, 3vw, 1.8rem)',
            fontWeight: 800,
            margin: '0 0 1rem',
            color: '#ffffff',
            letterSpacing: '-0.02em',
          }}
        >
          Que 2027 Vous Apporte Santé, Abondance & Réussite !
        </h2>

        {/* Texte des souhaits valorisant l'équipe et le commerce */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '1.25rem 1.75rem',
            margin: '0 auto 1.5rem',
            fontSize: '0.96rem',
            lineHeight: 1.7,
            color: '#e2e8f0',
          }}
        >
          <p style={{ margin: '0 0 0.75rem' }}>
            Chers gérants, commerçants et équipes, merci pour votre dévouement et votre travail exceptionnel tout au long de l'année.
          </p>
          <p style={{ margin: 0, color: '#fef08a', fontWeight: 600 }}>
            Nous vous souhaitons une clientèle toujours plus fidèle, des caisses rayonnantes et un plein accomplissement dans chacun de vos projets commerciaux.
          </p>
        </div>

        {/* Vœux de clôture chaleureux */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', color: '#fbbf24', fontSize: '1rem', fontWeight: 700 }}>
          <span>🥂</span>
          <span>Bonne et Merveilleuse Année 2027 à Vous et Vos Familles !</span>
          <span>🎉</span>
        </div>
      </div>
    </div>
  );
}
