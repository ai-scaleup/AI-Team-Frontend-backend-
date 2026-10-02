import { z } from 'zod';
import { AgentName } from 'src/generated/prisma/client';

// All valid agent names from the Prisma enum
const agentNames = [
  'JIM',
  'ALEX',
  'MIKE',
  'TONY',
  'LARA',
  'VALENTINA',
  'DANIELE',
  'SIMONE',
  'NIKO',
  'ALADINO',
  'LAURA',
  'DAN',
  'MAX',
  'SOFIA',
  'ROBERTA',
  'SARA_AI',
  'TEST_JIM',
  'TEST_ALEX',
  'TEST_MIKE',
  'TEST_TONY',
  'TEST_LARA',
  'TEST_VALENTINA',
  'TEST_DANIELE',
  'TEST_SIMONE',
  'TEST_NIKO',
  'TEST_ALADINO',
  'TEST_LAURA',
  'TEST_DAN',
  'TEST_MAX',
  'TEST_SOFIA',
  'TEST_ROBERTA',
] as const;

// Enum values for validation (Italian)
const contentLanguages = [
  'ITALIANO',
  'INGLESE',
  'SPAGNOLO',
  'FRANCESE',
  'TEDESCO',
  'PORTOGHESE',
  'ALTRO',
] as const;
const toneOfVoices = [
  'PROFESSIONALE_FORMALE',
  'AMICHEVOLE_INFORMALE',
  'TECNICO_ESPERTO',
  'MOTIVAZIONALE_ENERGETICO',
  'EMPATICO_COMPRENSIVO',
  'INNOVATIVO_VISIONARIO',
  'DIVERTENTE_CREATIVO',
] as const;
const marketingKnowledges = [
  'BASE',
  'INTERMEDIO',
  'AVANZATO',
  'EXPERT',
] as const;
const responseLengths = ['CONCISA', 'BILANCIATA', 'DETTAGLIATA'] as const;
const emojiUsages = ['MAI', 'MINIMO', 'MODERATO', 'FREQUENTE'] as const;
const proactivityLevels = [
  'SOLO_REATTIVO',
  'MODERATAMENTE_PROATTIVO',
  'MOLTO_PROATTIVO',
] as const;
const questionStyles = [
  'UNA_ALLA_VOLTA',
  'A_GRUPPI',
  'MINIMO_INDISPENSABILE',
] as const;
const decisionHelpStyles = [
  'ANALISI_OPZIONI',
  'RACCOMANDAZIONE_DIRETTA',
  'ENTRAMBI',
] as const;
const learningPreferences = [
  'APPRENDIMENTO_CONTINUO',
  'COMPORTAMENTO_STATICO',
  'AGGIORNAMENTI_PERIODICI',
] as const;
const marketComparisons = ['SEMPRE', 'SOLO_RILEVANTI', 'MAI'] as const;

// Schema for creating user preferences
export const createUserPreferenceSchema = z
  .object({
    oauthId: z.string().min(1, { message: 'OAuth ID is required.' }).optional(),
    email: z.string().email({ message: 'Valid email is required.' }).optional(),
    agentName: z.enum(agentNames, { message: 'Valid agent name is required.' }),

    // SECTION: IDENTITY
    // Both columns are nullable in the database, and the clients send null for
    // a field the user left blank, so null has to be accepted here too.
    displayName: z.string().nullable().optional(),
    businessName: z.string().nullable().optional(),

    // SECTION: TONGUE (Language)
    contentLanguage: z.enum(contentLanguages).optional().default('ITALIANO'),
    responseLanguage: z.enum(contentLanguages).optional().default('ITALIANO'),

    // SECTION: BRAND STYLE
    toneOfVoice: z
      .enum(toneOfVoices)
      .optional()
      .default('PROFESSIONALE_FORMALE'),
    marketingKnowledge: z
      .enum(marketingKnowledges)
      .optional()
      .default('INTERMEDIO'),

    // SECTION: INTERACTION
    responseLength: z.enum(responseLengths).optional().default('BILANCIATA'),
    emojiUsage: z.enum(emojiUsages).optional().default('MINIMO'),

    // SECTION: AI BEHAVIOR
    proactivityLevel: z
      .enum(proactivityLevels)
      .optional()
      .default('MODERATAMENTE_PROATTIVO'),
    questionStyle: z.enum(questionStyles).optional().default('UNA_ALLA_VOLTA'),
    decisionHelpStyle: z
      .enum(decisionHelpStyles)
      .optional()
      .default('ENTRAMBI'),

    // SECTION: PERSONALIZATION
    learningPreference: z
      .enum(learningPreferences)
      .optional()
      .default('APPRENDIMENTO_CONTINUO'),
    marketComparison: z
      .enum(marketComparisons)
      .optional()
      .default('SOLO_RILEVANTI'),

    // ONBOARDING STATUS
    onboardingCompleted: z.boolean().optional().default(false),
    onboardingStep: z.number().int().min(0).optional().default(0),
  })
  .refine((data) => data.oauthId || data.email, {
    message: 'OAuth ID or email is required.',
    path: ['oauthId'],
  });

// Schema for updating user preferences (all fields optional except identifiers)
export const updateUserPreferenceSchema = z.object({
  // SECTION: IDENTITY
  // Nullable in the database, and a blank field arrives as null.
  displayName: z.string().nullable().optional(),
  businessName: z.string().nullable().optional(),

  // SECTION: TONGUE (Language)
  contentLanguage: z.enum(contentLanguages).optional(),
  responseLanguage: z.enum(contentLanguages).optional(),

  // SECTION: BRAND STYLE
  toneOfVoice: z.enum(toneOfVoices).optional(),
  marketingKnowledge: z.enum(marketingKnowledges).optional(),

  // SECTION: INTERACTION
  responseLength: z.enum(responseLengths).optional(),
  emojiUsage: z.enum(emojiUsages).optional(),

  // SECTION: AI BEHAVIOR
  proactivityLevel: z.enum(proactivityLevels).optional(),
  questionStyle: z.enum(questionStyles).optional(),
  decisionHelpStyle: z.enum(decisionHelpStyles).optional(),

  // SECTION: PERSONALIZATION
  learningPreference: z.enum(learningPreferences).optional(),
  marketComparison: z.enum(marketComparisons).optional(),

  // ONBOARDING STATUS
  onboardingCompleted: z.boolean().optional(),
  onboardingStep: z.number().int().min(0).optional(),
});

// Type inference
export type CreateUserPreferenceDto = z.infer<
  typeof createUserPreferenceSchema
>;
export type UpdateUserPreferenceDto = z.infer<
  typeof updateUserPreferenceSchema
>;

// Export agent names for use in controller
export { agentNames };
