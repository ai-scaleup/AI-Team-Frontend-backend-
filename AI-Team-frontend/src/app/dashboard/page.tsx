"use client"

import { API_BASE } from "@/lib/apiBase"
import { authenticatedFetch } from "@/lib/authenticatedFetch";

import { useState, useEffect } from "react"
// Force rebuild
import Image from "next/image"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useUser, UserButton } from "@clerk/nextjs"
import { Moon, Sun } from "lucide-react"
import { resolveUserEmail } from "@/lib/devToken"
import { agents, type UiAgent } from "@/lib/agentCatalog"
import { fetchAssignedAgents, type AssignedTeam } from "@/lib/assignedAgents"
import TokenUsageSheet from "@/components/ui/TokenUsageSheet"

/* ---------------------------- API base URL ---------------------------- */


/* ------------------------------ Types ------------------------------ */

interface AgentGroup {
  id: string
  name: string
  description?: string | null
  slug?: string | null
}

interface GroupAgentsResponse {
  id: string
  name: string
  description?: string | null
  isActive: boolean
  agents: string[]
  agentCount: number
}
/* The agent catalogue lives in one place so the access guard sees the same list. */
/* -------------------------------- Page Component -------------------------------- */

export default function HomePage() {
  const { user, isLoaded } = useUser()
  const [email, setEmail] = useState<string>("")
  const [assignedAgentNames, setAssignedAgentNames] = useState<string[]>([])
  const [assignedGroups, setAssignedGroups] = useState<AssignedTeam[]>([])
  const [selectedGroup, setSelectedGroup] = useState<AgentGroup | null>(null)
  const [groupAgents, setGroupAgents] = useState<UiAgent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalLoading, setIsModalLoading] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [activeTab, setActiveTab] = useState<"agenti" | "test">("agenti")

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("theme", theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }

  useEffect(() => {
    async function fetchData() {
      if (!isLoaded) return

      // Without a Clerk session the development email identifies the caller.
      const userEmail = resolveUserEmail(user?.primaryEmailAddress?.emailAddress)

      if (!userEmail) {
        setIsLoading(false)
        return
      }

      try {
        setEmail(userEmail)

        console.log("[v0] Fetching data for user:", userEmail)

        // Agents a user can see come from two independent sources: team
        // assignments and per-agent assignments. The access guard reads the
        // same helper, so the grid and the guard can never disagree.
        const { agentKeys, teams } = await fetchAssignedAgents(userEmail)

        console.log("[v0] Assigned teams:", teams)
        console.log("[v0] Assigned agents:", agentKeys)

        setAssignedGroups(teams)
        setAssignedAgentNames(agentKeys)
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user, isLoaded])

  const handleGroupClick = async (group: AgentGroup) => {
    setSelectedGroup(group)
    setIsModalLoading(true)

    try {
      const response = await authenticatedFetch(`${API_BASE}/admin/teams/${group.id}`)

      if (response.ok) {
        const groupData: GroupAgentsResponse = await response.json()

        console.log("[v0] Group data:", groupData)

        setSelectedGroup({
          ...group,
          name: groupData.name,
        })

        const agentIds = groupData.agents
        const matchedAgents = agents.filter((agent) => agentIds.includes(agent.key))

        console.log("[v0] Matched agents:", matchedAgents)
        setGroupAgents(matchedAgents)
      } else {
        console.error("Failed to fetch group agents")
        setGroupAgents([])
      }
    } catch (error) {
      console.error("Error fetching group agents:", error)
      setGroupAgents([])
    } finally {
      setIsModalLoading(false)
    }
  }

  const handleCloseModal = () => {
    setSelectedGroup(null)
    setGroupAgents([])
  }

  const visibleAgents = agents.filter((agent) => {
    const isAssigned = assignedAgentNames.includes(agent.key)
    const isTest = agent.key.startsWith("TEST_")

    if (!isAssigned) return false

    return activeTab === "test" ? isTest : !isTest
  })

  if (isLoading || !isLoaded) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center px-4 ${theme === "dark" ? "bg-muted" : "bg-gray-100"}`}
      >
        <div
          className={`h-8 w-8 animate-spin rounded-full border-4 border-t-transparent ${theme === "dark" ? "border-primary" : "border-blue-600"}`}
        />
      </div>
    )
  }

  if (!email) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center px-4 ${theme === "dark" ? "bg-muted" : "bg-gray-100"}`}
      >
        <p
          className={`text-center text-sm sm:text-base ${theme === "dark" ? "text-muted-foreground" : "text-gray-600"}`}
        >
          Devi effettuare il login per vedere i tuoi agenti assegnati.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen ${theme === "dark" ? "bg-[#020617] bg-tech-grid" : "bg-gradient-to-br from-gray-50 to-blue-50"}`}
    >
      <style jsx global>{`
        .bg-tech-grid {
          background-image: 
            linear-gradient(rgba(14, 165, 233, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14, 165, 233, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        .glass-card {
          background: ${theme === "dark" ? "rgba(17, 24, 39, 0.7)" : "rgba(255, 255, 255, 0.95)"};
          border: 1px solid ${theme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"};
          box-shadow: ${theme === "dark" ? "0 4px 30px rgba(0, 0, 0, 0.3)" : "0 4px 30px rgba(0, 0, 0, 0.1)"};
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }

        .glass-card:hover {
          box-shadow: ${theme === "dark" ? "0 0 25px rgba(14, 165, 233, 0.3), inset 0 0 0 1px rgba(14, 165, 233, 0.4)" : "0 0 25px rgba(59, 130, 246, 0.3), inset 0 0 0 1px rgba(59, 130, 246, 0.4)"};
          border-color: ${theme === "dark" ? "rgba(14, 165, 233, 0.5)" : "rgba(59, 130, 246, 0.5)"};
        }

        .manager-card {
          box-shadow: 0 0 30px rgba(229, 43, 80, 0.25);
          border-color: rgba(229, 43, 80, 0.8) !important;
          animation: manager-pulse 3s infinite alternate;
        }
        .manager-card:hover {
          box-shadow: 0 0 60px rgba(229, 43, 80, 0.5), inset 0 0 0 2px rgba(229, 43, 80, 0.6);
        }

        @keyframes manager-pulse {
          0% { box-shadow: 0 0 20px rgba(229, 43, 80, 0.2); }
          100% { box-shadow: 0 0 40px rgba(229, 43, 80, 0.4); }
        }

        @keyframes pulse-green-strong {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.9); opacity: 1; }
          50% { opacity: 0.8; }
          100% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); opacity: 1; }
        }
        .status-dot-active {
          animation: pulse-green-strong 1.5s infinite ease-in-out;
        }

        .character-image {
          mask-image: linear-gradient(to bottom, black 85%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 85%, transparent 100%);
        }

        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .hologram-bg {
          background-image: linear-gradient(transparent 50%, rgba(0, 0, 0, 0.5) 50%);
          background-size: 100% 4px;
        }
        .scan-bar {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: ${theme === "dark" ? "linear-gradient(to bottom, transparent, rgba(14, 165, 233, 0.2), transparent)" : "linear-gradient(to bottom, transparent, rgba(59, 130, 246, 0.2), transparent)"};
          animation: scanline 2s linear infinite;
          pointer-events: none;
        }
        .manager-scan-bar {
          background: linear-gradient(to bottom, transparent, rgba(229, 43, 80, 0.3), transparent);
        }

        .group-card {
          background: ${theme === "dark" ? "rgba(17, 24, 39, 0.7)" : "rgba(255, 255, 255, 0.95)"};
          border: 1px solid ${theme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)"};
          box-shadow: ${theme === "dark" ? "0 4px 30px rgba(0, 0, 0, 0.3)" : "0 4px 30px rgba(0, 0, 0, 0.1)"};
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }
        .group-card:hover {
          box-shadow: ${theme === "dark" ? "0 0 25px rgba(99, 102, 241, 0.3), inset 0 0 0 1px rgba(99, 102, 241, 0.4)" : "0 0 25px rgba(99, 102, 241, 0.3), inset 0 0 0 1px rgba(99, 102, 241, 0.4)"};
          border-color: ${theme === "dark" ? "rgba(99, 102, 241, 0.5)" : "rgba(99, 102, 241, 0.5)"};
          transform: translateY(-4px);
        }

        /* Custom scrollbar for horizontal scroll */
        .agents-scroll::-webkit-scrollbar {
          height: 8px;
        }
        .agents-scroll::-webkit-scrollbar-track {
          background: ${theme === "dark" ? "rgba(17, 24, 39, 0.5)" : "rgba(229, 231, 235, 0.5)"};
          border-radius: 4px;
        }
        .agents-scroll::-webkit-scrollbar-thumb {
          background: ${theme === "dark" ? "rgba(14, 165, 233, 0.5)" : "rgba(59, 130, 246, 0.5)"};
          border-radius: 4px;
        }
        .agents-scroll::-webkit-scrollbar-thumb:hover {
          background: ${theme === "dark" ? "rgba(14, 165, 233, 0.7)" : "rgba(59, 130, 246, 0.7)"};
        }
      `}</style>

      <div style={{ fontFamily: "'Rajdhani', sans-serif" }} className={`mx-auto w-full max-w-[1600px] px-4 py-2 sm:px-6 lg:px-8 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

        {/* New Navigation Bar - Very Compact */}
        <nav className={`flex items-center justify-between mb-2 px-6 py-2 rounded-full border relative z-50 backdrop-blur-xl ${theme === "dark" ? "bg-[#0B1221]/80 border-white/5" : "bg-white/80 border-gray-200 shadow-md"}`}>
          {/* Left: Logo */}
          <div className="flex flex-col">
            <h1 className={`text-xl font-bold tracking-tight leading-none ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
              AI TEAM
            </h1>
            <span className="text-[10px] text-blue-500 font-bold tracking-[0.2em] uppercase">Dashboard</span>
          </div>

          {/* Center: Toggle */}
          <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full p-0.5 border flex items-center ${theme === "dark" ? "bg-[#0F1729] border-white/5" : "bg-gray-100 border-gray-200"}`}>
            <button
              onClick={() => setActiveTab("agenti")}
              className={`px-6 py-1 rounded-full text-xs font-bold tracking-wider transition-all duration-300 ${activeTab === "agenti"
                ? "bg-[#0ea5e9] text-white shadow-[0_0_15px_rgba(14,165,233,0.4)]"
                : theme === "dark"
                  ? "text-gray-400 hover:text-white"
                  : "text-gray-500 hover:text-gray-800"
                }`}
            >
              AGENTI
            </button>
            <button
              onClick={() => setActiveTab("test")}
              className={`px-6 py-1 rounded-full text-xs font-bold tracking-wider transition-all duration-300 ${activeTab === "test"
                ? "bg-[#0ea5e9] text-white shadow-[0_0_15px_rgba(14,165,233,0.4)]"
                : theme === "dark"
                  ? "text-gray-400 hover:text-white"
                  : "text-gray-500 hover:text-gray-800"
                }`}
            >
              TEST
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-6">
            <TokenUsageSheet email={email} assignedAgentNames={assignedAgentNames} theme={theme} />

            <button
              onClick={toggleTheme}
              className={`p-2 transition-all duration-300 ${theme === "dark" ? "text-white/80 hover:text-white" : "text-gray-600 hover:text-gray-900"
                }`}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <Link
              href={`/dashboard/knowledgebase?sharedNamespaceId=${user?.id ?? ""}`}
              className={`p-2 transition-colors ${theme === "dark" ? "text-white/80 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
              title="Knowledge Base - Info Azienda"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></svg>
            </Link>

            <Link
              href="/dashboard/settings"
              className={`p-2 transition-colors ${theme === "dark" ? "text-white/80 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
              title="Impostazioni Preferenze"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
            </Link>

            <button className={`p-2 transition-colors ${theme === "dark" ? "text-white/80 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            </button>

            <div className={`h-8 w-px mx-2 ${theme === "dark" ? "bg-white/10" : "bg-gray-300"}`}></div>

            <div className="text-right hidden sm:block">
              <p className={`text-[10px] font-medium ${theme === "dark" ? "text-white/60" : "text-gray-500"}`}>Admin</p>
              <p className="text-xs text-[#0ea5e9] font-bold">Pro Plan</p>
            </div>

            <UserButton
              appearance={{
                elements: {
                  avatarBox: `h-9 w-9 ring-2 ${theme === "dark" ? "ring-white/10" : "ring-gray-200"}`,
                },
              }}
            />
          </div>
        </nav>

        {/* Hero Section - Super Compact */}
        <header className="relative mb-4">
          {/* Grid Background Effect */}
          <div className={`absolute inset-0 bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)] -z-10 pointer-events-none h-[400px] w-full top-[-100px] 
             ${theme === "dark"
              ? "bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]"
              : "bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)]"
            }`}
          ></div>

          <div className="space-y-0.5 mb-2">
            <p className="text-[#0ea5e9] text-xs font-bold tracking-[0.15em] uppercase pl-1">
              Command Center
            </p>
            <h1 className={`text-4xl md:text-5xl font-bold leading-none tracking-tight ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
              IL TUO AI TEAM:<br />
              <span className="text-[#0ea5e9]">
                sfrutta i Super Poteri dei tuoi Ai Agents
              </span><br />
              <span className={`${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                per Distruggere i Competitor
              </span>
            </h1>
          </div>

          {/* Stats Cards - Pull up even more */}
          <div className="flex justify-end mt-[-50px] mb-4 gap-4">
            <div className={`backdrop-blur-md border rounded-xl px-5 py-2 min-w-[130px] ${theme === "dark" ? "bg-[#111827]/80 border-white/5" : "bg-white/80 border-gray-200 shadow-sm"}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Agenti Attivi</p>
              <p className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>10/10</p>
            </div>
            <div className={`backdrop-blur-md border rounded-xl px-5 py-2 min-w-[130px] ${theme === "dark" ? "bg-[#111827]/80 border-white/5" : "bg-white/80 border-gray-200 shadow-sm"}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Task Completati</p>
              <p className="text-xl font-bold text-[#0ea5e9]">1,240</p>
            </div>
          </div>
        </header>



        <section>
          <h2 className={`mb-3 text-xl font-bold tracking-wide flex items-center gap-3 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            <span className="w-1.5 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></span>
            I tuoi Agenti AI assegnati
          </h2>

          {visibleAgents.length === 0 ? (
            <p className={`text-xs sm:text-sm ${theme === "dark" ? "text-white/60" : "text-gray-600"}`}>
              Nessun agente AI ti è stato ancora assegnato.
            </p>
          ) : (
            <div className="agents-scroll overflow-x-auto pb-4">
              <main className="grid grid-cols-5 gap-4 min-w-[1200px] lg:gap-5 xl:gap-6">
                {visibleAgents.map((agent) => {
                  const isManager = agent.name === "Mike AI" || agent.name === "Test Mike AI"

                  return (
                    <Link key={agent.key} href={agent.href} className="group">
                      <div
                        className={`relative w-full aspect-[3/4] glass-card rounded-2xl overflow-hidden hover:-translate-y-2 transition-all duration-500 cursor-pointer ${isManager ? "manager-card" : ""}`}
                      >
                        <div
                          className={`absolute inset-0 bg-gradient-to-t ${theme === "dark" ? "from-[#020617]" : "from-white"} via-transparent to-transparent opacity-90 z-10 pointer-events-none`}
                        ></div>

                        <div className="absolute inset-0 w-full h-full">
                          <Image
                            src={agent.image || "/placeholder.svg"}
                            alt={agent.name}
                            fill
                            className="object-cover object-top transition duration-700 group-hover:scale-105 character-image"
                          />
                        </div>

                        <div className="absolute top-4 right-4 z-30">
                          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full border border-green-500/30">
                            <div className="w-2 h-2 rounded-full bg-green-500 status-dot-active"></div>
                            <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">
                              Active
                            </span>
                          </div>
                        </div>

                        <div className="absolute bottom-0 left-0 w-full p-4 z-20 flex flex-col justify-end h-full group-hover:opacity-0 transition-opacity duration-300">
                          <div className="transform translate-y-2">
                            <div
                              className={`border-l-4 pl-3 mb-1 ${isManager ? "border-[#E52B50]" : theme === "dark" ? "border-[#0ea5e9]" : "border-blue-600"}`}
                            >
                              <h3
                                className={`text-2xl font-bold leading-none drop-shadow-md ${isManager ? "text-[#E52B50]" : theme === "dark" ? "text-white" : "text-gray-900"}`}
                              >
                                {agent.name}
                              </h3>
                              <p
                                className={`text-xs font-bold tracking-widest uppercase mt-1 ${isManager ? "text-[#E52B50]" : theme === "dark" ? "text-[#0ea5e9]" : "text-blue-600"}`}
                              >
                                {agent.role}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`absolute inset-0 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col items-center justify-center p-5 text-center hologram-bg backdrop-blur-md ${theme === "dark" ? "bg-[#020617]/90" : "bg-white/90"}`}
                        >
                          <div className={`scan-bar ${isManager ? "manager-scan-bar" : ""}`}></div>

                          <div className="relative z-10 transform scale-95 group-hover:scale-100 transition-transform duration-500 delay-75">
                            <h3
                              className={`text-xl font-bold mb-1 ${isManager ? "text-[#E52B50]" : theme === "dark" ? "text-[#0ea5e9]" : "text-blue-600"}`}
                            >
                              {agent.name}
                            </h3>
                            <p
                              className={`text-[10px] uppercase tracking-widest mb-3 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                            >
                              {agent.role}
                            </p>

                            <div
                              className={`h-px w-10 mx-auto mb-3 ${isManager ? "bg-[#E52B50]" : theme === "dark" ? "bg-[#0ea5e9]" : "bg-blue-600"}`}
                            ></div>

                            <p
                              className={`text-xs font-medium leading-relaxed px-2 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                            >
                              Clicca per accedere alla dashboard di {agent.name}
                            </p>

                            <div
                              className={`mt-4 px-4 py-1.5 rounded border font-bold uppercase text-[10px] tracking-widest inline-block
                            ${isManager ? "border-[#E52B50] text-[#E52B50]" : theme === "dark" ? "border-[#0ea5e9] text-[#0ea5e9]" : "border-blue-600 text-blue-600"}`}
                            >
                              Accedi
                            </div>
                          </div>

                          <div
                            className={`absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 ${isManager ? "border-[#E52B50]" : theme === "dark" ? "border-[#0ea5e9]" : "border-blue-600"}`}
                          ></div>
                          <div
                            className={`absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 ${isManager ? "border-[#E52B50]" : theme === "dark" ? "border-[#0ea5e9]" : "border-blue-600"}`}
                          ></div>
                          <div
                            className={`absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 ${isManager ? "border-[#E52B50]" : theme === "dark" ? "border-[#0ea5e9]" : "border-blue-600"}`}
                          ></div>
                          <div
                            className={`absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 ${isManager ? "border-[#E52B50]" : theme === "dark" ? "border-[#0ea5e9]" : "border-blue-600"}`}
                          ></div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </main>
            </div>
          )}
        </section>
      </div>

      <Dialog open={!!selectedGroup} onOpenChange={handleCloseModal}>
        <DialogContent
          className={`max-w-6xl max-h-[90vh] overflow-y-auto border-[#0ea5e9]/30 ${theme === "dark" ? "bg-[#020617]" : "bg-white"}`}
        >
          <DialogHeader>
            <DialogTitle className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
              {selectedGroup?.name || "Gruppo di Agenti"}
            </DialogTitle>
            {selectedGroup?.description && (
              <p className={`text-sm mt-2 ${theme === "dark" ? "text-white/70" : "text-gray-600"}`}>
                {selectedGroup.description}
              </p>
            )}
          </DialogHeader>

          {isModalLoading ? (
            <div className="flex items-center justify-center py-12">
              <div
                className={`h-8 w-8 animate-spin rounded-full border-4 border-t-transparent ${theme === "dark" ? "border-[#0ea5e9]" : "border-blue-600"}`}
              />
            </div>
          ) : (
            <div className="mt-6">
              {groupAgents.length === 0 ? (
                <p className={`text-center py-8 ${theme === "dark" ? "text-white/60" : "text-gray-600"}`}>
                  Nessun agente trovato in questo gruppo.
                </p>
              ) : (
                <div className="agents-scroll overflow-x-auto pb-4">
                  <div className="grid grid-cols-5 gap-4 min-w-[900px]">
                    {groupAgents.map((agent) => {
                      const isManager = agent.name === "Mike AI" || agent.name === "Test Mike AI"

                      return (
                        <Link key={agent.key} href={agent.href} className="group">
                          <div
                            className={`relative w-full aspect-[3/4] glass-card rounded-2xl overflow-hidden hover:-translate-y-2 transition-all duration-500 cursor-pointer ${isManager ? "manager-card" : ""}`}
                          >
                            <div
                              className={`absolute inset-0 bg-gradient-to-t ${theme === "dark" ? "from-[#020617]" : "from-white"} via-transparent to-transparent opacity-90 z-10 pointer-events-none`}
                            ></div>

                            <div className="absolute inset-0 w-full h-full">
                              <Image
                                src={agent.image || "/placeholder.svg"}
                                alt={agent.name}
                                fill
                                className="object-cover object-top transition duration-700 group-hover:scale-105 character-image"
                              />
                            </div>

                            <div className="absolute top-3 right-3 z-30">
                              <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-full border border-green-500/30">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 status-dot-active"></div>
                                <span className="text-[9px] font-bold text-green-400 uppercase tracking-wider">
                                  Active
                                </span>
                              </div>
                            </div>

                            <div className="absolute bottom-0 left-0 w-full p-3 z-20 flex flex-col justify-end h-full group-hover:opacity-0 transition-opacity duration-300">
                              <div className="transform translate-y-2">
                                <div
                                  className={`border-l-4 pl-2 mb-1 ${isManager ? "border-[#E52B50]" : theme === "dark" ? "border-[#0ea5e9]" : "border-blue-600"}`}
                                >
                                  <h3
                                    className={`text-lg font-bold leading-none drop-shadow-md ${isManager ? "text-[#E52B50]" : theme === "dark" ? "text-white" : "text-gray-900"}`}
                                  >
                                    {agent.name}
                                  </h3>
                                  <p
                                    className={`text-[10px] font-bold tracking-widest uppercase mt-0.5 ${isManager ? "text-[#E52B50]" : theme === "dark" ? "text-[#0ea5e9]" : "text-blue-600"}`}
                                  >
                                    {agent.role}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div
                              className={`absolute inset-0 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col items-center justify-center p-4 text-center hologram-bg backdrop-blur-md ${theme === "dark" ? "bg-[#020617]/90" : "bg-white/90"}`}
                            >
                              <div className={`scan-bar ${isManager ? "manager-scan-bar" : ""}`}></div>

                              <div className="relative z-10 transform scale-95 group-hover:scale-100 transition-transform duration-500 delay-75">
                                <h3
                                  className={`text-lg font-bold mb-1 ${isManager ? "text-[#E52B50]" : theme === "dark" ? "text-[#0ea5e9]" : "text-blue-600"}`}
                                >
                                  {agent.name}
                                </h3>
                                <p
                                  className={`text-[9px] uppercase tracking-widest mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                                >
                                  {agent.role}
                                </p>

                                <div
                                  className={`h-px w-8 mx-auto mb-2 ${isManager ? "bg-[#E52B50]" : theme === "dark" ? "bg-[#0ea5e9]" : "bg-blue-600"}`}
                                ></div>

                                <p
                                  className={`text-[10px] font-medium leading-relaxed px-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                                >
                                  Clicca per accedere
                                </p>

                                <div
                                  className={`mt-3 px-3 py-1 rounded border font-bold uppercase text-[9px] tracking-widest inline-block
                            ${isManager ? "border-[#E52B50] text-[#E52B50]" : theme === "dark" ? "border-[#0ea5e9] text-[#0ea5e9]" : "border-blue-600 text-blue-600"}`}
                                >
                                  Accedi
                                </div>
                              </div>

                              <div
                                className={`absolute top-2 left-2 w-2 h-2 border-t-2 border-l-2 ${isManager ? "border-[#E52B50]" : theme === "dark" ? "border-[#0ea5e9]" : "border-blue-600"}`}
                              ></div>
                              <div
                                className={`absolute top-2 right-2 w-2 h-2 border-t-2 border-r-2 ${isManager ? "border-[#E52B50]" : theme === "dark" ? "border-[#0ea5e9]" : "border-blue-600"}`}
                              ></div>
                              <div
                                className={`absolute bottom-2 left-2 w-2 h-2 border-b-2 border-l-2 ${isManager ? "border-[#E52B50]" : theme === "dark" ? "border-[#0ea5e9]" : "border-blue-600"}`}
                              ></div>
                              <div
                                className={`absolute bottom-2 right-2 w-2 h-2 border-b-2 border-r-2 ${isManager ? "border-[#E52B50]" : theme === "dark" ? "border-[#0ea5e9]" : "border-blue-600"}`}
                              ></div>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
