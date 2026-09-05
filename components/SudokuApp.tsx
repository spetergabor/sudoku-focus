"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateScore, DIFFICULTIES, Difficulty, generatePuzzle, updateStreak } from "../lib/sudoku";
import { emptyStats, SavedGame, Stats, storage } from "../lib/storage";
import ServiceWorker from "./ServiceWorker";

const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const Icon = ({ children }: { children: React.ReactNode }) => <span className="tool-icon" aria-hidden="true">{children}</span>;
type GameSettings = { mistakeLimit: boolean; checkMistakes: boolean; autoNotes: boolean; showTimer: boolean; leftHanded: boolean };
const defaultSettings: GameSettings = { mistakeLimit: true, checkMistakes: true, autoNotes: true, showTimer: true, leftHanded: false };

export default function SudokuApp() {
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [game, setGame] = useState<SavedGame | null>(null);
  const [stats, setStats] = useState<Stats>(emptyStats());
  const [selected, setSelected] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [modal, setModal] = useState<"new" | "stats" | "result" | "confirm" | "settings" | null>(null);
  const [lastScore, setLastScore] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [settings, setSettings] = useState<GameSettings>(defaultSettings);
  const [celebrating, setCelebrating] = useState(false);
  const [completedBox, setCompletedBox] = useState<number | null>(null);
  const [completedRow, setCompletedRow] = useState<number | null>(null);
  const [completedCol, setCompletedCol] = useState<number | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("sudoku.theme") as "light" | "dark" | null;
    const next = savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const frame = requestAnimationFrame(() => {
      setTheme(next); document.documentElement.dataset.theme = next;
      setStats(storage.loadStats()); setGame(storage.loadGame());
      try { setSettings({ ...defaultSettings, ...JSON.parse(localStorage.getItem("sudoku.settings") || "{}") }); } catch { setSettings(defaultSettings); }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { if (game) storage.saveGame(game); }, [game]);
  useEffect(() => {
    if (!game || screen !== "game" || game.status !== "playing") return;
    const id = setInterval(() => setGame(g => g ? { ...g, seconds: g.seconds + 1 } : g), 1000);
    return () => clearInterval(id);
  }, [game?.status, screen]);

  const startGame = (difficulty: Difficulty) => {
    const { puzzle, solution } = generatePuzzle(difficulty);
    const next: SavedGame = { puzzle, solution, cells: [...puzzle], notes: Array.from({ length: 81 }, () => []), difficulty, seconds: 0, mistakes: 0, hintsLeft: DIFFICULTIES[difficulty].hints, hintsUsed: 0, history: [], status: "playing" };
    const nextStats = { ...stats, played: stats.played + 1 }; setStats(nextStats); storage.saveStats(nextStats);
    setGame(next); setScreen("game"); setSelected(null); setModal(null);
  };

  const snapshot = (g: SavedGame) => [...g.history.slice(-39), { cells: [...g.cells], notes: g.notes.map(n => [...n]) }];
  const complete = (g: SavedGame) => {
    const score = calculateScore(g.difficulty, g.seconds, g.mistakes, g.hintsUsed);
    const streak = updateStreak(stats.lastDate, stats.currentStreak, stats.longestStreak);
    const old = stats.byDifficulty[g.difficulty];
    const next: Stats = { ...stats, totalScore: stats.totalScore + score, completed: stats.completed + 1, ...streak, byDifficulty: { ...stats.byDifficulty, [g.difficulty]: { completed: old.completed + 1, bestTime: old.bestTime === null ? g.seconds : Math.min(old.bestTime, g.seconds), totalTime: old.totalTime + g.seconds, bestScore: Math.max(old.bestScore, score) } } };
    setStats(next); storage.saveStats(next); storage.saveGame(null); setLastScore(score); setCelebrating(true); setGame({ ...g, status: "complete" });
    setTimeout(() => { setCelebrating(false); setModal("result"); }, 1050);
  };

  const input = useCallback((value: number) => {
    setGame(current => {
      if (!current || current.status !== "playing" || selected === null || current.puzzle[selected]) return current;
      const history = snapshot(current);
      if (notesMode) {
        if (current.cells[selected]) return current;
        const nextNotes = current.notes.map(n => [...n]);
        nextNotes[selected] = nextNotes[selected].includes(value) ? nextNotes[selected].filter(n => n !== value) : [...nextNotes[selected], value];
        return { ...current, notes: nextNotes, history };
      }
      if (settings.checkMistakes && value !== current.solution[selected]) {
        const mistakes = current.mistakes + 1;
        if (navigator.vibrate) navigator.vibrate(45);
        return { ...current, mistakes, status: settings.mistakeLimit && mistakes >= 3 ? "over" : current.status, history };
      }
      const cells = [...current.cells]; cells[selected] = value;
      const boxRow = Math.floor(Math.floor(selected / 9) / 3) * 3;
      const boxCol = Math.floor((selected % 9) / 3) * 3;
      const boxIndices = Array.from({ length: 9 }, (_, offset) => (boxRow + Math.floor(offset / 3)) * 9 + boxCol + offset % 3);
      const boxWasComplete = boxIndices.every(index => current.cells[index] === current.solution[index]);
      const boxIsComplete = boxIndices.every(index => cells[index] === current.solution[index]);
      if (!boxWasComplete && boxIsComplete) {
        const box = Math.floor(boxRow / 3) * 3 + Math.floor(boxCol / 3);
        queueMicrotask(() => setCompletedBox(box));
        setTimeout(() => setCompletedBox(null), 850);
      }
      const row = Math.floor(selected / 9), col = selected % 9;
      const rowIndices = Array.from({ length: 9 }, (_, offset) => row * 9 + offset);
      const colIndices = Array.from({ length: 9 }, (_, offset) => offset * 9 + col);
      if (!rowIndices.every(index => current.cells[index] === current.solution[index]) && rowIndices.every(index => cells[index] === current.solution[index])) {
        queueMicrotask(() => setCompletedRow(row)); setTimeout(() => setCompletedRow(null), 850);
      }
      if (!colIndices.every(index => current.cells[index] === current.solution[index]) && colIndices.every(index => cells[index] === current.solution[index])) {
        queueMicrotask(() => setCompletedCol(col)); setTimeout(() => setCompletedCol(null), 850);
      }
      const notes = current.notes.map((n, i) => {
        if (!settings.autoNotes) return n;
        const sameRow = Math.floor(i / 9) === Math.floor(selected / 9), sameCol = i % 9 === selected % 9;
        const sameBox = Math.floor(i / 27) === Math.floor(selected / 27) && Math.floor((i % 9) / 3) === Math.floor((selected % 9) / 3);
        return sameRow || sameCol || sameBox ? n.filter(x => x !== value) : n;
      });
      const next = { ...current, cells, notes, history };
      if (cells.every((cell, index) => cell === current.solution[index])) queueMicrotask(() => complete(next));
      return next;
    });
  }, [selected, notesMode, stats, settings]);

  const erase = useCallback(() => setGame(g => {
    if (!g || selected === null || g.puzzle[selected] || g.status !== "playing") return g;
    const cells = [...g.cells], notes = g.notes.map(n => [...n]), history = snapshot(g); cells[selected] = 0; notes[selected] = [];
    return { ...g, cells, notes, history };
  }), [selected]);
  const undo = useCallback(() => setGame(g => {
    if (!g?.history.length || g.status !== "playing") return g;
    const previous = g.history[g.history.length - 1]; return { ...g, ...previous, history: g.history.slice(0, -1) };
  }), []);
  const hint = () => setGame(g => {
    if (!g || !g.hintsLeft || g.status !== "playing") return g;
    const empty = g.cells.map((v, i) => v ? -1 : i).filter(i => i >= 0); if (!empty.length) return g;
    const at = selected !== null && !g.cells[selected] ? selected : empty[Math.floor(Math.random() * empty.length)];
    const cells = [...g.cells]; cells[at] = g.solution[at]; setSelected(at);
    const next = { ...g, cells, hintsLeft: g.hintsLeft - 1, hintsUsed: g.hintsUsed + 1, history: snapshot(g) };
    if (cells.every(Boolean)) queueMicrotask(() => complete(next)); return next;
  });

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (screen !== "game" || modal) return;
      if (/^[1-9]$/.test(e.key)) input(Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); erase(); }
      else if (e.key.toLowerCase() === "n") setNotesMode(n => !n);
      else if (e.key.toLowerCase() === "h") hint();
      else if (e.key.toLowerCase() === "u" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z")) undo();
      else if (e.key.startsWith("Arrow")) { e.preventDefault(); setSelected(s => { const at = s ?? 0; if (e.key === "ArrowLeft") return Math.max(0, at - 1); if (e.key === "ArrowRight") return Math.min(80, at + 1); if (e.key === "ArrowUp") return Math.max(0, at - 9); return Math.min(80, at + 9); }); }
    };
    addEventListener("keydown", key); return () => removeEventListener("keydown", key);
  }, [screen, modal, input, erase, undo]);

  const related = useMemo(() => game && selected !== null ? game.cells[selected] : 0, [game, selected]);
  const toggleTheme = () => { const next = theme === "light" ? "dark" : "light"; setTheme(next); document.documentElement.dataset.theme = next; localStorage.setItem("sudoku.theme", next); };
  const updateSetting = (key: keyof GameSettings) => setSettings(current => { const next = { ...current, [key]: !current[key] }; localStorage.setItem("sudoku.settings", JSON.stringify(next)); return next; });
  const filledCount = game?.cells.filter(Boolean).length || 0;
  const progress = game ? Math.round((filledCount - game.puzzle.filter(Boolean).length) / (81 - game.puzzle.filter(Boolean).length) * 100) : 0;

  return <main className={screen === "game" ? "game-shell" : "home-shell"}><ServiceWorker />
    <header className="topbar">
      <button className="brand" onClick={() => setScreen("home")} aria-label="Sudoku home"><span className="brand-mark">S</span><span>Sudoku</span></button>
      <div className="header-actions">
        {screen === "game" && <button className="icon-button" onClick={() => setGame(g => g ? { ...g, status: g.status === "paused" ? "playing" : "paused" } : g)} aria-label={game?.status === "paused" ? "Resume game" : "Pause game"}>{game?.status === "paused" ? "▶" : "Ⅱ"}</button>}
        <button className="icon-button" onClick={() => setModal("settings")} aria-label="Game settings">⚙</button>
        <button className="icon-button" onClick={toggleTheme} aria-label="Toggle theme">{theme === "light" ? "☾" : "☀"}</button>
      </div>
    </header>

    {screen === "home" ? <section className="home-content">
      <div className="eyebrow">YOUR DAILY PUZZLE</div><h1>Clear your mind.</h1><p className="lede">A quiet place to focus, one number at a time.</p>
      <div className="home-actions">
        {game && game.status !== "over" && <button className="primary" onClick={() => { setScreen("game"); setGame(g => g ? { ...g, status: "playing" } : g); }}>Continue game <span>→</span></button>}
        <button className={game && game.status !== "over" ? "secondary" : "primary"} onClick={() => setModal("new")}>New game <span>＋</span></button>
      </div>
      <div className="summary"><button onClick={() => setModal("stats")}><small>Total score</small><strong>{stats.totalScore.toLocaleString()}</strong></button><i></i><button onClick={() => setModal("stats")}><small>Current streak</small><strong><span className="flame">◆</span> {stats.currentStreak} days</strong></button></div>
      <button className="text-button" onClick={() => setModal("stats")}>View statistics <span>↗</span></button>
    </section> : game && <section className="play-area">
      <div className="game-meta"><div><small>Difficulty</small><strong>{DIFFICULTIES[game.difficulty].label}</strong></div><div><small>Time</small><strong>{settings.showTimer ? formatTime(game.seconds) : "—"}</strong></div><div><small>Mistakes</small><strong className={game.mistakes ? "danger" : ""}>{game.mistakes}{settings.mistakeLimit ? " / 3" : ""}</strong></div></div>
      <div className="progress-track" role="progressbar" aria-label="Puzzle progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }}></span></div>
      <div className={`board-wrap ${game.status === "paused" || game.status === "over" ? "obscured" : ""} ${celebrating ? "celebrating" : ""}`}>
        <div className="board" role="grid" aria-label="Sudoku board">
          {game.cells.map((value, i) => { const r = Math.floor(i / 9), c = i % 9, sr = selected === null ? -1 : Math.floor(selected / 9), sc = selected === null ? -1 : selected % 9; const peer = selected !== null && (r === sr || c === sc || (Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3))); const box = Math.floor(r / 3) * 3 + Math.floor(c / 3); const boxPosition = (r % 3) + (c % 3); const unitComplete = completedBox === box || completedRow === r || completedCol === c; const unitDelay = completedRow === r ? c : completedCol === c ? r : boxPosition; return <button key={i} style={{ "--cell-delay": `${(r + c) * 38}ms`, "--unit-delay": `${unitDelay * 48}ms` } as React.CSSProperties} role="gridcell" aria-label={`Row ${r + 1}, column ${c + 1}${value ? `, ${value}` : ""}`} className={`cell ${game.puzzle[i] ? "given" : ""} ${peer ? "peer" : ""} ${i === selected ? "selected" : ""} ${related && value === related ? "same" : ""} ${unitComplete ? "unit-complete" : ""}`} onClick={() => setSelected(i)}>
            {value || <span className="notes">{Array.from({ length: 9 }, (_, n) => <i key={n}>{game.notes[i].includes(n + 1) ? n + 1 : ""}</i>)}</span>}
          </button>; })}
        </div>
        {game.status === "paused" && <div className="pause-panel"><b>Game paused</b><span>Take your time.</span><button className="primary compact" onClick={() => setGame(g => g ? { ...g, status: "playing" } : g)}>Resume</button></div>}
        {game.status === "over" && modal !== "result" && <div className="pause-panel"><b>bumzi vagy</b><span>Three mistakes — try a fresh puzzle.</span><button className="primary compact" onClick={() => setModal("new")}>New game</button></div>}
      </div>
      <div className={`tools ${settings.leftHanded ? "left-handed" : ""}`}>
        <button onClick={undo} disabled={!game.history.length}><Icon>↶</Icon><span>Undo</span></button><button onClick={erase}><Icon>⌫</Icon><span>Erase</span></button><button className={notesMode ? "active" : ""} onClick={() => setNotesMode(n => !n)}><Icon>✎</Icon><span>Notes</span><em>{notesMode ? "ON" : "OFF"}</em></button><button onClick={hint} disabled={!game.hintsLeft}><Icon>◇</Icon><span>Hint</span><em>{game.hintsLeft}</em></button>
      </div>
      <div className="keypad" aria-label="Number pad">{[1,2,3,4,5,6,7,8,9].map(n => {
        const exhausted = game.cells.filter(value => value === n).length === 9;
        const remaining = 9 - game.cells.filter(value => value === n).length;
        return <button key={n} className={exhausted ? "exhausted" : ""} disabled={exhausted} aria-label={exhausted ? `${n} completed` : `Enter ${n}, ${remaining} remaining`} onClick={() => input(n)}>{exhausted ? "" : <><span>{n}</span><small>{remaining}</small></>}</button>;
      })}</div>
      <button className="new-link" onClick={() => setModal(game.status === "playing" ? "confirm" : "new")}>New game</button>
    </section>}

    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && setModal(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button className="modal-close" onClick={() => setModal(null)} aria-label="Close">×</button>
      {(modal === "new" || modal === "confirm") && <><span className="modal-symbol">＋</span><h2 id="modal-title">{modal === "confirm" ? "Start a new game?" : "Choose difficulty"}</h2><p>{modal === "confirm" ? "Your current progress will be lost." : "Every puzzle has one unique solution."}</p><div className="difficulty-list">{(Object.keys(DIFFICULTIES) as Difficulty[]).map(d => <button key={d} onClick={() => startGame(d)}><span><b>{DIFFICULTIES[d].label}</b><small>{DIFFICULTIES[d].clues} clues · {DIFFICULTIES[d].hints} hints</small></span><i>→</i></button>)}</div></>}
      {modal === "stats" && <><span className="modal-symbol">↗</span><h2 id="modal-title">Statistics</h2><div className="stat-grid"><div><small>Games played</small><b>{stats.played}</b></div><div><small>Completed</small><b>{stats.completed}</b></div><div><small>Win rate</small><b>{stats.played ? Math.round(stats.completed / stats.played * 100) : 0}%</b></div><div><small>Total score</small><b>{stats.totalScore.toLocaleString()}</b></div><div><small>Current streak</small><b>{stats.currentStreak} days</b></div><div><small>Longest streak</small><b>{stats.longestStreak} days</b></div></div><div className="difficulty-stats">{(Object.keys(DIFFICULTIES) as Difficulty[]).map(d => <div key={d}><b>{DIFFICULTIES[d].label}</b><span>{stats.byDifficulty[d].completed} wins</span><span>{stats.byDifficulty[d].bestTime === null ? "—" : formatTime(stats.byDifficulty[d].bestTime)} best</span><strong>{stats.byDifficulty[d].bestScore.toLocaleString()} pts</strong></div>)}</div></>}
      {modal === "settings" && <><span className="modal-symbol">⚙</span><h2 id="modal-title">Game settings</h2><p>Make the board work the way you like.</p><div className="settings-list">
        {[["mistakeLimit","Three-mistake limit","End the game after three mistakes"],["checkMistakes","Instant mistake check","Show incorrect entries immediately"],["autoNotes","Clean up notes","Remove related notes automatically"],["showTimer","Show timer","Display elapsed time while playing"],["leftHanded","Left-handed controls","Reverse the tool order for easy reach"]].map(([key,title,desc]) => <button key={key} onClick={() => updateSetting(key as keyof GameSettings)}><span><b>{title}</b><small>{desc}</small></span><i className={settings[key as keyof GameSettings] ? "on" : ""}><em></em></i></button>)}
      </div></>}
      {modal === "result" && game && <><span className="modal-symbol success">✓</span><h2 id="modal-title">Completed!</h2><p>A focused finish. Nicely done.</p><div className="result-score"><small>Score</small><strong>{lastScore.toLocaleString()}</strong><span>Best {stats.byDifficulty[game.difficulty].bestScore.toLocaleString()}</span></div><div className="result-details"><span><small>Difficulty</small><b>{DIFFICULTIES[game.difficulty].label}</b></span><span><small>Time</small><b>{formatTime(game.seconds)}</b></span><span><small>Mistakes</small><b>{game.mistakes}</b></span><span><small>Hints used</small><b>{game.hintsUsed}</b></span></div><button className="primary" onClick={() => setModal("new")}>Play another <span>→</span></button></>}
    </section></div>}
    <footer><span>Sudoku · Play with focus</span><span>Offline friendly · Your progress stays on this device</span></footer>
  </main>;
}
