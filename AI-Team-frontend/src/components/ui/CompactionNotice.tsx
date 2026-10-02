"use client";

interface CompactionNoticeProps {
  sessionId: string | null;
  agent: string;
  chatId?: string | null;
  email?: string | null;
  refreshKey?: number;
}

/**
 * Compatibility shell for chat pages that previously rendered the retired
 * compaction policy UI. It intentionally performs no requests and renders
 * nothing.
 */
export function CompactionNotice(props: CompactionNoticeProps) {
  void props;
  return null;
}

export default CompactionNotice;
