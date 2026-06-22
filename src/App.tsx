import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Auth } from './components/Auth';
import { TrapPlatformerGame } from './components/TrapPlatformerGame';
import type { GameProgress } from './components/TrapPlatformerGame';
import { supabase } from './lib/supabase';

type PlayMode = 'menu' | 'guest' | 'user';
const guestProgressKey = 'toy-trap-run-progress';

function readGuestProgress(): GameProgress | null {
  try {
    const raw = localStorage.getItem(guestProgressKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GameProgress>;
    if (typeof parsed.levelIndex !== 'number' || typeof parsed.deaths !== 'number') return null;
    return { levelIndex: parsed.levelIndex, deaths: parsed.deaths };
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<PlayMode>('menu');
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const savedProgressRef = useRef('');

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        setMode('user');
        loadUserProgress(data.session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setMode('user');
        loadUserProgress(nextSession.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProgress(userId: string) {
    if (!supabase) return;
    const { data } = await supabase
      .from('game_progress')
      .select('level_index, deaths')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      const nextProgress = { levelIndex: data.level_index, deaths: data.deaths };
      setProgress(nextProgress);
      savedProgressRef.current = `${nextProgress.levelIndex}:${nextProgress.deaths}`;
    }
  }

  const saveProgress = useCallback(
    async (nextProgress: GameProgress) => {
      const progressKey = `${nextProgress.levelIndex}:${nextProgress.deaths}`;
      if (savedProgressRef.current === progressKey) return;
      savedProgressRef.current = progressKey;

      if (mode === 'guest') {
        localStorage.setItem(guestProgressKey, JSON.stringify(nextProgress));
        setProgress(nextProgress);
        return;
      }

      if (!session || !supabase) return;

      await supabase.from('game_progress').upsert({
        user_id: session.user.id,
        level_index: nextProgress.levelIndex,
        deaths: nextProgress.deaths,
        updated_at: new Date().toISOString(),
      });
      setProgress(nextProgress);
    },
    [mode, session],
  );

  function enterAsGuest() {
    const guestProgress = readGuestProgress();
    setProgress(guestProgress);
    savedProgressRef.current = guestProgress ? `${guestProgress.levelIndex}:${guestProgress.deaths}` : '';
    setMode('guest');
  }

  async function exitToMenu() {
    if (mode === 'user' && supabase) await supabase.auth.signOut();
    setSession(null);
    setProgress(null);
    savedProgressRef.current = '';
    setMode('menu');
  }

  if (mode === 'guest' || session) {
    return (
      <>
        <header className="game-topbar">
          <strong>{session ? `Игрок: ${session.user.email ?? 'аккаунт'}` : 'Гость'}</strong>
          <button className="small-pixel-button" onClick={exitToMenu} type="button">
            В меню
          </button>
        </header>
        <TrapPlatformerGame initialProgress={progress} onProgressChange={saveProgress} />
      </>
    );
  }

  return (
    <main className="main-menu">
      <section className="menu-hero">
        <p>Pixel boss platformer</p>
        <h1>Toy Trap Run</h1>
        <span>Сражайся с боссами, проходи уровни и играй один или вдвоём.</span>
      </section>
      <Auth onGuest={enterAsGuest} />
    </main>
  );
}
