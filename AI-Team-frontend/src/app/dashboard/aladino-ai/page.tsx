"use client"

import { authenticatedFetch } from "@/lib/authenticatedFetch";

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { UserButton } from "@clerk/nextjs"
import {
  Edit2,
  Trash2,
  Check,
  Copy,
  Sun,
  Moon,
  Zap,
  MessageSquare,
  User,
  Send,
  Paperclip,
  ChevronRight,
  Users,
  LayoutGrid,
  ChevronLeft,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronDown,
  MoreHorizontal,
  Share,
  Archive,
  X,
  RotateCcw,
  FileText,
  ExternalLink,
  Menu,
  Home,
  BookOpen,
} from "lucide-react"
import { useUser } from "@clerk/nextjs"
import { conversationService } from "@/services/conversationService"

import { extractFileContent } from "@/utils/fileExtraction"
import { getDevUserEmail } from "@/lib/devToken"

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
  sessionId?: string // Added sessionId to track n8n conversation history per chat
}

interface FolderType {
  id: string
  name: string
  createdAt: string
}

// --- CONSTANTS ---
const USER_AVATAR =
  "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"

// --- ROBUST MARKDOWN SHIM v4 ---
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
        .replace(/\[([^\]]+)\]$$([^)]+)$$/g, '<a href="$2" target="_blank" class="text-sky-400 hover:underline">$1</a>')
    }

    const autoBold = (str: string) => {
      const match = str.match(/^([A-ZÀ-ÖØ-Þ0-9\s&/-]{3,}:)(.*)/)
      if (match) {
        return `<strong class="font-bold text-slate-900 dark:text-white">${match[1]}</strong>${formatInline(match[2])}`
      }
      return formatInline(str)
    }

    const lines = text.split("\n")
    let output = ""
    let tableBuffer: string[] = []
    let inList = false

    const flushTable = () => {
      if (tableBuffer.length === 0) return

      if (tableBuffer.length < 2) {
        tableBuffer.forEach((line) => {
          output += `<div class="mb-1">${formatInline(line)}</div>`
        })
        tableBuffer = []
        return
      }

      let html =
        '<div class="overflow-x-auto my-3 rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5"><table class="w-full text-left border-collapse text-xs">'

      const headerCols = tableBuffer[0].split("|")
      const headerCells = headerCols.map((c) => c.trim()).filter(Boolean)

      html += '<thead class="bg-slate-100 dark:bg-white/10"><tr>'
      headerCells.forEach((cell) => {
        html += `<th class="p-2 border-b border-slate-200 dark:border-white/10 font-bold text-slate-800 dark:text-white">${formatInline(cell)}</th>`
      })
      html += "</tr></thead><tbody>"

      for (let i = 2; i < tableBuffer.length; i++) {
        const rowCols = tableBuffer[i].split("|")
        const rowCells = rowCols.map((c) => c.trim()).filter(Boolean)

        // Only add row if it has actual content
        if (rowCells.length > 0 && rowCells.some((cell) => cell.length > 0)) {
          html +=
            '<tr class="border-b border-slate-200 dark:border-white/5 last:border-0 hover:bg-slate-100/50 dark:hover:bg-white/5">'
          rowCells.forEach((cell) => {
            html += `<td class="p-2 opacity-90">${formatInline(cell)}</td>`
          })
          html += "</tr>"
        }
      }
      html += "</tbody></table></div>"

      output += html
      tableBuffer = []
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line.startsWith("|") && line.endsWith("|")) {
        if (inList) {
          output += "</ul>"
          inList = false
        }
        tableBuffer.push(line)
        continue
      }
      flushTable()

      if (line.match(/^[-*]\s/)) {
        if (!inList) {
          output += '<ul class="list-disc ml-4 my-2 space-y-1">'
          inList = true
        }
        const content = line.replace(/^[-*]\s+/, "")
        output += `<li>${autoBold(content)}</li>`
        continue
      }

      if (inList && line !== "") {
        output += "</ul>"
        inList = false
      }

      if (line === "") {
        output += '<div class="h-2"></div>'
      } else if (line.startsWith("### ")) {
        output += `<h3 class="text-lg font-bold mt-3 mb-1 text-slate-800 dark:text-white">${formatInline(line.replace(/^###\s/, ""))}</h3>`
      } else if (line.startsWith("## ")) {
        output += `<h2 class="text-xl font-bold mt-4 mb-2 border-b border-white/10 pb-1 text-slate-800 dark:text-white">${formatInline(line.replace(/^##\s/, ""))}</h2>`
      } else {
        output += `<div class="mb-1 leading-relaxed">${autoBold(line)}</div>`
      }
    }

    flushTable()
    if (inList) output += "</ul>"

    return output
  },
}

// --- AGENT DATABASE ---
const AGENTS_DB: Record<string, any> = {
  "tony-ai": {
    name: "Tony AI",
    role: "Sales Manager",
    image: "/assets/agents/Tony-AI.png",
    description: "Il tuo consulente vendite digitale con 30 anni di esperienza. Analizzo i dati e ottimizzo il funnel.",
    primaryColor: "#0ea5e9",
    accentColor: "#22d3ee",
    route: "/dashboard/tony-ai",
  },
  "mike-ai": {
    name: "Mike AI",
    role: "Marketing Manager",
    image: "/assets/agents/Mike-AI.png",
    description: "Il tuo stratega di marketing. Definisco funnel e strategie integrate per scalare il business.",
    primaryColor: "#3b82f6",
    accentColor: "#60a5fa",
    route: "/dashboard/mike-ai",
  },
  "lara-ai": {
    name: "Lara AI",
    role: "Social Media Manager",
    image: "/assets/agents/Lara-AI-1.png",
    description: "Gestisco i tuoi social media, creo calendari editoriali e massimizzo l'engagement.",
    primaryColor: "#ec4899",
    accentColor: "#f472b6",
    route: "/dashboard/lara-ai",
  },
  "laura-ai": {
    name: "Laura AI",
    role: "Social Media Manager",
    image: "/assets/agents/Laura-ai.png",
    description: "Gestisco i tuoi social media, creo calendari editoriali e massimizzo l'engagement.",
    primaryColor: "#ec4899",
    accentColor: "#f472b6",
    route: "/dashboard/laura-ai",
  },
  "simone-ai": {
    name: "Simone AI",
    role: "SEO Copywriter",
    image: "/assets/agents/SImone-ai.png",
    description: "Scrivo contenuti ottimizzati SEO che scalano le classifiche di Google e attraggono traffico.",
    primaryColor: "#10b981",
    accentColor: "#34d399",
    route: "/dashboard/simone-ai",
  },
  "niko-ai": {
    name: "Niko AI",
    role: "SEO Manager",
    image: "/assets/agents/Niko-AI.png",
    description: "Architetto della tua presenza online. Analizzo il sito e pianifico la strategia SEO tecnica.",
    primaryColor: "#f59e0b",
    accentColor: "#fbbf24",
    route: "/dashboard/niko-ai",
  },
  "valentina-ai": {
    name: "Valentina AI",
    role: "SEO Optimizer",
    image: "/assets/agents/Valentina-AI.png",
    description: "Ottimizzo i contenuti esistenti per massimizzare il posizionamento e il CTR.",
    primaryColor: "#8b5cf6",
    accentColor: "#a78bfa",
    route: "/dashboard/valentina-ai",
  },
  "aladino-ai": {
    name: "Aladino AI",
    role: "Innovation Manager",
    image: "/assets/agents/Aladdin-AI.png",
    description: "Gestisco le tue campagne pubblicitarie su Meta, Google e LinkedIn per il massimo ROI.",
    primaryColor: "#ef4444",
    accentColor: "#f87171",
    route: "/dashboard/aladino-ai",
  },
  "alex-ai": {
    name: "Alex AI",
    role: "Ads Manager",
    image: "/assets/agents/Alex-AI.png",
    description: "Gestisco le tue campagne pubblicitarie su Meta, Google e LinkedIn per il massimo ROI.",
    primaryColor: "#ef4444",
    accentColor: "#f87171",
    route: "/dashboard/alex-ai",
  },

  "jim-ai": {
    name: "Jim AI",
    role: "Sales Coach",
    image: "/assets/agents/JIM-ai.png",
    description: "Alleno il tuo team di vendita con simulazioni e role-play per chiudere più contratti.",
    primaryColor: "#f97316",
    accentColor: "#fb923c",
    route: "/dashboard/jim-ai",
  },
  "daniele-ai": {
    name: "Daniele AI",
    role: "Direct Response Copywriter",
    image: "/assets/agents/Daniele-ai.png",
    description:
      "Progetto e scrivo copy di direct response per trasformare traffico qualificato in lead e clienti paganti.",
    primaryColor: "#f97316",
    accentColor: "#fb923c",
    route: "/dashboard/daniele-ai",
  },
  "dan-ai": {
    name: "Dan AI",
    role: "Test AI Agent",
    image: "/assets/agents/Daniele-ai.png",
    description: "Sono Dan AI, un agente AI di test per verificare funzionalità e integrazioni.",
    primaryColor: "#6366f1",
    accentColor: "#818cf8",
    route: "/dashboard/dan-ai",
  },
  "max-ai": {
    name: "Max AI",
    role: "Business Development Manager",
    image: "/assets/agents/Tony-AI-strategiest.png",
    description: "Sviluppo opportunità di business e partnership strategiche per accelerare la crescita aziendale.",
    primaryColor: "#10b981",
    accentColor: "#34d399",
    route: "/dashboard/max-ai",
  },
  "sofia-ai": {
    name: "Sofia AI",
    role: "Content Marketing Strategist",
    image: "/assets/agents/Sofia-ai-1.png",
    description: "Creo strategie di content marketing data-driven per aumentare brand awareness e conversioni.",
    primaryColor: "#ec4899",
    accentColor: "#f472b6",
    route: "/dashboard/sofia-ai",
  },
  "roberta-ai": {
    name: "Roberta AI",
    role: "Customer Success Manager",
    image: "/assets/agents/Valentina-AI-AI-SEO-optimizer.png",
    description: "Gestisco la relazione con i clienti e ottimizzo la customer experience per massimizzare la retention.",
    primaryColor: "#8b5cf6",
    accentColor: "#f472b6",
    route: "/dashboard/roberta-ai",
  },
}

// --- AGENT ROSTER LIST ---
const AI_TEAM_LIST = [
  { id: "mike-ai" },
  { id: "tony-ai" },
  { id: "lara-ai" },
  { id: "laura-ai" },
  { id: "simone-ai" },
  { id: "niko-ai" },
  { id: "valentina-ai" },
  { id: "aladino-ai" },
  { id: "alex-ai" },
  { id: "jim-ai" },
  { id: "daniele-ai" },
  { id: "dan-ai" },
  { id: "max-ai" },
  { id: "sofia-ai" },
  { id: "roberta-ai" },
]



// --- TOKEN USAGE ALERT RULES (conversation scope) ---
// Mirrors the admin "Token Usage Alerts" defaults. Frontend-only for now.
type TokenAlertLevel = "info" | "warning" | "critical"
const TOKEN_ALERT_RULES: { percentage: number; level: TokenAlertLevel; message: string }[] = [
  { percentage: 50, level: "info", message: "Hai usato il 50% dei token della conversazione. Valuta di concludere a breve." },
  { percentage: 75, level: "warning", message: "75% dei token della conversazione utilizzati. Ti stai avvicinando al limite." },
  { percentage: 90, level: "critical", message: "90% raggiunto! La conversazione terminerà presto. Salva subito le informazioni importanti." },
]

const TOKEN_ALERT_STYLES: Record<TokenAlertLevel, { wrap: string; icon: string }> = {
  info: { wrap: "bg-sky-500/10 border-sky-400/40 text-sky-700 dark:text-sky-300", icon: "ℹ️" },
  warning: { wrap: "bg-amber-500/10 border-amber-400/40 text-amber-700 dark:text-amber-300", icon: "⚠️" },
  critical: { wrap: "bg-rose-500/10 border-rose-400/40 text-rose-700 dark:text-rose-300", icon: "🚨" },
}

export default function App() {
  // --- STATE ---
  const [activeAgentId, setActiveAgentId] = useState<string>("aladino-ai")
  const currentAgent = AGENTS_DB[activeAgentId] || AGENTS_DB["aladino-ai"]

  const [messages, setMessages] = useState<Message[]>([])
  const { user } = useUser()
  const userEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    getDevUserEmail()
  const [tokenUsage, setTokenUsage] = useState<{
    totalUsedTokens: number
    totalTokenLimit: number
    totalTokensLeft: number
  } | null>(null)

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

  // Folder State
  const [folders, setFolders] = useState<FolderType[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [draggedChatId, setDraggedChatId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const tokenUsagePercent = tokenUsage?.totalTokenLimit
    ? Math.min(100, Math.max(0, (tokenUsage.totalUsedTokens / tokenUsage.totalTokenLimit) * 100))
    : 0
  const tokenProgressClass =
    tokenUsagePercent >= 90
      ? "bg-red-500"
      : tokenUsagePercent >= 75
        ? "bg-amber-500"
        : "bg-sky-500"

  // --- REFS ---
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const newFolderInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const CURRENT_NAMESPACE = useRef("")
  const prevMessageCountRef = useRef(0)

  const N8N_ENDPOINT = process.env.NEXT_PUBLIC_ALADINO_AI_N8N_ENDPOINT || "https://n8n-c2lq.onrender.com/webhook/f3ee3b1a-b98b-4108-9381-dc34e7d34518/chat?action=sendMessage"

  // --- Set Pinecone namespace ---
  useEffect(() => {
    if (user?.id) {
      // Set namespace immediately from user.id (Clerk oauthId) so Pinecone is always ready
      CURRENT_NAMESPACE.current = user.id
      console.log("✅ Aladino AI: Using user.id for Pinecone namespace:", user.id)
    }
  }, [user?.id])

  useEffect(() => {
    if (!userEmail) return

    const userIdentifier = encodeURIComponent(userEmail)
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ""
    authenticatedFetch(`${API_BASE}/token-usage/${userIdentifier}/ALADINO`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) { /* token usage UI disabled */ }
      })
      .catch(() => {})
  }, [userEmail])

  // --- INITIALIZATION ---
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme) setIsDark(savedTheme === "dark")
    else setIsDark(true)

    if (window.innerWidth < 768) {
      setSidebarVisible(false)
    }

    const savedFolders = localStorage.getItem("aladino-ai-folders")
    if (savedFolders) {
      try {
        setFolders(JSON.parse(savedFolders))
      } catch (e) {
        console.error("Failed to parse folders", e)
      }
    }
  }, [])

  // Load conversations from API when user is available
  useEffect(() => {
    if (!user?.id) return

    const loadConversations = async () => {
      try {
        console.log("📡 Fetching conversations from API for user:", user.id)
        const conversations = await conversationService.getConversations(user.id, "aladino-ai")

        if (conversations && conversations.length > 0) {
          // Convert array to Record<string, ChatSession>
          const chatsRecord: Record<string, ChatSession> = {}
          conversations.forEach((conv) => {
            chatsRecord[conv.id] = {
              id: conv.id,
              messages: conv.messages || [],
              title: conv.title,
              lastUpdated: conv.lastUpdated,
              folderId: conv.folderId || null,
              archived: conv.archived || false,
              agentId: conv.agentId,
              sessionId: conv.sessionId,
            }
          })

          setChats(chatsRecord)

          // Set the most recent chat as active
          const sorted = Object.entries(chatsRecord).sort(
            ([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
          )
          const recentChatId = sorted[0][0]
          setCurrentChatId(recentChatId)
          setMessages(chatsRecord[recentChatId].messages || [])
          if (chatsRecord[recentChatId].agentId) {
            setActiveAgentId(chatsRecord[recentChatId].agentId)
          }
          console.log("✅ Loaded", conversations.length, "conversations from API")
        } else {
          // No conversations found, create a new one
          console.log("📝 No conversations found, creating new chat")
          await initNewChatForAgent(currentAgent)
        }
      } catch (error) {
        console.error("❌ Failed to load conversations from API:", error)
        // Fallback: create a new chat
        await initNewChatForAgent(currentAgent)
      }
    }

    loadConversations()
  }, [user?.id])

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [isDark])

  useEffect(() => {
    // Only scroll when a new message is added, not when streaming updates content
    if (messages.length !== prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
      prevMessageCountRef.current = messages.length
    }
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px"
    }
  }, [inputValue])

  useEffect(() => {
    if (isCreatingFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus()
    }
  }, [isCreatingFolder])

  const switchAgent = (agentId: string) => {
    const agent = AGENTS_DB[agentId]
    if (agent && agent.route) {
      window.open(agent.route, "_blank")
    }
  }

  const initNewChatForAgent = async (agent: any, specificAgentId?: string) => {
    const targetAgentId = specificAgentId || activeAgentId
    const newChatId = "chat_" + Date.now()
    const newSessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)

    let messageText = `Ciao! Sono **${agent.name}**. ${agent.description} Come posso aiutarti?`

    if (agent.name === "Aladino AI") {
      messageText = `Ciao! Sono Aladino AI. Invento nuovi prodotti e servizi ad alta marginalità per differenziarti sul mercato. Come posso aiutarti?`
    }

    const welcomeMsg: Message = {
      text: messageText,
      sender: "ai",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }

    setCurrentChatId(newChatId)
    setMessages([welcomeMsg])

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

    // Update local state immediately for responsive UI
    setChats((prev) => {
      const newChats = { [newChatId]: newChat, ...prev }
      return newChats
    })

    // Call API to persist to database
    if (user?.id) {
      try {
        await conversationService.createConversation(user.id, {
          id: newChatId,
          title: `Missione con ${agent.name}`,
          agentId: targetAgentId,
          sessionId: newSessionId,
          folderId: null,
          archived: false,
          messages: [welcomeMsg],
        })
        console.log("✅ Conversation created in database:", newChatId)
      } catch (error) {
        console.error("❌ Failed to create conversation in database:", error)
      }
    }
  }


  const updateChatState = (chatId: string, updates: Partial<ChatSession>) => {
    setChats((prev) => {
      const existing = prev[chatId]
      if (!existing) return prev
      const updatedChat = { ...existing, ...updates }
      const newChats = { ...prev, [chatId]: updatedChat }
      localStorage.setItem("aladino-ai-chats", JSON.stringify(newChats))
      return newChats
    })
  }

  const createNewChat = async () => {
    await initNewChatForAgent(currentAgent)
    setSidebarVisible(true)
    setSidebarMode("chats")
  }

  const loadChat = async (chatId: string) => {
    if (!chats[chatId]) return
    setCurrentChatId(chatId)

    // Set local messages first for responsive UI
    setMessages(chats[chatId].messages || [])

    if (chats[chatId].agentId && chats[chatId].agentId !== activeAgentId) {
      setActiveAgentId(chats[chatId].agentId)
    }
    setActiveMenu(null)
    if (window.innerWidth < 768) {
      setSidebarVisible(false)
    }

    // Fetch messages from API to ensure we have latest
    if (user?.id) {
      try {
        const apiMessages = await conversationService.getMessages(user.id, chatId)
        if (apiMessages && apiMessages.length > 0) {
          setMessages(apiMessages)
          // Update local state with fetched messages
          setChats((prev) => ({
            ...prev,
            [chatId]: { ...prev[chatId], messages: apiMessages },
          }))
          console.log("✅ Loaded", apiMessages.length, "messages from API for chat:", chatId)
        }
      } catch (error) {
        console.error("❌ Failed to load messages from API:", error)
      }
    }
  }

  // --- FOLDER LOGIC ---
  const confirmCreateFolder = () => {
    if (!newFolderName.trim()) {
      setIsCreatingFolder(false)
      return
    }
    const newFolder: FolderType = {
      id: `folder_${Date.now()}`,
      name: newFolderName,
      createdAt: new Date().toISOString(),
    }
    const updatedFolders = [...folders, newFolder]
    setFolders(updatedFolders)
    localStorage.setItem("aladino-ai-folders", JSON.stringify(updatedFolders))
    setExpandedFolders((prev) => new Set(prev).add(newFolder.id))
    setIsCreatingFolder(false)
    setNewFolderName("")
  }

  const cancelCreateFolder = () => {
    setIsCreatingFolder(false)
    setNewFolderName("")
  }

  const startCreateFolder = () => {
    setIsCreatingFolder(true)
    setNewFolderName("")
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const deleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Eliminare cartella? Le chat torneranno nella lista principale.")) return

    const updatedChats = { ...chats }
    Object.keys(updatedChats).forEach((key) => {
      if (updatedChats[key].folderId === folderId) {
        updatedChats[key].folderId = null
      }
    })
    setChats(updatedChats)
    localStorage.setItem("aladino-ai-chats", JSON.stringify(updatedChats))

    const updatedFolders = folders.filter((f) => f.id !== folderId)
    setFolders(updatedFolders)
    localStorage.setItem("aladino-ai-folders", JSON.stringify(updatedFolders))
  }

  // --- CONTEXT MENU ACTIONS ---
  const deleteChat = async (chatIdToDelete: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
      e.nativeEvent.stopImmediatePropagation()
    }

    setActiveMenu(null)

    if (!confirm("Sei sicuro di voler eliminare questa chat?")) return

    // Call API to delete from database
    if (user?.id) {
      try {
        await conversationService.deleteConversation(user.id, chatIdToDelete)
        console.log("✅ Conversation deleted from database:", chatIdToDelete)
      } catch (error) {
        console.error("❌ Failed to delete conversation from database:", error)
      }
    }

    const updatedChats = { ...chats }
    if (!updatedChats[chatIdToDelete]) return

    delete updatedChats[chatIdToDelete]
    const remainingIds = Object.keys(updatedChats)

    if (remainingIds.length === 0) {
      // Create a new chat if no chats remain
      await initNewChatForAgent(AGENTS_DB[activeAgentId])
    } else {
      setChats(updatedChats)

      if (chatIdToDelete === currentChatId) {
        const sorted = remainingIds.sort((a, b) => {
          const timeA = new Date(updatedChats[a].lastUpdated).getTime() || 0
          const timeB = new Date(updatedChats[b].lastUpdated).getTime() || 0
          return timeB - timeA
        })
        const nextId = sorted[0]
        setCurrentChatId(nextId)
        setMessages(updatedChats[nextId].messages || [])
      }
    }
  }

  const archiveChat = (chatId: string) => {
    updateChatState(chatId, { archived: !chats[chatId]?.archived })
    setActiveMenu(null)
  }

  const shareChat = (chatId: string) => {
    const url = `${window.location.origin}/chat/${chatId}`
    navigator.clipboard.writeText(url)
    alert("Link copiato negli appunti: " + url)
    setActiveMenu(null)
  }

  const startRenaming = (chatId: string) => {
    setRenamingChat(chatId)
    setRenameValue(chats[chatId]?.title || "")
    setActiveMenu(null)
  }

  const confirmRename = async (chatId: string) => {
    if (!renameValue.trim()) {
      setRenamingChat(null)
      return
    }

    const newTitle = renameValue.trim()

    // Update local state immediately
    setChats((prev) => ({
      ...prev,
      [chatId]: { ...prev[chatId], title: newTitle },
    }))

    // Call API to update in database
    if (user?.id) {
      try {
        await conversationService.updateConversation(user.id, chatId, { title: newTitle })
        console.log("✅ Conversation renamed in database:", chatId, "->", newTitle)
      } catch (error) {
        console.error("❌ Failed to rename conversation in database:", error)
      }
    }

    setRenamingChat(null)
    setRenameValue("")
  }

  // --- DRAG & DROP LOGIC ---
  const handleDragStart = (e: React.DragEvent, chatId: string) => {
    e.dataTransfer.setData("chatId", chatId)
    setDraggedChatId(chatId)
  }

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault()
    setDragOverFolderId(folderId)
  }

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault()
    setDragOverFolderId(null)
    const chatId = e.dataTransfer.getData("chatId")
    if (!chatId || !chats[chatId]) return
    if (chats[chatId].folderId === targetFolderId) return

    updateChatState(chatId, { folderId: targetFolderId })

    if (targetFolderId) {
      setExpandedFolders((prev) => new Set(prev).add(targetFolderId))
    }
    setDraggedChatId(null)
  }

  // --- MESSAGING ---
  const formatMessageText = (text: string) => {
    if (!text) return ""
    try {
      return simpleMarkdown.parse(text)
    } catch (e) {
      return text
    }
  }

  // --- Message Sending Logic ---
  // Highest crossed threshold drives the announcer bar; hard stop when no tokens left
  const activeTokenAlert = tokenUsage
    ? [...TOKEN_ALERT_RULES]
        .sort((a, b) => b.percentage - a.percentage)
        .find((rule) => tokenUsagePercent >= rule.percentage) || null
    : null
  const isTokenLimitReached = Boolean(
    tokenUsage && (tokenUsage.totalTokensLeft <= 0 || tokenUsagePercent >= 100),
  )

  const sendMessage = async () => {
    if (!inputValue.trim() && selectedFiles.length === 0) return
    if (isTokenLimitReached) return

    setIsLoading(true)

    let fileContext = ""
    if (selectedFiles.length > 0) {
      for (const file of selectedFiles) {
        const content = await extractFileContent(file)
        fileContext += `\n\n[File Content: ${file.name}]\n${content}\n[End File Content]`
      }
    }

    const userMessage: Message = {
      text: inputValue,
      sender: "user",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      files: selectedFiles.map((f) => f.name),
    }

    // Clear input immediately after creating the message object
    setInputValue("")
    setSelectedFiles([])

    let currentMessages = [...messages, userMessage]

    // Handle creating a new chat if none is active
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
      const newChat: ChatSession = {
        id: newChatId,
        title: `Missione con ${agent.name}`,
        messages: [welcomeMsg, userMessage],
        lastUpdated: new Date().toISOString(),
        folderId: null,
        archived: false,
        agentId: activeAgentId,
        sessionId: newSessionId,
      }

      const updatedChatsState = { ...chats, [newChatId]: newChat }
      setChats(updatedChatsState)
      setCurrentChatId(newChatId)
      currentChatIdForSend = newChatId
      currentMessages = [welcomeMsg, userMessage]
      setMessages(currentMessages)

      // Create conversation in API
      if (user?.id) {
        try {
          await conversationService.createConversation(user.id, {
            id: newChatId,
            title: `Missione con ${agent.name}`,
            agentId: activeAgentId,
            sessionId: newSessionId,
            messages: [welcomeMsg, userMessage],
          })
          console.log("✅ New conversation created with messages")
        } catch (error) {
          console.error("❌ Failed to create conversation:", error)
        }
      }
    } else {
      // Add user message to existing chat
      const updatedChatSession = {
        ...chats[currentChatIdForSend],
        messages: currentMessages,
        lastUpdated: new Date().toISOString(),
        title: chats[currentChatIdForSend]?.title || inputValue.slice(0, 30) || "Nuova Missione",
      }
      const updatedChatsState = { ...chats, [currentChatIdForSend]: updatedChatSession }
      setChats(updatedChatsState)
      setMessages(currentMessages)

      // Save user message to API
      if (user?.id) {
        try {
          await conversationService.addMessage(user.id, currentChatIdForSend, {
            text: userMessage.text,
            sender: userMessage.sender,
            time: userMessage.time,
          })
          console.log("✅ User message saved to API")
        } catch (error) {
          console.error("❌ Failed to save user message:", error)
        }
      }
    }

    // Add a placeholder for the AI's response
    const aiResponsePlaceholder: Message = { text: "...", sender: "ai", time: "", raw: "" }
    setMessages((prev) => [...prev, aiResponsePlaceholder])

    try {
      const currentChat = chats[currentChatIdForSend!]
      let sessionId = currentChat?.sessionId

      if (!sessionId) {
        sessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)
        const updatedChat = { ...currentChat, sessionId }
        const updatedChatsState = { ...chats, [currentChatIdForSend!]: updatedChat }
        setChats(updatedChatsState)
      }

      if (!currentChatIdForSend) throw new Error("currentChatIdForSend is null")

      const response = await authenticatedFetch(N8N_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatInput:
            inputValue + (selectedFiles.length ? ` [Attached: ${selectedFiles.map((f) => f.name).join(", ")}]` : "") +
            fileContext,
          sessionId: sessionId, // Use chat-specific sessionId for conversation continuity,
          useMemory: useMemory,
          metadata: {
            "shared-namespace": CURRENT_NAMESPACE.current,
            "agent-memory": `${CURRENT_NAMESPACE.current}-aladino-ai`,
            source: "aladino-ai",
            email: userEmail,
          },
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
            // Reveal faster the further behind we are, so display never lags the
            // stream, yet still animates a couple of characters near the end.
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
                if (isFirstChunk) {
                  rawText = obj.content
                  isFirstChunk = false
                } else {
                  rawText += obj.content
                }
                // The typewriter loop picks up the new rawText on its next tick.
              } else if (obj.type === "done" || obj.type === "end") {
                break
              }
            } catch (e) {
              console.error("Failed to parse JSON chunk:", e, "Line:", trimmed)
            }
          }
        }
      } catch (streamError) {
        // If we already received partial content, use it rather than failing completely
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

      // Finalize AI message
      const finalAiMessage: Message = {
        text: rawText.trim() || "La risposta è stata completata.",
        sender: "ai",
        time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        raw: rawText,
      }

      setMessages((prev) => {
        const newMsgs = [...prev]
        newMsgs[newMsgs.length - 1] = finalAiMessage
        // Update the chat in state
        const updatedChatSession = {
          ...chats[currentChatIdForSend!],
          messages: newMsgs,
          lastUpdated: new Date().toISOString(),
        }
        const updatedChatsState = { ...chats, [currentChatIdForSend!]: updatedChatSession }
        setChats(updatedChatsState)
        return newMsgs
      })

      // Save AI message to API
      if (user?.id && currentChatIdForSend) {
        try {
          await conversationService.addMessage(user.id, currentChatIdForSend, {
            text: finalAiMessage.text,
            sender: finalAiMessage.sender,
            time: finalAiMessage.time,
          })
          console.log("✅ AI message saved to API")
        } catch (error) {
          console.error("❌ Failed to save AI message:", error)
        }
      }

      const userIdentifier = userEmail ? encodeURIComponent(userEmail) : ""
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ""
      try {
        if (userIdentifier) {
          const [inputCount, outputCount] = await Promise.all([
            authenticatedFetch(`${API_BASE}/token-usage/count`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: userMessage.text }),
            }).then((r) => (r.ok ? r.json() : null)),
            authenticatedFetch(`${API_BASE}/token-usage/count`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: finalAiMessage.text }),
            }).then((r) => (r.ok ? r.json() : null)),
          ])

          const totalUsedInputTokens = inputCount?.totalUsedInputTokens ?? 0
          const totalUsedOutputTokens = outputCount?.totalUsedInputTokens ?? 0

          await authenticatedFetch(`${API_BASE}/token-usage/${userIdentifier}/ALADINO/usage`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ totalUsedInputTokens, totalUsedOutputTokens }),
          })

          const updated = await authenticatedFetch(`${API_BASE}/token-usage/${userIdentifier}/ALADINO`).then((r) =>
            r.ok ? r.json() : null,
          )
          if (updated) { /* token usage UI disabled */ }
        }
      } catch (err) {
        console.error("Aladino AI: Failed to update token usage:", err)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => {
        const newMsgs = [...prev]
        newMsgs[newMsgs.length - 1].text =
          `Errore: Impossibile inviare il messaggio. ${error instanceof Error ? error.message : String(error)}`
        return newMsgs
      })
    } finally {
      setIsLoading(false)

    }
  }

  const handleAttachment = () => fileInputRef.current?.click()
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files!)])
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCopyMessage = async (text: string, index: number) => {
    console.log("🔧 TABLE COPY FIX v3.0 - ACTIVE")

    try {
      let htmlContent = formatMessageText(text)
      console.log("📋 Original HTML:", htmlContent.substring(0, 300))

      // STEP 1: Remove wrapper divs from tables
      htmlContent = htmlContent.replace(
        /<div[^>]*class="[^"]*overflow-x-auto[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/div>/g,
        "$1",
      )

      // STEP 2: Use DOM parser to clean empty rows
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlContent, "text/html")

      // Find all table rows and remove empty ones
      const allRows = doc.querySelectorAll("tr")
      allRows.forEach((row) => {
        const cells = row.querySelectorAll("td, th")
        let hasContent = false

        // Check if any cell has actual text content
        cells.forEach((cell) => {
          const content = cell.textContent?.trim() || ""
          if (content.length > 0) {
            hasContent = true
          }
        })

        // Remove row if it has cells but no content
        if (!hasContent && cells.length > 0) {
          console.log("🗑️ Removing empty row with", cells.length, "empty cells")
          row.remove()
        }
      })

      // Get the cleaned HTML
      htmlContent = doc.body.innerHTML
      console.log("✅ After cleaning:", htmlContent.substring(0, 300))

      // STEP 3: Apply inline styles
      htmlContent = htmlContent
        .replace(/<strong[^>]*>/g, '<strong style="font-weight: 700; color: #0f172a;">')
        .replace(/<em[^>]*>/g, '<em style="font-style: italic; color: #334155;">')
        .replace(
          /<code[^>]*>/g,
          '<code style="background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; border: 1px solid #e2e8f0;">',
        )
        .replace(
          /<ul[^>]*>/g,
          '<ul style="margin-left: 20px; list-style-type: disc; padding-left: 20px; margin-bottom: 10px;">',
        )
        .replace(/<li[^>]*>/g, '<li style="margin-bottom: 4px;">')
        .replace(
          /<h3[^>]*>/g,
          '<h3 style="font-size: 18px; font-weight: bold; margin-top: 15px; margin-bottom: 5px; color: #0f172a;">',
        )
        .replace(
          /<h2[^>]*>/g,
          '<h2 style="font-size: 22px; font-weight: bold; border-bottom: 2px solid #e2e8f0; margin-top: 20px; margin-bottom: 10px; color: #0f172a;">',
        )
        .replace(
          /<table[^>]*>/g,
          '<table style="border-collapse: collapse; width: 100%; border: 1px solid #cbd5e1; font-family: sans-serif; font-size: 14px; margin: 10px 0;">',
        )
        .replace(/<thead[^>]*>/g, '<thead style="background-color: #f1f5f9;">')
        .replace(
          /<th[^>]*>/g,
          '<th style="border: 1px solid #94a3b8; padding: 10px; text-align: left; font-weight: bold; background-color: #f1f5f9; color: #0f172a;">',
        )
        .replace(/<td[^>]*>/g, '<td style="border: 1px solid #cbd5e1; padding: 8px; color: #334155;">')
        .replace(/<tr[^>]*>/g, "<tr>")

      const finalHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: sans-serif; color: #0f172a; line-height: 1.6;">
          ${htmlContent}
        </body>
        </html>
      `

      const blobHtml = new Blob([finalHtml], { type: "text/html" })
      const blobText = new Blob([text], { type: "text/plain" })

      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blobHtml,
          "text/plain": blobText,
        }),
      ])

      console.log("✅ Copy completed successfully!")
      setCopiedMessageIndex(index)
      setTimeout(() => setCopiedMessageIndex(null), 2000)
    } catch (err) {
      console.error("❌ Rich copy failed:", err)
      navigator.clipboard.writeText(text)
      setCopiedMessageIndex(index)
      setTimeout(() => setCopiedMessageIndex(null), 2000)
    }
  }

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />

      <style>{`
        :root {
            --brand-dark: #020617;
            --brand-primary: #0ea5e9;
            --font-tech: 'Rajdhani', sans-serif;
        }
        body { font-family: var(--font-tech); background-color: #f8fafc; color: #0f172a; overflow: hidden; }
        .dark body { background-color: var(--brand-dark); color: #f8fafc; }
        
        .glass-panel { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05); }
        .dark .glass-panel { background: rgba(2, 6, 23, 0.85); border: 1px solid rgba(14, 165, 233, 0.15); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4); }

        @keyframes brain-float { 0% { transform: translateY(0px); } 50% { transform: translateY(-6px); } 100% { transform: translateY(0px); } }
        .animate-float { animation: brain-float 6s ease-in-out infinite; }

        @keyframes typing-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }
        .typing-indicator { display: inline-flex; align-items: center; gap: 5px; padding: 2px 0; }
        .typing-indicator span { width: 8px; height: 8px; border-radius: 9999px; background: currentColor; opacity: 0.4; animation: typing-bounce 1.2s infinite ease-in-out; }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes brain-wave-flow { 0% { background-position: 0% 50%; opacity: 0.2; } 50% { background-position: 100% 50%; opacity: 0.5; } 100% { background-position: 0% 50%; opacity: 0.2; } }
        .brainwave-overlay { background: linear-gradient(90deg, transparent, rgba(14,165,233,0.3), transparent, rgba(34,211,238,0.3), transparent); background-size: 200% 100%; animation: brain-wave-flow 3s linear infinite; pointer-events: none; }

        @keyframes synapse-pulse { 0% { box-shadow: 0 -10px 40px rgba(14,165,233,0.1); border-top-color: rgba(14,165,233,0.3); } 50% { box-shadow: 0 -20px 60px rgba(14,165,233,0.4); border-top-color: rgba(14,165,233,0.8); } 100% { box-shadow: 0 -10px 40px rgba(14,165,233,0.1); border-top-color: rgba(14,165,233,0.3); } }
        .synapse-active { animation: synapse-pulse 1.5s ease-in-out infinite; position: relative; }

        @keyframes neural-grid-move { 0% { transform: translateY(0); } 100% { transform: translateY(50px); } }
        .neural-grid-active { 
            background-image: linear-gradient(0deg, transparent 24%, rgba(14, 165, 233, 0.05) 25%, rgba(14, 165, 233, 0.05) 26%, transparent 27%, transparent 74%, rgba(14, 165, 233, 0.05) 75%, rgba(14, 165, 233, 0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(14, 165, 233, 0.05) 25%, rgba(14, 165, 233, 0.05) 26%, transparent 27%, transparent 74%, rgba(14, 165, 233, 0.05) 75%, rgba(14, 165, 233, 0.05) 76%, transparent 77%, transparent);
            background-size: 50px 50px;
            animation: neural-grid-move 3s linear infinite;
        }
        
        @keyframes synapse-beam { 0% { opacity: 0; transform: translateY(20px) scale(0.8); } 50% { opacity: 1; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-20px) scale(1.2); } }
        .synapse-beam::before { content: ''; position: absolute; width: 100%; height: 100%; top: 0; left: 0; background: radial-gradient(circle, rgba(14,165,233,0.2) 0%, transparent 70%); animation: synapse-beam 2s infinite; pointer-events: none; z-index: -1; }

        .markdown-body table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 1.5em 0; border-radius: 12px; overflow: hidden; border: 1px solid rgba(148, 163, 184, 0.2); font-size: 0.95em; }
        .dark .markdown-body table { border-color: rgba(30, 41, 59, 0.8); }
        .markdown-body th { background-color: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 12px 16px; border-bottom: 2px solid rgba(148, 163, 184, 0.3); }
        .dark .markdown-body th { background-color: #1e293b; color: #cbd5e1; border-bottom-color: rgba(51, 65, 85, 0.8); }
        .markdown-body td { padding: 12px 16px; border-bottom: 1px solid rgba(148, 163, 184, 0.1); }
        .dark .markdown-body td { border-bottom-color: rgba(51, 65, 85, 0.4); }
        .markdown-body tr:nth-child(even) { background-color: rgba(241, 245, 249, 0.4); }
        .dark .markdown-body tr:nth-child(even) { background-color: rgba(30, 41, 59, 0.3); }
        
        .markdown-body p { margin-bottom: 1.25em; line-height: 1.6; }
        .markdown-body strong { font-weight: 700; color: inherit; }
        .markdown-body ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1.25em; }
        
        .btn-electric {
           background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
           box-shadow: 0 0 15px rgba(14,165,233,0.5);
           transition: all 0.3s ease;
        }
        .btn-electric:hover {
           box-shadow: 0 0 25px rgba(14,165,233,0.8);
           transform: translateY(-1px);
        }
        
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 2px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(30, 41, 59, 0.5); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(14, 165, 233, 0.5); }
      `}</style>

      <div className={`flex h-screen w-full bg-tech-grid azure-glow-bg ${isDark ? "dark" : ""}`}>
        {/* Sidebar */}
        <div
          className={`glass-panel flex flex-col transition-all duration-500 ease-[cubic-bezier(0,0,0.2,1)] z-40 
                        ${sidebarVisible ? "w-80 translate-x-0" : "w-0 -translate-x-full opacity-0"} 
                        fixed md:relative h-full border-r border-sky-100 dark:border-sky-900/30`}
        >
          <div className="p-6 border-b border-sky-100 dark:border-sky-900/30 bg-gradient-to-b from-white/50 to-transparent dark:from-sky-900/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative group cursor-pointer">
                  <div className="w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-sky-400 to-cyan-300 shadow-lg shadow-sky-400/20 group-hover:shadow-sky-400/50 transition-all duration-300">
                    <img
                      src={currentAgent.image || "/placeholder.svg"}
                      className="w-full h-full rounded-full object-cover bg-slate-900"
                      alt={currentAgent.name}
                    />
                  </div>
                  <div className="absolute bottom-0.5 right-0 w-3 h-3 bg-emerald-400 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></div>
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-wide font-tech">AI TEAM</h2>
              </div>
              <button
                onClick={() => setSidebarVisible(false)}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors md:hidden cursor-pointer"
              >
                <ChevronLeft size={20} />
              </button>
            </div>

            <button
              onClick={createNewChat}
              className="w-full py-3.5 px-4 btn-electric text-white font-bold rounded-xl flex items-center justify-center gap-2 uppercase tracking-wider text-sm border border-white/10 cursor-pointer"
            >
              <MessageSquare size={18} strokeWidth={2.5} /> Nuova Missione
            </button>
          </div>

          <div className="flex p-2 gap-1 mx-4 mt-4 bg-slate-100/80 dark:bg-slate-900/50 rounded-xl border border-sky-200/50 dark:border-sky-700/30 shadow-inner">
            <button
              onClick={() => setSidebarMode("chats")}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer
                    ${sidebarMode === "chats"
                  ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm border border-sky-100 dark:border-sky-600/30"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
            >
              <LayoutGrid size={14} /> Missioni
            </button>
            <button
              onClick={() => setSidebarMode("agents")}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer
                    ${sidebarMode === "agents"
                  ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm border border-sky-100 dark:border-sky-600/30"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
            >
              <Users size={14} /> AI Team
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto p-3 space-y-1 mt-2 custom-scrollbar"
            onDragOver={(e) => handleDragOver(e, null)}
            onDrop={(e) => handleDrop(e, null)}
          >
            {sidebarMode === "chats" && (
              <div className="animate-in fade-in duration-300 space-y-3">
                {isCreatingFolder ? (
                  <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-sky-400 flex gap-2 items-center animate-in fade-in slide-in-from-top-2">
                    <input
                      ref={newFolderInputRef}
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && confirmCreateFolder()}
                      placeholder="Nome cartella..."
                      className="flex-1 bg-transparent text-sm focus:outline-none text-slate-800 dark:text-white placeholder-slate-400"
                    />
                    <button
                      onClick={confirmCreateFolder}
                      className="p-1 text-green-500 hover:bg-green-500/10 rounded cursor-pointer"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={cancelCreateFolder}
                      className="p-1 text-red-500 hover:bg-red-500/10 rounded cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startCreateFolder}
                    className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-sky-500 border border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-400 rounded-lg transition-all cursor-pointer"
                  >
                    <FolderPlus size={14} /> Nuova Cartella
                  </button>
                )}

                {folders.map((folder) => {
                  const isExpanded = expandedFolders.has(folder.id)
                  const isDragTarget = dragOverFolderId === folder.id
                  const folderChats = Object.entries(chats).filter(([, c]) => c.folderId === folder.id)

                  return (
                    <div
                      key={folder.id}
                      className={`rounded-xl border transition-all duration-300 overflow-hidden mb-1
                                     ${isDragTarget
                          ? "border-sky-400 bg-sky-50 dark:bg-sky-900/30 shadow-[0_0_15px_rgba(14,165,233,0.3)] scale-[1.02]"
                          : "border-slate-300 dark:border-slate-700 bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900"
                        }`}
                      onDragOver={(e) => handleDragOver(e, folder.id)}
                      onDrop={(e) => handleDrop(e, folder.id)}
                    >
                      <div
                        className="flex items-center justify-between p-2 cursor-pointer hover:bg-white/50 dark:hover:bg-white/5"
                        onClick={() => toggleFolder(folder.id)}
                      >
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                          {isExpanded ? (
                            <FolderOpen size={16} className="text-sky-500" />
                          ) : (
                            <Folder size={16} className="text-slate-500" />
                          )}
                          {folder.name}
                          <span className="text-[10px] text-slate-500 font-mono bg-white/50 dark:bg-black/20 px-1.5 rounded-full">
                            {folderChats.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => deleteFolder(folder.id, e)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                          <ChevronDown
                            size={14}
                            className={`text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-slate-50/50 dark:bg-black/20 p-1 space-y-1 border-t border-slate-200 dark:border-slate-700">
                          {folderChats.length === 0 && (
                            <div className="text-[10px] text-slate-400 text-center py-2 italic">
                              Trascina qui le chat
                            </div>
                          )}
                          {folderChats
                            .sort(
                              ([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
                            )
                            .map(([id, chat]) => {
                              const isActive = id === currentChatId
                              return (
                                <div
                                  key={id}
                                  onClick={() => loadChat(id)}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, id)}
                                  className={`group p-2 rounded-lg cursor-pointer transition-all flex items-center justify-between ${isActive ? "bg-sky-100 dark:bg-sky-900/50 border-l-2 border-l-sky-500" : "hover:bg-white/50 dark:hover:bg-white/5"}`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className={`text-xs font-semibold truncate ${isActive ? "text-sky-600 dark:text-sky-400" : "text-slate-600 dark:text-slate-400"}`}
                                    >
                                      {chat.title}
                                    </p>
                                    <p className="text-[9px] text-slate-400 font-mono">
                                      {new Date(chat.lastUpdated).toLocaleDateString(undefined, {
                                        day: "2-digit",
                                        month: "2-digit",
                                      })}
                                    </p>
                                  </div>
                                  <button
                                    onClick={(e) => deleteChat(id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </div>
                  )
                })}

                <div className="space-y-1 pt-2">
                  {Object.entries(chats)
                    .filter(([, c]) => !c.folderId && (showArchived ? c.archived : !c.archived))
                    .sort(([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
                    .map(([id, chat]) => {
                      const isActive = id === currentChatId
                      const isMenuOpen = activeMenu === id

                      return (
                        <div
                          key={id}
                          onClick={() => loadChat(id)}
                          draggable
                          onDragStart={(e) => handleDragStart(e, id)}
                          className={`group relative p-3 rounded-xl cursor-pointer border transition-all duration-300
                                         ${isActive
                              ? "bg-gradient-to-r from-sky-50 to-white dark:from-sky-900/30 dark:to-slate-900/30 border-sky-200 dark:border-sky-500/50 shadow-sm border-l-4 border-l-sky-500"
                              : "border-transparent hover:bg-white/60 dark:hover:bg-white/5 hover:translate-x-1"
                            }`}
                        >
                          {renamingChat === id ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                className="w-full bg-transparent border-b border-sky-500 focus:outline-none text-sm"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && confirmRename(id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  confirmRename(id)
                                }}
                                className="text-green-500 cursor-pointer"
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center">
                              <div className="flex-1 min-w-0">
                                <h4
                                  className={`text-sm font-bold truncate transition-colors ${isActive ? "text-sky-600 dark:text-sky-400" : "text-slate-600 dark:text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-300"}`}
                                >
                                  {pinnedChats.has(id) && "📌 "}
                                  {chat.archived && "📦 "}
                                  {chat.title || "Nuova Strategia"}
                                </h4>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {new Date(chat.lastUpdated).toLocaleDateString(undefined, {
                                    day: "2-digit",
                                    month: "2-digit",
                                  })}{" "}
                                  •{" "}
                                  {new Date(chat.lastUpdated).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>

                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setActiveMenu(isMenuOpen ? null : id)
                                  }}
                                  className={`p-1.5 rounded-md text-slate-400 hover:text-sky-500 hover:bg-sky-100 dark:hover:bg-white/10 transition-all ${isMenuOpen ? "bg-sky-100 dark:bg-white/10 text-sky-500" : "opacity-0 group-hover:opacity-100"}`}
                                >
                                  <MoreHorizontal size={16} />
                                </button>

                                {isMenuOpen && (
                                  <div className="absolute right-0 top-8 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        shareChat(id)
                                      }}
                                      className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700/50 cursor-pointer"
                                    >
                                      <Share size={16} /> Condividi
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        startRenaming(id)
                                      }}
                                      className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
                                    >
                                      <Edit2 size={16} /> Rinomina
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        archiveChat(id)
                                      }}
                                      className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 cursor-pointer"
                                    >
                                      {chat.archived ? <RotateCcw size={16} /> : <Archive size={16} />}{" "}
                                      {chat.archived ? "Ripristina" : "Archivia"}
                                    </button>
                                    <button
                                      onClick={(e) => deleteChat(id, e)}
                                      className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 text-sm text-red-500 border-t border-slate-100 dark:border-slate-700/50 cursor-pointer"
                                    >
                                      <Trash2 size={16} /> Elimina
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>

                <div className="pt-4 border-t border-dashed border-slate-200 dark:border-slate-800 mt-4">
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-2 cursor-pointer"
                  >
                    <Archive size={12} /> {showArchived ? "Nascondi Archiviati" : "Mostra Archiviati"}
                  </button>
                </div>
              </div>
            )}

            {sidebarMode === "agents" && (
              <div className="space-y-2 animate-in fade-in duration-300 px-1">
                {AI_TEAM_LIST.map((agentItem, idx) => {
                  const agentData = AGENTS_DB[agentItem.id] || {}
                  return (
                    <div
                      key={idx}
                      onClick={() => switchAgent(agentItem.id)}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all duration-300 group cursor-pointer hover:shadow-md dark:hover:shadow-sky-900/20 ${activeAgentId === agentItem.id ? "bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-500/50" : "bg-white/40 dark:bg-white/5 border-transparent hover:bg-white/80 dark:hover:bg-white/10"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`relative w-10 h-10 rounded-full p-0.5 transition-all duration-300 ${activeAgentId === agentItem.id ? "bg-gradient-to-tr from-sky-500 to-cyan-400" : "bg-slate-200 dark:bg-slate-700"}`}
                        >
                          <img
                            src={agentData.image || "/placeholder.svg"}
                            className="w-full h-full rounded-full object-cover bg-white"
                            alt={agentData.name}
                          />
                        </div>
                        <div>
                          <h4
                            className={`text-sm font-bold transition-colors ${activeAgentId === agentItem.id ? "text-sky-600 dark:text-sky-400" : "text-slate-700 dark:text-slate-200"}`}
                          >
                            {agentData.name}
                          </h4>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                            {agentData.role}
                          </p>
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-slate-400 group-hover:text-sky-500 transition-colors" />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-sky-100 dark:border-sky-900/30 bg-white/30 dark:bg-black/20 backdrop-blur-sm">
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-sky-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-sky-500" fill="currentColor" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Memory Core
                </span>
              </div>
              <button
                onClick={() => {
                  setUseMemory(!useMemory)
                  localStorage.setItem("aladino-ai-use-memory", String(!useMemory))
                }}
                className={`w-10 h-5 rounded-full relative transition-all duration-300 ${useMemory ? "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.4)]" : "bg-slate-300 dark:bg-slate-600"}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${useMemory ? "left-5" : "left-0.5"}`}
                ></div>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div
          className="flex-1 flex flex-col relative h-full overflow-hidden bg-slate-50/50 dark:bg-transparent"
        >
          {/* Header */}
          <div className="sticky top-4 z-50 px-4 md:px-8">
            <div
              className={`w-full max-w-6xl mx-auto rounded-2xl p-1 shadow-2xl transition-all duration-500 animate-float overflow-hidden relative ${isDark ? "bg-slate-800/95 border border-sky-500/30 shadow-[0_0_50px_rgba(14,165,233,0.15)]" : "bg-sky-100/90 border border-sky-300 shadow-[0_10px_40px_rgba(14,165,233,0.25)]"} backdrop-blur-xl`}
            >
              <div className="absolute inset-0 pointer-events-none opacity-40 brainwave-overlay"></div>
              <div className="relative flex items-center justify-between p-3 md:p-4 rounded-xl z-10">
                <div className="flex items-center gap-4 md:gap-6">
                  <button
                    onClick={() => setSidebarVisible(!sidebarVisible)}
                    className="p-3 rounded-xl bg-sky-500 text-white shadow-lg shadow-sky-500/40 hover:scale-110 hover:shadow-sky-500/60 transition-all active:scale-95 border-t border-white/20 md:hidden flex items-center justify-center cursor-pointer"
                  >
                    <Menu size={24} strokeWidth={3} />
                  </button>
                  <button
                    onClick={() => setSidebarVisible(!sidebarVisible)}
                    className="p-3 rounded-xl bg-sky-500 text-white shadow-lg shadow-sky-500/40 hover:scale-110 hover:shadow-sky-500/60 transition-all active:scale-95 border-t border-white/20 hidden md:flex items-center justify-center cursor-pointer"
                  >
                    <ChevronRight size={24} strokeWidth={3} />
                  </button>

                  <div className="flex items-center gap-4 md:gap-6">
                    <div
                      className={`relative w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-full border-[3px] border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.6)] overflow-hidden bg-slate-950 ${isLoading ? "animate-pulse shadow-sky-300 ring-2 ring-sky-500/50" : ""}`}
                    >
                      <img
                        src={currentAgent.image || "/placeholder.svg"}
                        className="w-full h-full object-cover"
                        alt="Hero"
                      />
                      <div className="absolute inset-0 bg-sky-500/10 mix-blend-overlay"></div>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-widest leading-none drop-shadow-md">
                          {currentAgent.name}
                        </h1>
                        <span className="px-2 py-0.5 rounded bg-sky-500 text-white text-[10px] font-bold tracking-widest shadow-[0_0_10px_rgba(14,165,233,0.5)] uppercase">
                          Online
                        </span>
                      </div>
                      <p
                        className={`text-sm leading-tight max-w-md ${isDark ? "text-slate-300" : "text-slate-700"} font-medium`}
                      >
                        {currentAgent.role}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                  {tokenUsage && (
                    <div className="hidden md:flex flex-col gap-1 px-3 py-2 rounded-xl bg-slate-200/50 dark:bg-white/5 border border-slate-300/50 dark:border-white/10 min-w-[180px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          <Zap size={12} className="text-sky-400" />
                          Token Usati
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                          {tokenUsage.totalUsedTokens.toLocaleString("it-IT")}
                          <span className="text-slate-400 dark:text-slate-500 font-medium">
                            {" "}/ {tokenUsage.totalTokenLimit.toLocaleString("it-IT")}
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-300/60 dark:bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${tokenProgressClass}`}
                          style={{ width: `${tokenUsagePercent}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setIsDark(!isDark)}
                    className="p-2.5 rounded-full bg-slate-200/50 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 transition text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    {isDark ? <Sun size={20} /> : <Moon size={20} />}
                  </button>
                  <div className="h-8 w-px bg-slate-300 dark:bg-white/10 mx-2 hidden sm:block"></div>
                  <a
                    href="/dashboard"
                    className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all border-t border-white/20 flex items-center justify-center group cursor-pointer"
                  >
                    <Home size={22} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
                  </a>
                  <a
                    href={`/dashboard/knowledgebase/aladino-ai?sharedNamespaceId=${user?.id ?? ""}`}
                    className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 transition-all border-t border-white/20 flex items-center justify-center group cursor-pointer"
                    title="Knowledgebase"
                  >
                    <BookOpen size={22} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
                  </a>
                  <div className="hidden sm:block">
                    <UserButton
                      appearance={{
                        elements: {
                          avatarBox: "w-10 h-10 ring-2 ring-sky-400/50 hover:ring-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.6)]",
                        },
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar">
            <div className="max-w-6xl mx-auto space-y-6">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 md:gap-4 ${msg.sender === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  {msg.sender === "ai" && (
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-full shadow-lg shadow-sky-500/30 shrink-0 border-2 border-white dark:border-slate-900 overflow-hidden">
                      <img
                        src={
                          currentAgent.image ||
                          "/assets/agents/Aladdin-AI.png"
                        }
                        alt={currentAgent.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div
                    className={`group relative max-w-[85%] md:max-w-3xl rounded-2xl px-4 md:px-5 py-3 md:py-4 shadow-lg transition-all duration-300 hover:shadow-xl ${msg.sender === "ai" ? "bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700" : "bg-gradient-to-br from-sky-500 to-sky-600 text-white border border-sky-400"}`}
                  >
                    {msg.files && msg.files.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-white/20">
                        {msg.files.map((fileName, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 text-xs">
                            <FileText size={12} /> {fileName}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.sender === "ai" && (msg.text === "..." || msg.text === "") ? (
                      <div className="typing-indicator text-sky-500 dark:text-sky-400" aria-label={`${currentAgent?.name || "L'assistente"} sta scrivendo`}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    ) : (
                      <>
                        <div
                          className="markdown-body prose prose-slate dark:prose-invert max-w-none text-sm md:text-base leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text) }}
                        />
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                          <span className="text-[10px] opacity-60 font-mono">{msg.time}</span>
                          {msg.sender === "ai" && msg.text && (
                            <button
                              onClick={() => handleCopyMessage(msg.text, idx)}
                              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                            >
                              {copiedMessageIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {msg.sender === "user" && (
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-full shadow-lg shadow-slate-500/30 shrink-0 border-2 border-white dark:border-slate-900 overflow-hidden">
                      <img
                        src="https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
                        alt="User"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div
            className="sticky bottom-0 px-4 md:px-8 pb-4 md:pb-6"
          >
            <div className="max-w-6xl mx-auto">
              {/* Token usage announcer bar */}
              {isTokenLimitReached ? (
                <div className="mb-3 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium bg-rose-500/15 border-rose-500/50 text-rose-700 dark:text-rose-300">
                  <span aria-hidden>🛑</span>
                  <span>
                    Limite di token raggiunto. Questa conversazione è terminata: avvia una nuova chat per continuare.
                  </span>
                </div>
              ) : (
                activeTokenAlert && (
                  <div
                    className={`mb-3 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium ${TOKEN_ALERT_STYLES[activeTokenAlert.level].wrap}`}
                  >
                    <span aria-hidden>{TOKEN_ALERT_STYLES[activeTokenAlert.level].icon}</span>
                    <span>{activeTokenAlert.message}</span>
                  </div>
                )
              )}

              {selectedFiles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-700 text-sm group"
                    >
                      <FileText size={14} className="text-sky-600 dark:text-sky-400" />
                      <span className="text-slate-700 dark:text-slate-300">{file.name}</span>
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="glass-panel rounded-2xl shadow-2xl border-2 border-sky-200 dark:border-sky-700/50 overflow-hidden">
                <div className="flex items-end gap-3 p-3 md:p-4">
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage()
                      }
                    }}
                    placeholder={isTokenLimitReached ? "Limite di token raggiunto. Avvia una nuova chat per continuare." : "Scrivi il tuo messaggio..."}
                    rows={1}
                    className="flex-1 bg-transparent text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm md:text-base resize-none focus:outline-none min-h-[24px] max-h-[200px] py-2"
                    disabled={isLoading || isTokenLimitReached}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || isTokenLimitReached || (!inputValue.trim() && selectedFiles.length === 0)}
                    className={`p-3 md:p-3.5 rounded-xl font-bold uppercase tracking-wider transition-all duration-300 shrink-0 border-2 ${isLoading || (!inputValue.trim() && selectedFiles.length === 0) ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border-transparent cursor-not-allowed" : "bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 text-white shadow-lg shadow-sky-500/40 hover:shadow-sky-500/60 hover:scale-105 active:scale-95 border-sky-400 cursor-pointer"}`}
                  >
                    <Send size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  )
}


