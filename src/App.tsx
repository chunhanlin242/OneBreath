import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, HelpCircle, X, ChevronDown, Sun, Moon } from 'lucide-react';

const BREATHING_PATTERNS = [
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

const App = () => {
  const [isSetup, setIsSetup] = useState(true);
  const [duration, setDuration] = useState(5);
  const [patternIndex, setPatternIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [phase, setPhase] = useState('inhale');
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showPatternInfo, setShowPatternInfo] = useState(false);
  const [checkAnimDone, setCheckAnimDone] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('breath_only_dark_mode');
    return saved ? JSON.parse(saved) : true; // Default to dark mode
  });

  const audioCtxRef = useRef(null);
  const noiseSourceRef = useRef(null);
  const masterGainRef = useRef(null);
  const lfoRef = useRef(null);
  const tickRef = useRef(null);
  const sessionStartRef = useRef(null);
  const pianoAudioRef = useRef(null);
  const videoRef = useRef(null);

  const pattern = BREATHING_PATTERNS[patternIndex];

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('breath_only_dark_mode', JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // ── Storage helpers ──────────────────────────────────────────────
  const getCompletions = () => {
    try { return JSON.parse(localStorage.getItem('breath_only_completions') || '[]'); }
    catch { return []; }
  };
  const todayStr = () => new Date().toISOString().split('T')[0];
  const isCompletedToday = () => getCompletions().includes(todayStr());

  const markComplete = () => {
    const list = getCompletions();
    const t = todayStr();
    if (!list.includes(t)) {
      list.push(t);
      localStorage.setItem('breath_only_completions', JSON.stringify(list));
    }
  };

  const getStreak = () => {
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

  const getRecentDates = () => {
    const completions = getCompletions();
    const dates = [];
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
    if (isSetup && !pianoAudioRef.current) {
      const initPiano = () => {
        if (!audioCtxRef.current) {
          const AC = window.AudioContext || window.webkitAudioContext;
          audioCtxRef.current = new AC();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const masterGain = ctx.createGain();
        masterGain.gain.value = 0.15;
        masterGain.connect(ctx.destination);

        const notes = [261.63, 293.66, 329.63, 392.00, 440.00];
        const playNote = (freq, delay, duration) => {
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
        const loop = () => {
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

      const handleInteraction = () => {
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
  }, [isSetup]);

  useEffect(() => {
    if (!isSetup && pianoAudioRef.current) {
      const { masterGain } = pianoAudioRef.current;
      if (masterGain) {
        masterGain.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 1);
      }
      pianoAudioRef.current = null;
    }
  }, [isSetup]);

  // ── Audio engine ─────────────────────────────────────────────────
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AC();
    }
  };

  const buildOceanNoise = (ctx) => {
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

  const startTideSound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const { masterGain, sources, lfo } = buildOceanNoise(ctx);
    masterGain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 2.5);

    masterGainRef.current = masterGain;
    noiseSourceRef.current = sources;
    lfoRef.current = lfo;
  };

  const modulateOcean = (currentPhase, progress) => {
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

  const stopTideSound = () => {
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

  const playSingingBowl = () => {
    if (!audioCtxRef.current) return;
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
  const startSession = () => {
    initAudio();
    setIsSetup(false);
    setIsActive(true);
    setTimeLeft(duration * 60);
    setPhase('inhale');
    setPhaseProgress(0);
    sessionStartRef.current = Date.now();
    setTimeout(startTideSound, 120);
  };

  const resetSession = () => {
    clearInterval(tickRef.current);
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

    const tick = () => {
      const elapsed = (Date.now() - sessionStartRef.current) / 1000;
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
      let p, prog;
      
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
    return () => clearInterval(tickRef.current);
  }, [isActive, duration, pattern]);

  const formatTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  
  const circleScale = 
    phase === 'inhale' ? 0.38 + phaseProgress * 0.62 :
    phase === 'hold' ? 1.0 :
    1 - phaseProgress * 0.62;

  // ── Completion screen ─────────────────────────────────────────────
  if (showCompletion) {
    const streak = getStreak();
    const dates = getRecentDates();
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

        {/* Dark mode toggle - Fixed positioning */}
        <button
          onClick={toggleDarkMode}
          className={`fixed top-6 left-6 p-4 rounded-full ${darkMode ? 'bg-slate-700/70 hover:bg-slate-600/70' : 'bg-white/50 hover:bg-white/70'} backdrop-blur-xl border ${darkMode ? 'border-slate-600/50' : 'border-white/60'} shadow-xl transition-all z-50`}
        >
          {darkMode ? <Sun size={24} className="text-yellow-300" /> : <Moon size={24} className="text-slate-700" />}
        </button>

        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <div className="text-center w-full max-w-sm space-y-8">
            <div className="text-6xl animate-pulse">✨</div>
            <h1 className={`text-4xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'} tracking-tight`}>Session Complete</h1>
            {streak > 0 && (
              <div className={`inline-block px-6 py-2 rounded-full ${darkMode ? 'bg-slate-700/60 border-slate-600/40' : 'bg-white/60 border-white/40'} backdrop-blur-xl border shadow-lg text-emerald-500 font-medium`}>
                {streak} day streak 🔥
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

        {/* Dark mode toggle - Fixed positioning */}
        <button
          onClick={toggleDarkMode}
          className={`fixed top-6 left-6 p-4 rounded-full ${darkMode ? 'bg-slate-700/70 hover:bg-slate-600/70' : 'bg-white/50 hover:bg-white/70'} backdrop-blur-xl border ${darkMode ? 'border-slate-600/50' : 'border-white/60'} shadow-xl transition-all z-50`}
        >
          {darkMode ? <Sun size={24} className="text-yellow-300" /> : <Moon size={24} className="text-slate-700" />}
        </button>

        {/* Content */}
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-8">
            <div className={`text-center space-y-2 px-8 py-6 rounded-3xl ${darkMode ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white/40 border-white/60'} backdrop-blur-2xl border shadow-2xl`}>
              <h1 className={`text-5xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'} tracking-tight`}>OneBreath</h1>
              <p className={`${darkMode ? 'text-slate-300' : 'text-gray-700'} font-medium`}>A moment of calm</p>
              {isCompletedToday() && (
                <div className={`${darkMode ? 'text-emerald-400 bg-emerald-950/50' : 'text-emerald-600 bg-emerald-50/80'} text-sm font-semibold pt-2 inline-block px-4 py-1.5 rounded-full backdrop-blur-sm`}>
                  ✅ Completed today · {getStreak()} day streak
                </div>
              )}
            </div>

            {/* Duration slider */}
            <div className={`space-y-4 px-8 py-6 rounded-3xl ${darkMode ? 'bg-slate-800/50 border-slate-700/60' : 'bg-white/50 border-white/60'} backdrop-blur-2xl border shadow-xl`}>
              <label className={`block text-sm font-semibold ${darkMode ? 'text-slate-200' : 'text-gray-800'} tracking-wide`}>Duration</label>
              <input type="range" min="1" max="60" step="1" value={duration}
                onChange={e => setDuration(+e.target.value)}
                className="w-full h-3 rounded-full appearance-none cursor-pointer"
                style={{ 
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${((duration-1)/59)*100}%, ${darkMode ? 'rgba(51,65,85,0.5)' : 'rgba(255,255,255,0.5)'} ${((duration-1)/59)*100}%, ${darkMode ? 'rgba(51,65,85,0.5)' : 'rgba(255,255,255,0.5)'} 100%)`,
                }}
              />
              <div className={`text-center px-6 py-3 rounded-2xl ${darkMode ? 'bg-slate-700/60 border-slate-600/40' : 'bg-white/60 border-white/40'} backdrop-blur-sm border shadow-lg`}>
                <span className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{duration}</span>
                <span className={`text-lg ${darkMode ? 'text-slate-300' : 'text-gray-600'} ml-2 font-medium`}>{duration === 1 ? 'minute' : 'minutes'}</span>
              </div>
            </div>

            {/* Breathing pattern dropdown */}
            <div className={`space-y-4 px-8 py-6 rounded-3xl ${darkMode ? 'bg-slate-800/50 border-slate-700/60' : 'bg-white/50 border-white/60'} backdrop-blur-2xl border shadow-xl`}>
              <label className={`block text-sm font-semibold ${darkMode ? 'text-slate-200' : 'text-gray-800'} tracking-wide`}>Breathing Pattern</label>
              
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`w-full px-6 py-5 rounded-2xl ${darkMode ? 'bg-slate-700/80 border-slate-600/60 text-white hover:bg-slate-700' : 'bg-white/80 border-white/60 text-gray-900 hover:bg-white'} backdrop-blur-xl border flex items-center justify-between shadow-lg hover:shadow-xl transition-all`}
              >
                <div className="text-left">
                  <div className="font-bold text-lg">{pattern.name}</div>
                  <div className={`text-xs ${darkMode ? 'text-slate-300' : 'text-gray-600'} mt-1 font-medium`}>{pattern.label} • {pattern.benefit}</div>
                </div>
                <ChevronDown className={`transition-transform ${darkMode ? 'text-slate-300' : 'text-gray-600'} ${dropdownOpen ? 'rotate-180' : ''}`} size={22} />
              </button>

              {dropdownOpen && (
                <div className={`space-y-2 ${darkMode ? 'bg-slate-800/70 border-slate-700/60' : 'bg-white/70 border-white/60'} backdrop-blur-2xl rounded-2xl p-3 border shadow-2xl`}>
                  {BREATHING_PATTERNS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setPatternIndex(i);
                        setDropdownOpen(false);
                      }}
                      className={`w-full px-5 py-4 rounded-xl text-left transition-all ${
                        i === patternIndex 
                          ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-white shadow-lg shadow-emerald-500/30' 
                          : darkMode 
                            ? 'bg-slate-700/60 text-slate-200 hover:bg-slate-700 border border-slate-600/40'
                            : 'bg-white/60 text-gray-700 hover:bg-white/90 border border-white/40'
                      }`}
                    >
                      <div className="font-bold">{p.name}</div>
                      <div className={`text-xs mt-1 font-medium ${i === patternIndex ? 'text-white/90' : darkMode ? 'text-slate-400' : 'text-gray-600'}`}>{p.label}</div>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowPatternInfo(!showPatternInfo)}
                className={`flex items-center gap-2 ${darkMode ? 'text-slate-300 hover:text-white bg-slate-700/50 border-slate-600/40 hover:bg-slate-700/70' : 'text-gray-700 hover:text-gray-900 bg-white/50 border-white/40 hover:bg-white/70'} transition-colors text-sm font-medium px-4 py-2 rounded-xl backdrop-blur-sm border`}
              >
                <HelpCircle size={16} />
                <span>About this pattern</span>
              </button>

              {showPatternInfo && (
                <div className={`px-5 py-4 ${darkMode ? 'bg-slate-800/80 border-slate-700/60 text-slate-200' : 'bg-white/80 border-white/60 text-gray-700'} backdrop-blur-xl rounded-2xl text-sm leading-relaxed border shadow-xl`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-gray-900'} text-base`}>{pattern.name}</h3>
                    <button onClick={() => setShowPatternInfo(false)} className={`${darkMode ? 'text-slate-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                      <X size={18} />
                    </button>
                  </div>
                  <p className="font-medium">{pattern.description}</p>
                </div>
              )}
            </div>

            <button onClick={startSession}
              className={`w-full py-6 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-500 hover:to-teal-500 text-white rounded-full text-xl font-bold transition-all shadow-2xl shadow-emerald-500/40 hover:shadow-emerald-500/60 hover:scale-[1.02] flex items-center justify-center gap-3 border ${darkMode ? 'border-emerald-300/20' : 'border-white/20'} backdrop-blur-sm`}>
              <Play size={24} fill="white" /> Start Session
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
        className={`fixed top-6 left-6 p-4 rounded-full ${darkMode ? 'bg-slate-700/70 hover:bg-slate-600/70' : 'bg-white/50 hover:bg-white/70'} backdrop-blur-xl border ${darkMode ? 'border-slate-600/50' : 'border-white/60'} shadow-xl transition-all z-50`}
      >
        {darkMode ? <Sun size={24} className="text-yellow-300" /> : <Moon size={24} className="text-slate-700" />}
      </button>

      <button onClick={resetSession} className={`absolute top-6 right-6 ${darkMode ? 'text-slate-300 hover:text-white bg-slate-700/50 border-slate-600/60 hover:bg-slate-600/70' : 'text-gray-700 hover:text-gray-900 bg-white/50 border-white/60 hover:bg-white/70'} transition-colors z-10 p-3 rounded-full backdrop-blur-sm border shadow-lg`}>
        <RotateCcw size={22} />
      </button>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
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
                transition: 'transform 0.12s ease-out'
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
                transition: 'transform 0.12s ease-out',
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
                transition: 'transform 0.12s ease-out',
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