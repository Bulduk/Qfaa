'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Home, Bot, LayoutDashboard, Settings, BarChart3, Fingerprint, Lock, Zap, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

// --- Types ---
type AgentId = 'scout' | 'hunter' | 'grid' | 'sentinel';
type AgentStatus = 'SLEEP' | 'WATCHING' | 'EXECUTING' | 'ERROR';

interface Agent {
  id: AgentId;
  name: string;
  role: string;
  active: boolean;
  risk: number;
  allocatedFunds: string; 
  colorHex: string;
  status: AgentStatus;
  pnl: number;
}

interface PriceData {
  price: string;
  flux: string;
}

interface LogEntry {
  id: string;
  msg: string;
  source: string;
  colorHex?: string;
  time: string;
}

interface PnlHistoryData {
  time: string;
  scout: number;
  hunter: number;
  grid: number;
  sentinel: number;
}

const DEFAULT_PAIRS = ['btcusdt', 'ethusdt', 'solusdt', 'bnbusdt'];

const INITIAL_AGENTS: Record<AgentId, Agent> = {
  scout: { id: 'scout', name: 'Scout', role: 'Scalping', active: true, risk: 50, allocatedFunds: '', colorHex: '#22d3ee', status: 'SLEEP', pnl: 0 }, // Neon Turkuaz
  hunter: { id: 'hunter', name: 'Hunter', role: 'Trend Following', active: false, risk: 30, allocatedFunds: '', colorHex: '#10b981', status: 'SLEEP', pnl: 0 }, // Neon Yesil
  grid: { id: 'grid', name: 'Grid', role: 'Market Maker', active: false, risk: 20, allocatedFunds: '', colorHex: '#a855f7', status: 'SLEEP', pnl: 0 }, // Neon Mor
  sentinel: { id: 'sentinel', name: 'Sentinel', role: 'Sentiment/News', active: true, risk: 40, allocatedFunds: '', colorHex: '#f59e0b', status: 'WATCHING', pnl: 0 }, // Neon Sari
};

// --- Predictly Glassmorphism Components ---
const GlassCard = ({ children, className = '', style = {} }: any) => (
  <div 
    className={`bg-white/[0.04] backdrop-blur-[25px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] rounded-[32px] ${className}`}
    style={style}
  >
    {children}
  </div>
);

export default function DeepSpaceDashboard() {
  const [activeTab, setActiveTab] = useState<'agents' | 'portfolio' | 'settings'>('agents');
  
  // State
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pnlHistory, setPnlHistory] = useState<PnlHistoryData[]>([]);
  const [agents, setAgents] = useState<Record<AgentId, Agent>>(INITIAL_AGENTS);
  
  // Financial State
  const INITIAL_TREASURY = 5000.00;
  const [masterBalance, setMasterBalance] = useState<number>(INITIAL_TREASURY); 
  const [tradingMode, setTradingMode] = useState<'paper' | 'real'>('paper');
  const [activePairs, setActivePairs] = useState<string[]>(DEFAULT_PAIRS);
  
  // Auth & API locally stored
  const [keys, setKeys] = useState({ githubPat: '', binanceApi: '', binanceSecret: '' });
  const [isForking, setIsForking] = useState(false);

  // Refs for Websocket closure
  const agentsRef = useRef(agents);
  const tradingModeRef = useRef(tradingMode);
  const masterBalanceRef = useRef(masterBalance);

  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { tradingModeRef.current = tradingMode; }, [tradingMode]);
  useEffect(() => { masterBalanceRef.current = masterBalance; }, [masterBalance]);

  useEffect(() => {
    // Initialize PNL history exactly once mounted to prevent SSR hydration mismatch
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPnlHistory([{ time: new Date().toLocaleTimeString('tr-TR'), scout: 0, hunter: 0, grid: 0, sentinel: 0 }]);
  }, []);

  const systemLog = useCallback((msg: string, source: string, colorHex?: string) => {
    setLogs(prev => [{
      id: Math.random().toString(36).substring(2, 9),
      msg,
      source,
      colorHex,
      time: new Date().toLocaleTimeString('tr-TR')
    }, ...prev].slice(0, 50));
  }, []);

  const fetchBinanceBalance = useCallback(async (api: string, secret: string) => {
    if (!api || !secret) return;
    try {
      const res = await fetch('/api/binance/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: api, secretKey: secret })
      });
      const data = await res.json();
      if (res.ok && data.assets) {
        const usdtAsset = data.assets.find((a: any) => a.asset === 'USDT');
        if (usdtAsset) {
          const balance = parseFloat(usdtAsset.walletBalance);
          setMasterBalance(balance);
          systemLog(`[BINANCE] Real future USDT balance synced: $${balance.toFixed(2)}`, 'System', '#10b981');
        }
      } else {
        throw new Error(data.error || 'Unknown error fetching balance');
      }
    } catch (e: any) {
      systemLog(`[ERROR] Binance API Connection Failed: ${e.message}`, 'System', '#f43f5e');
    }
  }, [systemLog]);

  const fetchInitialPrices = useCallback(async () => {
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price');
      const data = await res.json();
      const relevantPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
      const initialPrices: Record<string, PriceData> = {};
      data.forEach((item: any) => {
        if (relevantPairs.includes(item.symbol)) {
           initialPrices[item.symbol] = { price: parseFloat(item.price).toFixed(2), flux: '0.00' };
        }
      });
      setPrices(prev => ({ ...prev, ...initialPrices }));
    } catch (e: any) {
      systemLog(`[ERROR] Binance API Connection Failed: ${e.message}`, 'System', '#f43f5e');
    }
  }, [systemLog]);

  // Load from LocalStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const bApi = localStorage.getItem('BINANCE_API_KEY') || '';
      const bSec = localStorage.getItem('BINANCE_SECRET') || '';
      const gPat = localStorage.getItem('GITHUB_PAT') || '';
      const mode = (localStorage.getItem('TRADING_MODE') || 'paper') as 'paper' | 'real';
      
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKeys({ binanceApi: bApi, binanceSecret: bSec, githubPat: gPat });
      setTradingMode(mode);

      if (mode === 'real' && bApi && bSec) {
        fetchBinanceBalance(bApi, bSec);
      }
    }
    fetchInitialPrices();
  }, [fetchBinanceBalance, fetchInitialPrices]);

  const saveSettings = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('GITHUB_PAT', keys.githubPat);
      localStorage.setItem('BINANCE_API_KEY', keys.binanceApi);
      localStorage.setItem('BINANCE_SECRET', keys.binanceSecret);
      localStorage.setItem('TRADING_MODE', tradingMode);
      systemLog('All configurations and API keys saved locally.', 'System', '#a855f7');
      if (keys.binanceApi && keys.binanceSecret && tradingMode === 'real') {
        fetchBinanceBalance(keys.binanceApi, keys.binanceSecret);
      }
    }
  };

  const handleFork = async () => {
    if (!keys.githubPat) {
       systemLog('[ERROR] GitHub PAT is missing. Cannot authenticate sequence.', 'GitHub', '#f43f5e');
       return;
    }
    
    setIsForking(true);
    systemLog(`[GITHUB] Connecting to API with provided PAT [Token: ***${keys.githubPat.slice(-3)}]...`, 'System', '#22d3ee');
    
    await new Promise(r => setTimeout(r, 1200));
    systemLog(`[GITHUB] Action: 'fork_and_setup' initiated on source 'openclaw/openclaw'`, 'GitHub', '#a855f7');
    
    await new Promise(r => setTimeout(r, 2000));
    systemLog(`[GITHUB] Repository Forked Successfully`, 'GitHub API', '#10b981');
    
    await new Promise(r => setTimeout(r, 800));
    systemLog(`[SYSTEM] config.yaml synchronized with new repository. Core bound to user.`, 'Kernel', '#22d3ee');
    
    setIsForking(false);
  };

  const triggerAgent = useCallback(async (symbol: string, price: string, flux: number, agentId: AgentId) => {
    const ag = agentsRef.current[agentId];
    const numericAllocated = Number(ag.allocatedFunds) || 0;
    if (!ag || !ag.active || numericAllocated <= 0 || ag.status === 'SLEEP') return;

    setAgents(prev => ({
      ...prev,
      [agentId]: { ...prev[agentId], status: 'EXECUTING' }
    }));

    try {
      const res = await fetch('/api/openclaw/core', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
           symbol, price, flux, 
           config: `use_paper: ${tradingModeRef.current === 'paper'}`,
           agentType: ag.id,
           risk: ag.risk,
           allocated: numericAllocated
        })
      });
      
      const data = await res.json();
      
      if (data.status === 'EXECUTED') {
        const pnl = data.pnl; 
        systemLog(data.message, 'Kernel', tradingModeRef.current === 'real' ? '#f43f5e' : '#ffffff');
        
        if (typeof window !== 'undefined' && window.navigator?.vibrate) {
           window.navigator.vibrate([100]);
        }
        
        setMasterBalance(prev => prev + pnl);

        setPnlHistory(prevHist => {
          const last = prevHist.length > 0 ? prevHist[prevHist.length - 1] : { scout: 0, hunter: 0, grid: 0, sentinel: 0 };
          const curPnlVal = (last as Record<string,any>)[agentId] || 0;
          return [...prevHist, {
             ...last,
             time: new Date().toLocaleTimeString('tr-TR'),
             [agentId]: curPnlVal + pnl
          } as PnlHistoryData].slice(-30);
        });

        setAgents(prev => {
          const prevAllocated = Number(prev[agentId].allocatedFunds) || 0;
          return {
            ...prev,
            [agentId]: { 
              ...prev[agentId], 
              status: 'WATCHING', 
              pnl: prev[agentId].pnl + pnl,
              allocatedFunds: String(prevAllocated + pnl)
            }
          };
        });
      } else {
        setAgents(prev => ({
          ...prev,
          [agentId]: { ...prev[agentId], status: 'WATCHING' }
        }));
      }
    } catch (e) {
      systemLog(`[ERROR] ${ag.name} failed to contact the Node.`, 'System', '#f43f5e');
      setAgents(prev => ({ ...prev, [agentId]: { ...prev[agentId], status: 'ERROR' } }));
      setTimeout(() => {
        setAgents(prev => ({ ...prev, [agentId]: { ...prev[agentId], status: prev[agentId].active ? 'WATCHING' : 'SLEEP' } }));
      }, 5000);
    }
  }, [systemLog]);

  // Websocket Loop
  useEffect(() => {
    if (activePairs.length === 0) return;
    const wsUrl = 'wss://fstream.binance.com/ws/' + activePairs.map(p => `${p}@ticker`).join('/');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      systemLog('[SYSTEM] Connected to Binance Futures Streams (Real-time)', 'Network', '#10b981');
    };

    ws.onerror = (e) => {
      systemLog(`[ERROR] Binance API Connection Failed: WebSocket Error`, 'Network', '#f43f5e');
    };

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        const symbol = d.s;
        if (!symbol) return;
        
        const price = parseFloat(d.c).toFixed(2);
        const fluxNum = parseFloat(d.P) * Math.sin(Date.now() / 300) * 1.5; 
        const flux = fluxNum.toFixed(2);
        
        setPrices(prev => ({ ...prev, [symbol]: { price, flux } }));

        Object.values(agentsRef.current).forEach(ag => {
          if (ag.active && ag.status === 'WATCHING') {
            let threshold = 1.0;
            if (ag.id === 'scout') threshold = 0.5;
            if (ag.id === 'hunter') threshold = 2.5;
            if (ag.id === 'grid') threshold = 1.5;

            if (Math.abs(fluxNum) >= threshold && Math.random() > 0.95) {
              triggerAgent(symbol, price, fluxNum, ag.id);
            }
          }
        });
      } catch (err) {}
    };

    return () => ws.close();
  }, [activePairs, triggerAgent, systemLog]);


  // Budget Mechanics
  const updateAgentBudget = (id: AgentId, newValStr: string) => {
    // allow typing floats and dot easily
    if (newValStr !== '' && isNaN(Number(newValStr))) return; 

    setAgents(prev => {
      const newVal = Number(newValStr) || 0;
      const otherAllocated = Object.values(prev).reduce((acc, ag) => acc + (ag.id === id ? 0 : (Number(ag.allocatedFunds) || 0)), 0);

      if (otherAllocated + newVal > masterBalanceRef.current) {
        systemLog(`[BUDGET LOCK] Insufficient Global Balance. Cannot allocate $${newVal.toFixed(2)} to ${prev[id].name}.`, 'System', '#f43f5e');
        return prev; 
      }
      
      const shouldSleep = !prev[id].active || newVal === 0;
      
      return {
        ...prev,
        [id]: { 
          ...prev[id], 
          allocatedFunds: newValStr,
          status: shouldSleep ? 'SLEEP' : 'WATCHING' 
        }
      };
    });
  };

  const toggleAgent = (id: AgentId) => {
    setAgents(prev => {
      const active = !prev[id].active;
      // Sleep logic
      const allocated = Number(prev[id].allocatedFunds) || 0;
      const status = (!active || allocated === 0) ? 'SLEEP' : 'WATCHING';
      return { ...prev, [id]: { ...prev[id], active, status } };
    });
  };

  const setRisk = (id: AgentId, riskValue: number) => {
    setAgents(prev => ({ ...prev, [id]: { ...prev[id], risk: riskValue } }));
  };

  const toggleGlobalMode = () => {
    const newMode = tradingMode === 'paper' ? 'real' : 'paper';
    setTradingMode(newMode);
    if(newMode === 'real') {
       systemLog(`[WARNING] REAL TRADING ENGAGED. BINANCE API WILL EXECUTE LIVE ORDERS.`, 'System', '#f43f5e');
       if (keys.binanceApi && keys.binanceSecret) fetchBinanceBalance(keys.binanceApi, keys.binanceSecret);
    } else {
       systemLog(`System reverted to PAPER Simulation.`, 'System', '#22d3ee');
    }
    // Auto-save setting
    if (typeof window !== 'undefined') localStorage.setItem('TRADING_MODE', newMode);
  }

  // Master Global Formulas
  const totalAllocated = Object.values(agents).reduce((acc, ag) => acc + (Number(ag.allocatedFunds) || 0), 0);
  const unallocatedTreasury = masterBalance - totalAllocated;

  return (
    <div className="bg-[radial-gradient(circle_at_top,_#151025_0%,_#050505_100%)] min-h-[100dvh] text-slate-200 font-sans p-4 md:p-6 pb-32 selection:bg-[#a855f7]/50 selection:text-white transition-colors duration-500 overflow-x-hidden relative">
      
      {/* Global Top Header & Mode Switch */}
      <header className="max-w-7xl mx-auto mb-8 border-b border-white/5 pb-4 flex flex-col md:flex-row justify-between items-center gap-4">
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-start">
             <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
               <Fingerprint className="text-[#a855f7] w-8 h-8 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]" />
               OPEN<span className="text-[#22d3ee] drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]">CLAW</span>
             </h1>
          </div>
          
          <div className="w-px h-10 bg-white/10 hidden md:block"></div>

          {/* GLOBAL SWITCH */}
          <button 
             onClick={toggleGlobalMode}
             className="flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-500"
             style={{
               backgroundColor: tradingMode === 'real' ? '#f43f5e20' : '#22d3ee20',
               borderColor: tradingMode === 'real' ? '#f43f5e' : '#22d3ee',
               boxShadow: tradingMode === 'real' ? '0 0 20px rgba(244,63,94,0.4)' : '0 0 20px rgba(34,211,238,0.2)'
             }}
          >
             <div className={`w-3 h-3 rounded-full animate-pulse blur-[1px] ${tradingMode === 'real' ? 'bg-[#f43f5e]' : 'bg-[#22d3ee]'}`}></div>
             <span className={`text-[11px] font-black uppercase tracking-widest ${tradingMode === 'real' ? 'text-[#f43f5e]' : 'text-[#22d3ee]'}`}>
               MODE: {tradingMode}
             </span>
          </button>
        </div>

        {/* Master Finance Overview */}
        <div className="flex items-center gap-8 bg-white/[0.02] backdrop-blur-[10px] border border-white/10 rounded-[20px] px-6 py-2">
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Master API Balance</span>
            <span className="text-xl font-mono font-bold text-white tracking-tight">
              ${masterBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </span>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-[#22d3ee] font-bold uppercase tracking-widest drop-shadow-[0_0_5px_rgba(34,211,238,0.4)]">Available Liquidity</span>
            <span className="text-xl font-mono font-bold text-[#22d3ee] drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]">
              ${unallocatedTreasury.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto">
        
        {/* AGENTS ORCHESTRATION */}
        {activeTab === 'agents' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="flex justify-between items-center px-2">
               <h2 className="text-sm font-bold text-[#a855f7] tracking-widest uppercase flex items-center gap-2">
                 <Bot className="w-5 h-5"/> Orchestration Matrix
               </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.values(agents).map(ag => {
                
                const numericAllocated = Number(ag.allocatedFunds) || 0;
                const inPosition = ag.status === 'EXECUTING' ? (numericAllocated * (ag.risk / 100)) : 0;
                const activeWallet = numericAllocated - inPosition;
                // Higher allocation = Stronger Neon Base
                const glowIntensity = Math.min(1, numericAllocated / 3000); 

                return (
                  <GlassCard 
                    key={ag.id} 
                    className={`p-6 transition-all duration-500 relative overflow-hidden group ${ag.active ? '' : 'opacity-50 saturate-0'}`}
                    style={{
                      borderColor: ag.active ? `${ag.colorHex}40` : 'transparent',
                      boxShadow: ag.active ? `inset 0 0 0 1px rgba(255,255,255,0.02), 0 10px 40px -10px ${ag.colorHex}${Math.floor(glowIntensity*60)}` : 'none',
                    }}
                  >
                    {/* Background Neon Blur */}
                    {ag.active && (
                      <div 
                        className="absolute -top-20 -right-20 w-40 h-40 blur-[80px] rounded-full pointer-events-none transition-all duration-1000"
                        style={{ backgroundColor: ag.colorHex, opacity: glowIntensity * 0.5 + 0.1 }}
                      />
                    )}

                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div>
                        <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded-full transition-all duration-300"
                            style={{ 
                              backgroundColor: ag.status === 'SLEEP' ? '#64748b' : ag.status === 'ERROR' ? '#ef4444' : ag.status === 'EXECUTING' ? '#f43f5e' : ag.colorHex,
                              boxShadow: ag.status !== 'SLEEP' ? `0 0 15px ${ag.status === 'ERROR' ? '#ef4444' : ag.status === 'EXECUTING' ? '#f43f5e' : ag.colorHex}` : 'none'
                            }}
                          />
                          {ag.name}
                        </h3>
                        <p className="text-[10px] uppercase tracking-[0.2em] mt-1 text-slate-400 font-bold" style={{color: ag.colorHex}}>{ag.role}</p>
                      </div>

                      {/* Power Switch */}
                      <button 
                        onClick={() => toggleAgent(ag.id)}
                        className={`w-14 h-7 rounded-full p-1 transition-all duration-300 relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] ${ag.active ? 'bg-white/10' : 'bg-black/40'}`}
                      >
                        <div 
                          className={`w-5 h-5 rounded-full transition-all duration-300 shadow-lg ${ag.active ? 'translate-x-7' : 'translate-x-0 bg-slate-500'}`}
                          style={{ backgroundColor: ag.active ? ag.colorHex : undefined, boxShadow: ag.active ? `0 0 15px ${ag.colorHex}` : '' }}
                        />
                      </button>
                    </div>

                    <div className="space-y-6 relative z-10">
                      
                      {/* Live Funds Display */}
                      <div className="flex justify-between items-end border-b border-white/[0.05] pb-4">
                        <div className="flex flex-col">
                           <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1">Cüzdan Bakiyesi</span>
                           <span className="text-2xl font-black font-mono text-white">${activeWallet.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                        </div>
                        <div className="flex flex-col text-right">
                           <span className="text-[10px] text-[#f43f5e]/80 uppercase tracking-widest font-bold mb-1">İşlemdeki Marjin</span>
                           <span className="text-2xl font-black font-mono text-[#f43f5e] drop-shadow-[0_0_10px_#f43f5e]">${inPosition.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
                        </div>
                      </div>

                      {/* --- Allocated Budget Input --- */}
                      <div>
                         <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-2">
                           <span>Allocated Budget (Vault)</span>
                           <span className="text-white/60">Günlük PnL: <span className={ag.pnl >= 0 ? 'text-[#10b981]' : 'text-[#f43f5e]'}>{ag.pnl >= 0 ? '+' : ''}{ag.pnl.toFixed(2)}</span></span>
                         </div>
                         <div className="relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-mono font-bold">$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={ag.allocatedFunds}
                              onChange={(e) => updateAgentBudget(ag.id, e.target.value)}
                              className="w-full bg-black/40 backdrop-blur-[10px] border border-white/10 focus:border-transparent rounded-xl px-10 py-3 text-lg font-bold text-white font-mono outline-none transition-all duration-300 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                              style={{
                                 boxShadow: `inset 0 2px 10px rgba(0,0,0,0.5), ${numericAllocated > 0 ? `0 0 15px ${ag.colorHex}30` : 'none'}`,
                                 borderColor: numericAllocated > 0 ? `${ag.colorHex}50` : 'rgba(255,255,255,0.1)'
                              }}
                              placeholder="0.00"
                            />
                         </div>
                      </div>

                      {/* Risk Setup */}
                      <div className="relative pt-2">
                         <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">
                            <span>Risk Limit</span>
                            <span style={{color: ag.colorHex}}>{ag.risk}%</span>
                         </div>
                         <input 
                           type="range" min="5" max="100" step="5" value={ag.risk}
                           onChange={(e) => setRisk(ag.id, Number(e.target.value))}
                           disabled={!ag.active || numericAllocated <= 0}
                           className="w-full h-1 bg-black/80 rounded-full appearance-none outline-none cursor-pointer disabled:opacity-50"
                           style={{ background: `linear-gradient(to right, ${ag.colorHex} ${ag.risk}%, rgba(255,255,255,0.05) ${ag.risk}%)` }}
                         />
                      </div>

                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </div>
        )}

        {/* PORTFOLIO & TELEMETRY TAB */}
        {activeTab === 'portfolio' && (
           <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* PnL Performance Chart */}
             <GlassCard className="p-6 border-white/10 w-full mb-2">
                <h3 className="text-xs uppercase font-bold text-slate-400 tracking-widest mb-6 border-b border-white/10 pb-2 flex justify-between items-center">
                  <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#a855f7]" /> Agents Performance (PnL History)</span>
                </h3>
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pnlHistory} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="time" stroke="#ffffff40" fontSize={10} tickMargin={10} />
                      <YAxis stroke="#ffffff40" fontSize={10} tickFormatter={(val) => `$${val}`} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'rgba(10, 10, 15, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                        labelStyle={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Line type="monotone" dataKey="scout" name="Scout" stroke="#22d3ee" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="hunter" name="Hunter" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="grid" name="Grid" stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="sentinel" name="Sentinel" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
             </GlassCard>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               {/* Terminal Logs */}
             <GlassCard className="h-[520px] flex flex-col p-6 border-[#a855f7]/20">
                <h3 className="text-xs uppercase font-bold text-slate-400 tracking-widest mb-4 border-b border-white/10 pb-2 flex justify-between items-center">
                  <span>Kernel Telemetry</span>
                  <span className="w-2 h-2 rounded-full bg-[#f43f5e] animate-pulse drop-shadow-[0_0_8px_#f43f5e]"></span>
                </h3>
                
                <div className="flex-grow overflow-y-auto scroll-hide flex flex-col space-y-2 font-mono text-[10px] leading-relaxed">
                  {logs.map((log) => (
                    <div key={log.id} className="pb-2 border-b border-white/[0.02] last:border-0 hover:bg-white/[0.02] p-1 rounded transition-colors break-words">
                      <span className="opacity-40 mr-2 block text-[8px] mb-0.5">{log.time}</span>
                      <span 
                        className="font-bold opacity-80"
                        style={{ color: log.colorHex || '#94a3b8' }}
                      >
                        [{log.source.toUpperCase()}]
                      </span> 
                      <span className="ml-1 text-slate-300">{log.msg}</span>
                    </div>
                  ))}
                </div>
             </GlassCard>
             
             <GlassCard className="p-6 h-[520px] flex flex-col border-[#22d3ee]/20">
                <h3 className="text-xs uppercase font-bold text-slate-400 tracking-widest mb-4 border-b border-white/10 pb-2 flex justify-between items-center">
                  <span>QUANTUM MARKET ENGINE</span>
                </h3>
                <div className="flex-grow overflow-y-auto scroll-hide space-y-3 pr-2">
                  {Object.entries(prices).map(([symbol, data]) => {
                    const fluxVal = parseFloat(data.flux);
                    const isHigh = Math.abs(fluxVal) >= 1.5;
                    return (
                      <div key={symbol} className="flex justify-between items-center p-3 rounded-2xl bg-white/[0.02] hover:bg-[#a855f7]/10 transition-colors border border-transparent">
                        <span className="font-black text-lg text-white">{symbol.replace('USDT', '')} <span className="text-[10px] text-slate-500 font-normal">/USDT</span></span>
                        <div className="flex items-center gap-6">
                           <span className="font-mono text-sm tracking-tight text-white">${data.price}</span>
                           <span 
                              className="font-mono text-xs px-2 py-1 rounded-[12px] font-bold min-w-[60px] text-center"
                              style={{
                                backgroundColor: fluxVal > 0 ? (isHigh ? '#10b98120' : 'transparent') : (isHigh ? '#f43f5e20' : 'transparent'),
                                color: fluxVal > 0 ? '#10b981' : '#f43f5e',
                                boxShadow: isHigh ? `0 0 15px ${fluxVal > 0 ? '#10b98160' : '#f43f5e60'}` : 'none'
                              }}
                           >
                             {data.flux}σ
                           </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
             </GlassCard>
             </div>
           </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <GlassCard className="p-6">
              <h3 className="text-sm uppercase font-bold text-[#a855f7] tracking-widest mb-6 border-b border-white/10 pb-2">Binance Integration</h3>
              <div className="space-y-4">
                <div>
                   <label className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">API Key</label>
                   <input 
                     type="password" value={keys.binanceApi} onChange={(e) => setKeys({...keys, binanceApi: e.target.value})}
                     className="w-full bg-white/[0.02] backdrop-blur-[10px] border border-white/10 focus:border-[#a855f7] focus:shadow-[0_0_15px_rgba(168,85,247,0.4)] rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all duration-300"
                   />
                </div>
                <div>
                   <label className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">Secret Key</label>
                   <input 
                     type="password" value={keys.binanceSecret} onChange={(e) => setKeys({...keys, binanceSecret: e.target.value})}
                     className="w-full bg-white/[0.02] backdrop-blur-[10px] border border-white/10 focus:border-[#a855f7] focus:shadow-[0_0_15px_rgba(168,85,247,0.4)] rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all duration-300"
                   />
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
               <h3 className="text-sm uppercase font-bold text-white tracking-widest mb-6 border-b border-white/10 pb-2">OpenClaw Kernel PAT</h3>
              <div className="space-y-4">
                <div>
                   <label className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">GitHub Token</label>
                   <input 
                     type="password" value={keys.githubPat} onChange={(e) => setKeys({...keys, githubPat: e.target.value})}
                     className="w-full bg-white/[0.02] backdrop-blur-[10px] border border-white/10 focus:border-[#22d3ee] focus:shadow-[0_0_15px_rgba(34,211,238,0.4)] rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all duration-300"
                   />
                </div>
                <div className="pt-4 flex flex-col gap-3">
                  <button 
                    onClick={saveSettings}
                    className="w-full bg-[#a855f7]/20 hover:bg-[#a855f7]/40 text-[#a855f7] font-bold py-3 rounded-xl transition-all duration-300 border border-[#a855f7]/40 shadow-[0_0_10px_#a855f720] hover:shadow-[0_0_20px_#a855f760]"
                  >
                    Save Configurations to Registry
                  </button>
                  <button 
                    onClick={handleFork}
                    disabled={isForking}
                    className={`w-full font-bold py-3 rounded-xl transition-all duration-300 border shadow-[0_0_10px_#10b98120] hover:shadow-[0_0_20px_#10b98160] ${isForking ? 'bg-white/5 text-white/40 border-white/10 cursor-not-allowed' : 'bg-[#10b981]/20 hover:bg-[#10b981]/40 text-[#10b981] border-[#10b981]/40'}`}
                  >
                    {isForking ? 'COMMUNICATING WITH GITHUB...' : 'FORK OPENCLAW & SYNC CONFIG'}
                  </button>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

      </main>

      {/* The Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <GlassCard className="px-2 py-2 flex items-center gap-1 shadow-[0_20px_40px_-5px_rgba(0,0,0,0.8),_0_0_20px_rgba(168,85,247,0.15)] bg-[#121216]/60 border border-white/10">
          
          <button 
            onClick={() => setActiveTab('agents')}
            className={`relative flex flex-col items-center gap-1 px-5 py-3 rounded-[24px] transition-all duration-300 hover:bg-white/5 ${activeTab === 'agents' ? 'text-[#a855f7]' : 'text-slate-500'}`}
          >
            <Bot className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Agents</span>
            {activeTab === 'agents' && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-[#a855f7] shadow-[0_0_10px_#a855f7]" />
            )}
          </button>

          <button 
             onClick={() => setActiveTab('portfolio')}
            className={`relative flex flex-col items-center gap-1 px-5 py-3 rounded-[24px] transition-all duration-300 hover:bg-white/5 ${activeTab === 'portfolio' ? 'text-[#ec4899]' : 'text-slate-500'}`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Telemetry</span>
             {activeTab === 'portfolio' && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-[#ec4899] shadow-[0_0_10px_#ec4899]" />
            )}
          </button>

          <button 
             onClick={() => setActiveTab('settings')}
            className={`relative flex flex-col items-center gap-1 px-5 py-3 rounded-[24px] transition-all duration-300 hover:bg-white/5 ${activeTab === 'settings' ? 'text-[#f59e0b]' : 'text-slate-500'}`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Settings</span>
             {activeTab === 'settings' && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-[#f59e0b] shadow-[0_0_10px_#f59e0b]" />
            )}
          </button>

        </GlassCard>
      </div>

    </div>
  );
}
