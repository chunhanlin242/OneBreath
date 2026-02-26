import React, { useState, useEffect, useRef } from 'react';
import { Play, Sun, Moon, Volume2, VolumeX, Clock, Bell, Home, X, ChevronUp, Settings as SettingsIcon } from 'lucide-react';

// --- 模式定義：詳細描述步驟 ---
interface BreathingPattern {
  name: string;
  label: string;
  inhale: number;
  hold: number;
  exhale: number;
  description: string;
}

const BREATHING_PATTERNS: BreathingPattern[] = [
  { 
    name: 'Balanced Breath', 
    label: '4秒吸氣 - 4秒吐氣', 
    inhale: 4, hold: 0, exhale: 4, 
    description: '等比吸吐能穩定神經系統，最適合初學者，能在不憋氣的情況下提升專注力。' 
  },
  { 
    name: 'Extended Exhale', 
    label: '4秒吸氣 - 6秒吐氣', 
    inhale: 4, hold: 0, exhale: 6, 
    description: '長吐氣能啟動副交感神經，告訴身體進入休息狀態，適合快速減輕壓力。' 
  },
  { 
    name: '4-7-8 Breathing', 
    label: '4秒吸氣 - 7秒憋氣 - 8秒吐氣', 
    inhale: 4, hold: 7, exhale: 8, 
    description: '被譽為神經系統的天然安眠藥。透過長時間憋氣與吐氣，達到極度深度放鬆。' 
  },
  { 
    name: 'Resonant Breath', 
    label: '5秒吸氣 - 5秒吐氣', 
    inhale: 5, hold: 0, exhale: 5, 
    description: '每分鐘呼吸 6 次，讓呼吸與心跳韻律同步（心臟共振），能平衡情緒與心血管系統。' 
  },
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'home' | 'settings'>('home');
  const [isSetupOpen, setIsSetupOpen] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(5);
  const [patternIndex, setPatternIndex] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [phaseProgress, setPhaseProgress] = useState<number>(0);
  const [showCompletion, setShowCompletion] = useState<boolean>(false);
  
  const [darkMode, setDarkMode] = useState<boolean>(() => JSON.parse(localStorage.getItem('breath_dark') || 'true'));
  const [musicEnabled, setMusicEnabled] = useState<boolean>(() => JSON.parse(localStorage.getItem('breath_music') || 'true'));
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(() => JSON.parse(localStorage.getItem('breath_remind') || 'false'));
  const [reminderTime, setReminderTime] = useState<string>(() => localStorage.getItem('breath_time') || '08:00');

  // 音頻 Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  const pattern = BREATHING_PATTERNS[patternIndex];

  useEffect(() => {
    localStorage.setItem('breath_dark', JSON.stringify(darkMode));
    localStorage.setItem('breath_music', JSON.stringify(musicEnabled));
    localStorage.setItem('breath_remind', JSON.stringify(reminderEnabled));
    localStorage.setItem('breath_time', reminderTime);
  }, [darkMode, musicEnabled, reminderEnabled, reminderTime]);

  // --- 海浪音效引擎 ---
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const startOceanSound = () => {
    if (!audioCtxRef.current || !musicEnabled) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1; // 白噪音
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start();
    noiseNodeRef.current = noise;
    gainNodeRef.current = gain;
  };

  const stopOceanSound = () => {
    if (gainNodeRef.current && audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      gainNodeRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
      setTimeout(() => {
        noiseNodeRef.current?.stop();
        noiseNodeRef.current = null;
        gainNodeRef.current = null;
      }, 1000);
    }
  };

  // 隨呼吸調整音量
  useEffect(() => {
    if (isActive && gainNodeRef.current && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      let volume = 0.05;
      if (phase === 'inhale') volume = 0.1 + (phaseProgress * 0.3);
      else if (phase === 'hold') volume = 0.4;
      else volume = 0.4 - (phaseProgress * 0.3);
      gainNodeRef.current.gain.linearRampToValueAtTime(Math.max(0.02, volume), now + 0.1);
    }
  }, [phase, phaseProgress, isActive]);

  // --- 練習邏輯 ---
  const startSession = () => {
    initAudio();
    setIsSetupOpen(false);
    setIsActive(true);
    setTimeLeft(duration * 60);
    sessionStartRef.current = Date.now();
    if (musicEnabled) setTimeout(startOceanSound, 200);
  };

  useEffect(() => {
    if (!isActive) return;
    const tick = () => {
      const elapsed = (Date.now() - sessionStartRef.current!) / 1000;
      const remaining = Math.max(0, duration * 60 - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setIsActive(false); stopOceanSound(); setShowCompletion(true);
        return;
      }
      const cycle = pattern.inhale + pattern.hold + pattern.exhale;
      const pos = elapsed % cycle;
      let p: 'inhale' | 'hold' | 'exhale', prog: number;
      if (pos < pattern.inhale) { p = 'inhale'; prog = pos / pattern.inhale; }
      else if (pos < pattern.inhale + pattern.hold) { p = 'hold'; prog = (pos - pattern.inhale) / pattern.hold; }
      else { p = 'exhale'; prog = (pos - pattern.inhale - pattern.hold) / pattern.exhale; }
      setPhase(p); setPhaseProgress(prog);
    };
    tickRef.current = setInterval(tick, 100);
    return () => clearInterval(tickRef.current!);
  }, [isActive, duration, pattern]);

  const circleScale = phase === 'inhale' ? 0.4 + (phaseProgress * 0.6) : phase === 'hold' ? 1.0 : 1.0 - (phaseProgress * 0.6);

  return (
    <div className={`min-h-screen transition-colors duration-500 font-sans ${darkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* 練習中 */}
      {isActive && (
        <div className="fixed inset-0 z-[200] bg-inherit flex flex-col items-center justify-center p-6">
          <div className="text-center mb-12">
            <p className="text-emerald-500 tracking-[0.3em] uppercase font-black mb-2 animate-pulse">
              {phase === 'inhale' ? '吸氣' : phase === 'hold' ? '憋氣' : '吐氣'}
            </p>
            <p className="text-5xl font-light opacity-80">{Math.floor(timeLeft / 60)}:{String(Math.floor(timeLeft % 60)).padStart(2, '0')}</p>
          </div>
          <div className="relative w-72 h-72 flex items-center justify-center transition-transform duration-[100ms] ease-linear" style={{ transform: `scale(${circleScale})` }}>
            <div className={`absolute inset-0 rounded-full blur-3xl opacity-20 ${darkMode ? 'bg-emerald-400' : 'bg-emerald-600'}`} />
            <div className={`w-full h-full rounded-full border-2 ${darkMode ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-emerald-500/20 bg-emerald-500/5'} backdrop-blur-md`} />
          </div>
          <button onClick={() => { setIsActive(false); stopOceanSound(); }} className="mt-16 p-4 opacity-40 hover:opacity-100"><X size={32} /></button>
        </div>
      )}

      {/* 完成 */}
      {showCompletion && (
        <div className="fixed inset-0 z-[210] bg-inherit flex flex-col items-center justify-center text-center p-6 animate-in fade-in">
          <div className="text-7xl mb-6">🌊</div>
          <h2 className="text-3xl font-bold mb-4">平靜達成</h2>
          <button onClick={() => setShowCompletion(false)} className="px-10 py-4 bg-emerald-500 text-white rounded-full font-bold shadow-xl">回到首頁</button>
        </div>
      )}

      {/* 主畫面 */}
      <main className="max-w-md mx-auto p-8 pt-20">
        {currentView === 'home' ? (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <h1 className="text-5xl font-black tracking-tighter mb-4 leading-none">Breathe.<br/><span className="text-emerald-500">Only.</span></h1>
            <p className="text-lg opacity-50 mb-12">深呼吸，讓世界慢下來。</p>
            
            <div className={`p-8 rounded-[40px] border-2 transition-all cursor-pointer active:scale-95 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-white shadow-sm'}`} onClick={() => setIsSetupOpen(true)}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">當前選擇</span>
                <ChevronUp size={16} />
              </div>
              <h3 className="text-2xl font-bold mb-1">{pattern.name}</h3>
              <p className="text-xs text-emerald-500 font-bold mb-3">{pattern.label}</p>
              <p className="opacity-60 text-sm leading-relaxed">{pattern.description}</p>
            </div>

            <button onClick={startSession} className="w-full mt-6 py-6 bg-emerald-500 text-white rounded-[40px] font-bold text-xl shadow-2xl shadow-emerald-500/30 flex items-center justify-center gap-3 active:scale-95 transition-transform">
              <Play fill="white" size={24} /> 開始練習
            </button>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <h2 className="text-3xl font-bold mb-8">設定</h2>
            <div className={`rounded-[32px] overflow-hidden ${darkMode ? 'bg-slate-900' : 'bg-white shadow-sm'}`}>
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500"><Bell size={24} /></div>
                  <p className="font-bold">每日提醒</p>
                </div>
                <button onClick={() => setReminderEnabled(!reminderEnabled)} className={`w-14 h-8 rounded-full transition-all relative ${reminderEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${reminderEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
              {reminderEnabled && (
                <div className="px-6 pb-8">
                  <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="w-full bg-transparent text-4xl font-light text-center focus:outline-none" />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* --- 浮動選單 (Bottom Sheet) --- */}
      {/* 背景遮罩 */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] transition-opacity duration-300 ${isSetupOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setIsSetupOpen(false)} 
      />
      {/* 選單主體 */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-[160] rounded-t-[48px] p-8 pb-12 transition-transform duration-500 ease-out transform ${darkMode ? 'bg-slate-900 border-t border-slate-800' : 'bg-white'} ${isSetupOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div className="w-12 h-1.5 bg-slate-500/30 rounded-full mx-auto mb-8" />
        <h2 className="text-2xl font-bold mb-6 text-center">呼吸模式</h2>
        
        <div className="space-y-6">
          <div className="space-y-3">
            {BREATHING_PATTERNS.map((p, i) => (
              <button key={p.name} onClick={() => setPatternIndex(i)} className={`w-full p-5 rounded-3xl text-left border-2 transition-all ${patternIndex === i ? 'border-emerald-500 bg-emerald-500/5' : 'border-transparent bg-slate-500/5'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-lg">{p.name}</span>
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">選擇</span>
                </div>
                <p className="text-xs text-emerald-500 font-bold mb-2">{p.label}</p>
                <p className="text-sm opacity-50 leading-relaxed">{p.description}</p>
              </button>
            ))}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-3 block">練習時長 (分鐘)</label>
            <div className="flex items-center gap-4 bg-slate-500/5 p-2 rounded-[32px]">
              <button onClick={() => setDuration(Math.max(1, duration - 1))} className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold">-</button>
              <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="flex-1 bg-transparent text-center text-2xl font-black focus:outline-none" />
              <button onClick={() => setDuration(duration + 1)} className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold">+</button>
            </div>
          </div>

          <button onClick={() => setIsSetupOpen(false)} className="w-full py-5 bg-emerald-500 text-white rounded-[32px] font-bold shadow-xl active:scale-95 transition-transform">完成並關閉</button>
        </div>
      </div>

      {/* 底部導覽列 */}
      <nav className={`fixed bottom-0 left-0 right-0 h-24 border-t flex items-center justify-around px-4 backdrop-blur-xl z-50 transition-colors ${darkMode ? 'bg-slate-950/80 border-slate-900 text-slate-500' : 'bg-white/90 border-slate-100 text-slate-400'}`}>
        <button onClick={() => setCurrentView('home')} className={`flex flex-col items-center gap-1 flex-1 ${currentView === 'home' ? 'text-emerald-500' : ''}`}>
          <Home size={22} strokeWidth={currentView === 'home' ? 3 : 2} />
          <span className="text-[10px] font-bold">首頁</span>
        </button>
        <button onClick={() => setMusicEnabled(!musicEnabled)} className={`flex flex-col items-center gap-1 flex-1 ${musicEnabled ? 'text-emerald-500' : ''}`}>
          {musicEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
          <span className="text-[10px] font-bold">音效</span>
        </button>
        <button onClick={() => setDarkMode(!darkMode)} className={`flex flex-col items-center gap-1 flex-1 ${darkMode ? 'text-yellow-400' : ''}`}>
          {darkMode ? <Sun size={22} /> : <Moon size={22} />}
          <span className="text-[10px] font-bold">模式</span>
        </button>
        <button onClick={() => setCurrentView('settings')} className={`flex flex-col items-center gap-1 flex-1 ${currentView === 'settings' ? 'text-emerald-500' : ''}`}>
          <SettingsIcon size={22} strokeWidth={currentView === 'settings' ? 3 : 2} />
          <span className="text-[10px] font-bold">設定</span>
        </button>
      </nav>
    </div>
  );
};

export default App;