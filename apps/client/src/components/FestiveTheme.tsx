import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

/**
 * Système d'événements festifs VTM.
 * Règle stricte : Ce système s'active UNIQUEMENT depuis la console Admin Centrale (SuperAdmin / Propriétaire).
 * Aucun contrôle de configuration, ni bouton encombrant n'est affiché côté gestionnaire.
 * Si désactivé côté Admin, absolument RIEN ne s'affiche ni ne s'exécute côté client.
 */
export function FestiveTheme() {
  const [activeEvent, setActiveEvent] = useState<'NONE' | 'CHRISTMAS' | 'NEW_YEAR'>('NONE');
  const [eventMessage, setEventMessage] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Vérification de l'état activé depuis la console SuperAdmin
  useEffect(() => {
    let isMounted = true;
    api.get<Record<string, unknown>>('/settings')
      .then((settings) => {
        if (!isMounted) return;
        const festiveMode = settings['festive.mode'] as string | undefined;
        const isMasterActive = settings['festive.active'] !== false && settings['festive.active'] !== 'false';

        if (isMasterActive && festiveMode === 'CHRISTMAS') {
          setActiveEvent('CHRISTMAS');
          setEventMessage(
            (settings['festive.message'] as string) ||
              'Nous vous souhaitons de très joyeuses fêtes de Noël dans la joie et la sérénité !'
          );
        } else if (isMasterActive && festiveMode === 'NEW_YEAR') {
          setActiveEvent('NEW_YEAR');
          setEventMessage(
            (settings['festive.message'] as string) ||
              'Excellente et prospère nouvelle année, pleine de succès et de vitalité commerciale !'
          );
        } else {
          setActiveEvent('NONE');
        }
      })
      .catch(() => {
        if (isMounted) setActiveEvent('NONE');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Animation passive féerique en arrière-plan (Chute de flocons doux pour Noël ou étincelles pour Nouvel An)
  useEffect(() => {
    if (activeEvent === 'NONE') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles: Array<{ x: number; y: number; r: number; d: number; s: number; color?: string }> = [];
    const particleCount = activeEvent === 'CHRISTMAS' ? 38 : 28;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 3 + 1,
        d: Math.random() * particleCount,
        s: Math.random() * 0.8 + 0.3,
        color: activeEvent === 'CHRISTMAS' ? '#ffffff' : ['#f59e0b', '#38bdf8', '#ec4899', '#10b981'][i % 4],
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2, false);
        ctx.fillStyle = activeEvent === 'CHRISTMAS' ? 'rgba(255, 255, 255, 0.45)' : (p.color || '#f59e0b');
        ctx.fill();

        p.y += p.s;
        p.x += Math.sin(p.d) * 0.5;

        if (p.y > height) {
          p.y = -10;
          p.x = Math.random() * width;
        }
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [activeEvent]);

  if (activeEvent === 'NONE') return null;

  return (
    <>
      {/* Canevas passif d'ambiance en arrière-plan sans blocage de clics */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 9998,
          opacity: 0.65,
        }}
      />

      {/* Bandeau discret d'événement activé par le propriétaire */}
      <div
        style={{
          background:
            activeEvent === 'CHRISTMAS'
              ? 'linear-gradient(90deg, #991b1b 0%, #1e3a8a 50%, #166534 100%)'
              : 'linear-gradient(90deg, #1e1b4b 0%, #311042 50%, #064e3b 100%)',
          color: '#ffffff',
          padding: '0.35rem 1rem',
          textAlign: 'center',
          fontSize: '0.84rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          zIndex: 9999,
          position: 'relative',
        }}
      >
        <span>{activeEvent === 'CHRISTMAS' ? '🎄' : '✨'}</span>
        <span>{eventMessage}</span>
        <span>{activeEvent === 'CHRISTMAS' ? '❄️' : '🥂'}</span>
      </div>
    </>
  );
}
