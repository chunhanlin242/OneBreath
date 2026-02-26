import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, HelpCircle, Sun, Moon, Volume2, VolumeX, Clock, Bell, Home, X, ChevronUp, Settings as SettingsIcon } from 'lucide-react';

// --- 介面定義 ---
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
    label: '4-0-4', 
    inhale: 4, hold: 0, exhale: 4, 
    description: '等比吸吐能穩定神經系統，最適合初學者，能在不憋氣的情況下提升專注力。' 
  },
  { 
    name: 'Extended Exhale', 
    label: '4-0-6', 
    inhale: 4, hold: 0, exhale: 6, 
    description: '長吐氣能啟動副交感神經，告訴身體進入休息狀態，適合快速減輕壓力。' 
  },
  { 
    name: '4-7-8 Breathing', 
    label: '4-7-8', 
    inhale: 4, hold: 7, exhale: 8, 
    description: '被譽為神經系統的天然安眠藥。透過長時間憋氣與吐氣，達到極度深度放鬆。' 
  },
  { 
    name: 'Resonant Breath', 
    label: '5-0-5', 
    inhale: 5, hold: 0, exhale: 5, 
    description: '每分鐘呼吸 6 次，讓呼吸與心跳韻律同步（心臟共振），能平衡情緒與心血管系統。' 
  },
];

const App: React.FC = () => {
  // --- 狀態管理 ---
  const [currentView, setCurrentView] = useState<'home' | 'settings'>('home');
  const [isSetupOpen, setIsSetupOpen] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(5);
  const [patternIndex, setPatternIndex] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [phaseProgress, setPhaseProgress] = useState<number>(0);
  const [showCompletion, setShowCompletion] = useState<boolean>(false);
  
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('breath_only_dark_mode');
    return saved ? JSON.parse(saved) : true;
  });
  const [musicEnabled, setMusicEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('breath_only_music_enabled');
    return saved ? JSON.parse(saved) : true;
  });
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('breath_only_reminder_enabled');
    return saved ? JSON.parse(saved) : false;
  });
  const [reminderTime, setReminderTime] = useState<string>(() => {
    return localStorage.getItem('breath_only_reminder_time') || '08:00';
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  const pattern = BREATHING_PATTERNS[patternIndex];

  useEffect(() => localStorage.setItem('breath_only_dark_mode', JSON.stringify(darkMode)), [darkMode]);
  useEffect(() => localStorage.setItem('breath_only_music_enabled', JSON.stringify(musicEnabled)), [musicEnabled]);
  useEffect(() => localStorage.setItem('breath_only_reminder_enabled', JSON.stringify(reminderEnabled)), [reminderEnabled]);
  useEffect(() => localStorage.setItem('breath_only_reminder_time', reminderTime), [reminderTime]);

  const startSession = () => {
    if (!audioCtxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    setIsSetupOpen(false);
    setIsActive(true);
    setTimeLeft(duration * 60);
    sessionStartRef.current = Date.now();
  };

  useEffect(() => {
    if (!isActive) return;
    const tick = () => {
      const elapsed = (Date.now() - sessionStartRef.current!) / 1000;
      const remaining = Math.max(0, duration * 60 - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setIsActive(false); setShowCompletion(true);
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
      
      {/* 1. 練習中介面 */}
      {isActive && (
        <div className="fixed inset-0 z-[100] bg-inherit flex flex-col items-center justify-center p-6">
          <div className="text-center mb-12">
            <p className="text-emerald-500 tracking-[0.3em] uppercase font-black mb-2">{phase}</p>
            <p className="text-5xl font-light opacity-80">{Math.floor(timeLeft / 60)}:{String(Math.floor(timeLeft % 60)).padStart(2, '0')}</p>
          </div>
          <div className="relative w-72 h-72 flex items-center justify-center transition-transform duration-[100ms] ease-linear" style={{ transform: `scale(${circleScale})` }}>
            <div className={`absolute inset-0 rounded-full blur-3xl opacity-20 ${darkMode ? 'bg-emerald-400' : 'bg-emerald-600'}`} />
            <div className={`w-full h-full rounded-full border-2 ${darkMode ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-emerald-500/20 bg-emerald-500/5'} backdrop-blur-md`} />
          </div>
          <button onClick={() => setIsActive(false)} className="mt-16 p-4 opacity-40 hover:opacity-100 transition-opacity"><X size={32} /></button>
        </div>
      )}

      {/* 2. 完成畫面 */}
      {showCompletion && (
        <div className="fixed inset-0 z-[110] bg-inherit flex flex-col items-center justify-center text-center p-6">
          <div className="text-7xl mb-6">✨</div>
          <h2 className="text-3xl font-bold mb-4">身心已重整</h2>
          <p className="opacity-60 mb-10">深呼吸的力量將伴隨你的每一步。</p>
          <button onClick={() => setShowCompletion(false)} className="px-10 py-4 bg-emerald-500 text-white rounded-full font-bold shadow-xl">回到首頁</button>
        </div>
      )}

      {/* 3. 主頁面內容 */}
      <main className="max-w-md mx-auto p-8 pt-20">
        {currentView === 'home' ? (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <h1 className="text-5xl font-black tracking-tighter mb-4 leading-none">One.<br/><span className="text-emerald-500">Breathe.</span></h1>
            <p className="text-lg opacity-50 mb-12">給自己幾分鐘，找回內在平靜。</p>
            
            {/* 當前設定卡片 (增加介紹內容) */}
            <div className={`p-8 rounded-[40px] border-2 transition-all cursor-pointer ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-white shadow-sm'}`} onClick={() => setIsSetupOpen(true)}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">當前設定</span>
                <ChevronUp className="animate-bounce" size={16} />
              </div>
              <h3 className="text-2xl font-bold mb-1">{pattern.name}</h3>
              <p className="text-xs opacity-40 font-medium mb-3">{pattern.label} • {duration} 分鐘</p>
              <p className="opacity-60 text-sm leading-relaxed">{pattern.description}</p>
            </div>

            <button onClick={startSession} className="w-full mt-6 py-6 bg-emerald-500 text-white rounded-[40px] font-bold text-xl shadow-2xl shadow-emerald-500/30 flex items-center justify-center gap-3 active:scale-95 transition-transform">
              <Play fill="white" size={24} /> 開始練習
            </button>
          </div>
        ) : (
          /* 設定頁面 */
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-700">
            <h2 className="text-3xl font-bold mb-8">設定</h2>
            <div className={`rounded-[32px] overflow-hidden ${darkMode ? 'bg-slate-900' : 'bg-white shadow-sm'}`}>
              <div className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500"><Bell size={24} /></div>
                  <div>
                    <p className="font-bold">每日提醒</p>
                    <p className="text-xs opacity-50">{reminderEnabled ? '已開啟通知' : '已關閉'}</p>
                  </div>
                </div>
                <button onClick={() => setReminderEnabled(!reminderEnabled)} className={`w-14 h-8 rounded-full transition-all relative ${reminderEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${reminderEnabled ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {reminderEnabled && (
                <div className="px-6 pb-8 animate-in fade-in slide-in-from-top-2">
                  <div className={`p-6 rounded-3xl ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-4 opacity-40 text-center">選擇提醒時間</label>
                    <input 
                      type="time" 
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full bg-transparent text-4xl font-light text-center focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 4. 浮動選單 (呼吸模式) */}
      {isSetupOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] animate-in fade-in duration-300" onClick={() => setIsSetupOpen(false)} />
          <div className={`fixed bottom-0 left-0 right-0 z-[160] rounded-t-[48px] p-8 pb-12 transition-transform animate-in slide-in-from-bottom-full duration-500 ${darkMode ? 'bg-slate-900 border-t border-slate-800' : 'bg-white'}`}>
            <div className="w-12 h-1.5 bg-slate-500/30 rounded-full mx-auto mb-8" />
            <h2 className="text-2xl font-bold mb-6 text-center">呼吸模式</h2>
            
            <div className="space-y-6 overflow-y-auto max-h-[70vh]">
              {/* 模式列表 */}
              <div className="space-y-3">
                {BREATHING_PATTERNS.map((p, i) => (
                  <button key={p.name} onClick={() => setPatternIndex(i)} className={`w-full p-5 rounded-3xl text-left border-2 transition-all ${patternIndex === i ? 'border-emerald-500 bg-emerald-500/5' : 'border-transparent bg-slate-500/5'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-lg">{p.name}</span>
                      <span className="text-xs font-bold bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg">{p.label}</span>
                    </div>
                    <p className="text-sm opacity-50 leading-relaxed">{p.description}</p>
                  </button>
                ))}
              </div>

              {/* 時長設定 */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-3 block">練習時長 (分鐘)</label>
                <div className="flex items-center gap-4 bg-slate-500/5 p-2 rounded-[32px]">
                  <button onClick={() => setDuration(Math.max(1, duration - 1))} className="w-12 h-12 rounded-full bg-inherit flex items-center justify-center text-2xl font-bold hover:bg-slate-500/10">-</button>
                  <input 
                    type="number" 
                    value={duration} 
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="flex-1 bg-transparent text-center text-2xl font-black focus:outline-none"
                    placeholder="5"
                  />
                  <button onClick={() => setDuration(duration + 1)} className="w-12 h-12 rounded-full bg-inherit flex items-center justify-center text-2xl font-bold hover:bg-slate-500/10">+</button>
                </div>
              </div>

              <button onClick={() => setIsSetupOpen(false)} className="w-full py-5 bg-emerald-500 text-white rounded-[32px] font-bold shadow-xl">更新設定</button>
            </div>
          </div>
        </>
      )}

      {/* 5. 底部導覽列 (順序: 首頁, 音效, 模式, 設定) */}
      <nav className={`fixed bottom-0 left-0 right-0 h-24 border-t flex items-center justify-around px-4 backdrop-blur-xl transition-colors z-50 ${darkMode ? 'bg-slate-950/80 border-slate-900 text-slate-500' : 'bg-white/90 border-slate-100 text-slate-400'}`}>
        <button onClick={() => setCurrentView('home')} className={`flex flex-col items-center gap-1 flex-1 ${currentView === 'home' ? 'text-emerald-500' : ''}`}>
          <Home size={22} strokeWidth={currentView === 'home' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-widest">首頁</span>
        </button>
        
        <button onClick={() => setMusicEnabled(!musicEnabled)} className={`flex flex-col items-center gap-1 flex-1 ${musicEnabled ? 'text-emerald-500' : ''}`}>
          {musicEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
          <span className="text-[10px] font-bold uppercase tracking-widest">音效</span>
        </button>

        <button onClick={() => setDarkMode(!darkMode)} className={`flex flex-col items-center gap-1 flex-1 ${darkMode ? 'text-yellow-400' : ''}`}>
          {darkMode ? <Sun size={22} /> : <Moon size={22} />}
          <span className="text-[10px] font-bold uppercase tracking-widest">模式</span>
        </button>

        <button onClick={() => setCurrentView('settings')} className={`flex flex-col items-center gap-1 flex-1 ${currentView === 'settings' ? 'text-emerald-500' : ''}`}>
          <SettingsIcon size={22} strokeWidth={currentView === 'settings' ? 3 : 2} />
          <span className="text-[10px] font-bold uppercase tracking-widest">設定</span>
        </button>
      </nav>
    </div>
  );
};

export default App;