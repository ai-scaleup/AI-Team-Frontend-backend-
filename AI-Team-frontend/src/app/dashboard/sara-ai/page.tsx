"use client"




import type React from "react"
import { useState, useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts"
import {
    Edit2, Trash2, Check, Copy, Sun, Moon, Zap, MessageSquare, User, Send, Paperclip,
    ChevronRight, Users, LayoutGrid, ChevronLeft, BrainCircuit, FolderPlus, Folder,
    FolderOpen, ChevronDown, MoreHorizontal, Share, Archive, X, RotateCcw, FileText,
    ExternalLink, Menu, Home, BarChart3, Smartphone, Search, Filter, Download,
    ArrowDownRight, RefreshCw, Book, Tag, ArrowLeft, QrCode
} from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { saraAiService } from "@/services/saraAiService"
import type { ChatSession as SaraSession, ChatMessage as SaraMessage, StatsResponse, DailyAnalyticsBucket } from "@/types/sara-ai"
















// --- CONFIGURATION ---
// 1. CHAT URL (POST) - Sends new messages to AI
const N8N_CHAT_URL = "https://n8n-c2lq.onrender.com/webhook/bb5226e9-6615-41cf-95ea-a9bbc4bd3e18";




// Note: History is now fetched via saraAiService.getSessions() and saraAiService.getConversation()








// --- TYPES ---
interface Message {
    text: string
    sender: "ai" | "user"
    time: string
    files?: string[]
    raw?: string
}








interface ChatSession {
    id: string
    messages: Message[]
    title: string
    lastUpdated: string
    folderId: string | null
    archived: boolean
    agentId: string
    sessionId?: string
}








interface FolderType {
    id: string
    name: string
    createdAt: string
}








interface WhatsAppSession {
    id: string;
    session_id?: string;
    phoneNumber: string;
    userName: string;
    lastActive: string;
    status: "active" | "completed" | "needs_attention";
    messages: Message[];
    toolUsage: string[];
    platform: "web" | "mobile";
    notes?: string;
}




// --- ROBUST MARKDOWN SHIM ---
const simpleMarkdown = {
    parse: (text: string) => {
        if (!text) return ""
        const formatInline = (str: string) => {
            return str
                .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
                .replace(/__([\s\S]*?)__/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
                .replace(/\*([\s\S]*?)\*/g, '<em class="italic opacity-90">$1</em>')
                .replace(/_([\s\S]*?)_/g, '<em class="italic opacity-90">$1</em>')
                .replace(/`([^`]+)`/g, '<code class="bg-black/20 px-1 rounded font-mono text-xs">$1</code>')
        }
        return text.split('\n').map(line => `<div class="mb-1">${formatInline(line)}</div>`).join('')
    },
}
















// --- AGENT DATABASE (FULL LIST) ---
const AGENTS_DB: Record<string, any> = {
    "sara-ai": {
        name: "Sara AI",
        role: "WhatsApp Assistant",
        image: "/assets/agents/sara-ai-1768406582163-0145e544-2c36-4790-b956-81dcdea1057d.jpeg",
        description: "Automazione WhatsApp e Gestione Appuntamenti.",
        primaryColor: "#25D366",
        accentColor: "#128C7E",
        route: "/dashboard/sara-ai",
        isDashboardOnly: true
    },
    "tony-ai": {
        name: "Tony AI",
        role: "Sales Manager",
        image: "/assets/agents/Tony-AI-strategiest.png",
        description: "Il tuo consulente vendite digitale.",
        primaryColor: "#0ea5e9",
        accentColor: "#22d3ee",
        route: "/dashboard/tony-ai",
    },
    "mike-ai": {
        name: "Mike AI",
        role: "Marketing Manager",
        image: "/assets/agents/Mike-AI-digital-marketing-mg.png",
        description: "Il tuo stratega di marketing.",
        primaryColor: "#3b82f6",
        accentColor: "#60a5fa",
        route: "/dashboard/mike-ai",
    },
    "lara-ai": {
        name: "Lara AI",
        role: "Social Media Manager",
        image: "/assets/agents/Lara-AI-social-strategiest.png",
        description: "Gestisco i tuoi social media.",
        primaryColor: "#ec4899",
        accentColor: "#f472b6",
        route: "/dashboard/lara-ai",
    },
    "simone-ai": {
        name: "Simone AI",
        role: "SEO Copywriter",
        image: "/assets/agents/Simone-AI-seo-copy.png",
        description: "Scrivo contenuti ottimizzati SEO.",
        primaryColor: "#10b981",
        accentColor: "#34d399",
        route: "/dashboard/simone-ai",
    },
    "niko-ai": {
        name: "Niko AI",
        role: "SEO Manager",
        image: "/assets/agents/Niko-AI.png",
        description: "Architetto della tua presenza online.",
        primaryColor: "#f59e0b",
        accentColor: "#fbbf24",
        route: "/dashboard/niko-ai",
    },
    "valentina-ai": {
        name: "Valentina AI",
        role: "SEO Optimizer",
        image: "/assets/agents/Valentina-AI-AI-SEO-optimizer.png",
        description: "Ottimizzo i contenuti esistenti.",
        primaryColor: "#8b5cf6",
        accentColor: "#a78bfa",
        route: "/dashboard/valentina-ai",
    },
    "alex-ai": {
        name: "Alex AI",
        role: "Ads Manager",
        image: "/assets/agents/David-AI-Ai-Specialist-social-ads.png",
        description: "Gestisco le tue campagne pubblicitarie.",
        primaryColor: "#ef4444",
        accentColor: "#f87171",
        route: "/dashboard/alex-ai",
    },
    "aladino-ai": {
        name: "Aladino AI",
        role: "Innovation Manager",
        image: "/assets/agents/Aladdin-AI-consultant.png",
        description: "Invento nuovi prodotti.",
        primaryColor: "#6366f1",
        accentColor: "#818cf8",
        route: "/dashboard/aladino-ai",
    },
    "jim-ai": {
        name: "Jim AI",
        role: "Sales Coach",
        image: "/assets/agents/Jim-AI---AI-Coach.png",
        description: "Alleno il tuo team di vendita.",
        primaryColor: "#f97316",
        accentColor: "#fb923c",
        route: "/dashboard/jim-ai",
    },
    "daniele-ai": {
        name: "Daniele AI",
        role: "Direct Response Copywriter",
        image: "/assets/agents/daniele_ai_direct_response_copywriter.png",
        description: "Progetto e scrivo copy.",
        primaryColor: "#f97316",
        accentColor: "#fb923c",
        route: "/dashboard/daniele-ai",
    },
}
















const AI_TEAM_LIST = [
    { id: "sara-ai" }, { id: "mike-ai" }, { id: "tony-ai" },
    { id: "lara-ai" }, { id: "simone-ai" }, { id: "niko-ai" },
    { id: "valentina-ai" }, { id: "alex-ai" }, { id: "aladino-ai" },
    { id: "jim-ai" }, { id: "daniele-ai" }
]
















// --- CHART COMPONENT ---
const SimpleLineChart = ({ data, color, height = 150, timeRange }: { data: number[], color: string, height?: number, timeRange: string }) => {
    const { theme, systemTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
















    useEffect(() => setMounted(true), []);








    const chartData = data.map((val, i) => {
        const d = new Date();
        // 1. TODAY: Show just the date
        if (timeRange === 'today') {
            return { index: i, value: val, label: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) };
        }
        // 2. YESTERDAY: Show yesterday's date
        if (timeRange === 'yesterday') {
            d.setDate(d.getDate() - 1);
            return { index: i, value: val, label: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) };
        }
        // 3. RANGES: Spread dates backward
        d.setDate(d.getDate() - (data.length - 1 - i));
        return { index: i, value: val, label: d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }) };
    });
















    if (!mounted) return <div style={{ height: `${height}px` }} className="w-full bg-transparent" />;
















    const currentTheme = theme === 'system' ? systemTheme : theme;
    const isDark = currentTheme === 'dark';
    const gradientId = `gradient-${color.replace('#', '')}`;
















    return (
        <div style={{ height: `${height}px` }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} dy={10} interval="preserveStartEnd" />
                    <Tooltip contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0', borderRadius: '8px', fontSize: '12px', color: isDark ? '#fff' : '#0f172a' }} itemStyle={{ color: color, fontWeight: 600 }} cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }} labelStyle={{ color: isDark ? '#94a3b8' : '#64748b', marginBottom: '4px' }} />
                    <Area type="monotone" dataKey="value" stroke={color} strokeWidth={3} fillOpacity={1} fill={`url(#${gradientId})`} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
















// --- MOCK USER BUTTON ---
const MockUserButton = () => (
    <button className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-sky-400/50 hover:ring-sky-400 transition-all shadow-[0_0_15px_rgba(14,165,233,0.6)] group cursor-pointer">
        <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <User size={20} className="text-sky-200" />
        </div>
    </button>
)
















export default function App() {
    const [activeAgentId, setActiveAgentId] = useState<string>("sara-ai")
    const currentAgent = AGENTS_DB[activeAgentId] || AGENTS_DB["sara-ai"]
    const isDashboardMode = currentAgent.isDashboardOnly === true
    const [saraSection, setSaraSection] = useState<"analytics" | "conversations" | "settings" | "qrcode">("analytics")
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [sidebarVisible, setSidebarVisible] = useState(true)
    const [sidebarMode, setSidebarMode] = useState<"chats" | "agents">("chats")
    const [useMemory, setUseMemory] = useState(true)
    const [chats, setChats] = useState<Record<string, ChatSession>>({})
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [activeMenu, setActiveMenu] = useState<string | null>(null)
    const [renamingChat, setRenamingChat] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState("")
    const [pinnedChats, setPinnedChats] = useState<Set<string>>(new Set())
    const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null)
    const [isDark, setIsDark] = useState(true)
    const [folders, setFolders] = useState<FolderType[]>([])
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [draggedChatId, setDraggedChatId] = useState<string | null>(null)
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState("")
    const [showArchived, setShowArchived] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [whatsappSessions, setWhatsappSessions] = useState<WhatsAppSession[]>([])
    const [qrCode, setQrCode] = useState<string | null>(null)
    const [isQrLoading, setIsQrLoading] = useState(false)
    const [qrStatus, setQrStatus] = useState<'connected' | 'disconnected'>('disconnected')
    const qrIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const [isConversationLoading, setIsConversationLoading] = useState(false)

    // Real analytics from API
    const [apiStats, setApiStats] = useState<StatsResponse | null>(null)
    const [analyticsData, setAnalyticsData] = useState<DailyAnalyticsBucket[]>([])

    const generateQRCode = async () => {
        console.log("Generating QR Code...")
        console.log("Token available:", !!process.env.NEXT_PUBLIC_WHAPI_TOKEN)
        setIsQrLoading(true)
        setQrCode(null)

        const fetchQR = async () => {
            try {
                const response = await fetch('https://gate.whapi.cloud/users/login', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_WHAPI_TOKEN}`
                    }
                })

                console.log("API Response Status:", response.status)

                if (!response.ok) {
                    const errorText = await response.text()
                    console.error("API Error Body:", errorText)
                    throw new Error('Failed to fetch QR code')
                }

                const data = await response.json()
                console.log("API Data:", data)

                if (data.base64) {
                    const qrImage = data.base64.startsWith('data:') ? data.base64 : `data:image/png;base64,${data.base64}`
                    setQrCode(qrImage)
                    setQrStatus('disconnected')
                } else if (data.qr) {
                    const qrImage = data.qr.startsWith('data:') ? data.qr : `data:image/png;base64,${data.qr}`
                    setQrCode(qrImage)
                    setQrStatus('disconnected')
                } else if (data.status === 'success' || (data.status === 'OK' && !data.base64)) {
                    // Check if already logged in or other status
                    setQrStatus('connected')
                    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current)
                }
            } catch (error) {
                console.error("QR Fetch Error:", error)
            } finally {
                setIsQrLoading(false)
            }
        }

        await fetchQR()

        // Auto-refresh every 20 seconds
        if (qrIntervalRef.current) clearInterval(qrIntervalRef.current)
        qrIntervalRef.current = setInterval(fetchQR, 20000)
    }

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (qrIntervalRef.current) clearInterval(qrIntervalRef.current)
        }
    }, [])



    // --- 🆕 FILTER STATE & REAL DATA CALCULATION ---
    const [timeRange, setTimeRange] = useState<"today" | "yesterday" | "7d" | "30d">("7d")








    const getAnalyticsData = (range: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const days = range === '30d' ? 30 : range === '7d' ? 7 : range === 'yesterday' ? 2 : 1;

        // Build a dense array of the last N dates (oldest → newest)
        const dateKeys: string[] = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            dateKeys.push(d.toISOString().split('T')[0]);
        }

        // Index the API data by date string
        const byDate = new Map<string, DailyAnalyticsBucket>();
        analyticsData.forEach(b => byDate.set(b.date, b));

        const chartMessages = dateKeys.map(k => byDate.get(k)?.messages ?? 0);
        const chartConvos   = dateKeys.map(k => byDate.get(k)?.conversations ?? 0);

        return {
            messages: chartMessages.reduce((a, b) => a + b, 0),
            conversations: chartConvos.reduce((a, b) => a + b, 0),
            chartMessages,
            chartConvos,
        };
    };
















    const currentData = getAnalyticsData(timeRange);
    const [selectedWaSessionId, setSelectedWaSessionId] = useState<string>("")
    const [lastPollTime, setLastPollTime] = useState<string>("Never")
    const [conversationRefreshKey, setConversationRefreshKey] = useState(0)
    const selectedWaSessionIdRef = useRef<string>("")
    const lastSelectedSessionActiveRef = useRef<string>("")

    // Keep ref in sync with state to avoid stale closures in polling interval
    useEffect(() => {
        selectedWaSessionIdRef.current = selectedWaSessionId;
        // Reset lastActive tracking when session changes so next poll correctly detects updates
        lastSelectedSessionActiveRef.current = "";
    }, [selectedWaSessionId])

    // ROBUST LOOKUP: Match by ID as a string to avoid type mismatches
    const activeWaSession = whatsappSessions.find(s => String(s.id) === String(selectedWaSessionId)) || whatsappSessions[0] || null
    const [noteValue, setNoteValue] = useState("")
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const waMessagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const newFolderInputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const CURRENT_NAMESPACE = useRef("")
















    const { user } = useUser()

    // --- Set Pinecone namespace ---
    useEffect(() => {
        if (user?.id) {
            // Set namespace immediately from user.id (Clerk oauthId) so Pinecone is always ready
            CURRENT_NAMESPACE.current = user.id
            console.log("✅ Sara AI: Using user.id for Pinecone namespace:", user.id)
        }
    }, [user?.id])

    const [mounted, setMounted] = useState(false)
    useEffect(() => {
        setMounted(true)
        const savedTheme = localStorage.getItem("theme")
        if (savedTheme) setIsDark(savedTheme === "dark")
        else setIsDark(true)
















































        const savedChats = localStorage.getItem("alex-ai-chats")
        if (savedChats) {
            try {
                const parsedChats = JSON.parse(savedChats) as Record<string, ChatSession>
                setChats(parsedChats)
                if (Object.keys(parsedChats).length > 0) {
                    const sorted = Object.entries(parsedChats).sort(
                        ([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
                    )
                    const recentChatId = sorted[0][0]
                    setCurrentChatId(recentChatId)
                    setMessages(parsedChats[recentChatId].messages || [])
                }
            } catch (e) {
                console.error("Failed to parse saved chats", e)
            }
        }
















        const savedFolders = localStorage.getItem("alex-ai-folders")
        if (savedFolders) {
            try {
                setFolders(JSON.parse(savedFolders))
            } catch (e) {
                console.error("Failed to parse folders", e)
            }
        }




        // Load WhatsApp Sessions & Sync State
        const savedWaSessions = localStorage.getItem("sara-ai-whatsapp-sessions")
        const savedSelection = localStorage.getItem("sara-ai-selected-id")


        if (savedWaSessions) {
            try {
                const parsed = JSON.parse(savedWaSessions);
                if (Array.isArray(parsed)) {
                    // Normalize any old "phone|| phone" IDs stored in cache
                    const seen = new Set<string>();
                    const cleaned = parsed
                        .map(s => {
                            const cleanId = String(s.id || s.phoneNumber || '').split('||')[0].trim();
                            return {
                                ...s,
                                id: cleanId,
                                phoneNumber: cleanId,
                                messages: (s.messages || []).filter((m: any) => !JSON.stringify(m).includes('{{'))
                            };
                        })
                        .filter(s => {
                            if (!s.id || seen.has(s.id)) return false;
                            seen.add(s.id);
                            return true;
                        });
                    setWhatsappSessions(cleaned);
                    if (savedSelection) {
                        setSelectedWaSessionId(savedSelection.split('||')[0].trim());
                    }
                }
            } catch (e) {
                console.error("Failed to parse saved WhatsApp sessions", e)
            }
        }
    }, [])
















    useEffect(() => {
        if (mounted) {
            if (isDark) {
                document.documentElement.classList.add("dark")
                localStorage.setItem("theme", "dark")
            } else {
                document.documentElement.classList.remove("dark")
                localStorage.setItem("theme", "light")
            }
        }
    }, [isDark, mounted])








    // --- API DATA FETCH (POLLING EVERY 10 SECONDS) ---
    const fetchHistory = async (isManual = false) => {
        if (!mounted || activeAgentId !== 'sara-ai') return;
        if (isManual) setIsLoading(true);

        try {
            const data = await saraAiService.getSessions();
            const sessions = data.sessions || [];

            if (sessions.length > 0) {
                console.log(`[Sara Polling] API Sync: Received ${sessions.length} sessions at ${new Date().toLocaleTimeString()}`);
                setLastPollTime(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

                setWhatsappSessions(prev => {
                    const mergedMap = new Map();
                    // 1. Maintain context from current sidebar — normalize any old "phone|| phone" IDs
                    prev.forEach(s => {
                        const rawId = String(s.id || s.session_id || s.phoneNumber).trim();
                        const safeId = rawId.split('||')[0].trim(); // strip duplicate suffix
                        if (safeId && safeId !== "undefined") {
                            mergedMap.set(safeId, { ...s, id: safeId, phoneNumber: safeId });
                        }
                    });

                    // 2. Process incoming sessions from API
                    sessions.forEach((incoming: SaraSession) => {
                        const sId = String(incoming.phoneNumber).trim();

                        const existing = mergedMap.get(sId);
                        if (existing) {
                            // Update existing session with new data
                            mergedMap.set(sId, {
                                ...existing,
                                id: sId,
                                phoneNumber: incoming.phoneNumber,
                                lastActive: incoming.lastMessageAt || existing.lastActive,
                                // Keep messages from existing - they get loaded on selection
                            });
                        } else {
                            console.log(`[Sara Polling] Sidebar: Adding NEW session for ${sId}`);
                            mergedMap.set(sId, {
                                id: sId,
                                phoneNumber: incoming.phoneNumber,
                                userName: incoming.phoneNumber,
                                lastActive: incoming.lastMessageAt || new Date().toISOString(),
                                status: 'active' as const,
                                messages: [],
                                toolUsage: [],
                                platform: 'mobile' as const,
                            });
                        }
                    });

                    const sorted = Array.from(mergedMap.values()).sort((a: any, b: any) =>
                        new Date(b.lastActive || 0).getTime() - new Date(a.lastActive || 0).getTime()
                    );

                    localStorage.setItem("sara-ai-whatsapp-sessions", JSON.stringify(sorted));
                    return [...sorted]; // New ref triggers React re-draw
                });

                setSelectedWaSessionId(prev => {
                    const cleanPrev = prev ? prev.split('||')[0].trim() : "";
                    const next = cleanPrev || (sessions[0]?.phoneNumber ? String(sessions[0].phoneNumber).trim() : "");
                    if (next) localStorage.setItem("sara-ai-selected-id", next);
                    return next;
                });

                // Detect new messages in the currently selected session and trigger conversation reload
                const currentSelectedId = selectedWaSessionIdRef.current;
                if (currentSelectedId) {
                    const selectedIncoming = sessions.find((s: SaraSession) => String(s.phoneNumber).trim() === currentSelectedId);
                    if (selectedIncoming?.lastMessageAt) {
                        const newLastActive = String(selectedIncoming.lastMessageAt);
                        if (newLastActive !== lastSelectedSessionActiveRef.current) {
                            lastSelectedSessionActiveRef.current = newLastActive;
                            setConversationRefreshKey(k => k + 1);
                        }
                    }
                }
            }
            if (isManual) setIsLoading(false);
        } catch (err) {
            console.error("Polling Error:", err);
            if (isManual) setIsLoading(false);
        }
    };




    useEffect(() => {
        if (activeAgentId === 'sara-ai' && mounted) {
            fetchHistory();
            const interval = setInterval(() => fetchHistory(false), 10000);
            return () => clearInterval(interval);
        }
    }, [activeAgentId, mounted]);

    // Fetch real stats from API
    useEffect(() => {
        const fetchStats = async () => {
            if (!mounted || activeAgentId !== 'sara-ai') return;
            try {
                const stats = await saraAiService.getStats();
                setApiStats(stats);
                console.log('[Sara Stats] Fetched:', stats);
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            }
        };

        if (activeAgentId === 'sara-ai' && mounted) {
            fetchStats();
            // Refresh stats every 30 seconds
            const interval = setInterval(fetchStats, 30000);
            return () => clearInterval(interval);
        }
    }, [activeAgentId, mounted]);

    // Fetch analytics data from the DB (always 30 days so we can slice client-side)
    useEffect(() => {
        const fetchAnalytics = async () => {
            if (!mounted || activeAgentId !== 'sara-ai') return;
            try {
                const result = await saraAiService.getAnalytics(30);
                setAnalyticsData(result.daily);
            } catch (err) {
                console.error('Failed to fetch analytics:', err);
            }
        };

        if (activeAgentId === 'sara-ai' && mounted) {
            fetchAnalytics();
            const interval = setInterval(fetchAnalytics, 60000);
            return () => clearInterval(interval);
        }
    }, [activeAgentId, mounted]);

    // Load full conversation when a session is selected
    useEffect(() => {
        const loadConversation = async () => {
            if (!selectedWaSessionId || !mounted || activeAgentId !== 'sara-ai') return;

            setIsConversationLoading(true);
            try {
                const conversationData = await saraAiService.getConversation(selectedWaSessionId);

                // Map API messages to WhatsAppSession messages format
                // Treat any sender that is NOT clearly a human as AI
                const AI_SENDERS = new Set(['ai', 'bot', 'assistant', 'sara', 'sara_ai', 'system', 'metis']);
                const mappedMessages = conversationData.messages.map((msg: SaraMessage) => ({
                    text: msg.text,
                    sender: (AI_SENDERS.has((msg.sender || '').toLowerCase()) ? 'ai' : 'user') as 'ai' | 'user',
                    time: (() => {
                        const msgDate = new Date(msg.createdAt);
                        const today = new Date();
                        const isToday = msgDate.toDateString() === today.toDateString();
                        if (isToday) {
                            return msgDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                        }
                        return msgDate.toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                    })(),
                }));

                // Update the session with full messages
                setWhatsappSessions(prev => {
                    return prev.map(session => {
                        if (String(session.id) === String(selectedWaSessionId)) {
                            return { ...session, messages: mappedMessages };
                        }
                        return session;
                    });
                });
            } catch (err) {
                console.error("Failed to load conversation:", err);
            } finally {
                setIsConversationLoading(false);
            }
        };

        loadConversation();
    }, [selectedWaSessionId, mounted, activeAgentId, conversationRefreshKey]);



    // Enhanced scroll & update reactivity
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        waMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [
        messages,
        selectedWaSessionId,
        activeWaSession?.messages?.length,
        activeWaSession?.messages?.[(activeWaSession?.messages?.length || 1) - 1]?.text,
        isDashboardMode,
        saraSection
    ])




    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto"
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px"
        }
    }, [inputValue])
















    const switchAgent = (agentId: string) => {
        const agent = AGENTS_DB[agentId]
        if (agent) {
            setActiveAgentId(agentId)
            if (agent.isDashboardOnly) {
                setSaraSection("analytics")
            }
            if (window.innerWidth < 768) setSidebarVisible(false)
        }
    }




    const initNewChatForAgent = (agent: any, specificAgentId?: string) => {
        if (agent.isDashboardOnly) return;


        const targetAgentId = specificAgentId || activeAgentId
        const newChatId = "chat_" + Date.now()
        const newSessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)






        let messageText = `Ciao! Sono **${agent.name}**. ${agent.description} Come posso aiutarti?`




        if (agent.name === "Alex AI") {
            messageText = `Ciao! Sono Alex AI, il tuo Cross-Platform Ads Strategist. Come posso supportarti oggi?`
        }




        const welcomeMsg: Message = {
            text: messageText,
            sender: "ai",
            time: new Date().toISOString(),
        }




        setCurrentChatId(newChatId)
        setMessages([welcomeMsg])




        setChats((prev) => {
            const newChat: ChatSession = {
                id: newChatId,
                messages: [welcomeMsg],
                title: `Missione con ${agent.name}`,
                lastUpdated: new Date().toISOString(),
                folderId: null,
                archived: false,
                agentId: targetAgentId,
                sessionId: newSessionId,
            }
            const newChats = { [newChatId]: newChat, ...prev }
            localStorage.setItem("alex-ai-chats", JSON.stringify(newChats))
            return newChats
        })
    }




    const updateChatState = (chatId: string, updates: Partial<ChatSession>) => {
        setChats((prev) => {
            const existing = prev[chatId]
            if (!existing) return prev
            const updatedChat = { ...existing, ...updates }
            const newChats = { ...prev, [chatId]: updatedChat }
            localStorage.setItem("alex-ai-chats", JSON.stringify(newChats))
            return newChats
        })
    }




    const createNewChat = () => {
        if (isDashboardMode) {
            switchAgent("alex-ai")
            setTimeout(() => {
                initNewChatForAgent(AGENTS_DB["alex-ai"])
                setSidebarVisible(true)
                setSidebarMode("chats")
            }, 100)
        } else {
            initNewChatForAgent(currentAgent)
            setSidebarVisible(true)
            setSidebarMode("chats")
        }
    }




    const loadChat = (chatId: string) => {
        if (!chats[chatId]) return
        setCurrentChatId(chatId)
        setMessages(chats[chatId].messages || [])
        if (chats[chatId].agentId && chats[chatId].agentId !== activeAgentId) {
            setActiveAgentId(chats[chatId].agentId)
        }
        setActiveMenu(null)
        if (window.innerWidth < 768) {
            setSidebarVisible(false)
        }
    }




    const confirmCreateFolder = () => {
        if (!newFolderName.trim()) { setIsCreatingFolder(false); return }
        const newFolder: FolderType = { id: `folder_${Date.now()}`, name: newFolderName, createdAt: new Date().toISOString() }
        const updatedFolders = [...folders, newFolder]
        setFolders(updatedFolders)
        localStorage.setItem("alex-ai-folders", JSON.stringify(updatedFolders))
        setExpandedFolders((prev) => new Set(prev).add(newFolder.id))
        setIsCreatingFolder(false)
        setNewFolderName("")
    }
    const cancelCreateFolder = () => { setIsCreatingFolder(false); setNewFolderName("") }
    const startCreateFolder = () => { setIsCreatingFolder(true); setNewFolderName("") }
    const toggleFolder = (folderId: string) => { setExpandedFolders((prev) => { const next = new Set(prev); if (next.has(folderId)) next.delete(folderId); else next.add(folderId); return next }) }
    const deleteFolder = (folderId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm("Eliminare cartella?")) return
        const updatedChats = { ...chats }
        Object.keys(updatedChats).forEach((key) => { if (updatedChats[key].folderId === folderId) updatedChats[key].folderId = null })
        setChats(updatedChats); localStorage.setItem("alex-ai-chats", JSON.stringify(updatedChats))
        const updatedFolders = folders.filter((f) => f.id !== folderId)
        setFolders(updatedFolders); localStorage.setItem("alex-ai-folders", JSON.stringify(updatedFolders))
    }
    const deleteChat = (chatIdToDelete: string, e?: React.MouseEvent) => {
        if (e) { e.preventDefault(); e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }
        setActiveMenu(null);
        if (!confirm("Eliminare questa chat?")) return;
        const updatedChats = { ...chats }; delete updatedChats[chatIdToDelete];
        setChats(updatedChats); localStorage.setItem("alex-ai-chats", JSON.stringify(updatedChats));
    }
    const archiveChat = (chatId: string) => { updateChatState(chatId, { archived: !chats[chatId]?.archived }); setActiveMenu(null); }
    const startRenaming = (chatId: string) => { setRenamingChat(chatId); setRenameValue(chats[chatId]?.title || ""); setActiveMenu(null); }
    const confirmRename = (chatId: string) => { if (!renameValue.trim()) { setRenamingChat(null); return; } updateChatState(chatId, { title: renameValue.trim() }); setRenamingChat(null); }
    const handleDragStart = (e: React.DragEvent, chatId: string) => { e.dataTransfer.setData("chatId", chatId); setDraggedChatId(chatId); }
    const handleDragOver = (e: React.DragEvent, folderId: string | null) => { e.preventDefault(); setDragOverFolderId(folderId); }
    const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => { e.preventDefault(); setDragOverFolderId(null); const chatId = e.dataTransfer.getData("chatId"); if (!chatId || !chats[chatId]) return; updateChatState(chatId, { folderId: targetFolderId }); if (targetFolderId) setExpandedFolders((prev) => new Set(prev).add(targetFolderId)); setDraggedChatId(null); }




    const formatMessageText = (text: string) => { try { return simpleMarkdown.parse(text) } catch (e) { return text } }




    const sendMessage = async () => {
        if (!inputValue.trim() && selectedFiles.length === 0) return




        setIsLoading(true)
        const userMessage: Message = {
            text: inputValue,
            sender: "user",
            time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
            files: selectedFiles.map((f) => f.name),
        }




        let currentMessages = [...messages, userMessage]
        let currentChatIdForSend = currentChatId




        if (!currentChatIdForSend) {
            const newChatId = "chat_" + Date.now()
            const newSessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)
            const agent = AGENTS_DB[activeAgentId]
            const welcomeMsg: Message = {
                text: `Ciao! Sono **${agent.name}**. ${agent.description} Come posso aiutarti?`,
                sender: "ai",
                time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
            }
            const newChat: ChatSession = { id: newChatId, title: `Missione con ${agent.name}`, messages: [welcomeMsg, userMessage], lastUpdated: new Date().toISOString(), folderId: null, archived: false, agentId: activeAgentId, sessionId: newSessionId }
            const updatedChatsState = { ...chats, [newChatId]: newChat }
            setChats(updatedChatsState)
            setCurrentChatId(newChatId)
            currentChatIdForSend = newChatId
            currentMessages = [welcomeMsg, userMessage]
            setMessages(currentMessages)
            localStorage.setItem("alex-ai-chats", JSON.stringify(updatedChatsState))
        } else {
            const updatedChatSession = { ...chats[currentChatIdForSend], messages: currentMessages, lastUpdated: new Date().toISOString(), title: chats[currentChatIdForSend]?.title || inputValue.slice(0, 30) || "Nuova Missione" }
            const updatedChatsState = { ...chats, [currentChatIdForSend]: updatedChatSession }
            setChats(updatedChatsState)
            setMessages(currentMessages)
            localStorage.setItem("alex-ai-chats", JSON.stringify(updatedChatsState))
        }




        const aiResponsePlaceholder: Message = { text: "...", sender: "ai", time: "", raw: "" }
        setMessages((prev) => [...prev, aiResponsePlaceholder])




        try {
            const currentChat = chats[currentChatIdForSend!]
            let sessionId = currentChat?.sessionId
            if (!sessionId) sessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9) // fallback




            // USE POST URL FOR CHAT
            const response = await fetch(N8N_CHAT_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chatInput: inputValue + (selectedFiles.length ? ` [Attached: ${selectedFiles.map((f) => f.name).join(", ")}]` : ""),
                    sessionId: sessionId,
                    useMemory: useMemory,
                    metadata: { namespace: CURRENT_NAMESPACE.current, source: activeAgentId },
                    chatId: currentChatIdForSend,
                }),
            })






            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            if (!response.body) throw new Error("No response body")




            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""
            let rawText = "" // full text accumulated from the stream so far
            let isFirstChunk = true

            // --- Smooth typewriter reveal ---
            // n8n streams the reply in chunks, but the network often delivers several
            // chunks bunched into a single read. React 18 then batches those state
            // updates into one render, so the text pops in all at once instead of
            // streaming. We decouple display from arrival: the reader fills `rawText`,
            // and this timer reveals it character-by-character so it always animates.
            let displayedLen = 0
            let streamDone = false
            let typewriterTimer: ReturnType<typeof setTimeout> | null = null

            const renderStreaming = (text: string) => {
                setMessages((prev) => {
                    const newMsgs = [...prev]
                    const last = newMsgs[newMsgs.length - 1]
                    newMsgs[newMsgs.length - 1] = { ...last, text }
                    return newMsgs
                })
            }

            const typewriterDone = new Promise<void>((resolve) => {
                const tick = () => {
                    if (displayedLen < rawText.length) {
                        const remaining = rawText.length - displayedLen
                        const step = Math.max(2, Math.ceil(remaining / 20))
                        displayedLen = Math.min(rawText.length, displayedLen + step)
                        renderStreaming(rawText.slice(0, displayedLen))
                    }
                    if (streamDone && displayedLen >= rawText.length) {
                        typewriterTimer = null
                        resolve()
                        return
                    }
                    typewriterTimer = setTimeout(tick, 16)
                }
                tick()
            })




            try {
                while (true) {
                    const { value, done } = await reader.read()
                    if (done) break
                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split(/\r?\n/)
                    buffer = lines.pop() || ""
                    for (const line of lines) {
                        const trimmed = line.replace(/^data:\s?/, "").trim()
                        if (!trimmed) continue
                        try {
                            const obj = JSON.parse(trimmed)
                            if (obj.type === "item" && typeof obj.content === "string") {
                                if (isFirstChunk) { rawText = obj.content; isFirstChunk = false } else { rawText += obj.content }
                                // The typewriter loop picks up the new rawText on its next tick.
                            } else if (obj.type === "done" || obj.type === "end") { break }
                        } catch (e) { console.error("JSON Error:", e) }
                    }
                }
            } catch (streamError) {
                if (!rawText) {
                    streamDone = true
                    if (typewriterTimer) clearTimeout(typewriterTimer)
                    throw streamError
                }
                console.warn("Streaming interrupted, using partial response", streamError)
            }

            // Let the typewriter drain any remaining buffered characters before finalizing.
            streamDone = true
            await typewriterDone




            const finalAiMessage: Message = { text: rawText.trim() || "La risposta è stata completata.", sender: "ai", time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }), raw: rawText }
            setMessages((prev) => {
                const newMsgs = [...prev]
                newMsgs[newMsgs.length - 1] = finalAiMessage
                const updatedChatSession = { ...chats[currentChatIdForSend!], messages: newMsgs, lastUpdated: new Date().toISOString() }
                const updatedChatsState = { ...chats, [currentChatIdForSend!]: updatedChatSession }
                localStorage.setItem("alex-ai-chats", JSON.stringify(updatedChatsState))
                setChats(updatedChatsState)
                return newMsgs
            })
        } catch (error) {
            setMessages((prev) => { const newMsgs = [...prev]; newMsgs[newMsgs.length - 1].text = `Errore di connessione.`; return newMsgs })
        } finally {
            setIsLoading(false); setInputValue(""); setSelectedFiles([])
        }
    }
    const handleAttachment = () => fileInputRef.current?.click()
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files?.length) setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)]) }
    const removeFile = (index: number) => { setSelectedFiles((prev) => prev.filter((_, i) => i !== index)) }
    const handleCopyMessage = async (text: string, index: number) => { navigator.clipboard.writeText(text); setCopiedMessageIndex(index); setTimeout(() => setCopiedMessageIndex(null), 2000) }




    // --- SAFE RENDER CHECK ---
    if (!mounted) return <div className="h-screen w-full bg-slate-900 flex items-center justify-center text-sky-500">Loading AI Team...</div>
    // --- REAL ANALYTICS CALCULATIONS ---
    // 1. Count Total Conversations (number of people in your list)
    const totalConversations = whatsappSessions.length;




    // 2. Count Total Incoming Messages (sum of all real messages sent by 'user')
    const totalMessages = whatsappSessions.reduce((total, session) => {
        if (!session.messages) return total;
        // Count real user messages (ignore zombie strings)
        const userMsgCount = session.messages.filter(m =>
            m.sender === 'user' && !m.text.includes('{{')
        ).length;
        return total + userMsgCount;
    }, 0);




    const renderAnalytics = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Analytics</h2>








                {/* --- FILTER BAR --- */}
                <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    {[
                        { id: "today", label: "Oggi" },
                        { id: "yesterday", label: "Ieri" },
                        { id: "7d", label: "7 Giorni" },
                        { id: "30d", label: "30 Giorni" }
                    ].map((filter) => (
                        <button
                            key={filter.id}
                            onClick={() => setTimeRange(filter.id as any)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${timeRange === filter.id
                                ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 dark:text-slate-400"
                                }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>




            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1: Incoming Messages */}
                <div className="glass-panel p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-slate-500 dark:text-slate-400 font-medium">Incoming Messages</h3>
                        <span className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1">
                            <ArrowDownRight size={12} className="rotate-180" /> Live
                        </span>
                    </div>
                    <div className="text-4xl font-bold text-slate-800 dark:text-white mb-6">
                        {totalMessages}
                    </div>
                    <SimpleLineChart
                        data={currentData.chartMessages}
                        color="#2EB9FF"
                        height={150}
                        timeRange={timeRange}
                    />
                </div>




                {/* Card 2: Total Conversations */}
                <div className="glass-panel p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-slate-500 dark:text-slate-400 font-medium">Total Conversations</h3>
                        <span className="px-2 py-1 rounded-md bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1">
                            <ArrowDownRight size={12} /> Avg
                        </span>
                    </div>
                    <div className="text-4xl font-bold text-slate-800 dark:text-white mb-6">
                        {totalConversations}
                    </div>
                    <SimpleLineChart
                        data={currentData.chartConvos}
                        color="#FF9F2E"
                        height={150}
                        timeRange={timeRange}
                    />
                </div>
            </div>
        </div>
    )
    const renderConversations = () => {
        return (
            <div className="flex h-[calc(100vh-140px)] gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
                {/* List Column */}
                <div className="w-80 shrink-0 glass-panel rounded-xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/50">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 dark:text-white truncate">Chats ({whatsappSessions.length})</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 font-mono">{lastPollTime}</span>
                                <button onClick={() => fetchHistory(true)} className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors ${isLoading ? 'animate-spin text-sky-500' : 'text-slate-400'}`}>
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
                                <input className="w-full bg-slate-100 dark:bg-black/20 border border-transparent focus:border-sky-500 rounded-lg pl-7 pr-1 py-2 text-xs focus:outline-none dark:text-white" placeholder="Cerca" />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {whatsappSessions.length === 0 && (
                            <div className="p-4 text-center">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Nessuna conversazione trovata.</p>
                                <button
                                    onClick={() => fetchHistory(true)}
                                    className="text-[10px] text-sky-500 hover:underline"
                                >
                                    Ricarica Pagina
                                </button>
                            </div>
                        )}
                        {whatsappSessions.map(session => (
                            <div key={session.id} onClick={() => setSelectedWaSessionId(String(session.id))} className={`p-2 rounded-lg cursor-pointer border transition-all ${String(selectedWaSessionId) === String(session.id) ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-500/30' : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate">{session.phoneNumber}</span>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] text-slate-400 whitespace-nowrap">
                                            {new Date(session.lastActive).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <div className="flex items-center gap-1">{session.platform === 'web' ? <ExternalLink size={8} className="text-sky-400" /> : <Smartphone size={8} className="text-emerald-400" />}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>




                {/* Chat Column */}
                <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/50 relative min-w-[300px]">
                    {/* Chat Header */}
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            {activeWaSession ? (
                                <>
                                    <Smartphone size={16} className="text-emerald-400" />
                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">{activeWaSession.phoneNumber}</span>
                                    <span className="text-[10px] text-slate-400">
                                        {activeWaSession.messages?.length || 0} messaggi
                                    </span>
                                </>
                            ) : (
                                <span className="text-sm text-slate-400">Nessuna chat selezionata</span>
                            )}
                        </div>
                    </div>
                    <div key={activeWaSession?.id} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-black/20">
                        {/* No session selected */}
                        {!selectedWaSessionId && (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                                <MessageSquare size={40} className="text-slate-300 dark:text-slate-600" />
                                <p className="text-sm text-slate-400 dark:text-slate-500">Seleziona una conversazione dalla lista</p>
                            </div>
                        )}
                        {/* Loading conversation */}
                        {selectedWaSessionId && isConversationLoading && (
                            <div className="flex flex-col items-center justify-center h-full gap-3">
                                <RefreshCw size={28} className="animate-spin text-sky-400" />
                                <p className="text-xs text-slate-400">Caricamento conversazione...</p>
                            </div>
                        )}
                        {/* Empty conversation */}
                        {selectedWaSessionId && !isConversationLoading && (!activeWaSession?.messages || activeWaSession.messages.length === 0) && (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                                <MessageSquare size={40} className="text-slate-300 dark:text-slate-600" />
                                <p className="text-sm text-slate-400 dark:text-slate-500">Nessun messaggio trovato per questa sessione</p>
                            </div>
                        )}
                        {/* Messages */}
                        {!isConversationLoading && activeWaSession?.messages?.map((msg, idx) => (
                            <div key={idx} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.sender === 'ai' && (
                                    <img src={currentAgent.image} className="w-8 h-8 rounded-full shadow-sm object-cover shrink-0" />
                                )}
                                <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-sm ${
                                    msg.sender === 'ai'
                                        ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-sm'
                                        : 'bg-sky-500 text-white rounded-br-sm'
                                }`}>
                                    <div className="leading-relaxed">{msg.text}</div>
                                    <div className={`text-[10px] mt-1 ${msg.sender === 'ai' ? 'opacity-40' : 'opacity-70'} text-right`}>{msg.time}</div>
                                </div>
                                {msg.sender === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-slate-500 dark:bg-slate-600 flex items-center justify-center shrink-0 shadow-sm">
                                        <User size={16} className="text-white" />
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={waMessagesEndRef} />
                    </div>
                </div>




            </div>
        )
    }



    const renderQRCode = () => {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="glass-panel p-8 rounded-2xl border border-slate-200 dark:border-slate-700/50 max-w-md w-full text-center relative overflow-hidden">
                    {/* Status Bar */}
                    <div className={`absolute top-0 left-0 w-full h-1 ${qrStatus === 'connected' ? 'bg-green-500' : 'bg-slate-300'}`} />

                    <div className="mb-6">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                            <QrCode size={40} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Connetti WhatsApp</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Scansiona il codice QR con il tuo WhatsApp per iniziare a ricevere messaggi</p>
                    </div>

                    {/* QR Code Area */}
                    <div className="bg-white p-4 rounded-xl shadow-inner mb-6 inline-block relative min-h-[224px] min-w-[224px] flex items-center justify-center">
                        {isQrLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-xl">
                                <RefreshCw className="animate-spin text-green-500" size={32} />
                            </div>
                        ) : qrCode ? (
                            <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 object-contain" />
                        ) : (
                            <div className="w-48 h-48 bg-slate-100 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-300">
                                <div className="text-center">
                                    <QrCode size={64} className="text-slate-300 mx-auto mb-2" />
                                    <span className="text-xs text-slate-400">Il Codice QR apparirà qui</span>
                                </div>
                            </div>
                        )}

                        {/* Refresh Button (visible when QR exists) */}
                        {qrCode && !isQrLoading && (
                            <button
                                onClick={generateQRCode}
                                className="absolute -bottom-3 -right-3 p-2 rounded-full bg-white shadow-md text-slate-500 hover:text-green-600 hover:scale-110 transition-all border border-slate-100"
                                title="Aggiorna Codice QR"
                            >
                                <RefreshCw size={16} />
                            </button>
                        )}
                    </div>

                    <div className="space-y-3">
                        {!qrCode ? (
                            <button
                                onClick={generateQRCode}
                                disabled={isQrLoading}
                                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isQrLoading ? 'Generazione in corso...' : 'Genera Codice QR'}
                            </button>
                        ) : (
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/30">
                                <p className="text-xs text-green-700 dark:text-green-400 font-medium">Il QR si aggiorna automaticamente ogni 20s</p>
                            </div>
                        )}

                        <p className="text-xs text-slate-400">Apri WhatsApp → Impostazioni → Dispositivi collegati → Collega un dispositivo</p>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-center gap-2 text-sm">
                            <div className={`w-2.5 h-2.5 rounded-full ${qrStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                            <span className="text-slate-500 dark:text-slate-400 font-medium">
                                {qrStatus === 'connected' ? 'Connesso' : 'Non Connesso'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }




    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
            <style>{`
        :root { --brand-dark: #020617; --font-tech: 'Rajdhani', sans-serif; }
        body { font-family: var(--font-tech); background-color: #f8fafc; color: #0f172a; overflow: hidden; }
        .dark body { background-color: var(--brand-dark); color: #f8fafc; }
        .glass-panel { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05); }
        .dark .glass-panel { background: rgba(2, 6, 23, 0.85); border: 1px solid rgba(14, 165, 233, 0.15); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4); }
        .btn-electric { background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); box-shadow: 0 0 15px rgba(14,165,233,0.5); transition: all 0.3s ease; }
        .btn-electric:hover { box-shadow: 0 0 25px rgba(14,165,233,0.8); transform: translateY(-1px); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 2px; }
      `}</style>






            <div className={`flex h-screen w-full bg-tech-grid azure-glow-bg ${isDark ? "dark" : ""}`}>
                {/* Sidebar */}
                <div className={`glass-panel flex flex-col transition-all duration-300 ease-in-out z-40 ${sidebarVisible ? (isSidebarCollapsed ? "w-20" : "w-56") : "w-0"} fixed md:relative h-full border-r border-sky-100 dark:border-sky-900/30 overflow-hidden`}>
                    <div className={`p-4 border-b border-sky-100 dark:border-sky-900/30 bg-gradient-to-b from-white/50 to-transparent dark:from-sky-900/20 flex flex-col ${isSidebarCollapsed ? 'items-center' : ''}`}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-sky-400 to-cyan-300 shadow-lg shadow-sky-400/20">
                                <img src={currentAgent.image} className="w-full h-full rounded-full object-cover" />
                            </div>
                            {!isSidebarCollapsed && <span className="font-bold text-xl tracking-wider text-slate-800 dark:text-white font-tech">AI TEAM</span>}
                            {!isSidebarCollapsed && <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="ml-auto p-1.5 rounded-lg hover:bg-white/10"><ChevronLeft size={18} /></button>}
                        </div>
                        {isSidebarCollapsed && <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="mb-6 p-1.5 rounded-lg hover:bg-white/10"><ChevronRight size={18} /></button>}






                        {isDashboardMode ? (
                            <>
                                {/* --- CHATS MENU --- */}
                                <div className="space-y-1">
                                    <button onClick={() => setSaraSection('analytics')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${saraSection === 'analytics' ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20' : 'text-slate-500 hover:bg-white/5'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                                        <BarChart3 size={20} /> {!isSidebarCollapsed && "Analytics"}
                                    </button>
                                    <button onClick={() => setSaraSection('conversations')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${saraSection === 'conversations' ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20' : 'text-slate-500 hover:bg-white/5'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                                        <MessageSquare size={20} /> {!isSidebarCollapsed && "Conversations"}
                                    </button>
                                    <button onClick={() => setSaraSection('qrcode')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${saraSection === 'qrcode' ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20' : 'text-slate-500 hover:bg-white/5'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                                        <QrCode size={20} /> {!isSidebarCollapsed && "WhatsApp Connect"}
                                    </button>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>




                {/* Main Content */}
                <div className="flex-1 flex flex-col relative h-full overflow-hidden bg-slate-50/50 dark:bg-transparent">
                    {/* Header */}
                    <div className="sticky top-4 z-50 px-4 md:px-8">
                        <div className="w-full max-w-full mx-auto rounded-2xl p-1 shadow-2xl bg-slate-800/95 border border-sky-500/30 backdrop-blur-xl">
                            <div className="relative flex items-center justify-between p-3 md:p-4 rounded-xl z-10">
                                <div className="flex items-center gap-4">
                                    <div className="relative w-16 h-16 shrink-0 rounded-full border-[3px] border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.6)] overflow-hidden bg-slate-950">
                                        <img src={currentAgent.image} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-black text-white uppercase tracking-widest leading-none">SARA AI</h1>
                                        <span className="px-2 py-0.5 rounded bg-sky-500 text-white text-[10px] font-bold tracking-widest shadow-[0_0_10px_rgba(14,165,233,0.5)] uppercase">ONLINE</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setIsDark(!isDark)} className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition text-slate-300"><Sun size={20} /></button>
                                    <MockUserButton />
                                </div>
                            </div>
                        </div>
                    </div>






                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar">
                        {isDashboardMode ? (
                            <>
                                {saraSection === 'analytics' && renderAnalytics()}
                                {saraSection === 'conversations' && renderConversations()}
                                {saraSection === 'qrcode' && renderQRCode()}
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500">Select an option from the sidebar</div>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}








