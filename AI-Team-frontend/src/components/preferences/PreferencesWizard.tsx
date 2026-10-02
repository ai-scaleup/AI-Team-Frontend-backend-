import { useState, useEffect } from "react"
import { ChevronRight, ChevronLeft, Check, Sparkles, X, Save, Loader2, Play } from "lucide-react"
import { UserPreferences, DEFAULT_PREFERENCES, PREFERENCE_LABELS, UpdateUserPreferenceDto, AgentName } from "@/types/preferences"
import { userPreferenceService } from "@/services/preferenceService"

interface PreferencesWizardProps {
    onComplete: () => void
    onClose: () => void
    isOpen: boolean
    userId: string
    agentName?: AgentName // Optional, defaults to 'JIM'
}

// --- CONFIGURATION ---
// Expanded questions for better clarity as requested
const QUESTIONS = [
    {
        section: "Identità",
        id: "user_name",
        label: "Come desideri essere chiamato?",
        description: "Inserisci il nome con cui il tuo Team di AI Agents si rivolgerà a te durante le conversazioni.",
        type: "text",
        placeholder: "Il tuo nome o nickname"
    },
    {
        section: "Identità",
        id: "business_name",
        label: "Qual è il nome della tua attività?",
        description: "Questo permetterà al Team di AI Agents di contestualizzare le strategie per il tuo brand specifico.",
        type: "text",
        placeholder: "Nome azienda, startup o progetto"
    },
    {
        section: "Lingua",
        id: "content_language",
        label: "In quale lingua vuoi generare i contenuti?",
        description: "Scegli la lingua principale per i testi (email, post, blog) che il Team di AI Agents scriverà per te.",
        type: "select",
        options: [
            "Italiano (Predefinito)",
            "Inglese (Internazionale)",
            "Spagnolo",
            "Francese",
            "Tedesco",
            "Portoghese",
            "Altro"
        ]
    },
    {
        section: "Lingua",
        id: "communication_language",
        label: "In che lingua vuoi che il Team ti risponda?",
        description: "Questa è la lingua che il Team di AI Agents userà per dialogare con te.",
        type: "select",
        options: [
            "Italiano (Consigliato)",
            "Inglese",
            "Spagnolo",
            "Francese",
            "Tedesco",
            "Portoghese",
            "Altro"
        ]
    },
    {
        section: "Stile Brand",
        id: "brand_tone",
        label: "Qual è il tono di voce del tuo brand?",
        description: "Definisci la personalità che il Team di AI Agents dovrà adottare per rappresentare la tua azienda.",
        type: "select",
        options: [
            "Professionale e Formale (Autorevole e Serio)",
            "Amichevole e Informale (Vicino al cliente)",
            "Tecnico ed Esperto (Settoriale e Preciso)",
            "Motivazionale ed Energetico (Ispirante)",
            "Empatico e Comprensivo (Supportivo)",
            "Innovativo e Visionario (Futuristico)",
            "Divertente e Creativo (Ironico e Leggero)"
        ]
    },
    {
        section: "Stile Brand",
        id: "language_complexity",
        label: "Qual è il tuo livello di conoscenza del Digital Marketing?",
        description: "Questo aiuta il Team di AI Agents a capire quanto tecnicamente deve spiegarti le strategie e i piani d'azione.",
        type: "select",
        options: [
            "Base (Spiegami i concetti in modo semplice e chiaro, senza termini complicati)",
            "Intermedio (Conosco i termini principali, ma apprezzo spiegazioni pratiche)",
            "Avanzato (Parla da esperto a esperto, usa pure terminologia tecnica)",
            "Expert (Voglio analisi tecniche di alto livello e focus sui dati)"
        ]
    },
    {
        section: "Interazione",
        id: "response_length",
        label: "Quanto devono essere lunghe le risposte del Team?",
        description: "Preferisci sintesi o dettagli approfonditi quando chatti con i tuoi AI Agents?",
        type: "select",
        options: [
            "Concisa (Dammi solo l'essenziale, voglio risparmiare tempo)",
            "Bilanciata (Una spiegazione chiara ma diretta al punto)",
            "Dettagliata (Voglio un'analisi completa e approfondita di ogni aspetto)"
        ]
    },
    {
        section: "Interazione",
        id: "emoji_usage",
        label: "Vuoi che il Team usi le Emoji?",
        description: "Le emoji possono rendere la conversazione più informale o essere evitate per mantenere serietà.",
        type: "select",
        options: [
            "Mai (Mantieni uno stile rigoroso e pulito)",
            "Minimo (Usale solo quando strettamente necessario per enfatizzare)",
            "Moderato (Usale per rendere il testo più scorrevole e amichevole)",
            "Frequente (Mi piace uno stile molto social, giovane e visivo)"
        ]
    },
    {
        section: "Comportamento AI",
        id: "proactivity_level",
        label: "Quanto deve essere proattivo il tuo Team?",
        description: "Ti aspetti che il Team di AI Agents si limiti a rispondere o che ti proponga nuove idee?",
        type: "select",
        options: [
            "Solo Reattivo (Rispondi esattamente a quello che chiedo, senza divagare)",
            "Moderatamente Proattivo (Se noti che manca qualcosa, suggerisci miglioramenti)",
            "Molto Proattivo (Agisci come un consulente: proponimi strategie e idee nuove anche se non richieste)"
        ]
    },
    {
        section: "Comportamento AI",
        id: "question_style",
        label: "Come preferisci che il Team ti faccia domande?",
        description: "Per raccogliere informazioni da te, come devono procedere gli AI Agents?",
        type: "select",
        options: [
            "Una alla volta (Guidami passo dopo passo, preferisco focus su una cosa per volta)",
            "A gruppi (Fammi più domande insieme per velocizzare il processo)",
            "Minimo indispensabile (Cerca di dedurre il più possibile e chiedimi solo l'essenziale)"
        ]
    },
    {
        section: "Comportamento AI",
        id: "decision_support",
        label: "Come vuoi essere aiutato nelle decisioni?",
        description: "Quando devi scegliere una strategia, cosa ti aspetti dal Team?",
        type: "select",
        options: [
            "Analisi Opzioni (Elencami i Pro e i Contro di ogni strada, decido io)",
            "Raccomandazione Diretta (Dimmi chiaramente cosa faresti tu al posto mio)",
            "Entrambi (Fammi un'analisi completa e poi dammi il tuo consiglio finale)"
        ]
    },
    {
        section: "Personalizzazione",
        id: "learning_adaptation",
        label: "Vuoi che il Team impari dalle vostre interazioni passate?",
        description: "Possiamo memorizzare il tuo stile e le tue preferenze man mano che lavoriamo insieme, per diventare sempre più precisi.",
        type: "select",
        options: [
            "Sì, Apprendimento Continuo (Memorizza tutto e adattati automaticamente al mio stile)",
            "No, Comportamento Statico (Rimani sempre fedele alle impostazioni iniziali che ho scelto oggi)",
            "Aggiornamenti Periodici (Memorizza, ma chiedimi conferma prima di cambiare il modo in cui lavori)"
        ]
    },
    {
        section: "Personalizzazione",
        id: "benchmark_references",
        label: "Vuoi confronti con i leader del tuo mercato?",
        description: "Quando definiamo strategie, vuoi sapere cosa fanno i migliori competitor del tuo settore (Benchmark)?",
        type: "select",
        options: [
            "Sì, includi sempre esempi di cosa fanno i leader di mercato",
            "Solo se trovi esempi molto specifici e rilevanti per la mia azienda",
            "No, concentriamoci solo sui miei dati interni e sulla mia unicità"
        ]
    }
];

// Helper type for safe access
type QuestionType =
    | { section: string; id: string; label: string; description: string; type: 'text'; placeholder: string; options?: never }
    | { section: string; id: string; label: string; description: string; type: 'select'; options: string[]; placeholder?: never };

const QUESTIONS_TYPED = QUESTIONS as unknown as QuestionType[];

export default function PreferencesWizard({ onComplete, onClose, isOpen, userId, agentName = 'JIM' }: PreferencesWizardProps) {
    // Current Step (-1 means Welcome Screen)
    const [currentStep, setCurrentStep] = useState(-1)
    const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES)
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isClosing, setIsClosing] = useState(false)

    // Helper to find the Wizard Option string that matches the API Enum Label
    const reverseMap = (labels: Record<string, string>, enumValue: string, fallbackFragment: string): string | undefined => {
        const label = labels[enumValue as keyof typeof labels];
        if (!label) return undefined;

        // Find the wizard option that starts with this label
        for (const question of QUESTIONS_TYPED) {
            if (question.type === 'select') {
                const match = question.options.find(opt => opt.startsWith(label));
                if (match) return match;
            }
        }
        return undefined;
    }

    // Load initial data
    useEffect(() => {
        if (isOpen && userId) {
            const loadData = async () => {
                setIsLoading(true)
                // Load for specific agent (defaults to JIM)
                const apiPrefs = await userPreferenceService.getOrCreate(userId, agentName)

                if (apiPrefs) {
                    // Map API DTO back to Wizard Legacy Format
                    const mappedPrefs: UserPreferences = {
                        user_name: apiPrefs.displayName || "",
                        business_name: apiPrefs.businessName || "",
                        content_language: reverseMap(PREFERENCE_LABELS.contentLanguage, apiPrefs.contentLanguage, "Italiano") || "",
                        communication_language: reverseMap(PREFERENCE_LABELS.contentLanguage, apiPrefs.responseLanguage, "Italiano") || "",
                        brand_tone: reverseMap(PREFERENCE_LABELS.toneOfVoice, apiPrefs.toneOfVoice, "Professionale") || "",
                        language_complexity: reverseMap(PREFERENCE_LABELS.marketingKnowledge, apiPrefs.marketingKnowledge, "Intermedio") || "",
                        response_length: reverseMap(PREFERENCE_LABELS.responseLength, apiPrefs.responseLength, "Bilanciata") || "",
                        emoji_usage: reverseMap(PREFERENCE_LABELS.emojiUsage, apiPrefs.emojiUsage, "Minimo") || "",
                        proactivity_level: reverseMap(PREFERENCE_LABELS.proactivityLevel, apiPrefs.proactivityLevel, "Moderatamente") || "",
                        question_style: reverseMap(PREFERENCE_LABELS.questionStyle, apiPrefs.questionStyle, "Una alla volta") || "",
                        decision_support: reverseMap(PREFERENCE_LABELS.decisionHelpStyle, apiPrefs.decisionHelpStyle, "Entrambi") || "",
                        learning_adaptation: reverseMap(PREFERENCE_LABELS.learningPreference, apiPrefs.learningPreference, "Apprendimento") || "",
                        benchmark_references: reverseMap(PREFERENCE_LABELS.marketComparison, apiPrefs.marketComparison, "Solo se rilevante") || "",
                        // Missing legacy fields that are not in the new API but needed for type compliance
                        followup_behavior: "",
                        confidence_display: "",
                    }
                    setPrefs(mappedPrefs)
                }
                setIsLoading(false)
            }
            loadData()
        }
    }, [isOpen, userId, agentName])

    if (!isOpen) return null

    const totalSteps = QUESTIONS_TYPED.length
    const isWelcome = currentStep === -1
    const currentQuestion = !isWelcome ? QUESTIONS_TYPED[currentStep] : null
    const progress = Math.max(0, ((currentStep + 1) / totalSteps) * 100)

    const handleNext = () => {
        if (currentStep < totalSteps - 1) {
            setCurrentStep(prev => prev + 1)
        } else {
            handleSave()
        }
    }

    const handleStart = () => {
        setCurrentStep(0)
    }

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1)
        } else if (currentStep === 0) {
            setCurrentStep(-1) // Back to welcome
        }
    }

    const handleSave = async (useDefaults = false) => {
        setIsSaving(true)
        const prefsToUse = useDefaults ? DEFAULT_PREFERENCES : prefs

        // Map Legacy Wizard Format to API DTO
        const mapValue = (labels: Record<string, string>, value: string): any => {
            if (!value) return undefined
            const entry = Object.entries(labels).find(([key, label]) => value.startsWith(label))
            return entry ? entry[0] : undefined
        }

        const dataToSave: UpdateUserPreferenceDto = {
            displayName: prefsToUse.user_name || null,
            businessName: prefsToUse.business_name || null,
            contentLanguage: mapValue(PREFERENCE_LABELS.contentLanguage, prefsToUse.content_language),
            responseLanguage: mapValue(PREFERENCE_LABELS.contentLanguage, prefsToUse.communication_language),
            toneOfVoice: mapValue(PREFERENCE_LABELS.toneOfVoice, prefsToUse.brand_tone),
            marketingKnowledge: mapValue(PREFERENCE_LABELS.marketingKnowledge, prefsToUse.language_complexity),
            responseLength: mapValue(PREFERENCE_LABELS.responseLength, prefsToUse.response_length),
            emojiUsage: mapValue(PREFERENCE_LABELS.emojiUsage, prefsToUse.emoji_usage),
            proactivityLevel: mapValue(PREFERENCE_LABELS.proactivityLevel, prefsToUse.proactivity_level),
            questionStyle: mapValue(PREFERENCE_LABELS.questionStyle, prefsToUse.question_style),
            decisionHelpStyle: mapValue(PREFERENCE_LABELS.decisionHelpStyle, prefsToUse.decision_support),
            learningPreference: mapValue(PREFERENCE_LABELS.learningPreference, prefsToUse.learning_adaptation),
            marketComparison: mapValue(PREFERENCE_LABELS.marketComparison, prefsToUse.benchmark_references),
            onboardingCompleted: true,
        }

        console.log('Wizard Saving:', dataToSave)

        // Save for specific agent (defaults to JIM)
        const { data, error } = await userPreferenceService.upsertWithResult(
            userId,
            agentName,
            dataToSave,
        )

        setIsSaving(false)

        if (data) {
            handleClose(true)
        } else {
            // The API says which field it rejected; hiding that behind "Riprova"
            // leaves the user clicking the same button forever.
            alert(error ?? "Errore durante il salvataggio. Riprova.")
        }
    }

    const handleSkip = () => {
        handleSave(true)
    }

    const handleClose = (completed = false) => {
        setIsClosing(true)
        setTimeout(() => {
            if (completed) onComplete()
            else onClose()
            setIsClosing(false)
            setCurrentStep(-1)
        }, 500)
    }

    const handleChange = (field: keyof UserPreferences, value: string) => {
        setPrefs(prev => ({ ...prev, [field]: value }))
    }

    const isStepValid = () => {
        if (isWelcome) return true
        if (!currentQuestion) return false

        // Basic validation: User Name required
        if (currentQuestion.id === 'user_name') {
            return !!prefs.user_name?.trim()
        }
        return true
    }

    // --- WELCOME SCREEN ---
    if (isWelcome) {
        return (
            <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-500 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
                {/* Main Card */}
                <div className={`w-full max-w-2xl bg-[#0B1120] border border-indigo-500/30 rounded-[2rem] shadow-[0_0_50px_rgba(79,70,229,0.15)] p-10 text-center transform transition-all duration-500 relative overflow-hidden ${isClosing ? 'scale-95' : 'scale-100'}`}>

                    {/* Background decoration */}
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-600"></div>
                    <div className="absolute -top-[100px] -right-[100px] w-60 h-60 bg-purple-600/20 blur-[100px] rounded-full pointing-events-none"></div>
                    <div className="absolute -bottom-[100px] -left-[100px] w-60 h-60 bg-cyan-500/10 blur-[100px] rounded-full pointing-events-none"></div>

                    <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse border border-indigo-500/20 relative z-10">
                        <Sparkles className="text-indigo-400 w-10 h-10" />
                    </div>

                    <h2 className="text-3xl font-bold text-white mb-4 relative z-10 font-tech tracking-tight">
                        Configura il tuo <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">Team di AI Agents</span>
                    </h2>

                    <p className="text-base text-slate-300 mb-8 leading-relaxed max-w-lg mx-auto relative z-10">
                        Per offrirti la migliore esperienza, abbiamo bisogno di conoscere il tuo stile. Queste preferenze guideranno il modo in cui il tuo Team lavorerà per te.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
                        <button
                            onClick={handleStart}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 px-10 rounded-full text-base flex items-center justify-center gap-2 transform hover:-translate-y-1 transition-all shadow-lg shadow-indigo-500/40"
                        >
                            Inizia Profilazione <Play size={18} fill="currentColor" />
                        </button>

                        <button
                            onClick={handleSkip}
                            className="bg-transparent border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white font-bold py-3 px-10 rounded-full text-base transition-all"
                        >
                            Salta per ora
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // --- WIZARD SCREEN ---
    return (
        <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg transition-opacity duration-500 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
            <div className={`w-full max-w-3xl max-h-[85vh] bg-[#0F172A] border border-slate-800 rounded-[1.5rem] shadow-2xl flex flex-col transform transition-all duration-500 overflow-hidden relative ${isClosing ? 'scale-95' : 'scale-100'}`}>

                {/* Background ambient glow */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none"></div>

                {/* Header */}
                <div className="flex items-center justify-between p-5 px-8 border-b border-slate-800 bg-[#0B1120]/50 relative z-20">
                    <div className="flex items-center gap-4">
                        <span className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border border-indigo-500/20">
                            SEZIONE {Math.ceil((currentStep + 1) / 2)} DI {Math.ceil(totalSteps / 2)}
                        </span>
                        <span className="text-slate-400 text-xs font-medium tracking-wide uppercase">
                            {currentQuestion!.section}
                        </span>
                    </div>
                    <button onClick={() => handleClose(false)} className="text-slate-500 hover:text-white transition-colors bg-slate-800/50 p-1.5 rounded-full hover:bg-slate-700/50">
                        <X size={18} />
                    </button>
                </div>

                {/* Progress Line */}
                <div className="h-0.5 w-full bg-slate-900">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-600 shadow-[0_0_10px_rgba(139,92,246,0.5)] transition-all duration-500 ease-out"
                        style={{ width: `${progress}% ` }}
                    />
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 relative z-10">
                    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500" key={currentQuestion!.id}>

                        <h3 className="text-xl md:text-2xl font-bold text-white mb-2 leading-tight tracking-tight">
                            {currentQuestion!.label}
                        </h3>

                        <p className="text-slate-400 text-sm mb-8 leading-relaxed font-light">
                            {currentQuestion!.description}
                        </p>

                        <div className="w-full space-y-3">
                            {isLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                                </div>
                            ) : (
                                <>
                                    {currentQuestion!.type === 'text' && (
                                        <div className="relative group">
                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-50 transition duration-500"></div>
                                            <input
                                                type="text"
                                                className="relative w-full bg-[#0B1120] border border-slate-700 rounded-xl p-4 text-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all shadow-xl"
                                                placeholder={currentQuestion!.placeholder}
                                                value={prefs[currentQuestion!.id as keyof UserPreferences] as string || ""}
                                                onChange={(e) => handleChange(currentQuestion!.id as keyof UserPreferences, e.target.value)}
                                                autoFocus
                                                onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                            />
                                        </div>
                                    )}

                                    {currentQuestion!.type === 'select' && (
                                        <div className="grid grid-cols-1 gap-2.5">
                                            {currentQuestion!.options?.map(opt => {
                                                const isSelected = prefs[currentQuestion!.id as keyof UserPreferences] === opt

                                                return (
                                                    <button
                                                        key={opt}
                                                        onClick={() => handleChange(currentQuestion!.id as keyof UserPreferences, opt)}
                                                        className={`relative w-full text-left p-4 rounded-xl border transition-all duration-200 group overflow-hidden ${isSelected
                                                            ? 'bg-[#1e1b4b] border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                                                            : 'bg-[#0B1120] border-slate-800 hover:border-slate-600 hover:bg-[#111827]'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between relative z-10">
                                                            <span className={`text-sm font-medium leading-relaxed ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                                                                {opt}
                                                            </span>
                                                            {isSelected && (
                                                                <div className="bg-indigo-500/20 p-1 rounded-full border border-indigo-500/50 flex-shrink-0 ml-3">
                                                                    <Check size={14} className="text-indigo-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        {isSelected && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 pointer-events-none"></div>}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer fixed at bottom */}
                <div className="p-5 border-t border-slate-800 bg-[#0B1120]/80 backdrop-blur-sm flex items-center justify-between relative z-20">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors px-3 py-2 font-medium text-xs md:text-sm"
                    >
                        <ChevronLeft size={16} /> Indietro
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={!isStepValid() || isLoading || isSaving}
                        className={`px-6 py-2.5 rounded-full font-bold flex items-center gap-2 transition-all shadow-lg text-sm
                            ${!isStepValid() || isLoading || isSaving
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed shadow-none border border-slate-700'
                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/30 hover:-translate-y-0.5'
                            }`}
                    >
                        {isSaving ? (
                            <>Salvando... <Loader2 className="animate-spin" size={16} /></>
                        ) : (
                            <>Avanti <ChevronRight size={16} /></>
                        )}
                    </button>
                </div>

            </div>
        </div>
    )
}
