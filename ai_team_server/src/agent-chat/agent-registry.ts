// src/agent-chat/agent-registry.ts
import { Logger } from '@nestjs/common';

/**
 * Slug used by the dashboard pages -> environment variable holding that
 * agent's n8n webhook URL. The names match AI-Team-frontend/.env.example one
 * to one, so the values move across unchanged.
 *
 * The URLs live here, on the backend, and nowhere else: the browser only ever
 * sees POST /agents/:slug/chat.
 */
export const AGENT_REGISTRY: Readonly<Record<string, string>> = {
  'aladino-ai': 'ALADINO_AI_N8N_ENDPOINT',
  'alex-ai': 'ALEX_AI_N8N_ENDPOINT',
  'dan-ai': 'DAN_AI_N8N_ENDPOINT',
  'daniele-ai': 'DANIELE_AI_N8N_ENDPOINT',
  'jim-ai': 'JIM_AI_N8N_ENDPOINT',
  'lara-ai': 'LARA_AI_N8N_ENDPOINT',
  'laura-ai': 'LAURA_AI_N8N_ENDPOINT',
  'max-ai': 'MAX_AI_N8N_ENDPOINT',
  'mike-ai': 'MIKE_AI_N8N_ENDPOINT',
  'niko-ai': 'NIKO_AI_N8N_ENDPOINT',
  'roberta-ai': 'ROBERTA_AI_N8N_ENDPOINT',
  'simone-ai': 'SIMONE_AI_N8N_ENDPOINT',
  'sofia-ai': 'SOFIA_AI_N8N_ENDPOINT',
  'tony-ai': 'TONY_AI_N8N_ENDPOINT',
  'valentina-ai': 'VALENTINA_AI_N8N_ENDPOINT',
  'sara-ai': 'SARA_AI_N8N_ENDPOINT',
  'test-aladino-ai': 'TEST_ALADINO_AI_N8N_ENDPOINT',
  'test-alex-ai': 'TEST_ALEX_AI_N8N_ENDPOINT',
  'test-daniele-ai': 'TEST_DANIELE_AI_N8N_ENDPOINT',
  'test-jim-ai': 'TEST_JIM_AI_N8N_ENDPOINT',
  'test-lara-ai': 'TEST_LARA_AI_N8N_ENDPOINT',
  'test-mike-ai': 'TEST_MIKE_AI_N8N_ENDPOINT',
  'test-niko-ai': 'TEST_NIKO_AI_N8N_ENDPOINT',
  'test-simone-ai': 'TEST_SIMONE_AI_N8N_ENDPOINT',
  'test-tony-ai': 'TEST_TONY_AI_N8N_ENDPOINT',
  'test-valentina-ai': 'TEST_VALENTINA_AI_N8N_ENDPOINT',
  'giulia-widget': 'GIULIA_WIDGET_N8N_ENDPOINT',
  'jennifer-widget': 'JENNIFER_WIDGET_N8N_ENDPOINT',
};

/**
 * Agents whose chat history is served by a second n8n webhook. Reached through
 * GET /agents/:slug/history; the slug is the same one used for chat.
 */
export const AGENT_HISTORY_REGISTRY: Readonly<Record<string, string>> = {
  'test-valentina-ai': 'TEST_VALENTINA_AI_HISTORY_N8N_ENDPOINT',
};

/**
 * The floating widgets are shown to every signed-in dashboard user, so they
 * carry no assignment and skip the entitlement check.
 */
export const UNRESTRICTED_SLUGS: ReadonlySet<string> = new Set([
  'giulia-widget',
  'jennifer-widget',
]);

/**
 * Reports every registry entry whose variable is unset. Called once at boot so
 * a misconfigured deploy shows up in the logs immediately, not on the first
 * chat with that agent.
 */
export function reportMissingAgentEndpoints(logger: Logger): string[] {
  const missing = [
    ...Object.values(AGENT_REGISTRY),
    ...Object.values(AGENT_HISTORY_REGISTRY),
  ].filter((envVar) => !process.env[envVar]?.trim());

  if (missing.length > 0) {
    logger.warn(
      `${missing.length} agent endpoint(s) not configured; those agents answer 503 until set: ${missing.join(', ')}`,
    );
  }
  if (!process.env.N8N_SHARED_SECRET?.trim()) {
    logger.warn(
      'N8N_SHARED_SECRET is not set; calls to n8n go out without X-Agent-Secret',
    );
  }
  return missing;
}
