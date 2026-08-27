"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { UserButton } from "@clerk/nextjs"
import {
    Send,
    ChevronRight,
    ChevronLeft,
    FolderPlus,
    X,
    FileText,
    Menu,
    Home,
    BookOpen,
    Sun,
    Moon,
    Zap,
    MessageSquare,
    User,
    Folder,
    FolderOpen,
    Trash2,
    Edit2,
    Archive,
    Check,
    MoreHorizontal,
    Copy,
    ChevronDown,
    Share,
    RotateCcw
} from "lucide-react"

import { SUBJECTS, Subject } from "@/data/dan-ai-data"
import OnboardingModal from "@/components/dan-ai/OnboardingModal"
import PreferencesWizard from "@/components/preferences/PreferencesWizard"
import PreferencesButton from "@/components/preferences/PreferencesButton"
import { useUser } from "@clerk/nextjs"
import { UserPreferences, DEFAULT_PREFERENCES } from "@/types/preferences"
import { preferenceService } from "@/services/preferenceService"
import DanHome from "@/components/dan-ai/DanHome"
import ResourcesPanel from "@/components/dan-ai/ResourcesPanel"
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
    agentId: string // Still useful to know which specific persona is answering
    subjectId?: string // NEW: Links chat to a subject
    sessionId?: string
}

interface FolderType {
    id: string
    name: string
    createdAt: string
    subjectId: string
}

// --- CONSTANTS ---
// Keeping AGENTS_DB here for reference and persona lookup
const AGENTS_DB: Record<string, any> = {
    "tony-ai": {
        name: "Tony AI",
        role: "Sales Manager",
        image: "/assets/agents/Tony-AI.png",
        description: "Il tuo consulente vendite digitale con 30 anni di esperienza.",
    },
    "mike-ai": {
        name: "Mike AI",
        role: "Marketing Manager",
        image: "/assets/agents/Mike-AI.png",
        description: "Il tuo stratega di marketing.",
    },
    "lara-ai": {
        name: "Lara AI",
        role: "Social Media Manager",
        image: "/assets/agents/Lara-AI-social-strategiest.png",
        description: "Gestisco i tuoi social media e creo calendari editoriali.",
    },
    "simone-ai": {
        name: "Simone AI",
        role: "SEO Copywriter",
        image: "/assets/agents/SImone-ai.png",
        description: "Scrivo contenuti ottimizzati SEO.",
    },
    "niko-ai": {
        name: "Niko AI",
        role: "SEO Manager",
        image: "/assets/agents/Niko-AI.png",
        description: "Architetto della tua presenza online.",
    },
    "valentina-ai": {
        name: "Valentina AI",
        role: "SEO Optimizer",
        image: "/assets/agents/Valentina-AI.png",
        description: "Ottimizzo i contenuti esistenti.",
    },
    "alex-ai": {
        name: "Alex AI",
        role: "Ads Manager",
        image: "/assets/agents/Alex-AI.png",
        description: "Gestisco le tue campagne pubblicitarie.",
    },
    "aladino-ai": {
        name: "Aladino AI",
        role: "Innovation Manager",
        image: "/assets/agents/Aladdin-AI.png",
        description: "Invento nuovi prodotti e servizi.",
    },
    "jim-ai": {
        name: "Jim AI",
        role: "Sales Coach",
        image: "/assets/agents/JIM-ai.png",
        description: "Alleno il tuo team di vendita.",
    },
    "daniele-ai": {
        name: "Daniele AI",
        role: "Direct Response Copywriter",
        image: "/assets/agents/Daniele-ai.png",
        description: "Progetto e scrivo copy di direct response.",
    },
    "dan-ai": {
        name: "Digital Marketing Coach",
        role: "Your AI Coach",
        image: "/assets/agents/Daniele-ai.png", // Using Daniele/Generic image for now or placeholder
        description: "Ti guido nell'apprendimento del Digital Marketing.",
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
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-sky-400 hover:underline">$1</a>')
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
            // ... existing table logic ...
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

export default function page() {
    // --- STATE ---
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
    const [isPrefsOpen, setIsPrefsOpen] = useState(false)
    const [userPrefs, setUserPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES)
    const [legacyPrefs, setLegacyPrefs] = useState<Record<string, any>>({})
    const { user } = useUser()
    const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || getDevUserEmail()
    const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null)
    const [showHome, setShowHome] = useState(true)
    const [isResourcesPanelOpen, setIsResourcesPanelOpen] = useState(false)

    const [messages, setMessages] = useState<Message[]>([])
    const [inputValue, setInputValue] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [sidebarVisible, setSidebarVisible] = useState(true)
    const [useMemory, setUseMemory] = useState(true)

    useEffect(() => {
        if (userEmail) {
            preferenceService.getUserPreferences(userEmail).then(setUserPrefs)
        }
    }, [userEmail])

    // --- Set Pinecone namespace ---
    useEffect(() => {
        if (user?.id) {
            // Set namespace immediately from user.id (Clerk oauthId) so Pinecone is always ready
            CURRENT_NAMESPACE.current = user.id
            console.log("✅ Dan AI: Using user.id for Pinecone namespace:", user.id)
        }
    }, [user?.id])

    // Rename Modal State (Reverted to Inline for consistency with System)
    const [chats, setChats] = useState<Record<string, ChatSession>>({})
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [activeMenu, setActiveMenu] = useState<string | null>(null)
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
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

    // --- REFS ---
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const newFolderInputRef = useRef<HTMLInputElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const CURRENT_NAMESPACE = useRef("")
    const prevMessageCountRef = useRef(0)

    const N8N_ENDPOINT = process.env.NEXT_PUBLIC_DAN_AI_N8N_ENDPOINT || ""

    const activeSubject = SUBJECTS.find(s => s.id === activeSubjectId) || null

    // --- INITIALIZATION ---
    useEffect(() => {
        const savedTheme = localStorage.getItem("theme")
        if (savedTheme) setIsDark(savedTheme === "dark")
        else setIsDark(true)

        if (window.innerWidth < 768) {
            setSidebarVisible(false)
        }

        const onboardingPrefs = localStorage.getItem("dan-ai-preferences")
        if (onboardingPrefs) {
            try {
                setUserPrefs(JSON.parse(onboardingPrefs))
            } catch (e) { }
        } else {
            setIsOnboardingOpen(true)
        }

        const legacyStored = localStorage.getItem("dan-ai-preferences")
        if (legacyStored) {
            try {
                setLegacyPrefs(JSON.parse(legacyStored))
            } catch (e) { }
        } else {
            setIsOnboardingOpen(true)
        }

        const savedChats = localStorage.getItem("dan-ai-chats")
        if (savedChats) {
            try {
                const parsedChats = JSON.parse(savedChats) as Record<string, ChatSession>
                setChats(parsedChats)
                // Do not auto-select chat, show Home by default unless we want to persist last state
            } catch (e) {
                console.error("Failed to parse saved chats", e)
            }
        }

        const savedFolders = localStorage.getItem("dan-ai-folders")
        if (savedFolders) {
            try {
                setFolders(JSON.parse(savedFolders))
            } catch (e) {
                console.error("Failed to parse folders", e)
            }
        }

    }, [])

    useEffect(() => {
        if (isCreatingFolder && newFolderInputRef.current) {
            newFolderInputRef.current.focus()
        }
    }, [isCreatingFolder])

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

    const handleOnboardingComplete = (prefs: Record<string, any>) => {
        localStorage.setItem("dan-ai-preferences", JSON.stringify(prefs))
        setLegacyPrefs(prefs)
        setIsOnboardingOpen(false)
        if (prefs.specificFocus) {
            setActiveSubjectId(prefs.specificFocus)
            setShowHome(false)
        }
    }

    const selectSubject = (subjectId: string) => {
        setActiveSubjectId(subjectId)
        setShowHome(false) // Show chat area (even if empty/new)
        setSidebarVisible(true)
        // Filter chats for this subject
        const subjectChats = Object.entries(chats).filter(([, c]) => c.subjectId === subjectId)
        if (subjectChats.length > 0) {
            // Load most recent
            const sorted = subjectChats.sort(
                ([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
            )
            loadChat(sorted[0][0])
        } else {
            // Init new chat for this subject
            initNewChatForSubject(subjectId)
        }
    }

    const initNewChatForSubject = (subjectId: string) => {
        const subject = SUBJECTS.find(s => s.id === subjectId)
        if (!subject) return

        const agentId = subject.relatedAgents[0] || "dan-ai"
        const agent = AGENTS_DB[agentId] || AGENTS_DB["dan-ai"]

        const newChatId = "chat_" + Date.now()
        const newSessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)

        const messageText = `Ciao! Sono il tuo Coach di **${subject.name}**. Oggi lavoreremo insieme per migliorare le tue competenze in questo ambito. Come posso aiutarti?`

        const welcomeMsg: Message = {
            text: messageText,
            sender: "ai",
            time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        }

        setCurrentChatId(newChatId)
        setMessages([welcomeMsg])
        setShowHome(false)

        setChats((prev) => {
            const newChat: ChatSession = {
                id: newChatId,
                messages: [welcomeMsg],
                title: `Lezione di ${subject.shortName}`,
                lastUpdated: new Date().toISOString(),
                folderId: null,
                archived: false,
                agentId: agentId,
                subjectId: subjectId,
                sessionId: newSessionId,
            }
            const newChats = { [newChatId]: newChat, ...prev }
            localStorage.setItem("dan-ai-chats", JSON.stringify(newChats))
            return newChats
        })
    }

    // --- CHAT LOGIC COPIED/ADAPTED ---
    const loadChat = (chatId: string) => {
        if (!chats[chatId]) return
        setCurrentChatId(chatId)
        setMessages(chats[chatId].messages || [])
        setShowHome(false)
        if (chats[chatId].subjectId) {
            setActiveSubjectId(chats[chatId].subjectId!)
        }
        setActiveMenu(null)
        if (window.innerWidth < 768) {
            setSidebarVisible(false)
        }
    }

    // --- RENAME LOGIC (INLINE SYSTEM STANDARD) ---
    const startRenaming = (chatId: string) => {
        setRenamingChat(chatId)
        setRenameValue(chats[chatId]?.title || "")
        setActiveMenu(null)
    }

    const confirmRename = (chatId: string) => {
        if (!renameValue.trim()) {
            setRenamingChat(null)
            return
        }
        setChats(prev => {
            const updated = { ...prev, [chatId]: { ...prev[chatId], title: renameValue.trim() } }
            localStorage.setItem("dan-ai-chats", JSON.stringify(updated))
            return updated
        })
        setRenamingChat(null)
        setRenameValue("")
    }

    const deleteChat = (chatIdToDelete: string, e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault()
            e.stopPropagation()
            e.nativeEvent.stopImmediatePropagation()
        }
        setActiveMenu(null)
        if (!confirm("Sei sicuro di voler eliminare questa chat?")) return

        setChats((prev) => {
            const updated = { ...prev }
            delete updated[chatIdToDelete]
            localStorage.setItem("dan-ai-chats", JSON.stringify(updated))
            return updated
        })

        if (chatIdToDelete === currentChatId) {
            // Go back home or find another chat
            setCurrentChatId(null)
            setShowHome(true)
        }
    }

    const archiveChat = (chatId: string) => {
        setChats(prev => {
            const chat = prev[chatId]
            if (!chat) return prev
            const updated = { ...prev, [chatId]: { ...chat, archived: !chat.archived } }
            localStorage.setItem("dan-ai-chats", JSON.stringify(updated))
            return updated
        })
        setActiveMenu(null)
    }

    const shareChat = (chatId: string) => {
        const url = `${window.location.origin}/chat/${chatId}`
        navigator.clipboard.writeText(url)
        alert("Link copiato negli appunti: " + url)
        setActiveMenu(null)
    }

    const toggleMenu = (chatId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (activeMenu === chatId) {
            setActiveMenu(null)
            setMenuPosition(null)
        } else {
            const rect = (e.target as HTMLElement).getBoundingClientRect()
            setMenuPosition({ x: rect.left, y: rect.bottom + 4 })
            setActiveMenu(chatId)
        }
    }

    // --- MESSAGE COPY ---
    const handleCopyMessage = async (text: string, index: number) => {
        try {
            const htmlContent = simpleMarkdown.parse(text)
            // Wrap in basic styling to ensure it looks good in GDocs
            const fullHtml = `<div style="font-family: sans-serif; line-height: 1.5; color: #0f172a;">${htmlContent}</div>`
            const blobHtml = new Blob([fullHtml], { type: "text/html" })
            const blobText = new Blob([text], { type: "text/plain" })
            await navigator.clipboard.write([new ClipboardItem({ ["text/html"]: blobHtml, ["text/plain"]: blobText })])
            setCopiedMessageIndex(index)
            setTimeout(() => setCopiedMessageIndex(null), 2000)
        } catch (e) {
            console.error("Copy failed", e)
            alert("Errore durante la copia")
        }
    }

    const sendMessage = async () => {
        if (!userPrefs.user_name) {
            setIsPrefsOpen(true)
            return
        }
        if (!inputValue.trim() && selectedFiles.length === 0) return

        setIsLoading(true)
        const userMessage: Message = {
            text: inputValue,
            sender: "user",
            time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
            files: selectedFiles.map((f) => f.name),
        }

        let currentChatIdForSend = currentChatId

        // If sending from Home or no active chat, enforce subject selection or use active
        if (!currentChatIdForSend) {
            if (!activeSubjectId) {
                alert("Seleziona una materia prima di iniziare!")
                setIsLoading(false)
                return
            }
            // Create chat on fly
            initNewChatForSubject(activeSubjectId)
            // Wait a tick or handle logic (simpler: return and let user type again? No, auto-send)
            // Refactoring initNewChatForSubject to return ID would be better, but for now let's duplicate logic for atomic send
            const subject = SUBJECTS.find(s => s.id === activeSubjectId)!
            const agentId = subject.relatedAgents[0] || "dan-ai"

            const newChatId = "chat_" + Date.now()
            const newSessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9)

            const welcomeMsg: Message = {
                text: `Ciao! Sono il tuo Coach di **${subject.name}**. Iniziamo!`,
                sender: "ai",
                time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
            }

            const newChat: ChatSession = {
                id: newChatId,
                messages: [welcomeMsg, userMessage],
                title: `Lezione di ${subject.shortName}`,
                lastUpdated: new Date().toISOString(),
                folderId: null,
                archived: false,
                agentId: agentId,
                subjectId: activeSubjectId,
                sessionId: newSessionId,
            }

            setChats(prev => {
                const u = { [newChatId]: newChat, ...prev }
                localStorage.setItem("dan-ai-chats", JSON.stringify(u))
                return u
            })
            setCurrentChatId(newChatId)
            currentChatIdForSend = newChatId
            setMessages([welcomeMsg, userMessage])
        } else {
            // Append to existing
            const updatedMsgs = [...messages, userMessage]
            setMessages(updatedMsgs)
            setChats(prev => {
                const u = {
                    ...prev,
                    [currentChatIdForSend!]: {
                        ...prev[currentChatIdForSend!],
                        messages: updatedMsgs,
                        lastUpdated: new Date().toISOString()
                    }
                }
                localStorage.setItem("dan-ai-chats", JSON.stringify(u))
                return u
            })
        }

        // Placeholder
        setMessages(prev => [...prev, { text: "...", sender: "ai", time: "", raw: "" }])

        try {
            const currentChat = chats[currentChatIdForSend!] || { sessionId: "session_" + Date.now(), agentId: "dan-ai" } // Fallback if just created
            let sessionId = currentChat.sessionId
            let agentIdToUse = currentChat.agentId || "dan-ai"

            const response = await fetch(N8N_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chatInput: inputValue +
                        (selectedFiles.length ? ` [Attached: ${selectedFiles.map((f) => f.name).join(", ")}]` : "") +
                        `\n\n[SYSTEM_CONTEXT DO_NOT_REPLY: DAN_AI_PREFERENCES=${JSON.stringify(legacyPrefs)}]` +
                        `\n\nUSER_PROFILE_DATA: ${JSON.stringify(userPrefs)}`,
                    sessionId: sessionId,
                    useMemory: useMemory,
                    metadata: {
                        namespace: CURRENT_NAMESPACE.current,
                        source: agentIdToUse,
                    },
                    chatId: currentChatIdForSend,
                }),
            })

            if (!response.ok) throw new Error("Network error")
            if (!response.body) throw new Error("No body")

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
                setMessages(prev => {
                    const n = [...prev]
                    n[n.length - 1] = { ...n[n.length - 1], text }
                    return n
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
                                if (isFirstChunk) { rawText = obj.content; isFirstChunk = false }
                                else { rawText += obj.content }
                                // The typewriter loop picks up the new rawText on its next tick.
                            } else if (obj.type === "done" || obj.type === "end") {
                                break
                            }
                        } catch (e) { }
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

            // Finalize
            setMessages(prev => {
                const n = [...prev]
                const finalMsg: Message = {
                    text: rawText || "Risposta completata.",
                    sender: "ai",
                    time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
                    raw: rawText
                }
                n[n.length - 1] = finalMsg

                // Update chat msg
                setChats(c => {
                    const updated = {
                        ...c,
                        [currentChatIdForSend!]: {
                            ...c[currentChatIdForSend!],
                            messages: n,
                            lastUpdated: new Date().toISOString()
                        }
                    }
                    localStorage.setItem("dan-ai-chats", JSON.stringify(updated))
                    return updated
                })

                return n
            })

        } catch (error) {
            console.error(error)
            setMessages(prev => {
                const n = [...prev]
                n[n.length - 1].text = "Errore di connessione."
                return n
            })
        } finally {
            setIsLoading(false)
            setInputValue("")
            setSelectedFiles([])
        }
    }

    // --- COPY FUNCTION ---
    const handleCopyConversation = async () => {
        try {
            // 1. Text Version
            const textToCopy = messages.map(m => `[${m.sender === "ai" ? "DAN AI" : "Student"}] ${m.time}\n${m.text}\n`).join("\n")

            // 2. HTML Version for Google Docs
            const htmlParts = messages.map(m => {
                const contentHtml = simpleMarkdown.parse(m.text)
                const senderName = m.sender === "ai" ? "DAN AI" : "Student"

                return `
                    <div style="margin-bottom: 16px; font-family: sans-serif;">
                        <div style="margin-bottom: 4px;">
                            <strong style="color: ${m.sender === "ai" ? "#4f46e5" : "#0f172a"};">${senderName}</strong> 
                            <span style="color: #94a3b8; font-size: 0.85em; margin-left: 8px;">${m.time}</span>
                        </div>
                        <div style="line-height: 1.5;">${contentHtml}</div>
                    </div>
                `
            })

            const htmlString = `<html><body>${htmlParts.join("<hr style='border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;' />")}</body></html>`

            const blobHtml = new Blob([htmlString], { type: "text/html" })
            const blobText = new Blob([textToCopy], { type: "text/plain" })

            await navigator.clipboard.write([new ClipboardItem({ ["text/html"]: blobHtml, ["text/plain"]: blobText })])
            alert("Conversazione copiata! Incolla in Google Docs per mantenere la formattazione.")

        } catch (e) {
            console.error("Copy failed", e)
            alert("Errore copia (browser non supportato?).")
        }
    }

    // Folder Logic
    const confirmCreateFolder = () => {
        if (!newFolderName.trim()) { setIsCreatingFolder(false); return }
        const newFolder = {
            id: `folder_${Date.now()}`,
            name: newFolderName,
            createdAt: new Date().toISOString(),
            subjectId: activeSubjectId || "general"
        }
        setFolders(prev => {
            const u = [...prev, newFolder]
            localStorage.setItem("dan-ai-folders", JSON.stringify(u))
            return u
        })
        setExpandedFolders(prev => new Set(prev).add(newFolder.id))
        setIsCreatingFolder(false)
        setNewFolderName("")
    }

    const deleteFolder = (fid: string) => {
        if (!confirm("Eliminare cartella?")) return
        setFolders(prev => {
            const u = prev.filter(f => f.id !== fid)
            localStorage.setItem("dan-ai-folders", JSON.stringify(u))
            return u
        })
        // Move chats back to root
        setChats(prev => {
            const u = { ...prev }
            Object.keys(u).forEach(k => {
                if (u[k].folderId === fid) u[k].folderId = null
            })
            localStorage.setItem("dan-ai-chats", JSON.stringify(u))
            return u
        })
    }

    const toggleFolder = (fid: string) => {
        setExpandedFolders(prev => {
            const n = new Set(prev)
            if (n.has(fid)) n.delete(fid)
            else n.add(fid)
            return n
        })
    }

    // Drag Drop (simplified reuse)
    const handleDragStart = (e: React.DragEvent, id: string) => { e.dataTransfer.setData("chatId", id); setDraggedChatId(id) }
    const handleDragOver = (e: React.DragEvent, fid: string | null) => { e.preventDefault(); setDragOverFolderId(fid) }
    const handleDrop = (e: React.DragEvent, fid: string | null) => {
        e.preventDefault()
        setDragOverFolderId(null)
        const id = e.dataTransfer.getData("chatId")
        if (!chats[id]) return
        setChats(prev => {
            const u = { ...prev, [id]: { ...prev[id], folderId: fid } }
            localStorage.setItem("dan-ai-chats", JSON.stringify(u))
            return u
        })
    }

    // --- RENDER ---
    return (
        <>
            <style>{`
            :root { --font-tech: 'Rajdhani', sans-serif; }
            body { font-family: var(--font-tech); background-color: #f8fafc; color: #0f172a; overflow: hidden; }
            .dark body { background-color: #020617; color: #f8fafc; }
            .glass-panel { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(16px); border-right: 1px solid rgba(255,255,255,0.5); }
            .dark .glass-panel { background: rgba(2, 6, 23, 0.85); border-right: 1px solid rgba(14, 165, 233, 0.15); }
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 2px; }
            @keyframes typing-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }
            .typing-indicator { display: inline-flex; align-items: center; gap: 5px; padding: 2px 0; }
            .typing-indicator span { width: 8px; height: 8px; border-radius: 9999px; background: currentColor; opacity: 0.4; animation: typing-bounce 1.2s infinite ease-in-out; }
            .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
            .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
            `}</style>

            <OnboardingModal
                isOpen={isOnboardingOpen}
                onComplete={handleOnboardingComplete}
                initialValues={legacyPrefs}
            />

            <PreferencesWizard
                isOpen={isPrefsOpen}
                onClose={() => setIsPrefsOpen(false)}
                onComplete={() => {
                    setIsPrefsOpen(false)
                    if (userEmail) {
                        preferenceService.getUserPreferences(userEmail).then(setUserPrefs)
                    }
                }}
                userId={userEmail}
            />

            {activeSubject && (
                <ResourcesPanel
                    isOpen={isResourcesPanelOpen}
                    onClose={() => setIsResourcesPanelOpen(false)}
                    subjectName={activeSubject.name}
                />
            )}

            {/* RENAME MODAL REMOVED - USING INLINE */}

            {/* Portal-based Dropdown Menu */}
            {activeMenu && menuPosition && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed w-40 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-[99999] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                    style={{ top: menuPosition.y, left: Math.min(menuPosition.x, window.innerWidth - 180) }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={(e) => { e.stopPropagation(); shareChat(activeMenu); setMenuPosition(null) }} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700/50"><Share size={14} /> Condividi</button>
                    <button onClick={(e) => { e.stopPropagation(); startRenaming(activeMenu); setMenuPosition(null) }} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200"><Edit2 size={14} /> Rinomina</button>
                    <button onClick={(e) => { e.stopPropagation(); archiveChat(activeMenu); setMenuPosition(null) }} className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">{chats[activeMenu]?.archived ? <RotateCcw size={14} /> : <Archive size={14} />} {chats[activeMenu]?.archived ? "Ripristina" : "Archivia"}</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteChat(activeMenu, e); setMenuPosition(null) }} className="w-full text-left px-3 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-sm text-red-500 border-t border-slate-100 dark:border-slate-700/50"><Trash2 size={14} /> Elimina</button>
                </div>,
                document.body
            )}

            <div className={`flex h-screen w-full ${isDark ? "dark" : ""}`}>
                {/* SIDEBAR */}
                <div className={`glass-panel flex flex-col w-80 fixed md:relative h-full z-40 transition-transform duration-300 ${sidebarVisible ? "translate-x-0" : "-translate-x-full absolute"}`}>
                    <div className="p-6 border-b border-sky-100 dark:border-sky-900/30">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">DA</div>
                            <h2 className="text-xl font-bold font-tech text-slate-800 dark:text-white">DAN AI</h2>
                        </div>

                        <button onClick={() => { setShowHome(true); setIsResourcesPanelOpen(false) }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition font-bold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-widest cursor-pointer">
                            <Home size={18} /> Dashboard
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Materie di Studio</h3>
                        <div className="space-y-1">
                            {SUBJECTS.map(subject => {
                                const isActive = activeSubjectId === subject.id
                                const Icon = subject.icon
                                return (
                                    <div key={subject.id}>
                                        <div
                                            onClick={() => selectSubject(subject.id)}
                                            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border
                                                ${isActive
                                                    ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/50"
                                                    : "border-transparent hover:bg-white/50 dark:hover:bg-white/5"
                                                }`}
                                        >
                                            <div className={`p-1.5 rounded-lg text-white shadow-lg`} style={{ backgroundColor: subject.color }}>
                                                <Icon size={14} />
                                            </div>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{subject.shortName}</span>
                                        </div>

                                        {/* Nested Chats for Active Subject */}
                                        {isActive && (
                                            <div className="ml-4 pl-4 border-l-2 border-slate-100 dark:border-slate-800 mt-2 space-y-1 animate-in slide-in-from-left-2 fade-in">
                                                <button onClick={() => initNewChatForSubject(subject.id)} className="flex items-center gap-2 text-xs font-semibold text-indigo-500 hover:text-indigo-600 py-1 mb-2">
                                                    <MessageSquare size={12} /> Nuova Lezione
                                                </button>

                                                {/* Folders & Chats Filtered by Subject - FULL IMPLEMENTATION */}

                                                {/* Subject Actions - Create Folder */}
                                                <div className="flex gap-2 mb-2 pr-2">
                                                    <button
                                                        onClick={() => { setIsCreatingFolder(true); setNewFolderName("") }}
                                                        className="flex-1 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 text-[10px] font-medium text-slate-500 hover:text-indigo-500 hover:border-indigo-400 transition-all"
                                                    >
                                                        <FolderPlus size={12} /> Cartella
                                                    </button>
                                                    <button
                                                        onClick={() => setShowArchived(!showArchived)}
                                                        className={`px-2 py-1.5 rounded-lg border transition-all ${showArchived ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600" : "border-slate-200 dark:border-slate-700 text-slate-400"}`}
                                                    >
                                                        <Archive size={12} />
                                                    </button>
                                                </div>

                                                {/* New Folder Input */}
                                                {isCreatingFolder && activeSubjectId === subject.id && (
                                                    <div className="flex gap-1 mb-2 pr-2 animate-in slide-in-from-top-2">
                                                        <input
                                                            value={newFolderName}
                                                            onChange={(e) => setNewFolderName(e.target.value)}
                                                            placeholder="Nome..."
                                                            className="flex-1 min-w-0 bg-white dark:bg-slate-800 border-2 border-indigo-500 rounded px-1 py-0.5 text-xs outline-none"
                                                            onKeyDown={(e) => e.key === "Enter" && confirmCreateFolder()}
                                                            autoFocus
                                                        />
                                                        <button onClick={confirmCreateFolder} className="p-1 bg-indigo-500 text-white rounded"><Check size={10} /></button>
                                                        <button onClick={() => setIsCreatingFolder(false)} className="p-1 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded"><X size={10} /></button>
                                                    </div>
                                                )}

                                                {/* Render Folders for this Subject */}
                                                {folders.filter(f => f.subjectId === subject.id).map(folder => {
                                                    const folderChats = Object.values(chats).filter(c => c.subjectId === subject.id && c.folderId === folder.id && !c.archived)
                                                    const isExpanded = expandedFolders.has(folder.id)
                                                    const isDragOver = dragOverFolderId === folder.id

                                                    return (
                                                        <div
                                                            key={folder.id}
                                                            className={`mb-1 mr-2 rounded-lg transition-all ${isDragOver ? "bg-indigo-50 ring-1 ring-indigo-500" : ""}`}
                                                            onDragOver={(e) => handleDragOver(e, folder.id)}
                                                            onDrop={(e) => handleDrop(e, folder.id)}
                                                        >
                                                            <div className="group flex items-center justify-between p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer" onClick={() => toggleFolder(folder.id)}>
                                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                                    {isExpanded ? <FolderOpen size={14} className="text-indigo-500" /> : <Folder size={14} className="text-slate-400 group-hover:text-indigo-400" />}
                                                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[120px]">{folder.name}</span>
                                                                    <span className="text-[10px] text-slate-400">({folderChats.length})</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id) }} className="hover:text-red-500"><Trash2 size={10} /></button>
                                                                </div>
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="ml-3 pl-2 border-l border-slate-100 dark:border-slate-800 mt-1 space-y-0.5">
                                                                    {folderChats.map(chat => (
                                                                        <div
                                                                            key={chat.id}
                                                                            draggable
                                                                            onDragStart={(e) => handleDragStart(e, chat.id)}
                                                                            onClick={() => loadChat(chat.id)}
                                                                            className={`group relative text-xs py-1 px-2 rounded cursor-pointer flex justify-between items-center
                                                                                ${currentChatId === chat.id
                                                                                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10 font-bold'
                                                                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                                }`}
                                                                        >
                                                                            {renamingChat === chat.id ? (
                                                                                <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                                                                                    <input
                                                                                        value={renameValue}
                                                                                        onChange={e => setRenameValue(e.target.value)}
                                                                                        className="flex-1 min-w-0 bg-white dark:bg-slate-800 border-2 border-indigo-500 rounded px-1 py-0.5 text-xs outline-none"
                                                                                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); confirmRename(chat.id) } }}
                                                                                        onClick={e => e.stopPropagation()}
                                                                                        autoFocus
                                                                                    />
                                                                                    <button onClick={(e) => { e.stopPropagation(); confirmRename(chat.id) }} className="text-green-500 hover:bg-green-100 rounded p-0.5"><Check size={12} /></button>
                                                                                    <button onClick={(e) => { e.stopPropagation(); setRenamingChat(null) }} className="text-red-500 hover:bg-red-100 rounded p-0.5"><X size={12} /></button>
                                                                                </div>
                                                                            ) : (
                                                                                <>
                                                                                    <span className="truncate flex-1">{chat.title}</span>
                                                                                    <button
                                                                                        onClick={(e) => toggleMenu(chat.id, e)}
                                                                                        className={`opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded ${activeMenu === chat.id ? 'opacity-100' : ''}`}
                                                                                    >
                                                                                        <MoreHorizontal size={12} />
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}

                                                {/* Unorganized Chats */}
                                                {Object.values(chats)
                                                    .filter(c => c.subjectId === subject.id && !c.folderId && !c.archived)
                                                    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
                                                    .map((chat) => (
                                                        <div
                                                            key={chat.id}
                                                            draggable="true"
                                                            onDragStart={(e) => handleDragStart(e, chat.id)}
                                                            onClick={() => loadChat(chat.id)}
                                                            className={`group relative text-xs truncate py-1.5 px-2 mr-2 rounded cursor-pointer flex justify-between items-center
                                                                ${currentChatId === chat.id
                                                                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10 font-bold'
                                                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                                }`}
                                                        >
                                                            {renamingChat === chat.id ? (
                                                                <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                                                                    <input
                                                                        value={renameValue}
                                                                        onChange={e => setRenameValue(e.target.value)}
                                                                        className="flex-1 min-w-0 bg-white dark:bg-slate-800 border-2 border-indigo-500 rounded px-1 py-0.5 text-xs outline-none"
                                                                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); confirmRename(chat.id) } }}
                                                                        onClick={e => e.stopPropagation()}
                                                                        autoFocus
                                                                    />
                                                                    <button onClick={(e) => { e.stopPropagation(); confirmRename(chat.id) }} className="text-green-500 hover:bg-green-100 rounded p-0.5"><Check size={12} /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setRenamingChat(null) }} className="text-red-500 hover:bg-red-100 rounded p-0.5"><X size={12} /></button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <span className="truncate flex-1">{chat.title}</span>
                                                                    <button
                                                                        onClick={(e) => toggleMenu(chat.id, e)}
                                                                        className={`opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded ${activeMenu === chat.id ? 'opacity-100' : ''}`}
                                                                    >
                                                                        <MoreHorizontal size={12} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="p-4 border-t border-sky-100 dark:border-sky-900/30 space-y-2">
                        <button
                            onClick={() => setIsOnboardingOpen(true)}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <User size={14} /> Modifica Preferenze Dan
                        </button>
                        <div className="flex items-center gap-2 text-xs text-slate-400 justify-center">
                            <Zap size={14} className="text-yellow-400" fill="currentColor" />
                            <span>AI Memory Active</span>
                        </div>
                    </div>
                </div>

                {/* MAIN CONTENT */}
                <div className="flex-1 flex flex-col relative h-full bg-slate-50 dark:bg-slate-950/50">
                    {/* Toggle Sidebar Mobile */}
                    {!sidebarVisible && (
                        <button onClick={() => setSidebarVisible(true)} className="absolute top-4 left-4 z-50 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                            <Menu size={20} className="text-slate-600 dark:text-slate-300" />
                        </button>
                    )}

                    {showHome ? (
                        <DanHome onSelectSubject={selectSubject} onOpenSettings={() => setIsOnboardingOpen(true)} />
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 flex items-center justify-between z-10">
                                <div className="flex items-center gap-4">
                                    {activeSubject && (
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/20" style={{ backgroundColor: activeSubject.color }}>
                                                <activeSubject.icon size={18} />
                                            </div>
                                            <div>
                                                <h1 className="text-lg font-bold text-slate-800 dark:text-white leading-none">{activeSubject.name}</h1>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Coach Attivo</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setIsOnboardingOpen(true)}
                                        className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md hover:shadow-lg hover:from-indigo-600 hover:to-purple-700 transition-all transform hover:-translate-y-0.5"
                                    >
                                        <User size={16} strokeWidth={2.5} />
                                        <span className="text-xs font-extrabold tracking-wide uppercase">Profilo Dan</span>
                                    </button>
                                    {activeSubject && (
                                        <button
                                            onClick={() => setIsResourcesPanelOpen(!isResourcesPanelOpen)}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors text-xs font-bold uppercase tracking-wider border border-indigo-200 dark:border-indigo-500/30"
                                        >
                                            <BookOpen size={14} /> Materiali
                                        </button>
                                    )}
                                    <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-2"></div>
                                    <button
                                        onClick={handleCopyConversation}
                                        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-500/30"
                                        title="Copia l'intera conversazione"
                                    >
                                        <Copy size={16} />
                                        <span className="text-xs font-bold">Copia Chat</span>
                                    </button>

                                    {/* NEW: Context Menu Trigger in Header */}
                                    {currentChatId && (
                                        <button
                                            onClick={(e) => toggleMenu(currentChatId, e)}
                                            className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${activeMenu === currentChatId ? 'bg-slate-100 dark:bg-slate-800 text-indigo-500' : 'text-slate-500'}`}
                                        >
                                            <MoreHorizontal size={20} />
                                        </button>
                                    )}

                                    <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-1"></div>

                                    <button onClick={() => setIsDark(!isDark)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                                    </button>
                                    <div className="mr-2">
                                        <PreferencesButton onClick={() => setIsPrefsOpen(true)} />
                                    </div>
                                    <UserButton />
                                </div>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                                <div className="max-w-4xl mx-auto space-y-6">
                                    {messages.map((msg, idx) => (
                                        <div key={idx} className={`flex gap-4 ${msg.sender === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}>
                                            {msg.sender === "ai" && (
                                                <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-700 shadow-sm overflow-hidden shrink-0">
                                                    <img src="/assets/agents/daniele_ai_direct_response_copywriter.png" className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${msg.sender === "ai" ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200" : "bg-indigo-600 text-white"}`}>
                                                {msg.files && msg.files.map((f, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-xs bg-black/10 p-1 rounded mb-2">
                                                        <FileText size={12} /> {f}
                                                    </div>
                                                ))}
                                                {msg.sender === "ai" && (msg.text === "..." || msg.text === "") ? (
                                                    <div className="typing-indicator text-indigo-500 dark:text-indigo-400" aria-label="Dan AI sta scrivendo">
                                                        <span></span>
                                                        <span></span>
                                                        <span></span>
                                                    </div>
                                                ) : (
                                                  <>
                                                <div
                                                    className="markdown-body text-sm leading-relaxed"
                                                    dangerouslySetInnerHTML={{ __html: simpleMarkdown.parse(msg.text) }}
                                                />
                                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                                                    <p className="text-[10px] opacity-50">{msg.time}</p>
                                                    {msg.sender === "ai" && msg.text && (
                                                        <button
                                                            onClick={() => handleCopyMessage(msg.text, idx)}
                                                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-colors"
                                                            title="Copia messaggio"
                                                        >
                                                            {copiedMessageIndex === idx ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                                        </button>
                                                    )}
                                                </div>
                                                  </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-t border-slate-200 dark:border-slate-800">
                                <div className="max-w-4xl mx-auto relative flex items-end gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 focus-within:border-indigo-500 transition-colors shadow-sm">
                                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-500 transition-colors">
                                        <FolderPlus size={20} />
                                    </button>
                                    <input type="file" multiple ref={fileInputRef} className="hidden" onChange={(e) => { if (e.target.files?.length) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} />

                                    <textarea
                                        ref={textareaRef}
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                        placeholder={`Chiedi a DAN AI riguardo ${activeSubject?.name || '...'} `}
                                        className="flex-1 bg-transparent max-h-32 min-h-[44px] py-3 text-sm focus:outline-none resize-none text-slate-800 dark:text-slate-200 placeholder-slate-400"
                                        rows={1}
                                    />

                                    <button
                                        onClick={sendMessage}
                                        disabled={isLoading || (!inputValue.trim() && selectedFiles.length === 0)}
                                        className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                                {selectedFiles.length > 0 && (
                                    <div className="max-w-4xl mx-auto mt-2 flex gap-2 overflow-x-auto">
                                        {selectedFiles.map((f, i) => (
                                            <div key={i} className="flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                                <FileText size={12} /> {f.name} <button onClick={() => setSelectedFiles(p => p.filter((_, idx) => idx !== i))}><X size={12} /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    )
}
