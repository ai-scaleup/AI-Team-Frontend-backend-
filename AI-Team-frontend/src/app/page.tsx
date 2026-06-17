"use client"

import { useState, useEffect } from "react"

import { SignedIn, SignedOut, SignInButton, SignUpButton, useUser } from "@clerk/nextjs"
import Image from "next/image"
import { useRouter } from "next/navigation"

type MockAgent = {
  name: string
  role: string
  image: string
}

const mockAgents: MockAgent[] = [
  {
    name: "Alex AI",
    role: "Cross-Platform Ads Manager",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2026/01/Alex-AI.png",
  },
  {
    name: "Tony AI",
    role: "Direttore Commerciale",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2026/01/Tony-AI.png",
  },
  {
    name: "Mike AI",
    role: "Direttore Marketing",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2026/01/Mike-AI.png",
  },
  {
    name: "Lara AI",
    role: "Social Media Manager",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2026/01/Lara-AI-1.png",
  },
  {
    name: "Simone AI",
    role: "SEO Copywriter",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2026/01/SImone-ai.png",
  },
  {
    name: "Aladino AI",
    role: "Creatore di nuove offerte e prodotti",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2026/01/Aladdin-AI.png",
  },
  {
    name: "Valentina AI",
    role: "SEO Optimizer",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2026/01/Valentina-AI.png",
  },
  {
    name: "Niko AI",
    role: "SEO Manager",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2026/01/Niko-AI.png",
  },
  {
    name: "Jim AI",
    role: "Coach di Vendite",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2026/01/JIM-ai.png",
  },
  {
    name: "Daniele AI",
    role: "Copywriter per Vendere (Direct Response)",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2026/01/Daniele-ai.png",
  },
]



// Icons
const BotIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className || "text-[#0ea5e9]"}
  >
    <rect width="18" height="10" x="3" y="11" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" x2="8" y1="16" y2="16" />
    <line x1="16" x2="16" y1="16" y2="16" />
  </svg>
)

const ArrowRight = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)

const SunIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

// SVG Logo
const AiTeamLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 50" className="h-10 w-auto filter brightness-125">
    <defs>
      <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style={{ stopColor: "#0ea5e9", stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: "#8b5cf6", stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <path
      d="M25 10 C 15 10, 10 20, 10 25 C 10 35, 20 40, 25 40 M 45 10 C 55 10, 60 20, 60 25 C 60 35, 50 40, 45 40 M 25 10 L 45 10 M 25 40 L 45 40 M 35 5 L 35 45 M 10 25 L 5 25 M 60 25 L 65 25 M 18 15 L 12 8 M 52 15 L 58 8"
      stroke="url(#logo-grad)"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="35" cy="25" r="5" fill="url(#logo-grad)" />
    <text
      x="75"
      y="35"
      fontFamily="Rajdhani, sans-serif"
      fontSize="32"
      fontWeight="900"
      className="fill-gray-800 dark:fill-white"
      letterSpacing="1"
    >
      AI TEAM
    </text>
  </svg>
)

// Components
const Navbar = ({ isDark, toggleTheme }: { isDark: boolean; toggleTheme: () => void }) => (
  <nav className="fixed w-full z-50 glass-panel border-b border-gray-200 dark:border-white/5 h-20 flex items-center shadow-lg transition-colors duration-300">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full font-bold">
      <div className="flex items-center justify-between">
        <div className="flex-shrink-0 cursor-pointer hover:opacity-80 transition">
          <AiTeamLogo />
        </div>
        <div className="hidden md:block">
          <div className="ml-10 flex items-center space-x-8">
            <a
              href="#home"
              className="text-gray-600 dark:text-gray-300 hover:text-[#0284c7] dark:hover:text-[#0ea5e9] transition px-3 py-2 rounded-md text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
            >
              Home
            </a>
            <SignedOut>
              <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="bg-[#0284c7] hover:bg-[#0ea5e9] text-white px-6 py-2.5 rounded-full font-bold transition text-sm shadow-lg shadow-[#0284c7]/20 hover:shadow-[#0284c7]/40 border border-white/10">
                  Registrati
                </button>
              </SignUpButton>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="text-gray-600 dark:text-gray-300 hover:text-[#0284c7] dark:hover:text-[#0ea5e9] transition px-6 py-2.5 rounded-full font-bold text-sm border border-gray-300 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5">
                  Accedi
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <button
                onClick={() => (window.location.href = "/dashboard")}
                className="bg-[#0284c7] hover:bg-[#0ea5e9] text-white px-6 py-2.5 rounded-full font-bold transition text-sm shadow-lg shadow-[#0284c7]/20 hover:shadow-[#0284c7]/40 border border-white/10"
              >
                Dashboard
              </button>
            </SignedIn>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white hover:bg-gray-200 dark:hover:bg-white/20 transition-colors duration-300 focus:outline-none"
              aria-label="Toggle Dark Mode"
            >
              {isDark ? <SunIcon size={20} /> : <MoonIcon size={20} />}
            </button>
          </div>
        </div>
        <div className="-mr-2 flex md:hidden items-center space-x-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white focus:outline-none"
          >
            {isDark ? <SunIcon size={20} /> : <MoonIcon size={20} />}
          </button>
          <BotIcon className="text-[#0284c7] dark:text-[#0ea5e9]" />
        </div>
      </div>
    </div>
  </nav>
)

const Hero = () => (
  <section
    id="home"
    className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-12 overflow-hidden transition-colors duration-300"
  >
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center w-full">
      <div className="max-w-5xl mx-auto mb-6 relative flex flex-col items-center z-20">
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl tracking-tight font-black text-gray-900 dark:text-white leading-none whitespace-nowrap transition-colors duration-300 font-tech">
          La tua Azienda di{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0284c7] via-blue-600 to-purple-600 dark:from-[#0ea5e9] dark:via-white dark:to-[#8b5cf6] btn-liquid">
            Ai Agents
          </span>
        </h1>
        <p className="mt-6 max-w-3xl mx-auto text-xl md:text-2xl font-medium text-gray-600 dark:text-gray-300 leading-relaxed transition-colors duration-300">
          Un team di AI Agents pronto a portare la tua azienda a livelli di qualità, velocità, semplicità mai visti
          prima!
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-5 justify-center w-full">
          <SignedOut>
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#0284c7] to-[#8b5cf6] dark:from-[#0ea5e9] dark:to-[#8b5cf6] rounded-full blur opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
              <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="relative btn-liquid bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] hover:to-[#0284c7] text-white font-bold py-4 px-10 rounded-full flex items-center justify-center text-lg transition-all transform group-hover:-translate-y-1 shadow-[0_0_20px_rgba(14,165,233,0.5)]">
                  Inizia Gratis
                  <span className="ml-2 bg-white/20 rounded-full p-1 group-hover:translate-x-1 transition">
                    <ArrowRight size={18} />
                  </span>
                </button>
              </SignUpButton>
            </div>
          </SignedOut>
          <SignedIn>
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#0284c7] to-[#8b5cf6] dark:from-[#0ea5e9] dark:to-[#8b5cf6] rounded-full blur opacity-40 group-hover:opacity-75 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
              <button
                onClick={() => (window.location.href = "/dashboard")}
                className="relative btn-liquid bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] hover:to-[#0284c7] text-white font-bold py-4 px-10 rounded-full flex items-center justify-center text-lg transition-all transform group-hover:-translate-y-1 shadow-[0_0_20px_rgba(14,165,233,0.5)]"
              >
                Vai alla Dashboard
                <span className="ml-2 bg-white/20 rounded-full p-1 group-hover:translate-x-1 transition">
                  <ArrowRight size={18} />
                </span>
              </button>
            </div>
          </SignedIn>
        </div>
      </div>

      <div className="w-full max-w-5xl relative -mt-2 group perspective-1000">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-gradient-to-r from-[#0ea5e9]/20 via-[#0284c7]/10 to-purple-600/20 blur-[80px] -z-10 rounded-full opacity-60 group-hover:opacity-80 transition duration-700"></div>
        <div className="relative floating-tech transform-style-3d">
          <div className="relative rounded-2xl p-2 bg-gradient-to-b from-white/40 to-white/10 dark:from-white/10 dark:to-transparent border border-white/40 dark:border-white/10 shadow-2xl backdrop-blur-sm transition duration-500 group-hover:border-[#0284c7]/30 dark:group-hover:border-[#0ea5e9]/30">
            <Image
              src="/assets/Ai-Team-Header-DAshboard.png"
              alt="AI Team Dashboard Full Width"
              width={1536}
              height={486}
              priority
              className="w-full rounded-xl object-cover shadow-[0_0_50px_-12px_rgba(0,0,0,0.2)] dark:shadow-[0_0_50px_-12px_rgba(0,0,0,0.6)]"
            />
            <div className="absolute -bottom-4 -left-4 glass-panel px-5 py-3 rounded-xl border border-[#0284c7]/20 dark:border-[#0ea5e9]/30 shadow-lg flex items-center gap-3 animate-[float-img_4s_ease-in-out_infinite_reverse] hidden md:flex">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Efficienza</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white font-tech">+340%</p>
              </div>
            </div>
            <div className="absolute -top-4 -right-4 glass-panel p-3 rounded-xl border border-purple-500/30 shadow-lg animate-[float-img_5s_ease-in-out_infinite_1s] hidden md:block">
              <BotIcon size={32} className="text-[#8b5cf6]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
)

const MockAgentsShowcase = () => (
  <section
    id="agents"
    className="relative py-8 sm:py-12 bg-[#020617] overflow-hidden border-t border-white/5"
    style={{ fontFamily: "'Rajdhani', sans-serif" }}
  >
    <div className="absolute inset-0 bg-tech-grid pointer-events-none"></div>
    <div className="relative z-10 mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8">
      <header className="relative mb-4">
        <div className="mb-3 space-y-0.5">
          <p className="pl-1 text-xs font-bold uppercase tracking-[0.15em] text-[#0ea5e9]">
            Command Center
          </p>
          <h2 className="text-4xl font-bold leading-none tracking-tight text-white md:text-5xl">
            IL TUO AI TEAM:
            <br />
            <span className="text-[#0ea5e9]">sfrutta i Super Poteri dei tuoi Ai Agents</span>
            <br />
            <span className="text-white">per Distruggere i Competitor</span>
          </h2>
        </div>

        <div className="flex gap-4 sm:justify-end lg:-mt-14">
          <div className="min-w-[130px] rounded-xl border border-white/5 bg-[#111827]/80 px-5 py-2 backdrop-blur-md">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Agenti Attivi
            </p>
            <p className="text-xl font-bold text-white">10/10</p>
          </div>
          <div className="min-w-[130px] rounded-xl border border-white/5 bg-[#111827]/80 px-5 py-2 backdrop-blur-md">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Task Completati
            </p>
            <p className="text-xl font-bold text-[#0ea5e9]">1,240</p>
          </div>
        </div>
      </header>

      <div className="agents-scroll overflow-x-auto pb-4">
        <div className="grid min-w-[1200px] grid-cols-5 gap-4 lg:gap-5 xl:gap-6">
          {mockAgents.map((agent) => {
            const isManager = agent.name === "Mike AI"

            return (
              <div key={agent.name} className="group">
                <div
                  className={`relative aspect-[3/4] w-full overflow-hidden rounded-2xl border bg-[#111827]/70 backdrop-blur-[10px] transition-all duration-500 hover:-translate-y-2 ${
                    isManager
                      ? "manager-card border-[#E52B50]/80"
                      : "border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.3)] hover:border-[#0ea5e9]/50 hover:shadow-[0_0_25px_rgba(14,165,233,0.3),inset_0_0_0_1px_rgba(14,165,233,0.4)]"
                  }`}
                >
                  <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-90"></div>

                  <div className="absolute inset-0 h-full w-full">
                    <Image
                      src={agent.image || "/placeholder.svg"}
                      alt={agent.name}
                      fill
                      sizes="(min-width: 1200px) 20vw, 240px"
                      className="character-image object-cover object-top transition duration-700 group-hover:scale-105"
                    />
                  </div>

                  <div className="absolute right-4 top-4 z-30">
                    <div className="flex items-center gap-2 rounded-full border border-green-500/30 bg-black/40 px-2 py-1 backdrop-blur-sm">
                      <div className="status-dot-active h-2 w-2 rounded-full bg-green-500"></div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">
                        Active
                      </span>
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 z-20 flex h-full w-full flex-col justify-end p-4 transition-opacity duration-300 group-hover:opacity-0">
                    <div className="translate-y-2">
                      <div className={`mb-1 border-l-4 pl-3 ${isManager ? "border-[#E52B50]" : "border-[#0ea5e9]"}`}>
                        <h3
                          className={`text-2xl font-bold leading-none drop-shadow-md ${
                            isManager ? "text-[#E52B50]" : "text-white"
                          }`}
                        >
                          {agent.name}
                        </h3>
                        <p
                          className={`mt-1 text-xs font-bold uppercase tracking-widest ${
                            isManager ? "text-[#E52B50]" : "text-[#0ea5e9]"
                          }`}
                        >
                          {agent.role}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="hologram-bg absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#020617]/90 p-5 text-center opacity-0 backdrop-blur-md transition-opacity duration-500 group-hover:opacity-100">
                    <div className={`scan-bar ${isManager ? "manager-scan-bar" : ""}`}></div>
                    <div className="relative z-10 scale-95 transition-transform delay-75 duration-500 group-hover:scale-100">
                      <h3 className={`mb-1 text-xl font-bold ${isManager ? "text-[#E52B50]" : "text-[#0ea5e9]"}`}>
                        {agent.name}
                      </h3>
                      <p className="mb-3 text-[10px] uppercase tracking-widest text-gray-400">{agent.role}</p>
                      <div className={`mx-auto mb-3 h-px w-10 ${isManager ? "bg-[#E52B50]" : "bg-[#0ea5e9]"}`}></div>
                      <p className="px-2 text-xs font-medium leading-relaxed text-white">
                        Clicca per accedere alla dashboard di {agent.name}
                      </p>
                      <div
                        className={`mt-4 inline-block rounded border px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                          isManager ? "border-[#E52B50] text-[#E52B50]" : "border-[#0ea5e9] text-[#0ea5e9]"
                        }`}
                      >
                        Accedi
                      </div>
                    </div>

                    <div className={`absolute left-3 top-3 h-3 w-3 border-l-2 border-t-2 ${isManager ? "border-[#E52B50]" : "border-[#0ea5e9]"}`}></div>
                    <div className={`absolute right-3 top-3 h-3 w-3 border-r-2 border-t-2 ${isManager ? "border-[#E52B50]" : "border-[#0ea5e9]"}`}></div>
                    <div className={`absolute bottom-3 left-3 h-3 w-3 border-b-2 border-l-2 ${isManager ? "border-[#E52B50]" : "border-[#0ea5e9]"}`}></div>
                    <div className={`absolute bottom-3 right-3 h-3 w-3 border-b-2 border-r-2 ${isManager ? "border-[#E52B50]" : "border-[#0ea5e9]"}`}></div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  </section>
)


const AssessmentCTA = () => (
  <section
    id="assessment-full"
    className="relative min-h-screen flex items-center py-24 overflow-hidden bg-white dark:bg-[#0B1120] border-t border-gray-200 dark:border-white/5 transition-colors duration-300"
  >
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-[#0284c7]/5 via-transparent to-transparent dark:from-purple-900/40 dark:via-[#0B1120] dark:to-[#0B1120] opacity-80"></div>
    <div className="absolute inset-0 bg-tech-pattern opacity-5 dark:opacity-10 mix-blend-normal dark:mix-blend-overlay invert dark:invert-0 transition-all duration-300"></div>
    <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-[#0ea5e9]/5 dark:from-[#0ea5e9]/10 to-transparent"></div>

    <div className="max-w-5xl mx-auto px-4 relative z-10 text-center font-bold">
      <h2 className="text-5xl md:text-7xl font-black text-gray-900 dark:text-white mb-8 leading-tight transition-colors duration-300 font-tech">
        Sei pronto a{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0284c7] to-purple-600 dark:from-[#0ea5e9] dark:to-purple-400 btn-liquid">
          scalare?
        </span>
      </h2>
      <p className="text-3xl font-medium text-gray-600 dark:text-gray-300 mb-16 max-w-3xl mx-auto leading-relaxed transition-colors duration-300">
        Non indovinare il tuo futuro. Misuralo. Fai il nostro test di valutazione gratuito e scopri esattamente come
        implementare un Team AI nella tua azienda oggi stesso.
      </p>

      <div className="glass-panel p-12 rounded-[3rem] border-2 border-[#0284c7]/10 dark:border-[#0ea5e9]/20 inline-block w-full relative overflow-hidden shadow-2xl group hover:border-[#0284c7]/30 dark:hover:border-[#0ea5e9]/50 transition duration-500 hover:shadow-[0_0_50px_rgba(14,165,233,0.2)]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0284c7]/5 via-transparent to-[#8b5cf6]/5 dark:from-[#0284c7]/10 dark:to-[#8b5cf6]/10 opacity-0 group-hover:opacity-100 transition duration-500"></div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-10 relative z-10">
          <div className="text-left">
            <h3 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-wide transition-colors duration-300">
              AI Agents TEST
            </h3>
            <div className="flex items-center mt-4 text-[#0284c7] dark:text-[#0ea5e9] transition-colors duration-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <p className="text-lg font-semibold">Tempo stimato: 3 minuti</p>
            </div>
          </div>
          <button className="glow-effect w-full md:w-auto bg-[#0B1120] dark:bg-white text-white dark:text-[#0B1120] font-black py-6 px-12 rounded-full text-xl hover:bg-[#0284c7] dark:hover:bg-[#0ea5e9] hover:text-white transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl flex items-center justify-center">
            INIZIA IL TEST ORA <ArrowRight className="ml-3" size={24} />
          </button>
        </div>
      </div>
    </div>
  </section>
)

const Footer = () => (
  <footer className="bg-gray-100/80 dark:bg-black/40 backdrop-blur-md border-t border-gray-200 dark:border-white/5 py-12 relative z-20 transition-colors duration-300">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
      <div className="text-center md:text-left">
        <AiTeamLogo />
        <p className="text-gray-500 text-sm mt-4 font-medium">© 2025 AI ScaleUp. Tutti i diritti riservati.</p>
        <div className="text-gray-400 text-xs mt-4 space-y-1 font-medium leading-relaxed">
          <p>HR SOLUTIONS SRL a socio unico</p>
          <p>Partita Iva/CF: 02847580137 | iscritta in data 02/11/2004</p>
          <p>Registro Imprese di Milano | REA: MI - 1828395</p>
          <p>Viale Francesco Restelli 3/7, 20124 MILANO (ITALIA)</p>
          <p>info@digital-coach.com</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-8 font-semibold w-full md:w-auto">
        <a
          href="#"
          className="text-gray-500 dark:text-gray-400 hover:text-[#0284c7] dark:hover:text-[#0ea5e9] transition py-2"
        >
          Privacy Policy
        </a>
        <a
          href="#"
          className="text-gray-500 dark:text-gray-400 hover:text-[#0284c7] dark:hover:text-[#0ea5e9] transition py-2"
        >
          Termini di Servizio
        </a>
        <a
          href="#"
          className="text-gray-500 dark:text-gray-400 hover:text-[#0284c7] dark:hover:text-[#0ea5e9] transition py-2"
        >
          Contatti
        </a>
      </div>
    </div>
  </footer>
)

export default function Home() {
  const [isDark, setIsDark] = useState(true)
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const toggleTheme = () => {
    setIsDark(!isDark)
  }

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDark])

  useEffect(() => {
    if (isLoaded && user) {
      router.push("/dashboard")
    }
  }, [isLoaded, user, router])

  return (
    <div className={`font-sans`}>
      <style jsx global>{`
        /* GLOBAL TECH FONT APPLIED TO EVERYTHING */
        body { font-family: sans-serif; }
        h1, h2, h3, h4, h5, h6, p, a, button, span, input { font-family: sans-serif; }
        
        /* Animation for Liquid Gradients on Buttons */
        @keyframes liquid {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .btn-liquid {
          background-size: 200% 200%;
          animation: liquid 3s ease infinite;
        }

        /* Floating Animation for the Image */
        @keyframes float-img {
          0% { transform: translateY(0px) rotate3d(1, 0, 0, 5deg); }
          50% { transform: translateY(-10px) rotate3d(1, 0, 0, 0deg); }
          100% { transform: translateY(0px) rotate3d(1, 0, 0, 5deg); }
        }
        .floating-tech {
          animation: float-img 6s ease-in-out infinite;
          transform-style: preserve-3d;
          perspective: 1000px;
        }

        /* Pulse Effect */
        @keyframes glow-pulse {
          0% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(14, 165, 233, 0); }
          100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0); }
        }
        .glow-effect {
          animation: glow-pulse 2s infinite;
        }

        /* Wave Animation for Voice Bars */
        @keyframes wave {
          0%, 100% { height: 20%; opacity: 0.5; }
          50% { height: 100%; opacity: 1; }
        }
        .wave-bar {
          animation: wave 1.2s ease-in-out infinite;
          transform-origin: bottom;
        }

        /* Glassmorphism Utilities */
        .glass-panel {
          transition: background 0.3s, border-color 0.3s;
        }

        /* Dark Mode Glass */
        .dark .glass-panel {
          background: rgba(11, 17, 32, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        /* Light Mode Glass */
        .glass-panel {
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .glass-button {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .dark .glass-button {
          border-color: rgba(255,255,255,0.1);
        }
        html:not(.dark) .glass-button {
          background: rgba(0, 0, 0, 0.05);
          border: 1px solid rgba(0, 0, 0, 0.05);
        }

        /* Custom Scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #0f172a; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        html:not(.dark) ::-webkit-scrollbar-track { background: #f1f5f9; }
        html:not(.dark) ::-webkit-scrollbar-thumb { background: #cbd5e1; }
        
        /* Transitions */
        body, div, section, nav, p, h1, h2, h3 {
          transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
        }

        .bg-tech-pattern {
          background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgdmlld0JveD0iMCAwIDYwIDYwIiBvcGFjaXR5PSIwLjA1Ij48cGF0aCBkPSJNMzAgMEw2MCAzMEwzMCA2MEwwIDMweiIgZmlsbD0iI2ZmZmZmZiIvPjwvc3ZnPg==');
        }

        .font-tech {
          font-family: var(--font-rajdhani), sans-serif;
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .perspective-1000 {
          perspective: 1000px;
        }

        .transform-style-3d {
          transform-style: preserve-3d;
        }

        .bg-tech-grid {
          background-image:
            linear-gradient(rgba(14, 165, 233, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14, 165, 233, 0.05) 1px, transparent 1px);
          background-size: 40px 40px;
        }

        .manager-card {
          box-shadow: 0 0 30px rgba(229, 43, 80, 0.25);
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
          background: linear-gradient(to bottom, transparent, rgba(14, 165, 233, 0.2), transparent);
          animation: scanline 2s linear infinite;
          pointer-events: none;
        }

        .manager-scan-bar {
          background: linear-gradient(to bottom, transparent, rgba(229, 43, 80, 0.3), transparent);
        }

        .agents-scroll::-webkit-scrollbar {
          height: 8px;
        }

        .agents-scroll::-webkit-scrollbar-track {
          background: rgba(17, 24, 39, 0.5);
          border-radius: 4px;
        }

        .agents-scroll::-webkit-scrollbar-thumb {
          background: rgba(14, 165, 233, 0.5);
          border-radius: 4px;
        }

        .agents-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(14, 165, 233, 0.7);
        }
      `}</style>

      <div className="flex flex-col font-sans bg-white dark:bg-[#0B1120]/90 relative transition-colors duration-300">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div
            className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-tech-pattern opacity-[0.03] dark:opacity-10 transition-all duration-300 ${!isDark ? "invert" : ""}`}
          ></div>
          <div className="absolute top-[-20%] right-[-10%] w-[900px] h-[900px] bg-[#0284c7]/5 dark:bg-[#0284c7]/10 rounded-full blur-[150px] mix-blend-multiply dark:mix-blend-screen animate-pulse"></div>
          <div
            className="absolute bottom-[-20%] left-[-10%] w-[700px] h-[700px] bg-[#8b5cf6]/5 dark:bg-[#8b5cf6]/10 rounded-full blur-[150px] mix-blend-multiply dark:mix-blend-screen animate-pulse"
            style={{ animationDelay: "2s" }}
          ></div>
        </div>

        <Navbar isDark={isDark} toggleTheme={toggleTheme} />
        <main className="flex-grow">
          <Hero />
          <MockAgentsShowcase />
          <AssessmentCTA />
        </main>
        <Footer />
      </div>

    </div>
  )
}
