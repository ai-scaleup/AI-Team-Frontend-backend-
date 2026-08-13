"use client";

import { useEffect, useState } from "react";
import { conversationService } from "@/services/conversationService";
import {
    TokenAlertRule,
    tokenAlertService,
} from "@/services/tokenAlertService";
import type { Conversation } from "@/types/conversation";

// Reads the open conversation's token budget and decides what the composer
// should do about it: which announcer message to show, and whether the
// conversation has run out and must be replaced by a new one.
//
// The counters live on the conversation row and are written by the n8n
// workflow after each run, so this only ever reads them. The thresholds come
// from the admin panel's Token Usage Alerts table.

// The workflow writes the new totals after its run has finished, which lands
// somewhere after the reply has finished streaming into the chat. Reading once
// on the way out would usually catch the old numbers, so this reads a few
// times over the following seconds and keeps the last answer.
const REFRESH_DELAYS_MS = [0, 3000, 8000];

// The header badge and the composer gate both want these counters and their
// timers fire together, so a read already on the wire is shared rather than
// duplicated.
const inFlightReads = new Map<string, Promise<Conversation>>();

const readConversation = (conversationId: string): Promise<Conversation> => {
    const existing = inFlightReads.get(conversationId);
    if (existing) return existing;

    const request = conversationService
        .getConversationById(conversationId)
        .finally(() => {
            inFlightReads.delete(conversationId);
        });

    inFlightReads.set(conversationId, request);
    return request;
};

export type ConversationTokenGate = {
    limit: number | null;
    used: number;
    left: number | null;
    // 0-100, clamped. 0 when no limit is assigned.
    percent: number;
    // Highest crossed threshold, or null below the lowest one.
    activeAlert: TokenAlertRule | null;
    // The budget is spent -- the composer must stop accepting messages.
    isLimitReached: boolean;
    // A read has landed for this conversation. Until it has, the gate stays
    // open so a slow network cannot lock someone out of a fresh chat.
    isLoaded: boolean;
};

const EMPTY_GATE: ConversationTokenGate = {
    limit: null,
    used: 0,
    left: null,
    percent: 0,
    activeAlert: null,
    isLimitReached: false,
    isLoaded: false,
};

export function useConversationTokenGate(
    conversationId: string | null | undefined,
    // Bump when a reply completes to re-read the counters.
    refreshKey: number = 0,
): ConversationTokenGate {
    const [rules, setRules] = useState<TokenAlertRule[]>([]);
    const [counters, setCounters] = useState<{
        conversationId: string;
        limit: number | null;
        used: number;
        left: number | null;
    } | null>(null);

    useEffect(() => {
        let cancelled = false;

        tokenAlertService
            .getConversationAlertRules()
            .then((loaded) => {
                if (!cancelled) setRules(loaded);
            })
            .catch(() => {
                // The service already falls back; nothing left to handle.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!conversationId) {
            setCounters(null);
            return;
        }

        let cancelled = false;

        const load = async () => {
            try {
                const conversation = await readConversation(conversationId);
                if (cancelled) return;

                const used = conversation.tokenUsed ?? 0;
                const limit = conversation.tokenLimit ?? null;

                setCounters({
                    conversationId,
                    limit,
                    used,
                    // tokenLeft is stored alongside the other two, but a
                    // conversation that has never been through the workflow
                    // only has a limit, so fall back to deriving it.
                    left:
                        conversation.tokenLeft ??
                        (limit != null ? Math.max(limit - used, 0) : null),
                });
            } catch {
                // A chat that exists only in local state has no row to read
                // yet, and a backend hiccup must not wall off the composer.
            }
        };

        const timers = REFRESH_DELAYS_MS.map((delay) => setTimeout(load, delay));

        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
        };
    }, [conversationId, refreshKey]);

    // Counters left over from the previous chat must not gate this one.
    if (!conversationId || !counters || counters.conversationId !== conversationId) {
        return EMPTY_GATE;
    }

    const { limit, used, left } = counters;

    // No limit assigned means no ceiling to hit.
    if (limit == null || limit <= 0) {
        return { ...EMPTY_GATE, used, isLoaded: true };
    }

    const percent = Math.min(100, Math.max(0, (used / limit) * 100));
    const isLimitReached = (left != null && left <= 0) || percent >= 100;

    const activeAlert =
        [...rules]
            .sort((a, b) => b.percentage - a.percentage)
            .find((rule) => percent >= rule.percentage) ?? null;

    return {
        limit,
        used,
        left,
        percent,
        activeAlert,
        isLimitReached,
        isLoaded: true,
    };
}
