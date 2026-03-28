import React, { useState, useRef, useEffect } from 'react';
import { 
  Shield, 
  Search, 
  Upload, 
  AlertTriangle, 
  CheckCircle, 
  Lock, 
  Eye, 
  FileSearch, 
  Globe, 
  Settings,
  ChevronRight,
  Loader2,
  Trash2,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Menu,
  X,
  Bell,
  BellDot,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService, AnalysisResult, WebSearchThreat } from './services/geminiService';
import { analytics } from './services/analytics';
import { notificationService, Notification as NotificationType } from './services/notificationService';
import { threatScoringService, IdentityHealth, ThreatScore } from './services/threatScoringService';
import { cn } from './lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';

type Tab = 'dashboard' | 'analyzer' | 'sentinel' | 'vault' | 'chat' | 'settings';

interface Persona {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  instruction: string;
  color: string;
}

const PERSONAS: Persona[] = [
  {
    id: 'expert',
    name: 'Deepfake Expert',
    icon: ShieldCheck,
    description: 'Technical detection & forensics',
    color: 'bg-blue-500',
    instruction: "You are the Defensive Deepfake Expert persona of RCK ai. Your tone is professional, analytical, and cautious. You specialize in technical forensic analysis of media, identifying compression artifacts, lighting inconsistencies, and biometric mismatches in deepfakes. You provide detailed technical explanations."
  },
  {
    id: 'advocate',
    name: 'Ethical AI Advocate',
    icon: Globe,
    description: 'Societal impact & ethics',
    color: 'bg-emerald-500',
    instruction: "You are the Ethical AI Advocate persona of RCK ai. Your tone is empathetic, philosophical, and forward-looking. You focus on the responsible use of AI, the importance of transparency, and the societal implications of synthetic media. You advocate for digital literacy and ethical boundaries."
  },
  {
    id: 'guardian',
    name: 'Privacy Guardian',
    icon: Lock,
    description: 'Data sovereignty & footprint',
    color: 'bg-purple-500',
    instruction: "You are the Privacy Guardian persona of RCK ai. Your tone is firm, protective, and direct. You specialize in data sovereignty, encryption, and minimizing digital footprints. You provide actionable advice on how to secure personal data and prevent unauthorized data harvesting."
  }
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [threats, setThreats] = useState<WebSearchThreat[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisResult[]>([]);
  const [identityHealth, setIdentityHealth] = useState<IdentityHealth | null>(null);
  const [userName, setUserName] = useState('');
  const [userContext, setUserContext] = useState('');
  const [uploadedMedia, setUploadedMedia] = useState<string | null>(null);
  const [analysisModel, setAnalysisModel] = useState<'auto' | 'image' | 'video' | 'audio'>('auto');
  const [analysisSensitivity, setAnalysisSensitivity] = useState<'low' | 'medium' | 'high'>('medium');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model', parts: { text: string }[] }[]>([]);
  const [currentChatMessage, setCurrentChatMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<Persona>(PERSONAS[0]);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [reportingThreat, setReportingThreat] = useState<WebSearchThreat | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((newNotifications) => {
      setNotifications(newNotifications);
    });

    // Request browser notification permission
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return unsubscribe;
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    analytics.track({
      category: 'navigation',
      action: 'view_tab',
      label: activeTab
    });
  }, [activeTab]);

  useEffect(() => {
    setIdentityHealth(threatScoringService.calculateIdentityHealth(threats, recentAnalyses));
  }, [threats, recentAnalyses]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      setUploadedMedia(event.target?.result as string);
      setIsAnalyzing(true);
      
      analytics.track({
        category: 'media_analysis',
        action: 'start_analysis',
        metadata: { 
          fileType: file.type,
          model: analysisModel,
          sensitivity: analysisSensitivity
        }
      });

      try {
        const result = await geminiService.analyzeMedia(base64, file.type, {
          modelType: analysisModel,
          sensitivity: analysisSensitivity
        });
        setAnalysisResult(result);
        setRecentAnalyses(prev => [result, ...prev].slice(0, 10));

        if (result.isAI) {
          notificationService.notify({
            type: 'threat',
            title: 'AI Generation Detected',
            message: `Potential deepfake detected in ${file.name}. Confidence: ${(result.confidence * 100).toFixed(1)}%`,
          });
        } else if (result.confidence > 0.9) {
          notificationService.notify({
            type: 'success',
            title: 'Media Verified',
            message: `${file.name} has been verified as authentic with high confidence.`,
          });
        }

        analytics.track({
          category: 'media_analysis',
          action: 'analysis_complete',
          metadata: { confidence: result.confidence }
        });
      } catch (error) {
        console.error("Analysis failed", error);
        analytics.track({
          category: 'media_analysis',
          action: 'analysis_error'
        });
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleIdentitySearch = async () => {
    if (!userName) return;
    setIsSearching(true);
    
    analytics.track({
      category: 'web_sentinel',
      action: 'start_scan',
      metadata: { hasContext: !!userContext }
    });

    try {
      const results = await geminiService.searchIdentityMisuse(userName, userContext);
      setThreats(results);

      const highRiskThreats = results.filter(t => t.riskScore > 70);
      if (highRiskThreats.length > 0) {
        notificationService.notify({
          type: 'threat',
          title: 'Identity Threats Detected',
          message: `Found ${highRiskThreats.length} high-risk impersonation attempts for ${userName}.`,
        });
      } else if (results.length > 0) {
        notificationService.notify({
          type: 'warning',
          title: 'Identity Mentions Found',
          message: `Found ${results.length} potential mentions of ${userName} on the web.`,
        });
      } else {
        notificationService.notify({
          type: 'success',
          title: 'Identity Scan Clean',
          message: `No unauthorized use of ${userName}'s identity was found.`,
        });
      }

      analytics.track({
        category: 'web_sentinel',
        action: 'scan_complete',
        metadata: { threatCount: results.length }
      });
    } catch (error) {
      console.error("Search failed", error);
      analytics.track({
        category: 'web_sentinel',
        action: 'scan_error'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentChatMessage.trim() || isChatLoading) return;

    const newUserMessage = { role: 'user' as const, parts: [{ text: currentChatMessage }] };
    const updatedHistory = [...chatMessages, newUserMessage];
    
    setChatMessages(updatedHistory);
    setCurrentChatMessage('');
    setIsChatLoading(true);

    analytics.track({
      category: 'chat',
      action: 'send_message',
      metadata: { 
        messageLength: currentChatMessage.length,
        persona: selectedPersona.id
      }
    });

    try {
      const response = await geminiService.chat(currentChatMessage, chatMessages, selectedPersona.instruction);
      setChatMessages([...updatedHistory, { role: 'model' as const, parts: [{ text: response || '' }] }]);
      analytics.track({
        category: 'chat',
        action: 'receive_response'
      });
    } catch (error) {
      console.error("Chat failed", error);
      setChatMessages([...updatedHistory, { role: 'model' as const, parts: [{ text: "I'm sorry, I encountered an error. Please try again." }] }]);
      analytics.track({
        category: 'chat',
        action: 'response_error'
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <ShieldCheck className="w-5 h-5" /> },
    { id: 'analyzer', label: 'Analyzer', icon: <Eye className="w-5 h-5" /> },
    { id: 'sentinel', label: 'Sentinel', icon: <Globe className="w-5 h-5" /> },
    { id: 'vault', label: 'Vault', icon: <Lock className="w-5 h-5" /> },
    { id: 'chat', label: 'Chat', icon: <Menu className="w-5 h-5" /> },
  ];

  if (!isAuthenticated) {
    return <AuthView onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-guardian-bg overflow-hidden text-slate-200">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-white/5 flex-col bg-guardian-card/50">
        <div className="p-6 flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">RCK ai</h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <NavItem 
              key={item.id}
              icon={item.icon} 
              label={item.label} 
              active={activeTab === item.id} 
              onClick={() => setActiveTab(item.id as Tab)} 
            />
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                JD
              </div>
              {notificationService.getUnreadCount() > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-guardian-bg rounded-full" />
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">John Doe</p>
              <p className="text-xs text-slate-400 truncate">Pro Guardian</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors relative"
                >
                  {notificationService.getUnreadCount() > 0 ? (
                    <BellDot className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                </button>
                <AnimatePresence>
                  {showNotifications && (
                    <NotificationPanel 
                      notifications={notifications}
                      onClose={() => setShowNotifications(false)}
                      onMarkRead={(id) => notificationService.markAsRead(id)}
                      onMarkAllRead={() => notificationService.markAllAsRead()}
                      onClearAll={() => notificationService.clearAll()}
                    />
                  )}
                </AnimatePresence>
              </div>
              <Settings 
                onClick={() => setActiveTab('settings')}
                className="w-4 h-4 text-slate-400 cursor-pointer hover:text-white transition-colors" 
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-guardian-card/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">RCK ai</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors relative"
            >
              {notificationService.getUnreadCount() > 0 ? (
                <BellDot className="w-5 h-5 text-blue-500" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
            </button>
            <AnimatePresence>
              {showNotifications && (
                <NotificationPanel 
                  notifications={notifications}
                  onClose={() => setShowNotifications(false)}
                  onMarkRead={(id) => notificationService.markAsRead(id)}
                  onMarkAllRead={() => notificationService.markAllAsRead()}
                  onClearAll={() => notificationService.clearAll()}
                />
              )}
            </AnimatePresence>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white border border-white/10">
            JD
          </div>
        </div>
      </header>

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-guardian-card/90 backdrop-blur-xl border-t border-white/5 px-2 py-2 flex items-center justify-around">
        {navItems.map((item) => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id as Tab)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[64px]",
              activeTab === item.id ? "text-blue-500" : "text-slate-500"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-lg transition-all",
              activeTab === item.id ? "bg-blue-500/10" : "bg-transparent"
            )}>
              {item.icon}
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative pb-32 md:pb-8">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 md:space-y-8"
              >
                <header>
                  <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Security Overview</h2>
                  <p className="text-slate-400 mt-1 text-sm md:text-base">Your identity is currently monitored and protected.</p>
                </header>

                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                    <StatCard 
                      title="Identity Health" 
                      value={identityHealth?.overallScore !== undefined ? `${identityHealth.overallScore}%` : "100%"} 
                      icon={<ShieldCheck className={cn("w-5 h-5 md:w-6 md:h-6", 
                        identityHealth?.status === 'Critical' ? 'text-red-500' : 
                        identityHealth?.status === 'At Risk' ? 'text-orange-500' : 
                        'text-emerald-500'
                      )} />}
                      color={
                        identityHealth?.status === 'Critical' ? 'text-red-500' : 
                        identityHealth?.status === 'At Risk' ? 'text-orange-500' : 
                        'text-emerald-500'
                      }
                    />
                    <StatCard 
                      title="Threat Index" 
                      value={identityHealth?.threatIndex !== undefined ? `${identityHealth.threatIndex}/100` : "0/100"} 
                      icon={<AlertTriangle className={cn("w-5 h-5 md:w-6 md:h-6", 
                        (identityHealth?.threatIndex || 0) > 60 ? 'text-red-500' : 
                        (identityHealth?.threatIndex || 0) > 30 ? 'text-orange-500' : 
                        'text-slate-400'
                      )} />}
                      color={
                        (identityHealth?.threatIndex || 0) > 60 ? 'text-red-500' : 
                        (identityHealth?.threatIndex || 0) > 30 ? 'text-orange-500' : 
                        'text-slate-400'
                      }
                    />
                    <StatCard 
                      title="Monitors" 
                      value="12" 
                      icon={<Eye className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />}
                      color="text-blue-500"
                    />
                  </div>

                  {identityHealth && identityHealth.factors.length > 0 && (
                    <section className="glass-panel rounded-2xl md:rounded-3xl p-5 md:p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-blue-500" />
                        Risk Factors
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {identityHealth.factors.map((factor, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                            <div>
                              <p className="text-sm font-medium text-white">{factor.label}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                {factor.impact === 'positive' ? 'Minimal risk detected' : 
                                 factor.impact === 'negative' ? 'Significant risk identified' : 
                                 'Moderate activity detected'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={cn("text-lg font-bold", 
                                factor.impact === 'positive' ? 'text-emerald-500' : 
                                factor.impact === 'negative' ? 'text-red-500' : 
                                'text-amber-500'
                              )}>
                                {factor.score}%
                              </p>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Impact</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                <section className="glass-panel rounded-2xl md:rounded-3xl p-5 md:p-6">
                  <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-500" />
                    Engagement Analytics
                  </h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="h-[300px] w-full min-w-0">
                      <h4 className="text-sm font-medium text-slate-400 mb-4 text-center">Feature Usage</h4>
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={[
                          { name: 'Analysis', value: analytics.getStats().mediaAnalyses },
                          { name: 'Scans', value: analytics.getStats().sentinelScans },
                          { name: 'Chat', value: analytics.getStats().chatMessages },
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#94a3b8" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                            itemStyle={{ color: '#60a5fa' }}
                          />
                          <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="h-[300px] w-full min-w-0">
                      <h4 className="text-sm font-medium text-slate-400 mb-4 text-center">Tab Views Distribution</h4>
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <PieChart>
                          <Pie
                            data={Object.entries(analytics.getStats().tabViews).map(([name, value]) => ({ name, value }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {[ '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981' ].map((color, index) => (
                              <Cell key={`cell-${index}`} fill={color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            height={36}
                            formatter={(value) => <span className="text-xs text-slate-400 capitalize">{value}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                  <section className="glass-panel rounded-2xl md:rounded-3xl p-5 md:p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Search className="w-5 h-5 text-blue-500" />
                      Recent Activity
                    </h3>
                    <div className="space-y-4">
                      <ActivityItem 
                        title="Web Scan Completed" 
                        time="2 hours ago" 
                        status="success" 
                        desc="No impersonation attempts found."
                      />
                      <ActivityItem 
                        title="Deepfake Analysis" 
                        time="5 hours ago" 
                        status="success" 
                        desc="Video 'profile_intro.mp4' verified as authentic."
                      />
                      <ActivityItem 
                        title="New Asset Protected" 
                        time="1 day ago" 
                        status="info" 
                        desc="Added 3 high-res images to the Vault."
                      />
                    </div>
                  </section>

                  <section className="glass-panel rounded-2xl md:rounded-3xl p-5 md:p-6 bg-gradient-to-br from-blue-600/10 to-transparent">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-blue-500" />
                      Security Recommendations
                    </h3>
                    <div className="space-y-4">
                      <Recommendation 
                        title="Enable Biometric Vault" 
                        desc="Add an extra layer of protection to your personal media."
                        action="Enable"
                      />
                      <Recommendation 
                        title="Update Identity Context" 
                        desc="Providing more details helps our AI find subtle impersonations."
                        action="Update"
                      />
                    </div>
                  </section>
                </div>
              </motion.div>
            )}

            {activeTab === 'analyzer' && (
              <motion.div 
                key="analyzer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 md:space-y-8"
              >
                <header>
                  <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Media Analyzer</h2>
                  <p className="text-slate-400 mt-1 text-sm md:text-base">Detect AI generation and deepfake manipulation in images and videos.</p>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Detection Model</label>
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                      {(['auto', 'image', 'video', 'audio'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setAnalysisModel(m)}
                          className={cn(
                            "flex-1 py-2 text-xs font-medium rounded-lg transition-all capitalize",
                            analysisModel === m ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sensitivity</label>
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                      {(['low', 'medium', 'high'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setAnalysisSensitivity(s)}
                          className={cn(
                            "flex-1 py-2 text-xs font-medium rounded-lg transition-all capitalize",
                            analysisSensitivity === s ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                  <div className="space-y-6">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-white/10 rounded-2xl md:rounded-3xl p-6 md:p-12 flex flex-col items-center justify-center gap-3 md:gap-4 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer group"
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileUpload}
                        accept="image/*,video/*,audio/*"
                      />
                      <div className="p-3 md:p-4 bg-white/5 rounded-full group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 md:w-8 md:h-8 text-slate-400 group-hover:text-blue-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-base md:text-lg font-medium text-white">Click or drag to upload</p>
                        <p className="text-xs text-slate-400 mt-1">Supports Image, Video, Audio up to 50MB</p>
                      </div>
                    </div>

                    {uploadedMedia && (
                      <div className="glass-panel rounded-2xl md:rounded-3xl p-4 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-sm font-medium text-slate-400">Preview</span>
                          <button 
                            onClick={() => {
                              setUploadedMedia(null);
                              setAnalysisResult(null);
                            }}
                            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {uploadedMedia.startsWith('data:image') ? (
                          <div className="relative group/preview overflow-hidden rounded-xl">
                            <img 
                              src={uploadedMedia} 
                              alt="Preview" 
                              className="w-full rounded-xl object-cover max-h-[300px] md:max-h-96 transition-all duration-500 group-hover/preview:scale-[1.03] group-hover/preview:shadow-[0_0_30px_rgba(59,130,246,0.4)]" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 rounded-xl border border-white/5 group-hover/preview:border-blue-500/30 transition-colors pointer-events-none" />
                          </div>
                        ) : uploadedMedia.startsWith('data:video') ? (
                          <div className="relative group/preview overflow-hidden rounded-xl">
                            <video 
                              src={uploadedMedia} 
                              controls 
                              className="w-full rounded-xl max-h-[300px] md:max-h-96 transition-all duration-500 group-hover/preview:scale-[1.03] group-hover/preview:shadow-[0_0_30px_rgba(59,130,246,0.4)]" 
                            />
                            <div className="absolute inset-0 rounded-xl border border-white/5 group-hover/preview:border-blue-500/30 transition-colors pointer-events-none" />
                          </div>
                        ) : (
                          <div className="p-8 flex flex-col items-center justify-center gap-4 bg-white/5 rounded-xl">
                            <div className="p-4 bg-blue-500/10 rounded-full">
                              <Loader2 className="w-8 h-8 text-blue-500 animate-pulse" />
                            </div>
                            <audio src={uploadedMedia} controls className="w-full" />
                            <p className="text-xs text-slate-400">Audio Stream Detected</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    {isAnalyzing ? (
                      <div className="glass-panel rounded-2xl md:rounded-3xl p-8 md:p-12 flex flex-col items-center justify-center gap-4 h-full min-h-[300px]">
                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                        <div className="text-center">
                          <h3 className="text-xl font-semibold text-white">Analyzing Media...</h3>
                          <p className="text-slate-400 mt-2 text-sm">Our AI is scanning for pixel inconsistencies and synthetic patterns.</p>
                        </div>
                      </div>
                    ) : analysisResult ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-panel rounded-2xl md:rounded-3xl p-6 md:p-8 space-y-6 h-full"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-semibold text-white">Analysis Result</h3>
                          <div className="flex flex-col items-end">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider",
                              threatScoringService.getThreatDetails(threatScoringService.calculateMediaScore(analysisResult).score).color.replace('text-', 'bg-') + '/20',
                              threatScoringService.getThreatDetails(threatScoringService.calculateMediaScore(analysisResult).score).color
                            )}>
                              {threatScoringService.getThreatDetails(threatScoringService.calculateMediaScore(analysisResult).score).label} Threat
                            </span>
                            <span className="text-[10px] text-slate-500 mt-1">
                              Score: {Math.round(threatScoringService.calculateMediaScore(analysisResult).score)}/100
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-slate-500">
                            <span>Integrity Risk Level</span>
                            <span className={threatScoringService.getThreatDetails(threatScoringService.calculateMediaScore(analysisResult).score).color}>
                              {Math.round(threatScoringService.calculateMediaScore(analysisResult).score)}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${threatScoringService.calculateMediaScore(analysisResult).score}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                              className={cn(
                                "h-full rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]",
                                threatScoringService.getThreatDetails(threatScoringService.calculateMediaScore(analysisResult).score).color.replace('text-', 'bg-')
                              )}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 p-4 md:p-6 rounded-2xl bg-white/5 border border-white/5">
                          <div className={cn(
                            "p-3 md:p-4 rounded-2xl",
                            analysisResult.isAI ? "bg-red-500/20" : "bg-emerald-500/20"
                          )}>
                            {analysisResult.isAI ? (
                              <AlertTriangle className="w-6 h-6 md:w-10 md:h-10 text-red-500" />
                            ) : (
                              <CheckCircle className="w-6 h-6 md:w-10 md:h-10 text-emerald-500" />
                            )}
                          </div>
                          <div className="text-center sm:text-left">
                            <p className="text-lg md:text-2xl font-bold text-white">
                              {analysisResult.isAI ? "AI Generated" : "Authentic Media"}
                            </p>
                            <p className="text-slate-400 text-xs md:text-sm">
                              Integrity Confidence: {(analysisResult.confidence * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>

                        <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                          <p className="text-sm text-slate-300">
                            <span className="font-bold text-white">Scoring Insight:</span> {threatScoringService.calculateMediaScore(analysisResult).description}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reasoning</h4>
                          <p className="text-slate-200 leading-relaxed text-sm md:text-base">
                            {analysisResult.reasoning}
                          </p>
                        </div>

                        {analysisResult.transcription && (
                          <div className="space-y-3 pt-4 border-t border-white/5">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transcription</h4>
                            <div className="p-4 bg-white/5 rounded-xl text-sm text-slate-300 italic">
                              "{analysisResult.transcription}"
                            </div>
                          </div>
                        )}

                        <div className="pt-6 border-t border-white/5">
                          <button className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm md:text-base">
                            <Shield className="w-4 h-4" />
                            Generate Detailed Report
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="glass-panel rounded-2xl md:rounded-3xl p-8 md:p-12 flex flex-col items-center justify-center gap-4 h-full min-h-[300px] text-center">
                        <FileSearch className="w-12 h-12 text-slate-600" />
                        <h3 className="text-xl font-semibold text-slate-400">No Analysis Data</h3>
                        <p className="text-slate-500 max-w-xs text-sm">Upload an image or video to start the deepfake detection process.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'sentinel' && (
              <motion.div 
                key="sentinel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 md:space-y-8"
              >
                <header>
                  <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Web Sentinel</h2>
                  <p className="text-slate-400 mt-1 text-sm md:text-base">Scan the web for unauthorized use of your identity and potential threats.</p>
                </header>

                <div className="glass-panel rounded-2xl md:rounded-3xl p-5 md:p-8 space-y-5 md:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <div className="space-y-2">
                      <label className="text-xs md:text-sm font-medium text-slate-400">Full Name to Protect</label>
                      <input 
                        type="text" 
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm md:text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs md:text-sm font-medium text-slate-400">Context / Profession</label>
                      <input 
                        type="text" 
                        value={userContext}
                        onChange={(e) => setUserContext(e.target.value)}
                        placeholder="e.g. Software Engineer"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm md:text-base"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleIdentitySearch}
                    disabled={isSearching || !userName}
                    className="w-full py-3.5 md:py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 text-sm md:text-base active:scale-[0.98]"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Scanning Web...
                      </>
                    ) : (
                      <>
                        <Search className="w-5 h-5" />
                        Initiate Identity Scan
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg md:text-xl font-semibold text-white flex items-center gap-2">
                    Scan Results
                    {threats.length > 0 && (
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-500 text-[10px] md:text-xs rounded-full">
                        {threats.length} Potential Threats
                      </span>
                    )}
                  </h3>
                  
                  {isSearching ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="glass-panel rounded-2xl p-5 md:p-6 animate-pulse space-y-4">
                          <div className="h-4 bg-white/5 rounded w-3/4"></div>
                          <div className="h-3 bg-white/5 rounded w-full"></div>
                          <div className="h-3 bg-white/5 rounded w-5/6"></div>
                        </div>
                      ))}
                    </div>
                  ) : threats.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                      {threats.map((threat, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="glass-panel rounded-2xl p-5 md:p-6 space-y-4 hover:border-red-500/30 transition-all group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="p-2 bg-red-500/10 rounded-lg">
                              <AlertTriangle className="w-5 h-5 text-red-500" />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={cn(
                                "text-[10px] md:text-xs font-bold px-2 py-1 rounded-full uppercase",
                                threat.riskScore > 70 ? "bg-red-500/20 text-red-500" : "bg-amber-500/20 text-amber-500"
                              )}>
                                Risk: {threat.riskScore}%
                              </span>
                              <span className="text-[9px] text-slate-500 font-medium">
                                Confidence: {threat.confidenceScore}%
                              </span>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-base md:text-lg font-semibold text-white group-hover:text-red-400 transition-colors">{threat.title}</h4>
                            <p className="text-xs md:text-sm text-slate-400 mt-1 line-clamp-2">{threat.description}</p>
                          </div>
                          
                          <div className="p-3 bg-white/5 rounded-xl space-y-2">
                            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Evidence Found</h5>
                            <p className="text-xs text-slate-300 italic">"{threat.evidence}"</p>
                          </div>

                          <div className="space-y-3">
                            <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resolution Plan</h5>
                            <div className="space-y-2">
                              {threat.resolutionPlan.map((item, i) => (
                                <div key={i} className="flex items-start gap-2 p-2 bg-white/5 rounded-lg border border-white/5">
                                  <div className={cn(
                                    "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                                    item.priority === 'high' ? "bg-red-500" : item.priority === 'medium' ? "bg-amber-500" : "bg-blue-500"
                                  )} />
                                  <div className="flex-1">
                                    <p className="text-xs text-slate-300">{item.step}</p>
                                    {item.link && (
                                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline mt-1 inline-block">
                                        Resource Link
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {threat.threatType === 'impersonation' && (
                              <button 
                                onClick={() => setReportingThreat(threat)}
                                className="w-full mt-4 py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-red-500/20 shadow-lg shadow-red-600/5 group/report"
                              >
                                <ShieldAlert className="w-4 h-4 group-hover/report:scale-110 transition-transform" />
                                Report Impersonation
                              </button>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-white/5">
                            <span className="text-[10px] md:text-xs font-medium text-slate-500 uppercase tracking-wider">{threat.threatType}</span>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => setReportingThreat(threat)}
                                className="flex items-center gap-1 text-[10px] md:text-xs text-red-400 hover:text-red-300 transition-colors font-semibold"
                              >
                                <ShieldAlert className="w-3 h-3" /> Report
                              </button>
                              <a 
                                href={threat.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] md:text-xs text-blue-400 hover:text-blue-300 transition-colors"
                              >
                                View Source <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="glass-panel rounded-2xl p-8 md:p-12 text-center space-y-4">
                      <ShieldCheck className="w-10 h-10 md:w-12 md:h-12 text-emerald-500 mx-auto" />
                      <h3 className="text-lg md:text-xl font-semibold text-white">No Threats Detected</h3>
                      <p className="text-slate-400 max-w-md mx-auto text-sm md:text-base">Your identity appears secure on the public web. Run a scan regularly to stay protected.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'vault' && (
              <motion.div 
                key="vault"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 md:space-y-8"
              >
                <header>
                  <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Identity Vault</h2>
                  <p className="text-slate-400 mt-1 text-sm md:text-base">Securely store and manage your personal assets used for identity verification.</p>
                </header>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                  <VaultItem 
                    title="Profile Photo" 
                    type="Image" 
                    date="Mar 02, 2026" 
                    protected={true}
                    img="https://picsum.photos/seed/profile/400/400"
                    threatScore={98}
                    description="Official biometric profile image used for cross-platform verification."
                  />
                  <VaultItem 
                    title="Keynote Video" 
                    type="Video" 
                    date="Feb 15, 2026" 
                    protected={true}
                    img="https://picsum.photos/seed/video/400/400"
                    threatScore={95}
                    description="High-resolution video recording of the 2026 global summit presentation."
                  />
                  <VaultItem 
                    title="Voice Sample" 
                    type="Audio" 
                    date="Jan 20, 2026" 
                    protected={true}
                    img="https://picsum.photos/seed/audio/400/400"
                    threatScore={82}
                    description="Encrypted voice biometric sample for multi-factor authentication."
                  />
                  <div className="border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-4 md:p-8 gap-2 md:gap-3 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer group min-h-[160px] md:min-h-[200px]">
                    <div className="p-2 md:p-3 bg-white/5 rounded-full group-hover:scale-110 transition-transform">
                      <Upload className="w-5 h-5 md:w-6 md:h-6 text-slate-400 group-hover:text-blue-500" />
                    </div>
                    <span className="text-xs font-medium text-slate-400">Add Asset</span>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex flex-col h-[calc(100vh-180px)] md:h-[calc(100vh-120px)]"
              >
                <header className="mb-4 md:mb-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl md:text-3xl font-bold text-white tracking-tight">Guardian Chat</h2>
                      <p className="text-slate-400 mt-0.5 text-xs md:text-base">Ask RCK ai anything about cybersecurity.</p>
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                      {PERSONAS.map((persona) => (
                        <button
                          key={persona.id}
                          onClick={() => {
                            setSelectedPersona(persona);
                            setChatMessages([]); // Clear history when switching personas for consistency
                            analytics.track({ category: 'chat', action: 'switch_persona', label: persona.id });
                          }}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap border",
                            selectedPersona.id === persona.id 
                              ? `${persona.color} text-white border-transparent shadow-lg` 
                              : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"
                          )}
                        >
                          <persona.icon className="w-4 h-4" />
                          {persona.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </header>

                <div className="flex-1 glass-panel rounded-2xl md:rounded-3xl p-3 md:p-6 overflow-y-auto mb-4 space-y-4 scrollbar-hide">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 opacity-50">
                      <div className={cn("p-6 rounded-full", selectedPersona.color + "/20")}>
                        <selectedPersona.icon className="w-12 h-12 text-white" />
                      </div>
                      <p className="text-slate-400 max-w-xs text-sm">
                        Hello! I'm your <strong>{selectedPersona.name}</strong>. {selectedPersona.description}. How can I help you today?
                      </p>
                    </div>
                  )}
                  {chatMessages.map((msg, idx) => (
                    <div 
                      key={idx} 
                      className={cn(
                        "flex w-full",
                        msg.role === 'user' ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "max-w-[85%] p-3 md:p-4 rounded-2xl text-sm md:text-base shadow-sm",
                        msg.role === 'user' 
                          ? "bg-blue-600 text-white rounded-tr-none" 
                          : "bg-white/5 text-slate-200 border border-white/5 rounded-tl-none"
                      )}>
                        {msg.parts[0].text}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="flex gap-2 sticky bottom-0 bg-guardian-bg/95 backdrop-blur-md py-3 px-1">
                  <input 
                    type="text" 
                    value={currentChatMessage}
                    onChange={(e) => setCurrentChatMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask a question..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={isChatLoading || !currentChatMessage.trim()}
                    className="px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center justify-center"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 md:space-y-8"
              >
                <header>
                  <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Account Settings</h2>
                  <p className="text-slate-400 mt-1 text-sm md:text-base">Manage your security preferences and account details.</p>
                </header>

                <div className="space-y-6">
                  <section className="glass-panel rounded-2xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-500" />
                      Profile
                    </h3>
                    <div className="flex items-center gap-4 p-3 bg-white/5 rounded-xl">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl font-bold text-white shadow-lg">
                        JD
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">John Doe</p>
                        <p className="text-sm text-slate-400">john.doe@example.com</p>
                        <button className="text-xs text-blue-400 hover:underline mt-1">Edit Profile</button>
                      </div>
                    </div>
                  </section>

                  <section className="glass-panel rounded-2xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Lock className="w-5 h-5 text-blue-500" />
                      Security
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-white">Two-Factor Authentication</p>
                          <p className="text-xs text-slate-400">Add an extra layer of security to your account.</p>
                        </div>
                        <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                          <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-white">Biometric Login</p>
                          <p className="text-xs text-slate-400">Use FaceID or Fingerprint to unlock the Vault.</p>
                        </div>
                        <div className="w-10 h-5 bg-slate-700 rounded-full relative cursor-pointer">
                          <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="glass-panel rounded-2xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Globe className="w-5 h-5 text-blue-500" />
                      Monitoring
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div>
                          <p className="text-sm font-medium text-white">Real-time Web Sentinel</p>
                          <p className="text-xs text-slate-400">Continuously scan for identity misuse.</p>
                        </div>
                        <div className="w-10 h-5 bg-blue-600 rounded-full relative cursor-pointer">
                          <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                    </div>
                  </section>

                  <button 
                    onClick={() => {
                      analytics.track({ category: 'navigation', action: 'sign_out' });
                      setIsAuthenticated(false);
                    }}
                    className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-red-500/20"
                  >
                    <Trash2 className="w-5 h-5" />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-guardian-card/90 backdrop-blur-xl border-t border-white/5 flex items-center justify-around p-3 z-50">
        {navItems.map((item) => (
          <button 
            key={item.id}
            onClick={() => setActiveTab(item.id as Tab)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all",
              activeTab === item.id ? "text-blue-500" : "text-slate-500"
            )}
          >
            <div className={cn(
              "p-2 rounded-xl transition-all",
              activeTab === item.id ? "bg-blue-500/10" : ""
            )}>
              {item.icon}
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {reportingThreat && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md glass-panel rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl border border-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/20 rounded-2xl">
                  <ShieldAlert className="w-8 h-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {reportingThreat.threatType === 'impersonation' ? 'Report Impersonation?' : 'Report Threat?'}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {reportingThreat.threatType === 'impersonation' 
                      ? 'Confirm you want to report this identity theft attempt.' 
                      : 'Confirm you want to report this potential threat.'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                <p className="text-sm font-semibold text-white truncate">{reportingThreat.title}</p>
                <p className="text-xs text-slate-400 line-clamp-2">{reportingThreat.url}</p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setReportingThreat(null)}
                  className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    notificationService.notify({
                      type: 'info',
                      title: 'Report Submitted',
                      message: `A formal impersonation report has been queued for ${reportingThreat.url}. Our team will review it shortly.`,
                    });
                    analytics.track({
                      category: 'web_sentinel',
                      action: 'report_threat',
                      label: reportingThreat.url
                    });
                    setReportingThreat(null);
                  }}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-red-600/20"
                >
                  Submit Report
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AuthView({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register' && password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      onLogin();
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-guardian-bg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass-panel rounded-3xl p-8 space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-blue-600/20">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">RCK ai</h1>
          <p className="text-slate-400">
            {mode === 'login' ? 'Secure your digital identity today.' : 'Create your secure identity vault.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'register' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Full Name</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>
          {mode === 'register' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Confirm Password</label>
              <input 
                type="password" 
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>
          )}
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'login' ? "Sign In" : "Create Account")}
          </button>
        </form>

        <div className="text-center">
          <p className="text-sm text-slate-500">
            {mode === 'login' ? (
              <>Don't have an account? <span onClick={() => setMode('register')} className="text-blue-400 cursor-pointer hover:underline">Create one</span></>
            ) : (
              <>Already have an account? <span onClick={() => setMode('login')} className="text-blue-400 cursor-pointer hover:underline">Sign in</span></>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function NotificationPanel({ 
  notifications, 
  onClose, 
  onMarkRead, 
  onMarkAllRead, 
  onClearAll 
}: { 
  notifications: NotificationType[], 
  onClose: () => void,
  onMarkRead: (id: string) => void,
  onMarkAllRead: () => void,
  onClearAll: () => void
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="absolute right-0 top-full mt-2 w-80 md:w-96 glass-panel rounded-2xl shadow-2xl z-[100] overflow-hidden border border-white/10"
    >
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-500" />
          Notifications
        </h3>
        <div className="flex gap-2">
          <button 
            onClick={onMarkAllRead}
            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-wider"
          >
            Mark all read
          </button>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="max-h-[400px] overflow-y-auto p-2 space-y-2 scrollbar-hide">
        {notifications.length === 0 ? (
          <div className="py-12 text-center space-y-3 opacity-50">
            <Bell className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm text-slate-500">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div 
              key={n.id}
              onClick={() => onMarkRead(n.id)}
              className={cn(
                "p-3 rounded-xl transition-all cursor-pointer border border-transparent",
                n.read ? "bg-transparent opacity-60" : "bg-white/5 border-white/5 hover:border-blue-500/30"
              )}
            >
              <div className="flex gap-3">
                <div className={cn(
                  "p-2 rounded-lg shrink-0",
                  n.type === 'threat' ? "bg-red-500/20 text-red-500" :
                  n.type === 'warning' ? "bg-amber-500/20 text-amber-500" :
                  n.type === 'success' ? "bg-emerald-500/20 text-emerald-500" :
                  "bg-blue-500/20 text-blue-500"
                )}>
                  {n.type === 'threat' ? <AlertTriangle className="w-4 h-4" /> :
                   n.type === 'warning' ? <ShieldAlert className="w-4 h-4" /> :
                   n.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
                   <Info className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-white truncate">{n.title}</p>
                    <span className="text-[9px] text-slate-500 whitespace-nowrap">
                      {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {notifications.length > 0 && (
        <div className="p-3 bg-white/5 border-t border-white/5">
          <button 
            onClick={onClearAll}
            className="w-full py-2 text-xs font-bold text-slate-500 hover:text-red-400 transition-colors uppercase tracking-wider"
          >
            Clear all notifications
          </button>
        </div>
      )}
    </motion.div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
        active 
          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {active && <ChevronRight className="w-4 h-4 ml-auto" />}
    </button>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4 md:p-6 flex items-center justify-between">
      <div>
        <p className="text-[10px] md:text-sm font-medium text-slate-400 uppercase tracking-wider">{title}</p>
        <p className={cn("text-lg md:text-2xl font-bold mt-0.5 md:mt-1", color)}>{value}</p>
      </div>
      <div className="p-2 md:p-3 bg-white/5 rounded-xl">
        {icon}
      </div>
    </div>
  );
}

function ActivityItem({ title, time, status, desc }: { title: string, time: string, status: 'success' | 'info' | 'warning', desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="relative">
        <div className={cn(
          "w-2 h-2 rounded-full mt-2",
          status === 'success' ? "bg-emerald-500" : status === 'info' ? "bg-blue-500" : "bg-amber-500"
        )} />
        <div className="absolute top-4 bottom-0 left-1/2 -translate-x-1/2 w-px bg-white/5" />
      </div>
      <div className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <h4 className="text-sm font-semibold text-white">{title}</h4>
          <span className="text-[10px] text-slate-500">{time}</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">{desc}</p>
      </div>
    </div>
  );
}

function Recommendation({ title, desc, action }: { title: string, desc: string, action: string }) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{desc}</p>
      </div>
      <button className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider">
        {action}
      </button>
    </div>
  );
}

function VaultItem({ title, type, date, protected: isProtected, img, threatScore, description }: { title: string, type: string, date: string, protected: boolean, img: string, threatScore?: number, description?: string }) {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden group flex flex-col">
      <div className="aspect-square relative overflow-hidden shrink-0">
        <img src={img} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2">
          {isProtected && (
            <div className="p-1.5 bg-emerald-500/20 backdrop-blur-md rounded-lg border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            </div>
          )}
          {threatScore !== undefined && (
            <div className={cn(
              "px-2 py-1 backdrop-blur-md rounded-lg border text-[10px] font-bold uppercase tracking-wider",
              threatScore > 90 ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-500" :
              threatScore > 70 ? "bg-blue-500/20 border-blue-500/30 text-blue-500" :
              "bg-amber-500/20 border-amber-500/30 text-amber-500"
            )}>
              Integrity: {threatScore}%
            </div>
          )}
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h4 className="text-sm md:text-base font-semibold text-white truncate">{title}</h4>
        {description && (
          <p className="text-[10px] md:text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed flex-1">
            {description}
          </p>
        )}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          <span className="text-[10px] md:text-xs text-slate-500">{type} • {date}</span>
          <button className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
