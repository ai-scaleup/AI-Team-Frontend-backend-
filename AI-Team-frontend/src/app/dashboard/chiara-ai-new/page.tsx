"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Loader2, LogOut, MessageSquare, RefreshCw, Save, Wifi } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const CHIARA_PROXY_BASE = "/api/chiara-admin"
const MAX_PROMPT_LENGTH = 20000
const MIN_PROMPT_LENGTH = 10

type WhatsappConnectionStatus =
  | "disabled"
  | "starting"
  | "qr"
  | "authenticated"
  | "ready"
  | "auth_failure"
  | "disconnected"
  | "logging_out"
  | "logout_failed"
  | "initialization_failed"

type WhatsappQrState = {
  status: WhatsappConnectionStatus
  message: string
  qrImageDataUrl: string | null
  qrGeneratedAt: string | null
}

type ConversationRole = "user" | "assistant" | "system"

type ConversationMessage = {
  id: string
  phoneNumber: string
  role: ConversationRole
  content: string
  metadata: unknown | null
  createdAt: string
  updatedAt: string
}

type ConversationPhoneNumberSummary = {
  phoneNumber: string
  messageCount: number
  lastMessageAt: string | null
}

type ModelResponse = {
  model: string
  allowedModels: string[]
}

type PromptResponse = {
  prompt: string
}

type ConversationNumbersResponse = {
  phoneNumbers: ConversationPhoneNumberSummary[]
}

type ConversationResponse = {
  phoneNumber: string
  messages: ConversationMessage[]
}

async function chiaraRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${CHIARA_PROXY_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })

  const contentType = response.headers.get("Content-Type")
  const payload = contentType?.includes("application/json") ? await response.json() : await response.text()

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String(payload.error)
        : `Chiara backend returned ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

function formatTime(value: string | null) {
  if (!value) return "Not available"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Invalid date"
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatDateTime(value: string | null) {
  if (!value) return "No messages yet"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Invalid date"
  return date.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function humanizeStatus(status: WhatsappConnectionStatus | undefined) {
  if (!status) return "Loading"
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function statusBadgeClass(status: WhatsappConnectionStatus | undefined) {
  if (status === "ready" || status === "authenticated") {
    return "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
  }

  if (status === "starting" || status === "logging_out") {
    return "border-amber-400/40 bg-amber-500/15 text-amber-300"
  }

  if (status === "qr") {
    return "border-sky-400/40 bg-sky-500/15 text-sky-300"
  }

  if (
    status === "auth_failure" ||
    status === "disconnected" ||
    status === "initialization_failed" ||
    status === "logout_failed"
  ) {
    return "border-red-400/40 bg-red-500/15 text-red-300"
  }

  return "border-slate-500/50 bg-slate-500/15 text-slate-300"
}

function roleBadgeClass(role: ConversationRole) {
  if (role === "user") return "border-blue-400/40 bg-blue-500/15 text-blue-300"
  if (role === "assistant") return "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
  return "border-slate-500/40 bg-slate-500/15 text-slate-300"
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error"
}

function isVisiblePhoneNumber(phoneNumber: string) {
  return !phoneNumber.endsWith("@lid")
}

export default function ChiaraAiNewPage() {
  const [qrState, setQrState] = useState<WhatsappQrState | null>(null)
  const [qrLoading, setQrLoading] = useState(true)
  const [qrError, setQrError] = useState<string | null>(null)
  const [logoutLoading, setLogoutLoading] = useState(false)

  const [phoneNumbers, setPhoneNumbers] = useState<ConversationPhoneNumberSummary[]>([])
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [numbersLoading, setNumbersLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [numbersError, setNumbersError] = useState<string | null>(null)
  const [messagesError, setMessagesError] = useState<string | null>(null)

  const [allowedModels, setAllowedModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [modelLoading, setModelLoading] = useState(true)
  const [modelSaving, setModelSaving] = useState(false)
  const [modelFeedback, setModelFeedback] = useState<string | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)

  const [prompt, setPrompt] = useState("")
  const [promptLoading, setPromptLoading] = useState(true)
  const [promptSaving, setPromptSaving] = useState(false)
  const [promptFeedback, setPromptFeedback] = useState<string | null>(null)
  const [promptError, setPromptError] = useState<string | null>(null)

  const promptIsValid = prompt.length >= MIN_PROMPT_LENGTH && prompt.length <= MAX_PROMPT_LENGTH
  const selectedConversationCount = messages.length

  const fetchQrState = useCallback(async (silent = false) => {
    if (!silent) setQrLoading(true)
    setQrError(null)

    try {
      const data = await chiaraRequest<WhatsappQrState>("/whatsapp/qr")
      setQrState(data)
    } catch (error) {
      setQrError(messageFromError(error))
    } finally {
      if (!silent) setQrLoading(false)
    }
  }, [])

  const fetchPhoneNumbers = useCallback(async () => {
    setNumbersLoading(true)
    setNumbersError(null)

    try {
      const data = await chiaraRequest<ConversationNumbersResponse>("/conversations/phone-numbers?limit=200")
      const visibleNumbers = data.phoneNumbers.filter((item) => isVisiblePhoneNumber(item.phoneNumber))
      setPhoneNumbers(visibleNumbers)
      setSelectedPhoneNumber((current) => {
        if (current && !visibleNumbers.some((item) => item.phoneNumber === current)) {
          setMessages([])
          return null
        }
        return current
      })
    } catch (error) {
      setNumbersError(messageFromError(error))
    } finally {
      setNumbersLoading(false)
    }
  }, [])

  const fetchMessages = useCallback(async (phoneNumber: string) => {
    setMessagesLoading(true)
    setMessagesError(null)

    try {
      const data = await chiaraRequest<ConversationResponse>(
        `/conversations?phoneNumber=${encodeURIComponent(phoneNumber)}&limit=200`,
      )
      setMessages(data.messages.filter((message) => isVisiblePhoneNumber(message.phoneNumber)))
    } catch (error) {
      setMessages([])
      setMessagesError(messageFromError(error))
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  const fetchModel = useCallback(async () => {
    setModelLoading(true)
    setModelError(null)

    try {
      const data = await chiaraRequest<ModelResponse>("/model")
      setAllowedModels(data.allowedModels)
      setSelectedModel(data.model)
    } catch (error) {
      setModelError(messageFromError(error))
    } finally {
      setModelLoading(false)
    }
  }, [])

  const fetchPrompt = useCallback(async () => {
    setPromptLoading(true)
    setPromptError(null)

    try {
      const data = await chiaraRequest<PromptResponse>("/prompt")
      setPrompt(data.prompt)
    } catch (error) {
      setPromptError(messageFromError(error))
    } finally {
      setPromptLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchQrState()
    const interval = window.setInterval(() => {
      void fetchQrState(true)
    }, 3000)

    return () => window.clearInterval(interval)
  }, [fetchQrState])

  useEffect(() => {
    void fetchPhoneNumbers()
    void fetchModel()
    void fetchPrompt()
  }, [fetchPhoneNumbers, fetchModel, fetchPrompt])

  const selectConversation = async (phoneNumber: string) => {
    setSelectedPhoneNumber(phoneNumber)
    await fetchMessages(phoneNumber)
  }

  const logoutWhatsapp = async () => {
    setLogoutLoading(true)
    setQrError(null)

    try {
      const data = await chiaraRequest<WhatsappQrState>("/whatsapp/logout", { method: "POST" })
      setQrState(data)
    } catch (error) {
      setQrError(messageFromError(error))
    } finally {
      setLogoutLoading(false)
    }
  }

  const saveModel = async () => {
    if (!selectedModel) return

    setModelSaving(true)
    setModelFeedback(null)
    setModelError(null)

    try {
      const data = await chiaraRequest<ModelResponse>("/model", {
        method: "PATCH",
        body: JSON.stringify({ model: selectedModel }),
      })
      setSelectedModel(data.model)
      setAllowedModels(data.allowedModels)
      setModelFeedback("Model saved successfully.")
    } catch (error) {
      setModelError(messageFromError(error))
    } finally {
      setModelSaving(false)
    }
  }

  const savePrompt = async () => {
    if (!promptIsValid) return

    setPromptSaving(true)
    setPromptFeedback(null)
    setPromptError(null)

    try {
      const data = await chiaraRequest<PromptResponse>("/prompt", {
        method: "PATCH",
        body: JSON.stringify({ prompt }),
      })
      setPrompt(data.prompt)
      setPromptFeedback("Prompt saved successfully.")
    } catch (error) {
      setPromptError(messageFromError(error))
    } finally {
      setPromptSaving(false)
    }
  }

  const qrPlaceholder = useMemo(() => {
    if (qrLoading) return "Loading WhatsApp pairing state..."
    if (qrError) return qrError
    return qrState?.message || "No QR code is currently available."
  }, [qrError, qrLoading, qrState?.message])

  return (
    <main className="min-h-screen bg-[#020617] bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_26%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <Card className="border-white/10 bg-slate-950/75 shadow-2xl shadow-sky-950/20 backdrop-blur">
          <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">
                <Wifi className="h-4 w-4" />
                WhatsApp Admin
              </div>
              <CardTitle className="text-3xl font-bold text-white">Chiara — WhatsApp pairing</CardTitle>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide",
                  statusBadgeClass(qrState?.status),
                )}
              >
                {humanizeStatus(qrState?.status)}
              </span>
              <Button
                className="bg-sky-500 text-white hover:bg-sky-400"
                disabled={qrLoading}
                onClick={() => void fetchQrState()}
                size="sm"
              >
                {qrLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Refresh
              </Button>
              <Button
                disabled={logoutLoading || qrState?.status === "disabled"}
                onClick={() => void logoutWhatsapp()}
                size="sm"
                variant="destructive"
              >
                {logoutLoading ? <Loader2 className="animate-spin" /> : <LogOut />}
                Log out
              </Button>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 lg:grid-cols-[1fr_420px]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Status</p>
                <p className="text-lg font-semibold text-white">{qrState?.message || "Waiting for status..."}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Updated</p>
                <p className="text-lg font-semibold text-white">{formatTime(qrState?.qrGeneratedAt ?? null)}</p>
              </div>
              {qrError && (
                <div className="flex items-start gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200 sm:col-span-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {qrError}
                </div>
              )}
            </div>

            <div className="flex h-[380px] items-center justify-center rounded-3xl border border-white/10 bg-black/30 p-6">
              {qrState?.qrImageDataUrl ? (
                // The backend returns a base64 data URL that can be used directly.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="Chiara WhatsApp pairing QR code"
                  className="max-h-full max-w-full rounded-2xl bg-white p-3"
                  src={qrState.qrImageDataUrl}
                />
              ) : (
                <p className="max-w-xs text-center text-sm text-slate-400">{qrPlaceholder}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/75 shadow-xl shadow-slate-950/20 backdrop-blur">
          <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">User conversations</p>
              <CardTitle className="flex items-center gap-2 text-2xl text-white">
                <MessageSquare className="h-5 w-5" />
                Conversations
              </CardTitle>
            </div>
            <Button
              className="bg-sky-500 text-white hover:bg-sky-400"
              disabled={numbersLoading}
              onClick={() => void fetchPhoneNumbers()}
              size="sm"
            >
              {numbersLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Refresh numbers
            </Button>
          </CardHeader>

          <CardContent>
            <div className="grid min-h-[560px] overflow-hidden rounded-3xl border border-white/10 bg-black/20 lg:grid-cols-[280px_1fr]">
              <aside className="border-b border-white/10 bg-white/[0.03] lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Phone numbers</p>
                  <span className="text-xs text-slate-400">{phoneNumbers.length}</span>
                </div>
                <div className="custom-scrollbar h-[500px] overflow-y-auto p-2">
                  {numbersLoading ? (
                    <div className="flex h-40 items-center justify-center text-sky-300">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : numbersError ? (
                    <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                      {numbersError}
                    </p>
                  ) : phoneNumbers.length === 0 ? (
                    <p className="p-4 text-center text-sm text-slate-400">No visible phone numbers found.</p>
                  ) : (
                    phoneNumbers.map((item) => (
                      <button
                        className={cn(
                          "mb-2 w-full rounded-2xl border p-3 text-left transition hover:border-sky-400/50 hover:bg-sky-500/10",
                          selectedPhoneNumber === item.phoneNumber
                            ? "border-sky-400/60 bg-sky-500/15"
                            : "border-white/10 bg-white/[0.03]",
                        )}
                        key={item.phoneNumber}
                        onClick={() => void selectConversation(item.phoneNumber)}
                      >
                        <p className="truncate font-mono text-sm text-white">{item.phoneNumber}</p>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                          <span>{item.messageCount} messages</span>
                          <span>{formatDateTime(item.lastMessageAt)}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </aside>

              <section className="flex min-w-0 flex-col">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">
                    {selectedPhoneNumber ? selectedPhoneNumber : "Select a phone number"}
                  </p>
                  {messagesLoading && <Loader2 className="h-4 w-4 animate-spin text-sky-300" />}
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                  {!selectedPhoneNumber ? (
                    <div className="flex h-full min-h-[420px] items-center justify-center text-center text-slate-400">
                      Pick a phone number from the sidebar to load its conversation.
                    </div>
                  ) : messagesError ? (
                    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
                      {messagesError}
                    </div>
                  ) : messagesLoading ? (
                    <div className="flex h-full min-h-[420px] items-center justify-center text-sky-300">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full min-h-[420px] items-center justify-center text-center text-slate-400">
                      No messages found for this number.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {messages.map((message) => (
                        <article
                          className={cn(
                            "max-w-[86%] rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-sm",
                            message.role === "user" ? "ml-auto" : "mr-auto",
                          )}
                          key={message.id}
                        >
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                roleBadgeClass(message.role),
                              )}
                            >
                              {message.role}
                            </span>
                            <span className="text-xs text-slate-400">{formatDateTime(message.createdAt)}</span>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100">
                            {message.content}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-400">
                  {messagesError
                    ? `Error: ${messagesError}`
                    : selectedPhoneNumber
                      ? `${selectedPhoneNumber} — ${selectedConversationCount} loaded messages`
                      : "No conversation selected"}
                </div>
              </section>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/75 shadow-xl shadow-slate-950/20 backdrop-blur">
          <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">AI configuration</p>
              <CardTitle className="text-2xl text-white">Model</CardTitle>
            </div>
            <Button
              className="bg-emerald-500 text-white hover:bg-emerald-400"
              disabled={modelLoading || modelSaving || !selectedModel}
              onClick={() => void saveModel()}
              size="sm"
            >
              {modelSaving ? <Loader2 className="animate-spin" /> : <Save />}
              Save model
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {modelLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading models...
              </div>
            ) : (
              <select
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none ring-sky-400 transition focus:ring-2"
                onChange={(event) => setSelectedModel(event.target.value)}
                value={selectedModel}
              >
                {allowedModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            )}
            {modelFeedback && <p className="text-sm text-emerald-300">{modelFeedback}</p>}
            {modelError && <p className="text-sm text-red-300">{modelError}</p>}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-950/75 shadow-xl shadow-slate-950/20 backdrop-blur">
          <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-300">Database prompt</p>
              <CardTitle className="text-2xl text-white">User prompt</CardTitle>
            </div>
            <Button
              className="bg-emerald-500 text-white hover:bg-emerald-400"
              disabled={promptLoading || promptSaving || !promptIsValid}
              onClick={() => void savePrompt()}
              size="sm"
            >
              {promptSaving ? <Loader2 className="animate-spin" /> : <Save />}
              Save prompt
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {promptLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading prompt...
              </div>
            ) : (
              <textarea
                className="min-h-72 w-full resize-y rounded-xl border border-white/10 bg-slate-900 px-4 py-3 font-mono text-sm leading-6 text-white outline-none ring-sky-400 transition placeholder:text-slate-500 focus:ring-2"
                maxLength={MAX_PROMPT_LENGTH}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Write Chiara's system prompt..."
                value={prompt}
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className={promptIsValid ? "text-slate-400" : "text-amber-300"}>
                {prompt.length}/{MAX_PROMPT_LENGTH} characters
              </span>
              {!promptIsValid && !promptLoading && (
                <span className="text-amber-300">
                  Prompt must be between {MIN_PROMPT_LENGTH} and {MAX_PROMPT_LENGTH} characters.
                </span>
              )}
            </div>
            {promptFeedback && <p className="text-sm text-emerald-300">{promptFeedback}</p>}
            {promptError && <p className="text-sm text-red-300">{promptError}</p>}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
