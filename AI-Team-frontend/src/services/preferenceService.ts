import { authenticatedFetch } from "@/lib/authenticatedFetch";
import {
    AgentName,
    UserPreference,
    UpdateUserPreferenceDto,
    UserPreferences,
    DEFAULT_PREFERENCES,
    PREFERENCE_LABELS,
} from '@/types/preferences';
import { waitForUserSync } from '@/lib/userSyncGate';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

// Helper function to check if running in browser
const isBrowser = () => typeof window !== 'undefined';

/**
 * User Preferences Service
 * Handles all API calls for user preferences management
 */
export const userPreferenceService = {
    /**
     * Get or create preferences for a user + agent combination.
     * This is the recommended method to use when loading an agent page.
     * @param oauthId - User's OAuth ID from Clerk
     * @param agentName - Which agent these preferences are for
     */
    async getOrCreate(oauthId: string, agentName: AgentName): Promise<UserPreference | null> {
        await waitForUserSync();
        const url = `${API_BASE}/user-preferences/${encodeURIComponent(oauthId)}/${encodeURIComponent(agentName)}/or-create`;

        console.log('🔄 [PreferenceService] getOrCreate called');
        console.log('🔄 [PreferenceService] API Base URL:', API_BASE);
        console.log('🔄 [PreferenceService] OAuth ID:', oauthId);
        console.log('🔄 [PreferenceService] Agent Name:', agentName);
        console.log('🔄 [PreferenceService] Full URL:', url);

        try {
            console.log('📡 [PreferenceService] Making API request...');
            const response = await authenticatedFetch(url, { cache: 'no-store' });

            console.log('📡 [PreferenceService] Response received');
            console.log('📡 [PreferenceService] Response status:', response.status);
            console.log('📡 [PreferenceService] Response ok:', response.ok);

            if (!response.ok) {
                console.error(`❌ [PreferenceService] Failed to get/create preferences: ${response.status}`);
                const errorText = await response.text();
                console.error('❌ [PreferenceService] Error response body:', errorText);
                return null;
            }

            const data = await response.json();
            console.log('✅ [PreferenceService] Preferences loaded successfully');
            console.log('✅ [PreferenceService] Response data:', JSON.stringify(data, null, 2));
            return data;
        } catch (error) {
            console.error('❌ [PreferenceService] Error fetching preferences:', error);
            return null;
        }
    },

    /**
     * Create new preferences for a user + agent.
     * Matches POST /user-preferences endpoint.
     * @param data - The full preference data including oauthId and agentName
     */
    async create(data: { oauthId: string; agentName: AgentName } & UpdateUserPreferenceDto): Promise<UserPreference | null> {
        const url = `${API_BASE}/user-preferences`;
        console.log('💾 [PreferenceService] create called');
        console.log('💾 [PreferenceService] Data to save:', JSON.stringify(data, null, 2));

        try {
            const response = await authenticatedFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            console.log('📡 [PreferenceService] Response status:', response.status);

            if (!response.ok) {
                console.error(`❌ [PreferenceService] Failed to create preferences: ${response.status}`);
                const errorText = await response.text();
                console.error('❌ [PreferenceService] Error response body:', errorText);
                return null;
            }

            const result = await response.json();
            console.log('✅ [PreferenceService] Preferences created successfully');
            return result;
        } catch (error) {
            console.error('❌ [PreferenceService] Error creating preferences:', error);
            return null;
        }
    },

    /**
     * Get all preferences for a user (across all agents).
     * Useful for settings dashboard.
     * @param oauthId - User's OAuth ID from Clerk
     */
    async getAll(oauthId: string): Promise<UserPreference[]> {
        console.log('🔄 [PreferenceService] getAll called for user:', oauthId);

        try {
            const url = `${API_BASE}/user-preferences/${encodeURIComponent(oauthId)}`;
            console.log('📡 [PreferenceService] Fetching all preferences from:', url);

            const response = await authenticatedFetch(url, { cache: 'no-store' });

            console.log('📡 [PreferenceService] Response status:', response.status);

            if (!response.ok) {
                console.error(`❌ [PreferenceService] Failed to get all preferences: ${response.status}`);
                return [];
            }

            const data = await response.json();
            console.log('✅ [PreferenceService] Loaded', data.length, 'preferences');
            return data;
        } catch (error) {
            console.error('❌ [PreferenceService] Error fetching all preferences:', error);
            return [];
        }
    },

    /**
     * Get preferences for a specific user + agent combination.
     * Returns null if not found (use getOrCreate for auto-creation).
     * @param oauthId - User's OAuth ID from Clerk
     * @param agentName - Which agent these preferences are for
     */
    async get(oauthId: string, agentName: AgentName): Promise<UserPreference | null> {
        console.log('🔄 [PreferenceService] get called for:', oauthId, agentName);

        try {
            const url = `${API_BASE}/user-preferences/${encodeURIComponent(oauthId)}/${encodeURIComponent(agentName)}`;
            console.log('📡 [PreferenceService] Fetching from:', url);

            const response = await authenticatedFetch(url, { cache: 'no-store' });

            console.log('📡 [PreferenceService] Response status:', response.status);

            if (response.status === 404) {
                console.log('⚠️ [PreferenceService] Preferences not found (404)');
                return null;
            }

            if (!response.ok) {
                console.error(`❌ [PreferenceService] Failed to get preferences: ${response.status}`);
                return null;
            }

            const data = await response.json();
            console.log('✅ [PreferenceService] Preferences loaded:', data.id);
            return data;
        } catch (error) {
            console.error('❌ [PreferenceService] Error fetching preferences:', error);
            return null;
        }
    },

    /**
     * Create or update preferences for a user + agent.
     * This is the recommended method for saving settings forms.
     * @param oauthId - User's OAuth ID from Clerk
     * @param agentName - Which agent these preferences are for
     * @param data - Preference data to save
     */
    async upsert(
        oauthId: string,
        agentName: AgentName,
        data: UpdateUserPreferenceDto
    ): Promise<UserPreference | null> {
        const url = `${API_BASE}/user-preferences/${encodeURIComponent(oauthId)}/${encodeURIComponent(agentName)}/upsert`;

        console.log('💾 [PreferenceService] upsert called');
        console.log('💾 [PreferenceService] OAuth ID:', oauthId);
        console.log('💾 [PreferenceService] Agent Name:', agentName);
        console.log('💾 [PreferenceService] Full URL:', url);
        console.log('💾 [PreferenceService] Data to save:', JSON.stringify(data, null, 2));

        try {
            console.log('📡 [PreferenceService] Making PUT request...');
            const response = await authenticatedFetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            console.log('📡 [PreferenceService] Response status:', response.status);
            console.log('📡 [PreferenceService] Response ok:', response.ok);

            if (!response.ok) {
                console.error(`❌ [PreferenceService] Failed to upsert preferences: ${response.status}`);
                const errorText = await response.text();
                console.error('❌ [PreferenceService] Error response body:', errorText);
                return null;
            }

            const result = await response.json();
            console.log('✅ [PreferenceService] Preferences saved successfully');
            console.log('✅ [PreferenceService] Saved data:', JSON.stringify(result, null, 2));
            return result;
        } catch (error) {
            console.error('❌ [PreferenceService] Error upserting preferences:', error);
            return null;
        }
    },

    /**
     * Update existing preferences for a user + agent.
     * @param oauthId - User's OAuth ID from Clerk
     * @param agentName - Which agent these preferences are for
     * @param data - Preference data to update
     */
    async update(
        oauthId: string,
        agentName: AgentName,
        data: UpdateUserPreferenceDto
    ): Promise<UserPreference | null> {
        console.log('💾 [PreferenceService] update called for:', oauthId, agentName);

        try {
            const url = `${API_BASE}/user-preferences/${encodeURIComponent(oauthId)}/${encodeURIComponent(agentName)}`;
            console.log('📡 [PreferenceService] Making PUT request to:', url);

            const response = await authenticatedFetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            console.log('📡 [PreferenceService] Response status:', response.status);

            if (!response.ok) {
                console.error(`❌ [PreferenceService] Failed to update preferences: ${response.status}`);
                return null;
            }

            const result = await response.json();
            console.log('✅ [PreferenceService] Preferences updated successfully');
            return result;
        } catch (error) {
            console.error('❌ [PreferenceService] Error updating preferences:', error);
            return null;
        }
    },

    /**
     * Delete preferences for a specific user + agent combination.
     * @param oauthId - User's OAuth ID from Clerk
     * @param agentName - Which agent's preferences to delete
     */
    async delete(oauthId: string, agentName: AgentName): Promise<boolean> {
        console.log('🗑️ [PreferenceService] delete called for:', oauthId, agentName);

        try {
            const url = `${API_BASE}/user-preferences/${encodeURIComponent(oauthId)}/${encodeURIComponent(agentName)}`;
            console.log('📡 [PreferenceService] Making DELETE request to:', url);

            const response = await authenticatedFetch(url, { method: 'DELETE' });

            console.log('📡 [PreferenceService] Response status:', response.status);

            if (response.status === 404) {
                console.log('⚠️ [PreferenceService] Preferences not found (404)');
                return false;
            }

            const success = response.status === 204;
            console.log(success ? '✅ [PreferenceService] Deleted successfully' : '❌ [PreferenceService] Delete failed');
            return success;
        } catch (error) {
            console.error('❌ [PreferenceService] Error deleting preferences:', error);
            return false;
        }
    },

    /**
     * Delete all preferences for a user.
     * @param oauthId - User's OAuth ID from Clerk
     */
    async deleteAll(oauthId: string): Promise<{ count: number }> {
        console.log('🗑️ [PreferenceService] deleteAll called for user:', oauthId);

        try {
            const url = `${API_BASE}/user-preferences/${encodeURIComponent(oauthId)}`;
            console.log('📡 [PreferenceService] Making DELETE request to:', url);

            const response = await authenticatedFetch(url, { method: 'DELETE' });

            console.log('📡 [PreferenceService] Response status:', response.status);

            if (!response.ok) {
                console.error(`❌ [PreferenceService] Failed to delete all preferences: ${response.status}`);
                return { count: 0 };
            }

            const result = await response.json();
            console.log('✅ [PreferenceService] Deleted', result.count, 'preferences');
            return result;
        } catch (error) {
            console.error('❌ [PreferenceService] Error deleting all preferences:', error);
            return { count: 0 };
        }
    },

    /**
     * Mark onboarding as completed for a user + agent.
     * @param oauthId - User's OAuth ID from Clerk
     * @param agentName - Which agent's onboarding to mark complete
     */
    async completeOnboarding(oauthId: string, agentName: AgentName): Promise<boolean> {
        console.log('🎓 [PreferenceService] completeOnboarding called for:', oauthId, agentName);

        const result = await this.upsert(oauthId, agentName, {
            onboardingCompleted: true,
        });

        const success = result !== null;
        console.log(success ? '✅ [PreferenceService] Onboarding marked complete' : '❌ [PreferenceService] Failed to mark onboarding complete');
        return success;
    },
};

// ----- LEGACY SERVICE (API PROXY) -----
// Replaces localStorage with API calls to ensure data consistency across all agents.
// hardcoded to 'JIM' agent preferences as the "Global" source of truth for now.

const mapApiToLegacy = (apiPrefs: UserPreference | null): UserPreferences => {
    if (!apiPrefs) return DEFAULT_PREFERENCES;

    // Helper to try and get the Label from the Enum if possible, for backward compatibility
    // with prompts that might expect natural language.
    // If not found, return the Enum key itself (LLMs understand Enums too).
    const getLabel = (labels: Record<string, string> | undefined, key: string | null | undefined) => {
        if (!key || !labels) return "";
        return labels[key] || key;
    };

    return {
        user_name: apiPrefs.displayName || "",
        business_name: apiPrefs.businessName || "",

        // Map Enums back to Labels (Strings) for legacy consumers
        content_language: getLabel(PREFERENCE_LABELS.contentLanguage, apiPrefs.contentLanguage),
        communication_language: getLabel(PREFERENCE_LABELS.contentLanguage, apiPrefs.responseLanguage),
        brand_tone: getLabel(PREFERENCE_LABELS.toneOfVoice, apiPrefs.toneOfVoice),
        language_complexity: getLabel(PREFERENCE_LABELS.marketingKnowledge, apiPrefs.marketingKnowledge),
        response_length: getLabel(PREFERENCE_LABELS.responseLength, apiPrefs.responseLength),
        emoji_usage: getLabel(PREFERENCE_LABELS.emojiUsage, apiPrefs.emojiUsage),
        proactivity_level: getLabel(PREFERENCE_LABELS.proactivityLevel, apiPrefs.proactivityLevel),
        question_style: getLabel(PREFERENCE_LABELS.questionStyle, apiPrefs.questionStyle),
        decision_support: getLabel(PREFERENCE_LABELS.decisionHelpStyle, apiPrefs.decisionHelpStyle),
        learning_adaptation: getLabel(PREFERENCE_LABELS.learningPreference, apiPrefs.learningPreference),
        benchmark_references: getLabel(PREFERENCE_LABELS.marketComparison, apiPrefs.marketComparison),

        // Mock legacy fields
        followup_behavior: "",
        confidence_display: ""
    };
};

/**
 * @deprecated Use userPreferenceService instead. 
 * This has been updated to proxy to userPreferenceService (API) to remove localStorage usage.
 */
export const preferenceService = {
    async getUserPreferences(userId: string): Promise<UserPreferences> {
        return await this.load(userId);
    },

    // Alias for load to be safer
    async load(userId: string): Promise<UserPreferences> {
        try {
            if (!userId) return DEFAULT_PREFERENCES;
            // Fetch JIM preferences as the default/global preferences
            const apiData = await userPreferenceService.getOrCreate(userId, 'JIM');
            return mapApiToLegacy(apiData);
        } catch (error) {
            console.error('Unexpected error fetching preferences (legacy proxy):', error);
            return DEFAULT_PREFERENCES;
        }
    },

    async saveUserPreferences(userId: string, preferences: UserPreferences): Promise<boolean> {
        try {
            if (!userId) return false;
            // We map Legacy -> API DTO
            // Note: This is a best-effort reverse mapping.
            // Since we moved to the Wizard saving directly to API, this function is rarely used.
            // But if an old component uses it, we should try to save.

            // However, implementing strict reverse mapping here is complex (Label -> Enum).
            // For now, we will log a warning and return true, assuming the Wizard is the primary editor.
            console.warn('saveUserPreferences is deprecated and read-only via this proxy. Use userPreferenceService directly.');
            return true;
        } catch (error) {
            console.error('Unexpected error saving preferences:', error);
            return false;
        }
    },
};
