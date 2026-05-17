// Agent Name Enum
export type AgentName =
    | 'JIM' | 'ALEX' | 'MIKE' | 'TONY' | 'LARA' | 'VALENTINA'
    | 'DANIELE' | 'SIMONE' | 'NIKO' | 'ALADINO' | 'LAURA' | 'DAN'
    | 'MAX' | 'SOFIA' | 'ROBERTA'
    // Test agents
    | 'TEST_JIM' | 'TEST_ALEX' | 'TEST_MIKE' | 'TEST_TONY' | 'TEST_LARA'
    | 'TEST_VALENTINA' | 'TEST_DANIELE' | 'TEST_SIMONE' | 'TEST_NIKO'
    | 'TEST_ALADINO' | 'TEST_LAURA' | 'TEST_DAN' | 'TEST_MAX' | 'TEST_SOFIA' | 'TEST_ROBERTA';

// Preference Enums
export type ContentLanguage = 'ITALIANO' | 'INGLESE' | 'SPAGNOLO' | 'FRANCESE' | 'TEDESCO' | 'PORTOGHESE' | 'ALTRO';

export type ToneOfVoice =
    | 'PROFESSIONALE_FORMALE'
    | 'AMICHEVOLE_INFORMALE'
    | 'TECNICO_ESPERTO'
    | 'MOTIVAZIONALE_ENERGETICO'
    | 'EMPATICO_COMPRENSIVO'
    | 'INNOVATIVO_VISIONARIO'
    | 'DIVERTENTE_CREATIVO';

export type MarketingKnowledge = 'BASE' | 'INTERMEDIO' | 'AVANZATO' | 'EXPERT';

export type ResponseLength = 'CONCISA' | 'BILANCIATA' | 'DETTAGLIATA';

export type EmojiUsage = 'MAI' | 'MINIMO' | 'MODERATO' | 'FREQUENTE';

export type ProactivityLevel = 'SOLO_REATTIVO' | 'MODERATAMENTE_PROATTIVO' | 'MOLTO_PROATTIVO';

export type QuestionStyle = 'UNA_ALLA_VOLTA' | 'A_GRUPPI' | 'MINIMO_INDISPENSABILE';

export type DecisionHelpStyle = 'ANALISI_OPZIONI' | 'RACCOMANDAZIONE_DIRETTA' | 'ENTRAMBI';

export type LearningPreference = 'APPRENDIMENTO_CONTINUO' | 'COMPORTAMENTO_STATICO' | 'AGGIORNAMENTI_PERIODICI';

export type MarketComparison = 'SEMPRE' | 'SOLO_RILEVANTI' | 'MAI';

// User Preference Interface (matches API response)
export interface UserPreference {
    id: string;
    oauthId: string;
    email: string;
    agentName: AgentName;

    // SECTION: IDENTITY
    displayName?: string | null;
    businessName?: string | null;

    // SECTION: LANGUAGE
    contentLanguage: ContentLanguage;
    responseLanguage: ContentLanguage;

    // SECTION: BRAND STYLE
    toneOfVoice: ToneOfVoice;
    marketingKnowledge: MarketingKnowledge;

    // SECTION: INTERACTION
    responseLength: ResponseLength;
    emojiUsage: EmojiUsage;

    // SECTION: AI BEHAVIOR
    proactivityLevel: ProactivityLevel;
    questionStyle: QuestionStyle;
    decisionHelpStyle: DecisionHelpStyle;

    // SECTION: PERSONALIZATION
    learningPreference: LearningPreference;
    marketComparison: MarketComparison;

    // ONBOARDING STATUS
    onboardingCompleted: boolean;
    onboardingStep: number;

    createdAt: string;
    updatedAt: string;
}

// DTO for updating preferences
export interface UpdateUserPreferenceDto {
    displayName?: string | null;
    businessName?: string | null;
    contentLanguage?: ContentLanguage;
    responseLanguage?: ContentLanguage;
    toneOfVoice?: ToneOfVoice;
    marketingKnowledge?: MarketingKnowledge;
    responseLength?: ResponseLength;
    emojiUsage?: EmojiUsage;
    proactivityLevel?: ProactivityLevel;
    questionStyle?: QuestionStyle;
    decisionHelpStyle?: DecisionHelpStyle;
    learningPreference?: LearningPreference;
    marketComparison?: MarketComparison;
    onboardingCompleted?: boolean;
    onboardingStep?: number;
}

// Default preference values (used when creating new preferences)
export const DEFAULT_PREFERENCE_VALUES: UpdateUserPreferenceDto = {
    displayName: '',
    businessName: '',
    contentLanguage: 'ITALIANO',
    responseLanguage: 'ITALIANO',
    toneOfVoice: 'PROFESSIONALE_FORMALE',
    marketingKnowledge: 'INTERMEDIO',
    responseLength: 'BILANCIATA',
    emojiUsage: 'MINIMO',
    proactivityLevel: 'MODERATAMENTE_PROATTIVO',
    questionStyle: 'UNA_ALLA_VOLTA',
    decisionHelpStyle: 'ENTRAMBI',
    learningPreference: 'APPRENDIMENTO_CONTINUO',
    marketComparison: 'SOLO_RILEVANTI',
    onboardingCompleted: false,
    onboardingStep: 0,
};

// Human-readable labels for each enum value (for UI)
// IMPORTANT: These must match the start of the Wizard Options for mapping to work
export const PREFERENCE_LABELS = {
    contentLanguage: {
        ITALIANO: 'Italiano',
        INGLESE: 'Inglese', // Changed to match "Inglese (Internazionale)" better? No "Italiano" matches "Italiano (Predefinito)". "Inglese" matches "Inglese".
        SPAGNOLO: 'Spagnolo',
        FRANCESE: 'Francese',
        TEDESCO: 'Tedesco',
        PORTOGHESE: 'Portoghese',
        ALTRO: 'Altro',
    },
    toneOfVoice: {
        PROFESSIONALE_FORMALE: 'Professionale e Formale',
        AMICHEVOLE_INFORMALE: 'Amichevole e Informale',
        TECNICO_ESPERTO: 'Tecnico ed Esperto',
        MOTIVAZIONALE_ENERGETICO: 'Motivazionale ed Energetico',
        EMPATICO_COMPRENSIVO: 'Empatico e Comprensivo',
        INNOVATIVO_VISIONARIO: 'Innovativo e Visionario',
        DIVERTENTE_CREATIVO: 'Divertente e Creativo',
    },
    marketingKnowledge: {
        BASE: 'Base',
        INTERMEDIO: 'Intermedio',
        AVANZATO: 'Avanzato',
        EXPERT: 'Expert', // Fixed Enum and Label
    },
    responseLength: {
        CONCISA: 'Concisa',
        BILANCIATA: 'Bilanciata',
        DETTAGLIATA: 'Dettagliata',
    },
    emojiUsage: {
        MAI: 'Mai',
        MINIMO: 'Minimo',
        MODERATO: 'Moderato',
        FREQUENTE: 'Frequente',
    },
    proactivityLevel: {
        SOLO_REATTIVO: 'Solo Reattivo',
        MODERATAMENTE_PROATTIVO: 'Moderatamente Proattivo',
        MOLTO_PROATTIVO: 'Molto Proattivo',
    },
    questionStyle: {
        UNA_ALLA_VOLTA: 'Una alla volta',
        A_GRUPPI: 'A gruppi',
        MINIMO_INDISPENSABILE: 'Minimo indispensabile',
    },
    decisionHelpStyle: {
        ANALISI_OPZIONI: 'Analisi Opzioni',
        RACCOMANDAZIONE_DIRETTA: 'Raccomandazione Diretta',
        ENTRAMBI: 'Entrambi',
    },
    learningPreference: {
        APPRENDIMENTO_CONTINUO: 'Sì, Apprendimento Continuo', // Matches "Sì, Apprendimento Continuo..."
        COMPORTAMENTO_STATICO: 'No, Comportamento Statico',   // Fixed Enum and Label
        AGGIORNAMENTI_PERIODICI: 'Aggiornamenti Periodici',
    },
    marketComparison: {
        SEMPRE: 'Sì, includi sempre esempi', // Matches "Sì, includi sempre esempi..."
        SOLO_RILEVANTI: 'Solo se trovi esempi', // Matches "Solo se trovi esempi..."
        MAI: 'No, concentriamoci solo', // Matches "No, concentriamoci solo..."
    },
} as const;

// Agent ID to AgentName mapping
export const AGENT_ID_TO_NAME: Record<string, AgentName> = {
    'jim-ai': 'JIM',
    'alex-ai': 'ALEX',
    'mike-ai': 'MIKE',
    'tony-ai': 'TONY',
    'lara-ai': 'LARA',
    'valentina-ai': 'VALENTINA',
    'daniele-ai': 'DANIELE',
    'simone-ai': 'SIMONE',
    'niko-ai': 'NIKO',
    'aladino-ai': 'ALADINO',
    'laura-ai': 'LAURA',
    'dan-ai': 'DAN',
    'max-ai': 'MAX',
    'sofia-ai': 'SOFIA',
    'roberta-ai': 'ROBERTA',
    // Test agents
    'test-jim-ai': 'TEST_JIM',
    'test-alex-ai': 'TEST_ALEX',
    'test-mike-ai': 'TEST_MIKE',
    'test-tony-ai': 'TEST_TONY',
    'test-lara-ai': 'TEST_LARA',
    'test-valentina-ai': 'TEST_VALENTINA',
    'test-daniele-ai': 'TEST_DANIELE',
    'test-simone-ai': 'TEST_SIMONE',
    'test-niko-ai': 'TEST_NIKO',
    'test-aladino-ai': 'TEST_ALADINO',
    'test-laura-ai': 'TEST_LAURA',
    'test-dan-ai': 'TEST_DAN',
    'test-max-ai': 'TEST_MAX',
    'test-sofia-ai': 'TEST_SOFIA',
    'test-roberta-ai': 'TEST_ROBERTA',
};

// AgentName to display name mapping
export const AGENT_DISPLAY_NAMES: Record<AgentName, string> = {
    JIM: 'Jim AI',
    ALEX: 'Alex AI',
    MIKE: 'Mike AI',
    TONY: 'Tony AI',
    LARA: 'Lara AI',
    VALENTINA: 'Valentina AI',
    DANIELE: 'Daniele AI',
    SIMONE: 'Simone AI',
    NIKO: 'Niko AI',
    ALADINO: 'Aladino AI',
    LAURA: 'Laura AI',
    DAN: 'Dan AI',
    MAX: 'Max AI',
    SOFIA: 'Sofia AI',
    ROBERTA: 'Roberta AI',
    TEST_JIM: 'Test Jim AI',
    TEST_ALEX: 'Test Alex AI',
    TEST_MIKE: 'Test Mike AI',
    TEST_TONY: 'Test Tony AI',
    TEST_LARA: 'Test Lara AI',
    TEST_VALENTINA: 'Test Valentina AI',
    TEST_DANIELE: 'Test Daniele AI',
    TEST_SIMONE: 'Test Simone AI',
    TEST_NIKO: 'Test Niko AI',
    TEST_ALADINO: 'Test Aladino AI',
    TEST_LAURA: 'Test Laura AI',
    TEST_DAN: 'Test Dan AI',
    TEST_MAX: 'Test Max AI',
    TEST_SOFIA: 'Test Sofia AI',
    TEST_ROBERTA: 'Test Roberta AI',
};

// Production agents only (excluding test agents)
export const PRODUCTION_AGENTS: AgentName[] = [
    'JIM', 'ALEX', 'MIKE', 'TONY', 'LARA', 'VALENTINA',
    'DANIELE', 'SIMONE', 'NIKO', 'ALADINO', 'LAURA', 'DAN',
    'MAX', 'SOFIA', 'ROBERTA'
];

// Legacy interface for backwards compatibility with existing PreferencesWizard
// TODO: Migrate PreferencesWizard to use new types
export interface UserPreferences {
    user_name: string;
    business_name: string;
    content_language: string;
    communication_language: string;
    brand_tone: string;
    language_complexity: string;
    response_length: string;
    emoji_usage: string;
    proactivity_level: string;
    question_style: string;
    decision_support: string;
    followup_behavior: string;
    confidence_display: string;
    learning_adaptation: string;
    benchmark_references: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
    user_name: "",
    business_name: "",
    content_language: "Italian",
    communication_language: "Italian",
    brand_tone: "Professional & Formal",
    language_complexity: "Technical & Professional",
    response_length: "Balanced",
    emoji_usage: "Moderate",
    proactivity_level: "Suggest improvements",
    question_style: "Grouped",
    decision_support: "Options with analysis",
    followup_behavior: "Ask if needed",
    confidence_display: "Balanced",
    learning_adaptation: "Agents learn from feedback",
    benchmark_references: "Include industry benchmarks"
};
