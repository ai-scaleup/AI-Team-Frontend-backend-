import {
    LineChart,
    Share2,
    Megaphone,
    PenTool,
    TrendingUp,
    MessageSquare,
    Lightbulb,
    Search,
} from "lucide-react"

export interface Subject {
    id: string
    name: string
    shortName: string
    icon: any
    color: string
    accentColor: string
    description: string
    relatedAgents: string[]
}

export const SUBJECTS: Subject[] = [
    {
        id: "digital-strategy",
        name: "Digital Marketing Strategy",
        shortName: "Digital Strategy",
        icon: LineChart,
        color: "#3b82f6", // Blue (Mike AI)
        accentColor: "#60a5fa",
        description: "Pianificazione strategica, funnel e analisi di mercato.",
        relatedAgents: ["mike-ai"],
    },
    {
        id: "social-media",
        name: "Social Media Content",
        shortName: "Social Media",
        icon: Share2,
        color: "#ec4899", // Pink (Lara AI)
        accentColor: "#f472b6",
        description: "Strategie editoriali, content creation e community management.",
        relatedAgents: ["lara-ai", "laura-ai"],
    },
    {
        id: "ads-online",
        name: "Advertising Online",
        shortName: "ADS Online",
        icon: Megaphone,
        color: "#ef4444", // Red (Alex AI)
        accentColor: "#f87171",
        description: "Campagne pubblicitarie su Meta, Google, LinkedIn e TikTok.",
        relatedAgents: ["alex-ai"],
    },
    {
        id: "copywriting",
        name: "Direct Response Copywriting",
        shortName: "Copywriting",
        icon: PenTool,
        color: "#f97316", // Orange (Daniele AI)
        accentColor: "#fb923c",
        description: "Scrittura persuasiva per landing page, email e sales letter.",
        relatedAgents: ["daniele-ai"],
    },
    {
        id: "sales-strategy",
        name: "Sales Strategy & Management",
        shortName: "Sales Strategy",
        icon: TrendingUp,
        color: "#0ea5e9", // Sky (Tony AI)
        accentColor: "#22d3ee",
        description: "Gestione team vendita, CRM e ottimizzazione processi commerciali.",
        relatedAgents: ["tony-ai"],
    },
    {
        id: "sales-scripts",
        name: "Sales Methods & Scripts",
        shortName: "Sales Scripts",
        icon: MessageSquare,
        color: "#f59e0b", // Amber (Jim AI - close match)
        accentColor: "#fbbf24",
        description: "Script di vendita, gestione obiezioni e tecniche di chiusura.",
        relatedAgents: ["jim-ai"],
    },
    {
        id: "offer-innovation",
        name: "Product & Offer Innovation",
        shortName: "Offer Innovation",
        icon: Lightbulb,
        color: "#6366f1", // Indigo (Aladino AI)
        accentColor: "#818cf8",
        description: "Creazione offerte irresistibili e innovazione di prodotto.",
        relatedAgents: ["aladino-ai"],
    },
    {
        id: "seo",
        name: "SEO Engine Optimization",
        shortName: "SEO",
        icon: Search,
        color: "#10b981", // Emerald (Simone/Niko AI)
        accentColor: "#34d399",
        description: "Ottimizzazione per i motori di ricerca e content marketing SEO.",
        relatedAgents: ["niko-ai", "simone-ai", "valentina-ai"],
    },
]

export interface QuestionOption {
    value: string
    label: string
}

export interface OnboardingQuestion {
    id: string
    question: string
    type: "text" | "select" | "multiselect" | "textarea"
    options?: QuestionOption[]
    placeholder?: string
    description?: string
}

export const ONBOARDING_STEPS: { title: string; questions: OnboardingQuestion[] }[] = [
    {
        title: "Benvenuto",
        questions: [
            {
                id: "userName",
                question: "Come ti chiami?",
                type: "text",
                placeholder: "Il tuo nome...",
            },
        ],
    },
    {
        title: "Il Tuo Obiettivo",
        questions: [
            {
                id: "mainGoal",
                question: "Qual è il tuo obiettivo principale nell'usare DAN AI?",
                type: "select",
                options: [
                    { value: "support", label: "Supporto operativo (far fare il lavoro agli AI)" },
                    { value: "learn_basic", label: "Apprendimento base (dialogare meglio con AI)" },
                    { value: "learn_deep", label: "Apprendimento approfondito (diventare competente)" },
                    { value: "mix", label: "Mix (dipende dall'argomento)" },
                    { value: "strategy_only", label: "Solo strategie (no operatività)" },
                    { value: "ops_only", label: "Solo operatività (strumenti)" },
                ],
            },
            {
                id: "urgency",
                question: "Quanto velocemente hai bisogno di risultati?",
                type: "select",
                options: [
                    { value: "immediate", label: "Immediato (spiegami il minimo indispensabile)" },
                    { value: "short", label: "Breve termine (2-4 settimane)" },
                    { value: "medium", label: "Medio termine (1-3 mesi)" },
                    { value: "long", label: "Lungo termine (voglio imparare bene)" },
                ],
            },
        ],
    },
    {
        title: "Livello Attuale",
        questions: [
            {
                id: "experienceLevel",
                question: "Come descriveresti la tua esperienza generale nel Digital Marketing?",
                type: "select",
                options: [
                    { value: "zero", label: "Zero assoluto" },
                    { value: "beginner", label: "Principiante (sentito termini ma mai applicati)" },
                    { value: "basic", label: "Base (fatto qualcosa senza strategia)" },
                    { value: "intermediate", label: "Intermedio (gestisco attività ma voglio migliorare)" },
                    { value: "advanced", label: "Avanzato (voglio aggiornarmi)" },
                    { value: "varied", label: "Vario (dipende dall'area)" },
                ],
            },
            {
                id: "competenceAreas",
                question: "In quali aree hai GIÀ qualche esperienza?",
                type: "multiselect",
                options: [
                    { value: "social", label: "Social Media" },
                    { value: "seo", label: "SEO" },
                    { value: "ads", label: "Advertising Online" },
                    { value: "email", label: "Email Marketing" },
                    { value: "copy", label: "Copywriting" },
                    { value: "strategy", label: "Strategia Marketing" },
                    { value: "sales", label: "Vendita e Negoziazione" },
                    { value: "product", label: "Creazione Prodotti/Servizi" },
                    { value: "none", label: "Nessuna di queste" },
                    { value: "all", label: "Tutte le aree" },
                    { value: "other", label: "Altro" },
                ],
            },
            {
                id: "priorityAreas",
                question: "Quali aree vuoi imparare/migliorare PRIMA? (Max 3)",
                type: "multiselect",
                options: [
                    { value: "strategy", label: "Strategia Digital Marketing (Mike AI)" },
                    { value: "seo", label: "SEO (Niko/Simone/Valentina AI)" },
                    { value: "social", label: "Social Media Content (Lara AI)" },
                    { value: "ads", label: "Advertising Online (Alex AI)" },
                    { value: "copy", label: "Copywriting Persuasivo (Daniele AI)" },
                    { value: "sales_strategy", label: "Strategia Vendite (Tony AI)" },
                    { value: "sales_training", label: "Training Vendita (Jim AI)" },
                    { value: "innovation", label: "Innovazione Prodotti (Aladino AI)" },
                ]
            }
        ],
    },
    {
        title: "Tempo e Disponibilità",
        questions: [
            {
                id: "weeklyTime",
                question: "Quanto tempo puoi dedicare settimanalmente all'apprendimento?",
                type: "select",
                options: [
                    { value: "micro", label: "Micro-learning (15-30 min/settimana)" },
                    { value: "light", label: "Light (1-2 ore/settimana)" },
                    { value: "standard", label: "Standard (3-5 ore/settimana)" },
                    { value: "intensive", label: "Intensivo (5+ ore/settimana)" },
                    { value: "variable", label: "Variabile" },
                ]
            },
            {
                id: "sessionType",
                question: "Come preferisci le sessioni di apprendimento?",
                type: "select",
                options: [
                    { value: "flash", label: "Flash (5-10 min, un concetto)" },
                    { value: "short", label: "Brevi (15-20 min, argomento completo)" },
                    { value: "standard", label: "Standard (30-45 min, con esempi)" },
                    { value: "deep", label: "Deep dive (1+ ora, immersione)" },
                ]
            }
        ]
    },
    {
        title: "Stile di Apprendimento",
        questions: [
            {
                id: "contentDepth",
                question: "Come preferisci che ti spieghi i concetti?",
                type: "select",
                options: [
                    { value: "ultra_synthetic", label: "Ultra-sintetico (solo essenziale)" },
                    { value: "synthetic", label: "Sintetico (key points + 1 esempio)" },
                    { value: "balanced", label: "Bilanciato (spiegazione + esempi + contesto)" },
                    { value: "deep", label: "Approfondito (capire il 'perché')" },
                    { value: "variable", label: "Dipende dall'argomento" },
                ]
            },
            {
                id: "techLanguage",
                question: "Come devo gestire i termini tecnici e inglesi?",
                type: "select",
                options: [
                    { value: "simple", label: "Semplice (evita/traduci tutto)" },
                    { value: "guided", label: "Guidato (usa ma spiega + glossario)" },
                    { value: "standard", label: "Standard (spiega solo se complessi)" },
                    { value: "pro", label: "Professionale (usa liberamente)" },
                ]
            },
            {
                id: "format",
                question: "Come preferisci ricevere le informazioni?",
                type: "select",
                options: [
                    { value: "conversational", label: "Testo discorsivo" },
                    { value: "structured", label: "Strutturato (punti, tabelle)" },
                    { value: "examples_first", label: "Esempi first (prima pratica poi teoria)" },
                    { value: "step_by_step", label: "Step-by-step (procedure)" },
                    { value: "mix", label: "Mix" },
                ]
            }
        ]
    },
    {
        title: "Contesto Aziendale",
        questions: [
            {
                id: "companyContext",
                question: "Hai compilato il questionario aziendale 'Onboarding AI Team'?",
                type: "select",
                options: [
                    { value: "yes_full", label: "Sì, completamente" },
                    { value: "yes_partial", label: "Sì, parzialmente" },
                    { value: "no_provide", label: "No, ma fornisco info qui sotto" },
                    { value: "no_generic", label: "No, preferisco apprendimento generico" },
                ]
            },
            {
                id: "companyDetails",
                question: "Se hai risposto di voler fornire info, scrivile qui (Settore, prodotti, clienti, budget...):",
                type: "textarea",
                placeholder: "Descrivi la tua azienda...",
                options: []
            },
            {
                id: "examplesContext",
                question: "Vuoi che gli esempi siano personalizzati sulla tua azienda?",
                type: "select",
                options: [
                    { value: "always", label: "Sempre" },
                    { value: "often", label: "Spesso (preferenza azienda, ma anche generici)" },
                    { value: "sometimes", label: "A volte (mix)" },
                    { value: "never", label: "Mai (preferisco generici)" },
                ]
            }
        ]
    },
    {
        title: "Motivazione e Preferenze",
        questions: [
            {
                id: "motivation",
                question: "Cosa ti aiuta a rimanere motivato?",
                type: "select",
                options: [
                    { value: "results", label: "Risultati rapidi" },
                    { value: "understanding", label: "Comprensione profonda" },
                    { value: "practice", label: "Pratica ed esercizi" },
                    { value: "autonomy", label: "Autonomia di scelta" },
                ]
            },
            {
                id: "learningAids",
                question: "Cosa ti aiuta ad imparare? (Multiselezione)",
                type: "multiselect",
                options: [
                    { value: "metaphors", label: "Metafore" },
                    { value: "quizzes", label: "Mini quiz/test" },
                    { value: "examples", label: "Esempi pratici" },
                    { value: "tables", label: "Tabelle ed elenchi" },
                    { value: "motivation", label: "Frasi motivazionali" },
                ]
            },
            {
                id: "personality",
                question: "Che personalità deve avere il tuo Coach?",
                type: "select",
                options: [
                    { value: "directive", label: "Direttivo/Normativo" },
                    { value: "empathetic", label: "Empatico/Ascolto" },
                    { value: "funny", label: "Simpatico/Scherzoso" },
                    { value: "motivational", label: "Motivatore/Ispirazionale" },
                    { value: "pragmatic", label: "Pragmatico/Concreto" },
                ]
            },
            {
                id: "language",
                question: "Lingua preferita?",
                type: "select",
                options: [
                    { value: "it", label: "Italiano" },
                    { value: "en", label: "Inglese" },
                    { value: "es", label: "Spagnolo" },
                    { value: "fr", label: "Francese" },
                    { value: "de", label: "Tedesco" },
                    { value: "other", label: "Altro" },
                ]
            }
        ]
    }
]
