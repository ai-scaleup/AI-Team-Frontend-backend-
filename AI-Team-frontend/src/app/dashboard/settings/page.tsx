"use client"

import { useState, useEffect } from "react"
import { useUser, UserButton } from "@clerk/nextjs"
import Link from "next/link"
import {
    ArrowLeft,
    Save,
    Loader2,
    Check,
    User,
    Languages,
    Palette,
    MessageSquare,
    BrainCircuit,
    Sparkles,
    Moon,
    Sun,
    ChevronDown,
    AlertCircle,
} from "lucide-react"
import {
    AgentName,
    UserPreference,
    UpdateUserPreferenceDto,
    PREFERENCE_LABELS,
    AGENT_DISPLAY_NAMES,
    PRODUCTION_AGENTS,
    DEFAULT_PREFERENCE_VALUES,
} from "@/types/preferences"
import { userPreferenceService } from "@/services/preferenceService"
import { getDevUserEmail } from "@/lib/devToken"

export default function SettingsPage() {
    const { user, isLoaded } = useUser()
    const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || getDevUserEmail()
    const [isDark, setIsDark] = useState(true)
    const [selectedAgent, setSelectedAgent] = useState<AgentName>("JIM")
    const [preferences, setPreferences] = useState<UserPreference | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(["identity", "language", "brandStyle", "interaction", "aiBehavior", "personalization"])
    )

    // Theme handling
    useEffect(() => {
        const savedTheme = localStorage.getItem("theme")
        if (savedTheme) setIsDark(savedTheme === "dark")
        else setIsDark(true)
    }, [])

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add("dark")
            localStorage.setItem("theme", "dark")
        } else {
            document.documentElement.classList.remove("dark")
            localStorage.setItem("theme", "light")
        }
    }, [isDark])

    // Load preferences when user or agent changes
    useEffect(() => {
        if (!userEmail) return

        const loadPreferences = async () => {
            setIsLoading(true)
            setSaveError(null)

            const prefs = await userPreferenceService.getOrCreate(userEmail, "JIM")

            if (prefs) {
                setPreferences(prefs)
            } else {
                setSaveError("Impossibile caricare le preferenze. Riprova più tardi.")
            }

            setIsLoading(false)
        }

        loadPreferences()
    }, [userEmail, selectedAgent])

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev)
            if (next.has(section)) next.delete(section)
            else next.add(section)
            return next
        })
    }

    const handleChange = <K extends keyof UpdateUserPreferenceDto>(
        field: K,
        value: UpdateUserPreferenceDto[K]
    ) => {
        if (!preferences) return
        setPreferences({ ...preferences, [field]: value })
        setSaveSuccess(false)
        setSaveError(null)
    }

    const handleSave = async () => {
        if (!userEmail || !preferences) return

        setIsSaving(true)
        setSaveError(null)
        setSaveSuccess(false)

        console.log('💾 [Settings] Saving preferences...', preferences);

        const dataToSave: UpdateUserPreferenceDto = {
            // Use null coalescing to ensure we send null if empty, rather than undefined (which drops the key)
            displayName: preferences.displayName ?? null,
            businessName: preferences.businessName ?? null,
            contentLanguage: preferences.contentLanguage,
            responseLanguage: preferences.responseLanguage,
            toneOfVoice: preferences.toneOfVoice,
            marketingKnowledge: preferences.marketingKnowledge,
            responseLength: preferences.responseLength,
            emojiUsage: preferences.emojiUsage,
            proactivityLevel: preferences.proactivityLevel,
            questionStyle: preferences.questionStyle,
            decisionHelpStyle: preferences.decisionHelpStyle,
            learningPreference: preferences.learningPreference,
            marketComparison: preferences.marketComparison,
        }

        console.log('💾 [Settings] Data payload:', JSON.stringify(dataToSave, null, 2));

        const { data, error } = await userPreferenceService.upsertWithResult(
            userEmail,
            "JIM",
            dataToSave,
        )

        if (data) {
            setPreferences(data)
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 3000)
        } else {
            setSaveError(error ?? "Errore durante il salvataggio. Riprova.")
        }

        setIsSaving(false)
    }

    if (!isLoaded) {
        return (
            <div className={`flex min-h-screen items-center justify-center ${isDark ? "bg-[#020617]" : "bg-gray-50"}`}>
                <Loader2 className={`h-8 w-8 animate-spin ${isDark ? "text-sky-500" : "text-blue-600"}`} />
            </div>
        )
    }

    if (!user) {
        return (
            <div className={`flex min-h-screen items-center justify-center ${isDark ? "bg-[#020617]" : "bg-gray-50"}`}>
                <p className={isDark ? "text-white/60" : "text-gray-600"}>
                    Devi effettuare il login per accedere alle impostazioni.
                </p>
            </div>
        )
    }

    return (
        <div className={`min-h-screen ${isDark ? "bg-[#020617]" : "bg-gray-50"}`}>
            <style jsx global>{`
        .settings-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23${isDark ? '94a3b8' : '64748b'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 40px;
        }
      `}</style>

            {/* Header */}
            <header className={`sticky top-0 z-50 border-b backdrop-blur-xl ${isDark ? "bg-[#0B1221]/90 border-white/5" : "bg-white/90 border-gray-200"}`}>
                <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/5 text-white/60 hover:text-white" : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"}`}
                        >
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <h1 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                                Impostazioni Preferenze
                            </h1>
                            <p className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
                                Personalizza il comportamento dei tuoi AI Agents
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsDark(!isDark)}
                            className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/5 text-white/60 hover:text-white" : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"}`}
                        >
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <UserButton
                            appearance={{
                                elements: {
                                    avatarBox: `h-8 w-8 ring-2 ${isDark ? "ring-white/10" : "ring-gray-200"}`,
                                },
                            }}
                        />
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-6">
                {/* Agent Selector */}
                <div className={`mb-6 p-4 rounded-2xl border ${isDark ? "bg-[#0F172A] border-white/5" : "bg-white border-gray-200 shadow-sm"}`}>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                        Seleziona Agente
                    </label>
                    <div className="relative">
                        <select
                            value={selectedAgent}
                            onChange={(e) => setSelectedAgent(e.target.value as AgentName)}
                            className={`settings-select w-full md:w-80 p-3 rounded-xl border font-medium transition-colors cursor-pointer ${isDark
                                ? "bg-[#1E293B] border-white/10 text-white hover:border-sky-500/50 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50"
                                : "bg-gray-50 border-gray-200 text-gray-900 hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                                } outline-none`}
                        >
                            {PRODUCTION_AGENTS.map((agent) => (
                                <option key={agent} value={agent}>
                                    {AGENT_DISPLAY_NAMES[agent]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <p className={`text-xs mt-2 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                        Le preferenze sono salvate separatamente per ogni agente
                    </p>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className={`h-8 w-8 animate-spin ${isDark ? "text-sky-500" : "text-blue-600"}`} />
                    </div>
                )}

                {/* Error State */}
                {!isLoading && saveError && !preferences && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${isDark ? "bg-red-500/10 border border-red-500/20" : "bg-red-50 border border-red-200"}`}>
                        <AlertCircle className="text-red-500" size={20} />
                        <p className={isDark ? "text-red-400" : "text-red-600"}>{saveError}</p>
                    </div>
                )}

                {/* Preferences Form */}
                {!isLoading && preferences && (
                    <div className="space-y-4">
                        {/* Identity Section */}
                        <PreferenceSection
                            title="Identità"
                            icon={<User size={18} />}
                            description="Come desideri essere chiamato?"
                            isExpanded={expandedSections.has("identity")}
                            onToggle={() => toggleSection("identity")}
                            isDark={isDark}
                        >
                            <div className="grid md:grid-cols-2 gap-4">
                                <FormInput
                                    label="Il tuo nome"
                                    value={preferences.displayName || ""}
                                    onChange={(v) => handleChange("displayName", v || null)}
                                    placeholder="Es: Marco"
                                    isDark={isDark}
                                />
                                <FormInput
                                    label="Nome della tua attività"
                                    value={preferences.businessName || ""}
                                    onChange={(v) => handleChange("businessName", v || null)}
                                    placeholder="Es: Acme Srl"
                                    isDark={isDark}
                                />
                            </div>
                        </PreferenceSection>

                        {/* Language Section */}
                        <PreferenceSection
                            title="Lingua"
                            icon={<Languages size={18} />}
                            description="Scegli le lingue per contenuti e risposte"
                            isExpanded={expandedSections.has("language")}
                            onToggle={() => toggleSection("language")}
                            isDark={isDark}
                        >
                            <div className="grid md:grid-cols-2 gap-4">
                                <FormSelect
                                    label="Lingua dei contenuti generati"
                                    value={preferences.contentLanguage}
                                    onChange={(v) => handleChange("contentLanguage", v as any)}
                                    options={PREFERENCE_LABELS.contentLanguage}
                                    isDark={isDark}
                                />
                                <FormSelect
                                    label="Lingua delle risposte AI"
                                    value={preferences.responseLanguage}
                                    onChange={(v) => handleChange("responseLanguage", v as any)}
                                    options={PREFERENCE_LABELS.contentLanguage}
                                    isDark={isDark}
                                />
                            </div>
                        </PreferenceSection>

                        {/* Brand Style Section */}
                        <PreferenceSection
                            title="Stile Brand"
                            icon={<Palette size={18} />}
                            description="Definisci il tono e lo stile di comunicazione"
                            isExpanded={expandedSections.has("brandStyle")}
                            onToggle={() => toggleSection("brandStyle")}
                            isDark={isDark}
                        >
                            <div className="grid md:grid-cols-2 gap-4">
                                <FormSelect
                                    label="Tono di voce"
                                    value={preferences.toneOfVoice}
                                    onChange={(v) => handleChange("toneOfVoice", v as any)}
                                    options={PREFERENCE_LABELS.toneOfVoice}
                                    isDark={isDark}
                                />
                                <FormSelect
                                    label="Livello di conoscenza marketing"
                                    value={preferences.marketingKnowledge}
                                    onChange={(v) => handleChange("marketingKnowledge", v as any)}
                                    options={PREFERENCE_LABELS.marketingKnowledge}
                                    isDark={isDark}
                                />
                            </div>
                        </PreferenceSection>

                        {/* Interaction Section */}
                        <PreferenceSection
                            title="Interazione"
                            icon={<MessageSquare size={18} />}
                            description="Come preferisci ricevere le risposte"
                            isExpanded={expandedSections.has("interaction")}
                            onToggle={() => toggleSection("interaction")}
                            isDark={isDark}
                        >
                            <div className="grid md:grid-cols-2 gap-4">
                                <FormSelect
                                    label="Lunghezza risposte"
                                    value={preferences.responseLength}
                                    onChange={(v) => handleChange("responseLength", v as any)}
                                    options={PREFERENCE_LABELS.responseLength}
                                    isDark={isDark}
                                />
                                <FormSelect
                                    label="Utilizzo emoji"
                                    value={preferences.emojiUsage}
                                    onChange={(v) => handleChange("emojiUsage", v as any)}
                                    options={PREFERENCE_LABELS.emojiUsage}
                                    isDark={isDark}
                                />
                            </div>
                        </PreferenceSection>

                        {/* AI Behavior Section */}
                        <PreferenceSection
                            title="Comportamento AI"
                            icon={<BrainCircuit size={18} />}
                            description="Come deve comportarsi l'agente"
                            isExpanded={expandedSections.has("aiBehavior")}
                            onToggle={() => toggleSection("aiBehavior")}
                            isDark={isDark}
                        >
                            <div className="grid md:grid-cols-2 gap-4">
                                <FormSelect
                                    label="Livello di proattività"
                                    value={preferences.proactivityLevel}
                                    onChange={(v) => handleChange("proactivityLevel", v as any)}
                                    options={PREFERENCE_LABELS.proactivityLevel}
                                    isDark={isDark}
                                />
                                <FormSelect
                                    label="Stile delle domande"
                                    value={preferences.questionStyle}
                                    onChange={(v) => handleChange("questionStyle", v as any)}
                                    options={PREFERENCE_LABELS.questionStyle}
                                    isDark={isDark}
                                />
                                <FormSelect
                                    label="Aiuto nelle decisioni"
                                    value={preferences.decisionHelpStyle}
                                    onChange={(v) => handleChange("decisionHelpStyle", v as any)}
                                    options={PREFERENCE_LABELS.decisionHelpStyle}
                                    isDark={isDark}
                                />
                            </div>
                        </PreferenceSection>

                        {/* Personalization Section */}
                        <PreferenceSection
                            title="Personalizzazione"
                            icon={<Sparkles size={18} />}
                            description="Apprendimento e confronti di mercato"
                            isExpanded={expandedSections.has("personalization")}
                            onToggle={() => toggleSection("personalization")}
                            isDark={isDark}
                        >
                            <div className="grid md:grid-cols-2 gap-4">
                                <FormSelect
                                    label="Preferenza apprendimento"
                                    value={preferences.learningPreference}
                                    onChange={(v) => handleChange("learningPreference", v as any)}
                                    options={PREFERENCE_LABELS.learningPreference}
                                    isDark={isDark}
                                />
                                <FormSelect
                                    label="Confronti di mercato"
                                    value={preferences.marketComparison}
                                    onChange={(v) => handleChange("marketComparison", v as any)}
                                    options={PREFERENCE_LABELS.marketComparison}
                                    isDark={isDark}
                                />
                            </div>
                        </PreferenceSection>

                        {/* Save Button */}
                        <div className={`sticky bottom-4 p-4 rounded-2xl border backdrop-blur-xl ${isDark ? "bg-[#0F172A]/90 border-white/10" : "bg-white/90 border-gray-200 shadow-lg"}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    {saveError && (
                                        <p className="text-sm text-red-500 flex items-center gap-2">
                                            <AlertCircle size={14} /> {saveError}
                                        </p>
                                    )}
                                    {saveSuccess && (
                                        <p className={`text-sm flex items-center gap-2 ${isDark ? "text-green-400" : "text-green-600"}`}>
                                            <Check size={14} /> Preferenze salvate con successo!
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${isSaving
                                        ? isDark
                                            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                        : isDark
                                            ? "bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/25 hover:-translate-y-0.5"
                                            : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 hover:-translate-y-0.5"
                                        }`}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" /> Salvataggio...
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} /> Salva Preferenze
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

// --- Subcomponents ---

function PreferenceSection({
    title,
    icon,
    description,
    isExpanded,
    onToggle,
    isDark,
    children,
}: {
    title: string
    icon: React.ReactNode
    description: string
    isExpanded: boolean
    onToggle: () => void
    isDark: boolean
    children: React.ReactNode
}) {
    return (
        <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[#0F172A] border-white/5" : "bg-white border-gray-200 shadow-sm"}`}>
            <button
                onClick={onToggle}
                className={`w-full p-4 flex items-center justify-between transition-colors ${isDark ? "hover:bg-white/5" : "hover:bg-gray-50"}`}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? "bg-sky-500/10 text-sky-400" : "bg-blue-100 text-blue-600"}`}>
                        {icon}
                    </div>
                    <div className="text-left">
                        <h3 className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{title}</h3>
                        <p className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>{description}</p>
                    </div>
                </div>
                <ChevronDown
                    size={18}
                    className={`transition-transform ${isDark ? "text-white/50" : "text-gray-400"} ${isExpanded ? "rotate-180" : ""}`}
                />
            </button>
            {isExpanded && (
                <div className={`p-4 pt-0 border-t ${isDark ? "border-white/5" : "border-gray-100"}`}>
                    <div className="pt-4">{children}</div>
                </div>
            )}
        </div>
    )
}

function FormInput({
    label,
    value,
    onChange,
    placeholder,
    isDark,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    isDark: boolean
}) {
    return (
        <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                {label}
            </label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`w-full p-3 rounded-xl border transition-colors outline-none ${isDark
                    ? "bg-[#1E293B] border-white/10 text-white placeholder:text-white/30 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                    }`}
            />
        </div>
    )
}

function FormSelect({
    label,
    value,
    onChange,
    options,
    isDark,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    options: Record<string, string>
    isDark: boolean
}) {
    return (
        <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                {label}
            </label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`settings-select w-full p-3 rounded-xl border transition-colors cursor-pointer outline-none ${isDark
                    ? "bg-[#1E293B] border-white/10 text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50"
                    : "bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                    }`}
            >
                {Object.entries(options).map(([key, displayName]) => (
                    <option key={key} value={key}>
                        {displayName}
                    </option>
                ))}
            </select>
        </div>
    )
}
