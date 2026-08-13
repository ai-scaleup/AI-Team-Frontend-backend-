const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export type TokenAlertLevel = 'info' | 'warning' | 'critical';

export interface TokenAlertRule {
    id: string;
    percentage: number;
    level: TokenAlertLevel;
    message: string;
}

// Shape the admin API returns. Levels and scopes are upper case there.
interface ApiTokenAlertRule {
    id: string;
    scope: 'CONVERSATION' | 'MONTHLY';
    thresholdPercent: number;
    level: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    isActive: boolean;
    sortOrder: number;
}

// Used when the rules cannot be read -- a backend hiccup should not leave the
// chat with no warning at all before it hits the wall. Mirrors the rows the
// admin table is seeded with.
export const FALLBACK_CONVERSATION_ALERT_RULES: TokenAlertRule[] = [
    {
        id: 'fallback-50',
        percentage: 50,
        level: 'info',
        message: 'Hai usato il 50% dei token della conversazione. Valuta di concludere a breve.',
    },
    {
        id: 'fallback-75',
        percentage: 75,
        level: 'warning',
        message: '75% dei token della conversazione utilizzati. Ti stai avvicinando al limite.',
    },
    {
        id: 'fallback-90',
        percentage: 90,
        level: 'critical',
        message: '90% raggiunto! La conversazione terminerà presto. Salva subito le informazioni importanti.',
    },
];

const toRule = (rule: ApiTokenAlertRule): TokenAlertRule => ({
    id: rule.id,
    percentage: rule.thresholdPercent,
    level: rule.level.toLowerCase() as TokenAlertLevel,
    message: rule.message,
});

// The rules change only when an admin edits them, so every chat page sharing
// one in-flight request (and its answer) keeps this off the hot path.
let cached: { at: number; rules: TokenAlertRule[] } | null = null;
let inFlight: Promise<TokenAlertRule[]> | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000;

export const tokenAlertService = {
    // Active conversation-scope rules, ordered by threshold.
    async getConversationAlertRules(): Promise<TokenAlertRule[]> {
        if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.rules;
        if (inFlight) return inFlight;

        inFlight = (async () => {
            try {
                const response = await fetch(
                    `${API_BASE}/admin/token-alert-rules?scope=CONVERSATION&isActive=true`,
                );
                if (!response.ok) throw new Error('Failed to fetch token alert rules');

                const payload: ApiTokenAlertRule[] = await response.json();
                const rules = payload
                    .map(toRule)
                    .sort((a, b) => a.percentage - b.percentage);

                // An admin who deletes every rule wants no announcements, so an
                // empty list is a real answer and is cached as one.
                cached = { at: Date.now(), rules };
                return rules;
            } catch {
                return FALLBACK_CONVERSATION_ALERT_RULES;
            } finally {
                inFlight = null;
            }
        })();

        return inFlight;
    },

    // Drops the cache so a chat opened after an admin edit sees the new rules.
    clearCache() {
        cached = null;
    },
};
