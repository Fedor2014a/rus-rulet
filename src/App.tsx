import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Auth } from './components/Auth';
import { totalLevelCount, TrapPlatformerGame } from './components/TrapPlatformerGame';
import type { SavedGameProgress } from './components/TrapPlatformerGame';
import { supabase } from './lib/supabase';

type PlayMode = 'menu' | 'guest' | 'user';
const guestProgressKey = 'toy-trap-run-progress';
const menuLevelPageSize = 50;
type ProgressRow = {
  level_index: number;
  deaths: number;
  player_hp: { p1: number; p2: number } | null;
  arrows: { p1: number; p2: number } | null;
};

function readGuestProgress(): SavedGameProgress | null {
  try {
    const raw = localStorage.getItem(guestProgressKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedGameProgress>;
    if (typeof parsed.levelIndex !== 'number' || typeof parsed.deaths !== 'number') return null;
    return {
      levelIndex: parsed.levelIndex,
      deaths: parsed.deaths,
      playerHp: parsed.playerHp,
      arrows: parsed.arrows,
    };
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<PlayMode>('menu');
  const [progress, setProgress] = useState<SavedGameProgress | null>(null);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [menuLevelInput, setMenuLevelInput] = useState('1');
  const [menuLevelPage, setMenuLevelPage] = useState(0);
  const savedProgressRef = useRef('');

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        setMode('user');
        void loadUserProgress(data.session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setMode('user');
        void loadUserProgress(nextSession.user.id);
      } else {
        setProgressLoaded(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProgress(userId: string) {
    if (!supabase) return;
    setProgressLoaded(false);
    const { data } = await supabase
      .from('game_progress')
      .select('level_index, deaths, player_hp, arrows')
      .eq('user_id', userId)
      .maybeSingle();
    const row = data as ProgressRow | null;

    if (row) {
      const nextProgress: SavedGameProgress = {
        levelIndex: row.level_index,
        deaths: row.deaths,
        playerHp: row.player_hp ?? undefined,
        arrows: row.arrows ?? undefined,
      };
      setProgress(nextProgress);
      savedProgressRef.current = makeProgressKey(nextProgress);
    } else {
      setProgress(null);
      savedProgressRef.current = '';
    }
    setProgressLoaded(true);
  }

  function makeProgressKey(nextProgress: SavedGameProgress) {
    return [
      nextProgress.levelIndex,
      nextProgress.deaths,
      nextProgress.playerHp?.p1 ?? '',
      nextProgress.playerHp?.p2 ?? '',
      nextProgress.arrows?.p1 ?? '',
      nextProgress.arrows?.p2 ?? '',
    ].join(':');
  }

  const saveProgress = useCallback(
    async (nextProgress: SavedGameProgress) => {
      const progressKey = makeProgressKey(nextProgress);
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
        player_hp: nextProgress.playerHp,
        arrows: nextProgress.arrows,
        updated_at: new Date().toISOString(),
      });
      setProgress(nextProgress);
    },
    [mode, session],
  );

  async function enterAsGuest(startLevelIndex?: number) {
    if (typeof startLevelIndex === 'number') {
      const nextProgress: SavedGameProgress = {
        levelIndex: Math.max(0, Math.min(totalLevelCount - 1, startLevelIndex)),
        deaths: 0,
      };
      setSession(null);
      setProgress(nextProgress);
      setProgressLoaded(true);
      savedProgressRef.current = makeProgressKey(nextProgress);
      setMode('guest');
      return;
    }

    if (supabase) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!error && data.session) {
        setSession(data.session);
        setMode('user');
        await loadUserProgress(data.session.user.id);
        return;
      }
    }

    const guestProgress = readGuestProgress();
    setSession(null);
    setProgress(guestProgress);
    setProgressLoaded(true);
    savedProgressRef.current = guestProgress ? makeProgressKey(guestProgress) : '';
    setMode('guest');
  }

  async function exitToMenu() {
    if (mode === 'user' && supabase) await supabase.auth.signOut();
    setSession(null);
    setProgress(null);
    setProgressLoaded(false);
    savedProgressRef.current = '';
    setMode('menu');
  }

  if (mode === 'guest' || (mode === 'user' && session)) {
    if (!progressLoaded) {
      return (
        <main className="main-menu">
          <section className="menu-hero">
            <p>Pixel boss platformer</p>
            <h1>Загрузка сохранения...</h1>
            <span>Достаём прогресс из Supabase.</span>
          </section>
        </main>
      );
    }

    const isGuest = mode === 'guest' || Boolean(session?.user.is_anonymous);

    return (
      <>
        <header className="game-topbar">
          <strong>{isGuest ? 'Гость' : `Игрок: ${session?.user.email ?? 'аккаунт'}`}</strong>
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
      <LevelMenu
        levelInput={menuLevelInput}
        levelPage={menuLevelPage}
        onChangeInput={setMenuLevelInput}
        onChangePage={setMenuLevelPage}
        onStart={(levelIndex) => void enterAsGuest(levelIndex)}
      />
    </main>
  );
}

type LevelMenuProps = {
  levelInput: string;
  levelPage: number;
  onChangeInput: (value: string) => void;
  onChangePage: (value: number) => void;
  onStart: (levelIndex: number) => void;
};

function LevelMenu({ levelInput, levelPage, onChangeInput, onChangePage, onStart }: LevelMenuProps) {
  const pageCount = Math.ceil(totalLevelCount / menuLevelPageSize);
  const pageStart = levelPage * menuLevelPageSize;
  const visibleLevels = Array.from(
    { length: Math.min(menuLevelPageSize, totalLevelCount - pageStart) },
    (_, index) => pageStart + index,
  );

  function clampLevelIndex(levelIndex: number) {
    return Math.max(0, Math.min(totalLevelCount - 1, levelIndex));
  }

  function startFromInput() {
    const levelNumber = Number.parseInt(levelInput, 10);
    const levelIndex = Number.isNaN(levelNumber) ? 0 : clampLevelIndex(levelNumber - 1);
    onChangeInput(String(levelIndex + 1));
    onChangePage(Math.floor(levelIndex / menuLevelPageSize));
    onStart(levelIndex);
  }

  return (
    <section className="menu-levels">
      <div className="menu-levels-head">
        <article>
          <p>Level browser</p>
          <h2>Посмотреть любой уровень</h2>
        </article>
        <div className="menu-level-controls">
          <input
            min="1"
            max={totalLevelCount}
            onChange={(event) => onChangeInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') startFromInput();
            }}
            type="number"
            value={levelInput}
          />
          <button onClick={startFromInput} type="button">Смотреть</button>
        </div>
      </div>

      <div className="menu-level-pager">
        <button
          className="secondary-action"
          disabled={levelPage === 0}
          onClick={() => onChangePage(Math.max(0, levelPage - 1))}
          type="button"
        >
          -50
        </button>
        <strong>
          {pageStart + 1}-{Math.min(pageStart + menuLevelPageSize, totalLevelCount)}
        </strong>
        <button
          className="secondary-action"
          disabled={levelPage >= pageCount - 1}
          onClick={() => onChangePage(Math.min(pageCount - 1, levelPage + 1))}
          type="button"
        >
          +50
        </button>
      </div>

      <div className="menu-level-grid">
        {visibleLevels.map((levelIndex) => (
          <button
            key={levelIndex}
            onClick={() => {
              onChangeInput(String(levelIndex + 1));
              onStart(levelIndex);
            }}
            type="button"
          >
            {levelIndex + 1}
          </button>
        ))}
      </div>
    </section>
  );
}
