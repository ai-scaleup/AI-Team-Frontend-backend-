"use client"


import type React from "react"
import { useState, useEffect, useRef } from "react"
import {
  Edit2, Trash2, Check, Copy, Sun, Moon, Zap, MessageSquare, User, Send, Paperclip,
  ChevronRight, Users, LayoutGrid, ChevronLeft, BrainCircuit, FolderPlus, Folder,
  FolderOpen, ChevronDown, MoreHorizontal, Share, Archive, X, RotateCcw, FileText,
  ExternalLink, Menu, Home, BarChart3, Smartphone, Search, Filter, Download,
  ArrowDownRight, RefreshCw, Book, Tag, Settings, ArrowLeft, PanelRight,
  PanelRightClose, PanelRightOpen
} from "lucide-react"


// --- CONFIGURATION ---
// 1. CHAT URL (POST) - Sends new messages to AI
const N8N_CHAT_URL = "https://n8n-c2lq.onrender.com/webhook/60220da6-592c-4374-8668-602ab37df920";


// 2. HISTORY URL (GET) - Fetches conversation history
const N8N_HISTORY_URL = "https://n8n-c2lq.onrender.com/webhook/99cff9d0-c1ee-4a46-99d7-27f06ed97802";


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
  phoneNumber: string;
  userName: string;
  lastActive: string;
  status: "active" | "completed" | "needs_attention";
  messages: Message[];
  toolUsage: string[];
  platform: "web" | "mobile";
  notes?: string;
}


// --- CONSTANTS ---
// Mock Data (Fallback if N8N is offline)
const WHATSAPP_LOGS: WhatsAppSession[] = [
  {
    id: "wa_001",
    phoneNumber: "+39 340 555 0192",
    userName: "Marco R. (Offline)",
    lastActive: "Dec 5, 8:13 AM",
    status: "active",
    platform: "web",
    toolUsage: ["Google Calendar", "Redis Memory"],
    notes: "Interested in SEO services. Follow up next week.",
    messages: [
      { sender: "user", text: "Vorrei prenotare una call per discutere della strategia SEO.", time: "10:30" },
      { sender: "ai", text: "Certamente Marco. Ho accesso al calendario. Preferisci questa settimana o la prossima?", time: "10:30" },
      { sender: "user", text: "Va bene giovedì pomeriggio.", time: "10:31" },
      { sender: "ai", text: "Controllo subito... Ho uno slot libero giovedì alle 15:00 o alle 16:30. Quale preferisci?", time: "10:31" }
    ]
  }
];


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
  "chiara-ai": {
    name: "Chiara AI",
    role: "WhatsApp Assistant",
    image: "/assets/agents/Claudia-AI-sales-agent.png",
    description: "Automazione WhatsApp e Gestione Appuntamenti.",
    primaryColor: "#25D366",
    accentColor: "#128C7E",
    route: "/dashboard/chiara-ai",
    isDashboardOnly: true
  },
  "tony-ai": {
    name: "Tony AI",
    role: "Sales Manager",
    image: "/assets/agents/Tony-AI.png",
    description: "Il tuo consulente vendite digitale.",
    primaryColor: "#0ea5e9",
    accentColor: "#22d3ee",
    route: "/dashboard/tony-ai",
  },
  "mike-ai": {
    name: "Mike AI",
    role: "Marketing Manager",
    image: "/assets/agents/Mike-AI.png",
    description: "Il tuo stratega di marketing.",
    primaryColor: "#3b82f6",
    accentColor: "#60a5fa",
    route: "/dashboard/mike-ai",
  },
  "lara-ai": {
    name: "Lara AI",
    role: "Social Media Manager",
    image: "/assets/agents/Lara-AI-1.png",
    description: "Gestisco i tuoi social media.",
    primaryColor: "#ec4899",
    accentColor: "#f472b6",
    route: "/dashboard/lara-ai",
  },
  "laura-ai": {
    name: "Laura AI",
    role: "Social Media Manager",
    image: "/assets/agents/Laura-ai.png",
    description: "Gestisco i tuoi social media.",
    primaryColor: "#ec4899",
    accentColor: "#f472b6",
    route: "/dashboard/laura-ai",
  },
  "simone-ai": {
    name: "Simone AI",
    role: "SEO Copywriter",
    image: "/assets/agents/SImone-ai.png",
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
    image: "/assets/agents/Valentina-AI.png",
    description: "Ottimizzo i contenuti esistenti.",
    primaryColor: "#8b5cf6",
    accentColor: "#a78bfa",
    route: "/dashboard/valentina-ai",
  },
  "alex-ai": {
    name: "Alex AI",
    role: "Ads Manager",
    image: "/assets/agents/Alex-AI.png",
    description: "Gestisco le tue campagne pubblicitarie.",
    primaryColor: "#ef4444",
    accentColor: "#f87171",
    route: "/dashboard/alex-ai",
  },
  "aladino-ai": {
    name: "Aladino AI",
    role: "Innovation Manager",
    image: "/assets/agents/Aladdin-AI.png",
    description: "Invento nuovi prodotti.",
    primaryColor: "#6366f1",
    accentColor: "#818cf8",
    route: "/dashboard/aladino-ai",
  },
  "jim-ai": {
    name: "Jim AI",
    role: "Sales Coach",
    image: "/assets/agents/JIM-ai.png",
    description: "Alleno il tuo team di vendita.",
    primaryColor: "#f97316",
    accentColor: "#fb923c",
    route: "/dashboard/jim-ai",
  },
  "daniele-ai": {
    name: "Daniele AI",
    role: "Direct Response Copywriter",
    image: "/assets/agents/Daniele-ai.png",
    description: "Progetto e scrivo copy.",
    primaryColor: "#f97316",
    accentColor: "#fb923c",
    route: "/dashboard/daniele-ai",
  },
}


const AI_TEAM_LIST = [
  { id: "chiara-ai" }, { id: "mike-ai" }, { id: "tony-ai" },
  { id: "lara-ai" }, { id: "laura-ai" }, { id: "simone-ai" }, { id: "niko-ai" },
  { id: "valentina-ai" }, { id: "alex-ai" }, { id: "aladino-ai" },
  { id: "jim-ai" }, { id: "daniele-ai" }
]


// --- CHART COMPONENT ---
const SimpleLineChart = ({ data, color, height = 100 }: { data: number[], color: string, height?: number }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = 100 / (data.length - 1);


  let pathD = `M 0 ${100 - ((data[0] - min) / range) * 80 - 10}`;
  data.forEach((val, i) => {
    if (i === 0) return;
    const x = i * stepX;
    const y = 100 - ((val - min) / range) * 80 - 10;
    pathD += ` L ${x} ${y}`;
  });


  const fillD = `${pathD} L 100 100 L 0 100 Z`;


  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={fillD} fill={`url(#grad-${color})`} stroke="none" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
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
  const [activeAgentId, setActiveAgentId] = useState<string>("chiara-ai")
  const currentAgent = AGENTS_DB[activeAgentId] || AGENTS_DB["chiara-ai"]
  const isDashboardMode = currentAgent.isDashboardOnly === true
  const [chiaraSection, setChiaraSection] = useState<"analytics" | "conversations" | "settings">("analytics")
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(true)
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
  const [whatsappSessions, setWhatsappSessions] = useState<WhatsAppSession[]>(WHATSAPP_LOGS)
  const [selectedWaSessionId, setSelectedWaSessionId] = useState<string>(WHATSAPP_LOGS[0].id)
  const activeWaSession = whatsappSessions.find(s => s.id === selectedWaSessionId) || whatsappSessions[0] || WHATSAPP_LOGS[0]
  const [noteValue, setNoteValue] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const newFolderInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const CURRENT_NAMESPACE = useRef("")


  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme) setIsDark(savedTheme === "dark")
    else setIsDark(true)


    const generateUUID = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === "x" ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })


    let namespace = localStorage.getItem("Namespace")
    if (!namespace) {
      namespace = generateUUID()
      localStorage.setItem("Namespace", namespace)
    }
    CURRENT_NAMESPACE.current = namespace


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


  // --- N8N DATA FETCH (Using NEW History URL) ---
  useEffect(() => {
    if (activeAgentId === 'chiara-ai' && mounted) {
      console.log("Fetching real history from:", N8N_HISTORY_URL)


      fetch(N8N_HISTORY_URL, { method: 'GET' })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error("No data");
        })
        .then(data => {
          // If it's wrapped in { json: [...] }, unwrap it
          const actualData = Array.isArray(data) ? data : (data.json || []);


          // If nested deeply like [ { json: { ... } } ] from n8n Code node
          const cleanedData = actualData.map((item: any) => item.json ? item.json : item);


          if (Array.isArray(cleanedData) && cleanedData.length > 0) {
            console.log("✅ Success! Loaded real logs", cleanedData);
            setWhatsappSessions(cleanedData);
            if (cleanedData[0]?.id) setSelectedWaSessionId(cleanedData[0].id);
          } else {
            console.log("⚠️ N8N returned empty data.");
          }
        })
        .catch((err) => {
          console.log("⚠️ Could not fetch data. Check N8N GET node.", err);
        });
    }
  }, [activeAgentId, mounted])


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
  }, [messages, selectedWaSessionId, isDashboardMode, chiaraSection])


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
        setChiaraSection("analytics")
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
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
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
      let rawText = ""
      let isFirstChunk = true


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
              setMessages((prev) => { const newMsgs = [...prev]; newMsgs[newMsgs.length - 1].text = rawText; return newMsgs })
            } else if (obj.type === "done") { break }
          } catch (e) { console.error("JSON Error:", e) }
        }
      }


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


  const renderAnalytics = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Analytics</h2>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700">Last 7 days <ChevronDown size={14} /></button>
          <span className="text-[10px] text-slate-400">Live <RefreshCw size={10} className="inline ml-1" /></span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
          <div className="flex justify-between items-start mb-4"><h3 className="text-slate-500 dark:text-slate-400 font-medium">Incoming Messages</h3><span className="px-2 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1"><ArrowDownRight size={12} /> 41.3%</span></div>
          <div className="text-4xl font-bold text-slate-800 dark:text-white mb-6">394</div>
          <SimpleLineChart data={[60, 55, 50, 60, 45, 95, 50]} color="#0ea5e9" height={150} />
        </div>
        <div className="glass-panel p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
          <div className="flex justify-between items-start mb-4"><h3 className="text-slate-500 dark:text-slate-400 font-medium">Total Conversations</h3><span className="px-2 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1"><ArrowDownRight size={12} /> 35.2%</span></div>
          <div className="text-4xl font-bold text-slate-800 dark:text-white mb-6">59</div>
          <SimpleLineChart data={[10, 10, 9, 8, 8, 8, 2]} color="#fb923c" height={150} />
        </div>
      </div>
    </div>
  )


  const renderConversations = () => {
    const showDetails = isDetailsPanelOpen && isSidebarCollapsed;
    return (
      <div className="flex h-[calc(100vh-140px)] gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
        {/* List Column */}
        <div className="w-80 shrink-0 glass-panel rounded-xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/50">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 space-y-3">
            <h3 className="font-bold text-slate-800 dark:text-white truncate">Chats ({whatsappSessions.length})</h3>
            <div className="flex gap-1">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
                <input className="w-full bg-slate-100 dark:bg-black/20 border border-transparent focus:border-sky-500 rounded-lg pl-7 pr-1 py-2 text-xs focus:outline-none dark:text-white" placeholder="Search" />
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {whatsappSessions.map(session => (
              <div key={session.id} onClick={() => setSelectedWaSessionId(session.id)} className={`p-2 rounded-lg cursor-pointer border transition-all ${selectedWaSessionId === session.id ? 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-500/30' : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate">{session.phoneNumber}</span>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-slate-400 whitespace-nowrap">{session.lastActive.split(',')[0]}</span>
                    <div className="flex items-center gap-1">{session.platform === 'web' ? <ExternalLink size={8} className="text-sky-400" /> : <Smartphone size={8} className="text-emerald-400" />}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* Chat Column */}
        <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700/50 relative min-w-[300px]">
          {isSidebarCollapsed && (
            <div className="absolute top-4 right-4 z-10">
              <button onClick={() => setIsDetailsPanelOpen(!isDetailsPanelOpen)} className={`p-2 rounded-lg backdrop-blur-sm border transition-all ${isDetailsPanelOpen ? 'bg-slate-100/50 dark:bg-black/20 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-sky-500 shadow-md'}`}>
                {isDetailsPanelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-black/20">
            {activeWaSession?.messages?.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === 'ai' && <img src={currentAgent.image} className="w-8 h-8 rounded-full shadow-sm object-cover" />}
                <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${msg.sender === 'ai' ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white'}`}>
                  <div>{msg.text}</div>
                </div>
                {msg.sender === 'user' && (
                  <img src="https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg" className="w-8 h-8 rounded-full shadow-sm object-cover" />
                )}
              </div>
            ))}
          </div>
        </div>


        {/* Details Column */}
        <div className={`glass-panel rounded-xl flex flex-col border border-slate-200 dark:border-slate-700/50 transition-all duration-300 ease-in-out overflow-hidden ${showDetails ? 'w-72 opacity-100 mr-0' : 'w-0 opacity-0 -mr-4 border-0'}`}>
          <div className="w-72 shrink-0">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex items-center gap-2"><Settings size={16} className="text-slate-500" /> <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Details</span></div>
            <div className="p-4 space-y-6">
              <div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-slate-400" /><input className="w-full bg-slate-100 dark:bg-black/20 border border-transparent focus:border-sky-500 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none dark:text-white" placeholder="Search" /></div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Actions</label>
                <div className="flex gap-2"><button className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500"><Check size={16} /></button><button className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500"><Archive size={16} /></button><button className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500"><Trash2 size={16} /></button></div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Note</label>
                <textarea className="w-full h-32 bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:outline-none focus:border-sky-500 dark:text-white resize-none" placeholder="Leave a note..." value={activeWaSession.notes || noteValue} onChange={(e) => setNoteValue(e.target.value)} />
              </div>
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
                {!isSidebarCollapsed && (
                  <div className="mx-2 mb-4 p-1 bg-slate-200 dark:bg-black/40 rounded-xl flex items-center border border-slate-300 dark:border-white/10">
                    <button onClick={() => setSidebarMode("chats")} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase ${sidebarMode === 'chats' ? 'bg-sky-500 text-white' : 'text-slate-500'}`}>Missioni</button>
                    <button onClick={() => setSidebarMode("agents")} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase ${sidebarMode === 'agents' ? 'bg-sky-500 text-white' : 'text-slate-500'}`}>AI Team</button>
                  </div>
                )}
                {/* --- AGENTS LIST --- */}
                {sidebarMode === 'agents' && (
                  <div className="space-y-2 w-full mt-4">
                    {AI_TEAM_LIST.map((agentItem) => {
                      const agent = AGENTS_DB[agentItem.id]
                      return (
                        <div key={agentItem.id} onClick={() => switchAgent(agentItem.id)} className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all ${isSidebarCollapsed ? 'justify-center' : ''} ${activeAgentId === agentItem.id ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-200' : 'hover:bg-white/40 dark:hover:bg-white/5'}`}>
                          <img src={agent.image} className="w-8 h-8 rounded-full bg-slate-200 object-cover shrink-0" />
                          {!isSidebarCollapsed && (
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{agent.name}</div>
                              <div className="text-[10px] text-slate-400 truncate">{agent.role}</div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* --- CHATS MENU --- */}
                {sidebarMode === 'chats' && (
                  <div className="space-y-1">
                    <button onClick={() => setChiaraSection('analytics')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${chiaraSection === 'analytics' ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20' : 'text-slate-500 hover:bg-white/5'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                      <BarChart3 size={20} /> {!isSidebarCollapsed && "Analytics"}
                    </button>
                    <button onClick={() => setChiaraSection('conversations')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${chiaraSection === 'conversations' ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20' : 'text-slate-500 hover:bg-white/5'} ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                      <MessageSquare size={20} /> {!isSidebarCollapsed && "Conversations"}
                    </button>
                  </div>
                )}
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
                    <h1 className="text-2xl font-black text-white uppercase tracking-widest leading-none">{currentAgent.name}</h1>
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
                {chiaraSection === 'analytics' && renderAnalytics()}
                {chiaraSection === 'conversations' && renderConversations()}
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

