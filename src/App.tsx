import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, HelpCircle, X, ChevronDown, Sun, Moon } from 'lucide-react';

interface BreathingPattern {
  name: string;
  label: string;
  inhale: number;
  hold: number;
  exhale: number;
  description: string;
  benefit: string;
}

interface DateInfo {
  str: string;
  label: string;
  done: boolean;
}

const BREATHING_PATTERNS: BreathingPattern[] = [
  {
    name: 'Balanced Breath',
    label: '4s in / 4s out',
    inhale: 4, hold: 0, exhale: 4,
    description: 'Equal inhale and exhale creates a steady, symmetrical rhythm. Ideal for beginners — it calms the nervous system without forcing you to hold or extend your breath.',
    benefit: 'Reduces anxiety • Improves focus',
  },
  {
    name: 'Extended Exhale',
    label: '4s in / 6s out',
    inhale: 4, hold: 0, exhale: 6,
    description: 'A longer exhale activates the parasympathetic nervous system, signaling your body to rest. The 4:6 ratio is widely used in clinical stress-reduction programs.',
    benefit: 'Deep relaxation • Lowers heart rate',
  },
  {
    name: '4-7-8 Breathing',
    label: '4s in / 7s hold / 8s out',
    inhale: 4, hold: 7, exhale: 8,
    description: 'Developed by Dr. Andrew Weil, this pattern acts as a natural tranquilizer for the nervous system. The extended hold and exhale trigger deep relaxation — excellent for sleep preparation.',
    benefit: 'Sleep aid • Stress relief • Anxiety reduction',
  },
  {
    name: 'Resonant Breath',
    label: '5s in / 5s out',
    inhale: 5, hold: 0, exhale: 5,
    description: 'Breathing at ~6 cycles per minute (5s in, 5s out) synchronizes your breath with your heart rate rhythm — known as cardiac coherence. Deeply restorative.',
    benefit: 'Heart coherence • Emotional balance',
  },
];

const App: React.FC = () => {
  const [isSetup, setIsSetup] = useState<boolean>(true);
  const [duration, setDuration] = useState<number>(5);
  const [patternIndex, setPatternIndex] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [phaseProgress, setPhaseProgress] = useState<number>(0);
  const [showCompletion, setShowCompletion] = useState<boolean>(false);
  const [showPatternInfo, setShowPatternInfo] = useState<boolean>(false);
  const [checkAnimDone, setCheckAnimDone] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [resetProgress, setResetProgress] = useState<number>(0);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [showResetMessage, setShowResetMessage] = useState<boolean>(false);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resetStartRef = useRef<number | null>(null);
  const [expandedPatternInfo, setExpandedPatternInfo] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('breath_only_dark_mode');
    return saved ? JSON.parse(saved) : true; // Default to dark mode
  });
  const [musicEnabled, setMusicEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('breath_only_music_enabled');
    return saved ? JSON.parse(saved) : true; // Default to music on
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode[] | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const pianoAudioRef = useRef<{ ctx: AudioContext; masterGain: GainNode } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const pattern = BREATHING_PATTERNS[patternIndex];

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('breath_only_dark_mode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Save music preference
  useEffect(() => {
    localStorage.setItem('breath_only_music_enabled', JSON.stringify(musicEnabled));
  }, [musicEnabled]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleMusic = () => {
    setMusicEnabled(!musicEnabled);
  };

  // ── Storage helpers ──────────────────────────────────────────────
  const getCompletions = (): string[] => {
    try { return JSON.parse(localStorage.getItem('breath_only_completions') || '[]'); }
    catch { return []; }
  };
  const todayStr = (): string => new Date().toISOString().split('T')[0];
  const isCompletedToday = (): boolean => getCompletions().includes(todayStr());

  const markComplete = (): void => {
    const completions = getCompletions();
    const t = todayStr();
    if (!completions.includes(t)) {
      completions.push(t);
      localStorage.setItem('breath_only_completions', JSON.stringify(completions));
    }
    
    // Track total meditation time
    const totalTime = parseInt(localStorage.getItem('breath_only_total_time') || '0');
    localStorage.setItem('breath_only_total_time', (totalTime + duration).toString());
  };

  const getTotalMeditationTime = (): number => {
    return parseInt(localStorage.getItem('breath_only_total_time') || '0');
  };

  const formatTotalTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} minutes`;
  };

  const getStreak = (): number => {
    const completions = getCompletions().sort().reverse();
    if (!completions.length) return 0;
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (completions.includes(d.toISOString().split('T')[0])) streak++;
      else break;
    }
    return streak;
  };

  const getRecentDates = (): DateInfo[] => {
    const completions = getCompletions();
    const dates: DateInfo[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      dates.push({ str, label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), done: completions.includes(str) });
    }
    return dates;
  };

  // ── Piano music on landing page ──────────────────────────────────
  useEffect(() => {
    if (isSetup && !pianoAudioRef.current && musicEnabled) {
      const initPiano = (): void => {
        if (!audioCtxRef.current) {
          const AC = window.AudioContext || (window as any).webkitAudioContext;
          audioCtxRef.current = new AC();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const masterGain = ctx.createGain();
        masterGain.gain.value = 0.15;
        masterGain.connect(ctx.destination);

        const notes = [261.63, 293.66, 329.63, 392.00, 440.00];
        const playNote = (freq: number, delay: number, duration: number): void => {
          const osc = ctx.createOscillator();
          const env = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          
          env.gain.setValueAtTime(0, ctx.currentTime + delay);
          env.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay + 0.02);
          env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
          
          osc.connect(env);
          env.connect(masterGain);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + duration);
        };

        const pattern = [0, 2, 4, 2, 3, 1, 0, 3];
        let time = 0;
        const loop = (): void => {
          pattern.forEach((idx, i) => {
            playNote(notes[idx], time + i * 1.2, 4);
            if (i % 2 === 0 && idx > 0) {
              playNote(notes[idx] * 0.5, time + i * 1.2, 4);
            }
          });
          time += pattern.length * 1.2;
          if (isSetup) {
            setTimeout(loop, pattern.length * 1200);
          }
        };
        loop();
        
        pianoAudioRef.current = { ctx, masterGain };
      };

      const handleInteraction = (): void => {
        initPiano();
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
      };
      document.addEventListener('click', handleInteraction);
      document.addEventListener('touchstart', handleInteraction);

      return () => {
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
      };
    }
  }, [isSetup, musicEnabled]);

  useEffect(() => {
    if (!isSetup && pianoAudioRef.current) {
      const { masterGain } = pianoAudioRef.current;
      if (masterGain) {
        masterGain.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 1);
      }
      pianoAudioRef.current = null;
    }
  }, [isSetup]);

  // Stop piano music when music is toggled off
  useEffect(() => {
    if (!musicEnabled && pianoAudioRef.current) {
      const { masterGain } = pianoAudioRef.current;
      if (masterGain && audioCtxRef.current) {
        masterGain.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.5);
      }
      setTimeout(() => {
        pianoAudioRef.current = null;
      }, 600);
    }
  }, [musicEnabled]);

  // ── Audio engine ─────────────────────────────────────────────────
  const initAudio = (): void => {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AC();
    }
  };

  const buildOceanNoise = (ctx: AudioContext): { masterGain: GainNode; sources: AudioBufferSourceNode[]; lfo: OscillatorNode } => {
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const layers = [
      { freq: 220, Q: 0.4, gain: 1.2, type: 'bandpass' },
      { freq: 800, Q: 0.5, gain: 0.9, type: 'bandpass' },
      { freq: 2200, Q: 0.7, gain: 0.45, type: 'bandpass' },
    ];

    const bufferSecs = 4;
    const buf = ctx.createBuffer(2, ctx.sampleRate * bufferSecs, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0;
      for (let i = 0; i < d.length; i++) {
        const wh = Math.random() * 2 - 1;
        b0 = 0.99886*b0 + wh*0.0555179;
        b1 = 0.99332*b1 + wh*0.0750759;
        b2 = 0.96900*b2 + wh*0.1538520;
        b3 = 0.86650*b3 + wh*0.3104856;
        b4 = 0.55000*b4 + wh*0.5329522;
        b5 = -0.7616*b5 - wh*0.0168980;
        d[i] = (b0+b1+b2+b3+b4+b5+wh*0.5362)*0.11;
      }
    }

    const sources = layers.map(l => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = Math.random() * bufferSecs;
      src.loopEnd = bufferSecs;

      const filt = ctx.createBiquadFilter();
      filt.type = l.type;
      filt.frequency.value = l.freq;
      filt.Q.value = l.Q;

      const g = ctx.createGain();
      g.gain.value = l.gain;

      src.connect(filt);
      filt.connect(g);
      g.connect(masterGain);
      src.start(0, Math.random() * bufferSecs);
      return src;
    });

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain);
    lfoGain.connect(masterGain.gain);
    lfo.start();

    return { masterGain, sources, lfo };
  };

  const startTideSound = (): void => {
    if (!audioCtxRef.current || !musicEnabled) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const { masterGain, sources, lfo } = buildOceanNoise(ctx);
    masterGain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 2.5);

    masterGainRef.current = masterGain;
    noiseSourceRef.current = sources;
    lfoRef.current = lfo;
  };

  const modulateOcean = (currentPhase: 'inhale' | 'hold' | 'exhale', progress: number): void => {
    if (!masterGainRef.current || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const ramp = 0.15;

    if (currentPhase === 'inhale') {
      const vol = 0.05 + progress * 0.85;
      masterGainRef.current.gain.linearRampToValueAtTime(vol, now + ramp);
    } else if (currentPhase === 'hold') {
      masterGainRef.current.gain.linearRampToValueAtTime(0.9, now + ramp);
    } else {
      const vol = 0.9 - progress * 0.87;
      masterGainRef.current.gain.linearRampToValueAtTime(Math.max(0.03, vol), now + ramp);
    }
  };

  const stopTideSound = (): void => {
    if (!masterGainRef.current || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    masterGainRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
    setTimeout(() => {
      try {
        if (noiseSourceRef.current) noiseSourceRef.current.forEach(s => s.stop());
        if (lfoRef.current) lfoRef.current.stop();
      } catch {}
      noiseSourceRef.current = null;
      masterGainRef.current = null;
      lfoRef.current = null;
    }, 1400);
  };

  const playSingingBowl = (): void => {
    if (!audioCtxRef.current || !musicEnabled) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const duration = 6;

    [[432, 0.32], [648, 0.14]].forEach(([freq, amp]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(amp, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    });
  };

  // ── Session control ───────────────────────────────────────────────
  const startSession = (): void => {
    initAudio();
    setIsSetup(false);
    setIsActive(true);
    setTimeLeft(duration * 60);
    setPhase('inhale');
    setPhaseProgress(0);
    sessionStartRef.current = Date.now();
    setTimeout(startTideSound, 120);
  };

  const resetSession = (): void => {
    clearInterval(tickRef.current!);
    tickRef.current = null;
    stopTideSound();
    setIsActive(false);
    setIsSetup(true);
    setShowCompletion(false);
    setTimeLeft(0);
    setPhaseProgress(0);
    setCheckAnimDone(false);
  };

  // ── Breathing tick ────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;

    const tick = (): void => {
      const elapsed = (Date.now() - sessionStartRef.current!) / 1000;
      const remaining = Math.max(0, duration * 60 - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setIsActive(false);
        stopTideSound();
        setTimeout(() => {
          playSingingBowl();
          markComplete();
          setShowCompletion(true);
          setTimeout(() => setCheckAnimDone(true), 900);
        }, 400);
        return;
      }

      const cycleTime = pattern.inhale + pattern.hold + pattern.exhale;
      const pos = elapsed % cycleTime;
      let p: 'inhale' | 'hold' | 'exhale';
      let prog: number;
      
      if (pos < pattern.inhale) {
        p = 'inhale';
        prog = pos / pattern.inhale;
      } else if (pos < pattern.inhale + pattern.hold) {
        p = 'hold';
        prog = (pos - pattern.inhale) / pattern.hold;
      } else {
        p = 'exhale';
        prog = (pos - pattern.inhale - pattern.hold) / pattern.exhale;
      }
      
      setPhase(p);
      setPhaseProgress(prog);
      modulateOcean(p, prog);
    };

    tick();
    tickRef.current = setInterval(tick, 50);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isActive, duration, pattern, musicEnabled]);

  const formatTime = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  
  const circleScale = 
    phase === 'inhale' ? 0.38 + phaseProgress * 0.62 :
    phase === 'hold' ? 1.0 :
    1 - phaseProgress * 0.62;

  // ── Completion screen ─────────────────────────────────────────────
  if (showCompletion) {
    const streak = getStreak();
    const dates = getRecentDates();
    const totalTime = getTotalMeditationTime();
    
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Animated ocean background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute inset-0 ${darkMode ? 'opacity-30' : 'opacity-40'}`}>
            <div className="absolute inset-0 bg-gradient-to-b from-blue-900/50 via-teal-800/50 to-cyan-900/50" />
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute bottom-0 left-0 right-0 h-32 rounded-full"
                style={{
                  background: `radial-gradient(ellipse at center, ${darkMode ? 'rgba(20, 184, 166, 0.15)' : 'rgba(20, 184, 166, 0.2)'} 0%, transparent 70%)`,
                  animation: `wave ${8 + i * 2}s ease-in-out infinite`,
                  animationDelay: `${i * 0.5}s`,
                  transform: `translateY(${i * 20}px)`,
                }}
              />
            ))}
          </div>
        </div>
        
        <style>{`
          @keyframes wave {
            0%, 100% { transform: translateX(-25%) translateY(0) scale(1); }
            50% { transform: translateX(25%) translateY(-10px) scale(1.1); }
          }
        `}</style>

        {/* Gradient overlay */}
        <div className={`absolute inset-0 ${darkMode ? 'bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95' : 'bg-gradient-to-br from-blue-50/95 via-purple-50/95 to-pink-50/95'}`} />

        {/* Control buttons - Top left corner */}
        <button
          onClick={toggleDarkMode}
          className={`fixed top-6 left-6 p-4 rounded-full ${darkMode ? 'bg-slate-700/70 hover:bg-slate-600/70' : 'bg-white/50 hover:bg-white/70'} backdrop-blur-xl border ${darkMode ? 'border-slate-600/50' : 'border-white/60'} shadow-xl transition-all z-50`}
        >
          {darkMode ? <Sun size={24} className="text-yellow-300" /> : <Moon size={24} className="text-slate-700" />}
        </button>

        <button
          onClick={toggleMusic}
          className={`fixed top-6 left-24 p-4 rounded-full ${darkMode ? 'bg-slate-700/70 hover:bg-slate-600/70' : 'bg-white/50 hover:bg-white/70'} backdrop-blur-xl border ${darkMode ? 'border-slate-600/50' : 'border-white/60'} shadow-xl transition-all z-50`}
        >
          {musicEnabled ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={darkMode ? 'text-emerald-400' : 'text-emerald-600'}>
              <path d="M9 18V5l12-2v13"></path>
              <circle cx="6" cy="18" r="3"></circle>
              <circle cx="18" cy="16" r="3"></circle>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={darkMode ? 'text-slate-400' : 'text-gray-500'}>
              <path d="M9 18V5l12-2v13"></path>
              <circle cx="6" cy="18" r="3"></circle>
              <circle cx="18" cy="16" r="3"></circle>
              <line x1="2" y1="2" x2="22" y2="22"></line>
            </svg>
          )}
        </button>

        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <div className="text-center w-full max-w-sm space-y-8" style={{ fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif' }}>
            <div className="text-6xl animate-pulse">✨</div>
            <h1 className={`text-4xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} tracking-tight`}>Session Complete</h1>
            {streak > 0 && (
              <div className={`inline-block px-6 py-2 rounded-full ${darkMode ? 'bg-slate-700/60 border-slate-600/40' : 'bg-white/60 border-white/40'} backdrop-blur-xl border shadow-lg text-emerald-500 font-medium`}>
                {streak} day streak 🔥
              </div>
            )}
            
            {/* Total meditation time */}
            {totalTime > 0 && (
              <div className={`inline-block px-6 py-2 rounded-full ${darkMode ? 'bg-slate-700/60 border-slate-600/40' : 'bg-white/60 border-white/40'} backdrop-blur-xl border shadow-lg`}>
                <span className={`${darkMode ? 'text-slate-300' : 'text-gray-600'} text-sm font-medium`}>
                  Total: <span className={`${darkMode ? 'text-white' : 'text-gray-900'} font-bold`}>{formatTotalTime(totalTime)}</span>
                </span>
              </div>
            )}

            <div className="flex flex-col items-center gap-3">
              <div className={`flex items-center gap-3 px-6 py-4 rounded-3xl ${darkMode ? 'bg-slate-800/70 border-slate-700/50' : 'bg-white/70 border-white/50'} backdrop-blur-xl border shadow-2xl shadow-emerald-500/20 transition-all duration-700 ${checkAnimDone ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-emerald-500" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
                  <path d="M7 12.5l3.5 3.5 6-7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                    strokeDasharray="16" strokeDashoffset={checkAnimDone ? 0 : 16}
                    style={{ transition: 'stroke-dashoffset 0.6s ease 0.2s' }} />
                </svg>
                <span className={`${darkMode ? 'text-white' : 'text-gray-900'} text-sm font-semibold`}>Today — {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>

            <div className={`space-y-3 px-6 py-5 rounded-3xl ${darkMode ? 'bg-slate-800/50 border-slate-700/40' : 'bg-white/50 border-white/40'} backdrop-blur-xl border shadow-xl`}>
              <p className={`${darkMode ? 'text-slate-400' : 'text-gray-600'} text-xs uppercase tracking-widest font-semibold`}>Last 7 days</p>
              <div className="grid grid-cols-7 gap-2">
                {dates.map(({ str, label, done }) => {
                  const isToday = str === todayStr();
                  return (
                    <div key={str} className="flex flex-col items-center gap-1.5">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 ${done ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30' : darkMode ? 'bg-slate-700/60 backdrop-blur-sm border border-slate-600' : 'bg-white/60 backdrop-blur-sm border border-gray-200'} ${isToday && done ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}`}>
                        {done && (
                          <svg viewBox="0 0 14 14" className="w-5 h-5" fill="none">
                            <path d="M3 7l2.8 3 5-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                              strokeDasharray="12" strokeDashoffset={checkAnimDone ? 0 : 12}
                              style={{ transition: `stroke-dashoffset 0.5s ease ${isToday ? 0.4 : 0.2}s` }} />
                          </svg>
                        )}
                      </div>
                      <span className={`${darkMode ? 'text-slate-500' : 'text-gray-500'} text-xs font-medium`}>{new Date(str + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={resetSession}
              className={`px-10 py-4 ${darkMode ? 'bg-slate-700/70 border-slate-600/50 hover:bg-slate-600/70 text-white' : 'bg-white/70 border-white/50 hover:bg-white/90 text-gray-900'} backdrop-blur-xl border transition-all shadow-xl hover:shadow-2xl flex items-center gap-2 mx-auto font-medium rounded-full`}>
              <RotateCcw size={18} /> New Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Setup screen ──────────────────────────────────────────────────
  if (isSetup) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Animated ocean background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute inset-0 ${darkMode ? 'opacity-30' : 'opacity-40'}`}>
            <div className="absolute inset-0 bg-gradient-to-b from-blue-900/50 via-teal-800/50 to-cyan-900/50" />
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute bottom-0 left-0 right-0 h-32 rounded-full"
                style={{
                  background: `radial-gradient(ellipse at center, ${darkMode ? 'rgba(20, 184, 166, 0.15)' : 'rgba(20, 184, 166, 0.2)'} 0%, transparent 70%)`,
                  animation: `wave ${8 + i * 2}s ease-in-out infinite`,
                  animationDelay: `${i * 0.5}s`,
                  transform: `translateY(${i * 20}px)`,
                }}
              />
            ))}
          </div>
        </div>
        
        <style>{`
          @keyframes wave {
            0%, 100% { transform: translateX(-25%) translateY(0) scale(1); }
            50% { transform: translateX(25%) translateY(-10px) scale(1.1); }
          }
        `}</style>
        
        {/* Gradient overlay */}
        <div className={`absolute inset-0 ${darkMode ? 'bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90' : 'bg-gradient-to-br from-blue-50/90 via-purple-50/90 to-pink-50/90'}`} />

        {/* Control buttons - Top left corner */}
        <div className="fixed top-6 left-6 flex gap-3 z-50">
          <button
            onClick={toggleDarkMode}
            className={`p-4 rounded-full ${darkMode ? 'bg-slate-700/70 hover:bg-slate-600/70' : 'bg-white/50 hover:bg-white/70'} backdrop-blur-xl border ${darkMode ? 'border-slate-600/50' : 'border-white/60'} shadow-xl transition-all duration-300 ease-out hover:scale-110`}
          >
            {darkMode ? <Sun size={24} className="text-yellow-300 transition-all duration-300" /> : <Moon size={24} className="text-slate-700 transition-all duration-300" />}
          </button>
          <button
            onClick={toggleMusic}
            className={`p-4 rounded-full ${darkMode ? 'bg-slate-700/70 hover:bg-slate-600/70' : 'bg-white/50 hover:bg-white/70'} backdrop-blur-xl border ${darkMode ? 'border-slate-600/50' : 'border-white/60'} shadow-xl transition-all duration-300 ease-out hover:scale-110`}
          >
            {musicEnabled ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${darkMode ? 'text-emerald-400' : 'text-emerald-600'} transition-colors duration-300`}>
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${darkMode ? 'text-slate-400' : 'text-gray-500'} transition-colors duration-300`}>
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
                <line x1="2" y1="2" x2="22" y2="22"></line>
              </svg>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md space-y-4" style={{ fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif' }}>
            {/* Title card - Fixed height */}
            <div className={`text-center px-6 py-6 rounded-3xl ${darkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white/40 border-white/60'} backdrop-blur-2xl border shadow-2xl min-h-[140px] flex flex-col justify-center`}>
              <h1 className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} tracking-tight`}>One Breathing</h1>
              <p className={`${darkMode ? 'text-slate-300' : 'text-gray-700'} font-medium text-sm mt-1`}>A moment of calm</p>
              {isCompletedToday() && (
                <div className={`${darkMode ? 'text-emerald-400 bg-emerald-950/50' : 'text-emerald-600 bg-emerald-50/80'} text-xs font-semibold mt-2 inline-block px-3 py-1 rounded-full backdrop-blur-sm`}>
                  ✅ Completed today · {getStreak()} day streak
                </div>
              )}
            </div>

            {/* Duration slider - Horizontal draggable */}
            <div className={`px-6 pt-6 pb-4 rounded-3xl ${darkMode ? 'bg-slate-800/50 border-slate-700/60' : 'bg-white/50 border-white/60'} backdrop-blur-2xl border shadow-xl transition-all duration-300 min-h-[140px] flex flex-col justify-center`}>
              <label className={`block text-xs font-semibold ${darkMode ? 'text-slate-200' : 'text-gray-800'} tracking-wide mb-3`}>Breathing Duration</label>
              
              {/* Display value */}
              <div className="text-center mb-4">
                <span className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} tracking-tight`}>{duration}</span>
                <span className={`text-base ${darkMode ? 'text-slate-300' : 'text-gray-600'} ml-2 font-medium`}>{duration === 1 ? 'minute' : 'minutes'}</span>
              </div>

              {/* Horizontal slider */}
              <div className="relative px-2 py-1">
                <input 
                  type="range" 
                  min="1" 
                  max="60" 
                  step="1" 
                  value={duration}
                  onChange={e => setDuration(+e.target.value)}
                  className="w-full appearance-none cursor-pointer duration-slider-horizontal"
                  style={{ 
                    background: `linear-gradient(to right, 
                      ${darkMode ? 'rgba(16, 185, 129, 0.6)' : 'rgba(16, 185, 129, 0.7)'} 0%, 
                      ${darkMode ? 'rgba(20, 184, 166, 0.6)' : 'rgba(20, 184, 166, 0.7)'} ${((duration - 1) / 59) * 100}%, 
                      ${darkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.5)'} ${((duration - 1) / 59) * 100}%, 
                      ${darkMode ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.5)'} 100%)`,
                    height: '8px',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <style>{`
                .duration-slider-horizontal {
                  -webkit-appearance: none;
                  appearance: none;
                }
                .duration-slider-horizontal::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  appearance: none;
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
                  cursor: grab;
                  border: 3px solid rgba(255, 255, 255, 0.95);
                  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
                  transition: transform 0.2s ease, box-shadow 0.2s ease;
                  margin-top: -6px;
                }
                .duration-slider-horizontal::-webkit-slider-thumb:hover {
                  transform: scale(1.15);
                  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.6);
                }
                .duration-slider-horizontal::-webkit-slider-thumb:active {
                  cursor: grabbing;
                  transform: scale(1.1);
                  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.7);
                }
                .duration-slider-horizontal::-moz-range-thumb {
                  width: 20px;
                  height: 20px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
                  cursor: grab;
                  border: 3px solid rgba(255, 255, 255, 0.95);
                  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
                  transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .duration-slider-horizontal::-moz-range-thumb:hover {
                  transform: scale(1.15);
                  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.6);
                }
                .duration-slider-horizontal::-moz-range-thumb:active {
                  cursor: grabbing;
                  transform: scale(1.1);
                  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.7);
                }
                .duration-slider-horizontal::-webkit-slider-runnable-track {
                  height: 8px;
                  border-radius: 4px;
                }
                .duration-slider-horizontal::-moz-range-track {
                  height: 8px;
                  border-radius: 4px;
                  background: transparent;
                }
              `}</style>
            </div>

            {/* Breathing pattern dropdown - Matching padding */}
            <div className={`px-6 pt-6 pb-4 rounded-3xl ${darkMode ? 'bg-slate-800/50 border-slate-700/60' : 'bg-white/50 border-white/60'} backdrop-blur-2xl border shadow-xl transition-all duration-300 min-h-[140px] flex flex-col justify-center`}>
              <label className={`block text-xs font-semibold ${darkMode ? 'text-slate-200' : 'text-gray-800'} tracking-wide mb-3`}>Breathing Pattern</label>
              
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`w-full px-4 py-3 rounded-2xl ${darkMode ? 'bg-slate-700/80 border-slate-600/60 text-white hover:bg-slate-700' : 'bg-white/80 border-white/60 text-gray-900 hover:bg-white'} backdrop-blur-xl border flex items-center justify-between shadow-lg hover:shadow-xl transition-all duration-300`}
              >
                <div className="text-left flex-1">
                  <div className="font-bold text-base">{pattern.name}</div>
                  <div className={`text-xs ${darkMode ? 'text-slate-300' : 'text-gray-600'} mt-0.5 font-medium`}>{pattern.label}</div>
                  <div className={`text-xs mt-1 font-medium ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{pattern.benefit}</div>
                </div>
                <ChevronDown className={`transition-transform duration-500 ease-in-out ${darkMode ? 'text-slate-300' : 'text-gray-600'} ${dropdownOpen ? 'rotate-180' : ''} flex-shrink-0 ml-2`} size={18} />
              </button>

              {/* Dropdown menu */}
              <div 
                className={`overflow-hidden transition-all duration-500 ease-in-out ${dropdownOpen ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}
              >
                <div className={`rounded-2xl ${darkMode ? 'bg-slate-700/60 border-slate-600/40' : 'bg-white/60 border-white/40'} backdrop-blur-xl border shadow-lg space-y-1 p-2`}>
                  {BREATHING_PATTERNS.map((p, i) => (
                    <div 
                      key={i}
                      className={`transition-all duration-300 ease-out ${
                        dropdownOpen 
                          ? 'opacity-100 translate-y-0' 
                          : 'opacity-0 -translate-y-2'
                      }`}
                      style={{ 
                        transitionDelay: dropdownOpen ? `${i * 50}ms` : '0ms'
                      }}
                    >
                      <button
                        onClick={() => {
                          setPatternIndex(i);
                          setDropdownOpen(false);
                          setExpandedPatternInfo(null);
                        }}
                        className={`w-full px-4 py-3 rounded-xl text-left transition-all duration-300 ease-out flex items-center justify-between transform ${
                          i === patternIndex 
                            ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-white shadow-md scale-[1.02]' 
                            : darkMode 
                              ? 'hover:bg-slate-600/60 text-slate-200 hover:scale-[1.01]'
                              : 'hover:bg-gray-100/80 text-gray-700 hover:scale-[1.01]'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="font-bold text-sm">{p.name}</div>
                          <div className={`text-xs mt-0.5 font-medium ${i === patternIndex ? 'text-white/90' : darkMode ? 'text-slate-400' : 'text-gray-600'}`}>{p.label}</div>
                          <div className={`text-xs mt-1 font-medium ${i === patternIndex ? 'text-emerald-100' : darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{p.benefit}</div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedPatternInfo(expandedPatternInfo === i ? null : i);
                          }}
                          className={`p-2 rounded-lg transition-all duration-300 ease-out transform ${
                            expandedPatternInfo === i
                              ? i === patternIndex 
                                ? 'bg-white/20 text-white scale-110' 
                                : darkMode ? 'bg-slate-500/60 text-white scale-110' : 'bg-gray-200 text-gray-900 scale-110'
                              : i === patternIndex
                                ? 'hover:bg-white/10 text-white/80 hover:scale-105'
                                : darkMode ? 'hover:bg-slate-500/40 text-slate-400 hover:scale-105' : 'hover:bg-gray-200/60 text-gray-500 hover:scale-105'
                          }`}
                        >
                          <HelpCircle size={16} />
                        </button>
                      </button>
                      
                      {/* Info panel - slides down smoothly */}
                      <div 
                        className={`overflow-hidden transition-all duration-500 ease-in-out ${
                          expandedPatternInfo === i ? 'max-h-48 opacity-100 mt-1' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className={`mx-2 px-4 py-3 ${darkMode ? 'bg-slate-600/80 border-slate-500/60 text-slate-200' : 'bg-gray-50/80 border-gray-200/60 text-gray-700'} backdrop-blur-xl rounded-xl text-xs leading-relaxed border`}>
                          <p className="font-medium">{p.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={startSession}
              className={`w-full py-5 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-500 hover:to-teal-500 text-white rounded-full text-lg sm:text-xl font-bold transition-all duration-500 ease-out shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-500/60 hover:scale-[1.02] flex items-center justify-center gap-3 border ${darkMode ? 'border-emerald-300/20' : 'border-white/20'} backdrop-blur-sm`}>
              <Play size={22} fill="white" /> Start Breathing
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Session screen ────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated ocean background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute inset-0 ${darkMode ? 'opacity-30' : 'opacity-40'}`}>
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/50 via-teal-800/50 to-cyan-900/50" />
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute bottom-0 left-0 right-0 h-32 rounded-full"
              style={{
                background: `radial-gradient(ellipse at center, ${darkMode ? 'rgba(20, 184, 166, 0.15)' : 'rgba(20, 184, 166, 0.2)'} 0%, transparent 70%)`,
                animation: `wave ${8 + i * 2}s ease-in-out infinite`,
                animationDelay: `${i * 0.5}s`,
                transform: `translateY(${i * 20}px)`,
              }}
            />
          ))}
        </div>
      </div>
      
      <style>{`
        @keyframes wave {
          0%, 100% { transform: translateX(-25%) translateY(0) scale(1); }
          50% { transform: translateX(25%) translateY(-10px) scale(1.1); }
        }
      `}</style>

      {/* Gradient overlay */}
      <div className={`absolute inset-0 ${darkMode ? 'bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95' : 'bg-gradient-to-br from-blue-50/95 via-purple-50/95 to-pink-50/95'}`} />

      {/* Ambient gradient orbs */}
      <div className={`absolute top-20 left-20 w-96 h-96 ${darkMode ? 'bg-emerald-500/10' : 'bg-blue-300/20'} rounded-full blur-3xl`} />
      <div className={`absolute bottom-20 right-20 w-96 h-96 ${darkMode ? 'bg-teal-500/10' : 'bg-pink-300/20'} rounded-full blur-3xl`} />
      
      {/* Dark mode toggle - Fixed positioning */}
      <button
        onClick={toggleDarkMode}
        className={`fixed top-6 left-6 p-4 rounded-full ${darkMode ? 'bg-slate-700/70 hover:bg-slate-600/70' : 'bg-white/50 hover:bg-white/70'} backdrop-blur-xl border ${darkMode ? 'border-slate-600/50' : 'border-white/60'} shadow-xl transition-all duration-300 ease-out z-50 hover:scale-110`}
      >
        {darkMode ? <Sun size={24} className="text-yellow-300 transition-all duration-300" /> : <Moon size={24} className="text-slate-700 transition-all duration-300" />}
      </button>

      {/* Music toggle button */}
      <button
        onClick={toggleMusic}
        className={`fixed top-6 left-24 p-4 rounded-full ${darkMode ? 'bg-slate-700/70 hover:bg-slate-600/70' : 'bg-white/50 hover:bg-white/70'} backdrop-blur-xl border ${darkMode ? 'border-slate-600/50' : 'border-white/60'} shadow-xl transition-all duration-300 ease-out z-50 hover:scale-110`}
      >
        {musicEnabled ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${darkMode ? 'text-emerald-400' : 'text-emerald-600'} transition-colors duration-300`}>
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${darkMode ? 'text-slate-400' : 'text-gray-500'} transition-colors duration-300`}>
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
            <line x1="2" y1="2" x2="22" y2="22"></line>
          </svg>
        )}
      </button>

      {/* Reset button */}
      <button onClick={resetSession} className={`fixed top-6 right-6 ${darkMode ? 'text-slate-300 hover:text-white bg-slate-700/70 border-slate-600/60 hover:bg-slate-600/70' : 'text-gray-700 hover:text-gray-900 bg-white/50 border-white/60 hover:bg-white/70'} transition-all duration-300 ease-out z-50 p-4 rounded-full backdrop-blur-xl border shadow-xl hover:scale-110`}>
        <X size={24} className="transition-transform duration-300" />
      </button>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6" style={{ fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif' }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="relative">
            {/* Glow effect */}
            <div 
              className="absolute inset-0 rounded-full blur-3xl opacity-60"
              style={{
                background: darkMode 
                  ? 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(16,185,129,0.4) 0%, transparent 70%)',
                transform: `scale(${circleScale * 1.5})`,
                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
            
            {/* Main breathing circle */}
            <div
              className="w-72 h-72 rounded-full relative shadow-2xl"
              style={{
                background: darkMode
                  ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.7) 0%, rgba(14, 165, 233, 0.7) 50%, rgba(168, 85, 247, 0.5) 100%)'
                  : 'linear-gradient(135deg, rgba(52, 211, 153, 0.9) 0%, rgba(14, 165, 233, 0.9) 50%, rgba(168, 85, 247, 0.7) 100%)',
                transform: `scale(${circleScale})`,
                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: 'blur(40px)',
                border: darkMode ? '2px solid rgba(255, 255, 255, 0.15)' : '2px solid rgba(255, 255, 255, 0.3)',
              }}
            />
            
            {/* Inner glass reflection */}
            <div 
              className="absolute top-0 left-0 w-full h-full rounded-full pointer-events-none"
              style={{
                background: darkMode 
                  ? 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 50%)'
                  : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 50%)',
                transform: `scale(${circleScale})`,
                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
        </div>

        <div className="space-y-5 text-center pb-12">
          <div className={`px-8 py-3 rounded-full ${darkMode ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/60 border-white/50'} backdrop-blur-xl border shadow-xl inline-block`}>
            <div className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} capitalize tracking-tight`}>{phase}</div>
          </div>
          <div className={`px-10 py-5 rounded-3xl ${darkMode ? 'bg-slate-800/50 border-slate-700/40' : 'bg-white/50 border-white/40'} backdrop-blur-xl border shadow-2xl`}>
            <div className={`text-6xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} tracking-tight`}>{formatTime(timeLeft)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
