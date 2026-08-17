import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layers } from 'lucide-react';

const COLORS = ['#facc15', '#ef4444', '#3b82f6', '#22c55e'];
const STARTING_CELL_INDEX = 3; // lower right
const SHUFFLE_DURATION_MS = 2000;
const SHUFFLE_STEP_MS = 80;

function clampInteger(value: string | number, min: number, max: number) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function getContrastTextColor(hexColor: string): string {
  if (!hexColor || typeof hexColor !== 'string') return '#ffffff';
  let hex = hexColor.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return '#ffffff';

  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);

  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return '#ffffff';

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 130 ? '#000000' : '#ffffff';
}

function shuffledColors() {
  const result = [...COLORS];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createFinalShuffledGrid() {
  let result: string[];
  do {
    result = shuffledColors();
  } while (result.every((color, index) => color === COLORS[index]));
  return result;
}

import RhodusDuoDisplay from './RhodusDuoDisplay';
import RhodusDuoController from './RhodusDuoController';
import { isNearbyAvailable } from '../lib/nearby';

export default function RhodusApp() {
  const [appMode, setAppMode] = useState<'local' | 'duo-display' | 'duo-controller'>('local');
  const [intervalMs, setIntervalMs] = useState(1000);
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [targetFlashes, setTargetFlashes] = useState(10);
  
  const [gridColors, setGridColors] = useState([...COLORS]);
  const [changeCount, setChangeCount] = useState(0);
  const [lastColorIndex, setLastColorIndex] = useState(-1);
  const [activeCellIndex, setActiveCellIndex] = useState(-1);

  const [isActive, setIsActive] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showComplete, setShowComplete] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [showCustomSettings, setShowCustomSettings] = useState(false);

  const [currentCountdown, setCurrentCountdown] = useState(5);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const flashTimer = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);
  const shuffleTimer = useRef<number | null>(null);
  const flashStartedAt = useRef(0);
  const nextFlashNumber = useRef(1);
  
  const changeCountRef = useRef(changeCount);
  useEffect(() => {
    changeCountRef.current = changeCount;
  }, [changeCount]);
  
  const isActiveRef = useRef(isActive);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  
  const isCountingDownRef = useRef(isCountingDown);
  useEffect(() => { isCountingDownRef.current = isCountingDown; }, [isCountingDown]);

  const clearScheduledTimeout = (timerRef: React.MutableRefObject<number | null>) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopTimers = useCallback(() => {
    clearScheduledTimeout(flashTimer);
    clearScheduledTimeout(countdownTimer);
    clearScheduledTimeout(shuffleTimer);
  }, []);

  const millisecondsUntil = (deadline: number) => {
    return Math.max(0, deadline - performance.now());
  };

  const restoreFixedGrid = () => {
    setIsShuffling(false);
    setGridColors(COLORS);
  };

  const activateColor = (index: number) => {
    setActiveCellIndex(index);
    setLastColorIndex(index);
  };

  const clearActiveColor = () => {
    setActiveCellIndex(-1);
    setLastColorIndex(-1);
  };

  const stopTraining = useCallback(({ showPanel = true } = {}) => {
    stopTimers();
    setIsActive(false);
    isActiveRef.current = false;
    setIsCountingDown(false);
    isCountingDownRef.current = false;
    setShowComplete(false);
    restoreFixedGrid();
    clearActiveColor();
    setShowControls(showPanel);
  }, [stopTimers]);

  const chooseNextColorIndex = (currentLastColorIndex: number) => {
    if (currentLastColorIndex < 0) {
      return Math.floor(Math.random() * COLORS.length);
    }
    const offset = 1 + Math.floor(Math.random() * (COLORS.length - 1));
    return (currentLastColorIndex + offset) % COLORS.length;
  };

  const nextColor = (currentLastColorIndex: number) => {
    const nextIdx = chooseNextColorIndex(currentLastColorIndex);
    activateColor(nextIdx);
    setChangeCount(prev => {
      const nextCount = prev + 1;
      changeCountRef.current = nextCount;
      return nextCount;
    });
    return nextIdx;
  };

  const scheduleNextFlash = (currentLastColorIndex: number) => {
    if (!isActiveRef.current) return;

    const deadline = flashStartedAt.current + nextFlashNumber.current * intervalMs;
    flashTimer.current = window.setTimeout(() => {
      flashTimer.current = null;
      if (!isActiveRef.current) return;

      if (changeCountRef.current >= targetFlashes) {
        stopTimers();
        setIsActive(false);
        isActiveRef.current = false;
        setShowComplete(true);
        setShowControls(false);
        return;
      }

      const nextIdx = nextColor(currentLastColorIndex);
      if (!isActiveRef.current) return;

      nextFlashNumber.current += 1;
      scheduleNextFlash(nextIdx);
    }, millisecondsUntil(deadline));
  };

  const beginFlashing = () => {
    setIsCountingDown(false);
    isCountingDownRef.current = false;
    setIsActive(true);
    isActiveRef.current = true;
    setShowControls(false);

    setChangeCount(1);
    changeCountRef.current = 1;
    const nextIdx = chooseNextColorIndex(-1);
    activateColor(nextIdx);
    
    flashStartedAt.current = performance.now();
    nextFlashNumber.current = 1;
    
    scheduleNextFlash(nextIdx);
  };

  const startCountdownClock = () => {
    setIsShuffling(false);
    activateColor(STARTING_CELL_INDEX);
    setCurrentCountdown(countdownSeconds);

    const countdownStartedAt = performance.now();
    let completedSteps = 0;

    const scheduleNextCountdownStep = () => {
      const deadline = countdownStartedAt + (completedSteps + 1) * 1000;
      countdownTimer.current = window.setTimeout(() => {
        countdownTimer.current = null;
        if (!isCountingDownRef.current) return;

        completedSteps += 1;
        const remaining = countdownSeconds - completedSteps;

        if (remaining <= 0) {
          beginFlashing();
          return;
        }

        setCurrentCountdown(remaining);
        scheduleNextCountdownStep();
      }, millisecondsUntil(deadline));
    };

    scheduleNextCountdownStep();
  };

  const beginShuffle = () => {
    clearActiveColor();
    setIsShuffling(true);

    const finalGridColors = createFinalShuffledGrid();
    const shuffleStartedAt = performance.now();
    const shuffleEndsAt = shuffleStartedAt + SHUFFLE_DURATION_MS;
    let frameNumber = 0;
    let litCellIndex = -1;

    const renderShuffleFrame = () => {
      if (!isCountingDownRef.current) return;

      if (performance.now() >= shuffleEndsAt) {
        shuffleTimer.current = null;
        setGridColors(finalGridColors);
        startCountdownClock();
        return;
      }

      setGridColors(shuffledColors());

      const offset = 1 + Math.floor(Math.random() * (COLORS.length - 1));
      litCellIndex = (litCellIndex + offset + COLORS.length) % COLORS.length;
      activateColor(litCellIndex);

      frameNumber += 1;
      const nextDeadline = Math.min(
        shuffleEndsAt,
        shuffleStartedAt + frameNumber * SHUFFLE_STEP_MS
      );
      shuffleTimer.current = window.setTimeout(
        renderShuffleFrame,
        millisecondsUntil(nextDeadline)
      );
    };

    renderShuffleFrame();
  };

  const beginCountdown = () => {
    if (changeCount >= targetFlashes) {
      setChangeCount(0);
      changeCountRef.current = 0;
    }
    setShowComplete(false);
    stopTimers();
    setIsCountingDown(true);
    isCountingDownRef.current = true;
    setIsActive(false);
    isActiveRef.current = false;
    setShowControls(true);
    restoreFixedGrid();
    clearActiveColor();

    if (shuffleEnabled) {
      beginShuffle();
    } else {
      startCountdownClock();
    }
  };

  const handleStartStop = () => {
    if (isActive || isCountingDown) {
      stopTraining({ showPanel: true });
    } else {
      beginCountdown();
    }
  };

  const startLevel = (level: number) => {
    if (level === 1) {
      setIntervalMs(1300);
      setTargetFlashes(10);
      setShuffleEnabled(false);
      setCountdownSeconds(5);
    } else if (level === 2) {
      setIntervalMs(1150);
      setTargetFlashes(12);
      setShuffleEnabled(false);
      setCountdownSeconds(5);
    } else if (level === 3) {
      setIntervalMs(1000);
      setTargetFlashes(15);
      setShuffleEnabled(false);
      setCountdownSeconds(5);
    } else if (level === 4) {
      setIntervalMs(900);
      setTargetFlashes(17);
      setShuffleEnabled(false);
      setCountdownSeconds(5);
    } else if (level === 5) {
      setIntervalMs(800);
      setTargetFlashes(20);
      setShuffleEnabled(false);
      setCountdownSeconds(5);
    }
    beginCountdown();
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn('Vollbildmodus ist nicht verfügbar.', error);
    }
  };

  const handleAppPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (target.closest('[data-hub-control]')) return;
    if (!isCountingDown && !isActive) return;
    event.preventDefault();
    event.stopPropagation();
    setChangeCount(0);
    stopTraining({ showPanel: true });
  };

  const openControlsFromComplete = () => {
    setShowComplete(false);
    setShowControls(true);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        if (isCountingDownRef.current) stopTraining({ showPanel: true });
        else if (isActiveRef.current) setShowControls(true);
      }
    };

    const handleVisibility = () => {
      if (document.hidden && (isActiveRef.current || isCountingDownRef.current)) {
        stopTraining({ showPanel: true });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('visibilitychange', handleVisibility);
      stopTimers();
    };
  }, [stopTraining]);

  const isNativeNearbyMode = isNearbyAvailable();

  if (isNativeNearbyMode) {
    return <RhodusDuoDisplay />;
  }

  if (appMode === 'duo-display') {
    return <RhodusDuoDisplay onExit={() => setAppMode('local')} />;
  }
  
  if (appMode === 'duo-controller') {
    return <RhodusDuoController onExit={() => setAppMode('local')} />;
  }

  return (
    <div className="flex h-full w-full bg-[#000000] text-white font-mono select-none overflow-hidden">
      <main id="app" className="flex-1 hic-rhodus-app relative" aria-label="Hic Rhodus 2-mal-2 Farbwechsel-Training" onPointerDown={handleAppPointerDown}>
      <div id="colorGrid" className={`color-grid ${isShuffling ? 'shuffling' : ''}`} aria-hidden="true">
        {gridColors.map((color, index) => (
          <div 
            key={index} 
            id={`cell_${index}`} 
            className={`color-cell ${activeCellIndex === index ? 'active' : ''}`} 
            style={{ backgroundColor: color }}
          >
            {isActive && activeCellIndex === index && (
              <div 
                id={`cellNumber_${index}`} 
                className="cell-number" 
                style={{ color: getContrastTextColor(color) }}
              >
                {changeCount}
              </div>
            )}
          </div>
        ))}
      </div>

      <div id="screenHint" className={`screen-hint ${showControls || !isActive ? 'hidden' : ''}`} aria-hidden="true"></div>

      <div id="completeOverlay" className={`complete-overlay ${!showComplete ? 'hidden' : ''}`} aria-modal="true" role="dialog" aria-labelledby="completeTitle">
        <div 
          id="completeCard" 
          className="complete-card" 
          role="button" 
          tabIndex={0} 
          onClick={openControlsFromComplete} 
          onKeyDown={(e) => { 
            if (e.key === 'Enter' || e.key === ' ') { 
              e.preventDefault(); 
              openControlsFromComplete(); 
            } 
          }}
        >
          <div id="completeTitle" className="complete-title">Ziel erreicht</div>
          <div className="complete-copy"><strong id="completeCount">{changeCount}</strong> Farbwechsel abgeschlossen</div>
          <button 
            id="restartButton" 
            className="complete-restart" 
            type="button" 
            aria-label="Mit denselben Einstellungen neu starten" 
            onClick={(e) => { 
              e.stopPropagation(); 
              beginCountdown(); 
            }}
          >
            <svg className="fill-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.34-5.66L20 8"></path>
              <path d="M20 3v5h-5"></path>
            </svg>
            <span>Erneut starten</span>
          </button>
          <button 
            id="settingsButton" 
            className="complete-settings" 
            type="button" 
            aria-label="Einstellungen öffnen" 
            onClick={(e) => { 
              e.stopPropagation(); 
              openControlsFromComplete(); 
            }}
          >
            <svg className="fill-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"></path>
            </svg>
            <span>Einstellungen</span>
          </button>
        </div>
      </div>

      <div 
        id="controlsOverlay" 
        className={`overlay ${isCountingDown ? 'countdown-mode' : ''} ${(!showControls && !isCountingDown) ? 'hidden' : ''}`} 
        aria-modal="true" 
        role="dialog" 
        tabIndex={-1} 
        aria-labelledby="appTitle" 
        onClick={(e) => { 
          if (e.target === e.currentTarget) e.preventDefault(); 
        }} 
        onKeyDown={(e) => { 
          if (e.key === 'Escape' && e.target === e.currentTarget) e.preventDefault(); 
        }}
      >
        <div id="countdown" className={`countdown ${!isCountingDown ? 'hidden' : ''}`} aria-live="assertive">
          <span key={currentCountdown}>{currentCountdown}</span>
        </div>

        <div id="panel" className={`panel ${isCountingDown ? 'hidden' : ''}`}>
          <header className="header">
            <h1 id="appTitle">Hic Rhodus</h1>
            <div className="title-line" aria-hidden="true"></div>
          </header>

          {!showCustomSettings ? (
            <div id="levelCards" className="level-cards">
              <button id="levelCard1" className="level-card level-1" type="button" onClick={() => startLevel(1)}>
                <div className="level-title">Level 1</div>
                <div className="level-desc">1300ms, 10 Farbwechsel</div>
              </button>
              <button id="levelCard2" className="level-card level-2" type="button" onClick={() => startLevel(2)}>
                <div className="level-title">Level 2</div>
                <div className="level-desc">1150ms, 12 Farbwechsel</div>
              </button>
              <button id="levelCard3" className="level-card level-3" type="button" onClick={() => startLevel(3)}>
                <div className="level-title">Level 3</div>
                <div className="level-desc">1000ms, 15 Farbwechsel</div>
              </button>
              <button id="levelCard4" className="level-card level-4" type="button" onClick={() => startLevel(4)}>
                <div className="level-title">Level 4</div>
                <div className="level-desc">900ms, 17 Farbwechsel</div>
              </button>
              <button id="levelCard5" className="level-card level-5" type="button" onClick={() => startLevel(5)}>
                <div className="level-title">Level 5</div>
                <div className="level-desc">800ms, 20 Farbwechsel</div>
              </button>
              <button id="levelCardCustom" className="level-card custom" type="button" onClick={() => setShowCustomSettings(true)}>
                <div className="level-title">Eigene Einstellungen</div>
                <div className="level-desc">Manuell konfigurieren</div>
              </button>
              <div className="grid grid-cols-2 gap-3 w-full pt-1">
                <button className="level-card" style={{ borderColor: 'rgba(168, 85, 247, 0.4)', background: 'rgba(168, 85, 247, 0.05)' }} type="button" onClick={() => setAppMode('duo-display')}>
                  <div className="level-title text-purple-400">Display</div>
                </button>
                <button className="level-card" style={{ borderColor: 'rgba(168, 85, 247, 0.4)', background: 'rgba(168, 85, 247, 0.05)' }} type="button" onClick={() => setAppMode('duo-controller')}>
                  <div className="level-title text-purple-400">Controller</div>
                </button>
              </div>
            </div>
          ) : (
            <>
              <section className="setting">
                <div className="setting-head">
                  <label htmlFor="intervalInput">Intervall</label>
                  <output id="intervalOutput" className="value" htmlFor="intervalInput">{intervalMs}ms</output>
                </div>
                <div className="stepper">
                  <button id="intervalMinus" className="icon-button" type="button" title="100ms verringern" aria-label="Intervall um 100 Millisekunden verringern" onClick={() => setIntervalMs(Math.max(50, intervalMs - 100))}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>
                  </button>
                  <input id="intervalInput" className="number-input" type="number" inputMode="numeric" min="50" max="5000" step="50" value={intervalMs} onChange={(e) => setIntervalMs(parseInt(e.target.value) || 0)} onBlur={() => setIntervalMs(clampInteger(intervalMs, 50, 5000))} aria-label="Intervall in Millisekunden" />
                  <button id="intervalPlus" className="icon-button" type="button" title="100ms erhöhen" aria-label="Intervall um 100 Millisekunden erhöhen" onClick={() => setIntervalMs(Math.min(5000, intervalMs + 100))}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </div>
              </section>

              <section className="setting">
                <div className="setting-head">
                  <label htmlFor="targetInput">Farbwechsel Anzahl</label>
                  <output id="targetOutput" className="value" htmlFor="targetInput">{targetFlashes}</output>
                </div>
                <div className="stepper">
                  <button id="targetMinus" className="icon-button" type="button" title="1 verringern" aria-label="Anzahl um eins verringern" onClick={() => setTargetFlashes(Math.max(1, targetFlashes - 1))}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>
                  </button>
                  <input id="targetInput" className="number-input" type="number" inputMode="numeric" min="1" max="1000" step="1" value={targetFlashes} onChange={(e) => setTargetFlashes(parseInt(e.target.value) || 0)} onBlur={() => setTargetFlashes(clampInteger(targetFlashes, 1, 1000))} aria-label="Anzahl der Farbwechsel" />
                  <button id="targetPlus" className="icon-button" type="button" title="1 erhöhen" aria-label="Anzahl um eins erhöhen" onClick={() => setTargetFlashes(Math.min(1000, targetFlashes + 1))}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </div>
              </section>

              <section className="setting">
                <div className="setting-head">
                  <label id="shuffleLabel" htmlFor="shuffleToggle">Shuffle</label>
                  <output id="shuffleOutput" className="value">{shuffleEnabled ? 'An' : 'Aus'}</output>
                </div>
                <button id="shuffleToggle" className="toggle-button" type="button" role="switch" aria-checked={shuffleEnabled} aria-labelledby="shuffleLabel shuffleOutput" onClick={() => setShuffleEnabled(!shuffleEnabled)}>
                  <span id="shuffleToggleText" className="toggle-copy">Positionen vor dem Start mischen</span>
                  <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb"></span></span>
                </button>
              </section>

              <section className="setting">
                <div className="setting-head">
                  <label htmlFor="countdownInput">Countdown</label>
                  <output id="countdownOutput" className="value" htmlFor="countdownInput">{countdownSeconds}s</output>
                </div>
                <div className="stepper">
                  <button id="countdownMinus" className="icon-button" type="button" title="1 Sekunde verringern" aria-label="Countdown um eine Sekunde verringern" onClick={() => setCountdownSeconds(Math.max(1, countdownSeconds - 1))}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>
                  </button>
                  <input id="countdownInput" className="number-input" type="number" inputMode="numeric" min="1" max="60" step="1" value={countdownSeconds} onChange={(e) => setCountdownSeconds(parseInt(e.target.value) || 0)} onBlur={() => setCountdownSeconds(clampInteger(countdownSeconds, 1, 60))} aria-label="Countdown-Dauer in Sekunden" />
                  <button id="countdownPlus" className="icon-button" type="button" title="1 Sekunde erhöhen" aria-label="Countdown um eine Sekunde erhöhen" onClick={() => setCountdownSeconds(Math.min(60, countdownSeconds + 1))}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                  </button>
                </div>
              </section>

              <div className="actions">
                <button id="startButton" className={`primary ${isActive || isCountingDown ? 'stop' : ''}`} type="button" onClick={handleStartStop}>
                  {isActive || isCountingDown ? (
                    <>
                      <svg id="startIcon" className="fill-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>
                      <span id="startButtonText">{isCountingDown ? 'Abbrechen' : 'Stop'}</span>
                    </>
                  ) : (
                    <>
                      <svg id="startIcon" className="fill-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 4 13 8-13 8z"/></svg>
                      <span id="startButtonText">Start</span>
                    </>
                  )}
                </button>

                <button id="backToLevelsButton" className="secondary" type="button" onClick={() => setShowCustomSettings(false)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
                  <span>Zurück zu Leveln</span>
                </button>

                <button id="fullscreenButton" className="secondary" type="button" onClick={toggleFullscreen}>
                  {isFullscreen ? (
                    <>
                      <svg id="fullscreenIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M8 21v-3a2 2 0 0 0-2-2H3M16 21v-3a2 2 0 0 1 2-2h3"></path></svg>
                      <span id="fullscreenText">Vollbild beenden</span>
                    </>
                  ) : (
                    <>
                      <svg id="fullscreenIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"></path></svg>
                      <span id="fullscreenText">Vollbildmodus</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  </div>
);
}
