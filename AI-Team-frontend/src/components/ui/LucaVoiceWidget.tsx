"use client"

import { useState, useEffect } from "react"
import { useScribe } from "@elevenlabs/react"
import { Mic, MicOff } from "lucide-react"

interface Message {
    id: string
    role: 'user' | 'assistant'
    text: string
    timestamp: number
}

export default function LucaVoiceWidget() {
    const [audioLevel, setAudioLevel] = useState(0)
    const [error, setError] = useState<string>("")
    const [isConnecting, setIsConnecting] = useState(false)
    const [messages, setMessages] = useState<Message[]>([])
    const [isAIThinking, setIsAIThinking] = useState(false)
    const [isAISpeaking, setIsAISpeaking] = useState(false)

    const scribe = useScribe({
        modelId: "scribe_v2_realtime",
        onPartialTranscript: (data) => {
            console.log("Partial:", data.text)
        },
        onCommittedTranscript: async (data) => {
            console.log("Committed:", data.text)
            if (data.text && data.text.trim()) {
                await handleUserMessage(data.text)
            }
        },
        onError: (error: any) => {
            console.error("Scribe error:", error)
            setError(error?.message || error || "Si è verificato un errore")
        },
    })

    //Animate audio bars
    useEffect(() => {
        if (!scribe.isConnected || isAISpeaking) {
            setAudioLevel(0)
            return
        }

        const interval = setInterval(() => {
            setAudioLevel(Math.random() * 100)
        }, 100)

        return () => clearInterval(interval)
    }, [scribe.isConnected, isAISpeaking])

    const fetchToken = async () => {
        const response = await fetch('/api/scribe-token')
        if (!response.ok) {
            throw new Error('Token generation failed')
        }
        const data = await response.json()
        return data.token
    }

    const checkMicrophonePermission = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Il tuo browser non supporta l\'accesso al microfono')
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            }
        })

        stream.getTracks().forEach(track => track.stop())
        return true
    }

    const handleStart = async () => {
        setIsConnecting(true)
        setError("")

        try {
            await checkMicrophonePermission()
            const token = await fetchToken()

            await scribe.connect({
                token,
                commitStrategy: 'vad' as any,
                vadSilenceThresholdSecs: 1.0,
                microphone: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            })
        } catch (err: any) {
            console.error("Connection error:", err)
            setError(err.message || "Impossibile avviare la connessione")
        } finally {
            setIsConnecting(false)
        }
    }

    const handleStop = async () => {
        await scribe.disconnect()
        setAudioLevel(0)
    }

    const handleUserMessage = async (text: string) => {
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            text,
            timestamp: Date.now()
        }
        setMessages(prev => [...prev, userMessage])

        setIsAIThinking(true)
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    conversationHistory: messages.slice(-6).map(m => ({
                        role: m.role,
                        content: m.text
                    }))
                })
            })

            if (!response.ok) {
                throw new Error('Errore nella risposta del server')
            }

            const data = await response.json()
            const aiResponse = data.response

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: aiResponse,
                timestamp: Date.now()
            }
            setMessages(prev => [...prev, aiMessage])

            // Speak the response
            await speakText(aiResponse)

        } catch (err: any) {
            console.error('AI response error:', err)
            setError(err.message || 'Errore nella risposta AI')
        } finally {
            setIsAIThinking(false)
        }
    }

    const speakText = async (text: string) => {
        if (!text || text.trim().length === 0) return

        setIsAISpeaking(true)
        try {
            const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js")

            const apiKey = process.env.NEXT_PUBLIC_ELEVEN_LABS_API_KEY

            const client = new ElevenLabsClient({
                apiKey: apiKey,
            })

            const voiceId = 'XrExE9yKIg1WjnnlVkGX' // Matilda

            const audioStream = await client.textToSpeech.stream(voiceId, {
                text: text,
                modelId: "eleven_turbo_v2_5",
                voiceSettings: {
                    stability: 0.5,
                    similarityBoost: 0.75,
                },
            })

            const reader = audioStream.getReader()
            const chunks: Uint8Array[] = []

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                if (value) chunks.push(value)
            }

            const audioBlob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' })
            const audioUrl = URL.createObjectURL(audioBlob)
            const audio = new Audio(audioUrl)

            audio.onended = () => {
                setIsAISpeaking(false)
                URL.revokeObjectURL(audioUrl)
            }

            audio.onerror = () => {
                setIsAISpeaking(false)
                URL.revokeObjectURL(audioUrl)
            }

            await audio.play()

        } catch (err: any) {
            console.error('TTS error:', err)
            setIsAISpeaking(false)
        }
    }

    const bars = Array.from({ length: 7 }, (_, i) => i)

    return (
        <div className="flex flex-col items-center justify-center relative py-12 lg:py-0 w-full">
            {/* Microphone button */}
            <div className="relative z-10 mb-12 group/mic">
                <div className="absolute inset-0 bg-[#0284c7]/20 dark:bg-[#0ea5e9]/30 rounded-full animate-ping scale-150 blur-xl opacity-20"></div>
                <div className="absolute inset-0 bg-[#0284c7]/20 dark:bg-[#0284c7]/30 rounded-full animate-pulse-slow scale-125 blur-lg animation-delay-2000"></div>

                <button
                    onClick={scribe.isConnected ? handleStop : handleStart}
                    disabled={isConnecting || isAISpeaking}
                    className={`w-64 h-64 btn-liquid rounded-full flex flex-col items-center justify-center relative z-20 border-8 transition transform ${scribe.isConnected
                        ? "bg-gradient-to-br from-red-500 to-red-600 shadow-[0_0_80px_-20px_rgba(239,68,68,0.8)] border-white/30"
                        : "bg-gradient-to-br from-[#0284c7] to-[#0ea5e9] shadow-[0_0_80px_-20px_rgba(14,165,233,0.8)] border-white/10"
                        } ${(isConnecting || isAISpeaking) ? "opacity-50 cursor-not-allowed" : "hover:scale-110 cursor-pointer hover:border-white/50"}`}
                >
                    {isAISpeaking && (
                        <div className="absolute inset-0 rounded-full bg-green-400 animate-pulse opacity-30" />
                    )}

                    {scribe.isConnected ? (
                        <MicOff size={80} className="text-white mb-4 drop-shadow-lg" />
                    ) : (
                        <Mic size={80} className="text-white mb-4 drop-shadow-lg" />
                    )}

                    <span className="text-white font-bold tracking-widest uppercase text-sm">
                        {isConnecting ? "Connessione..." :
                            isAISpeaking ? "Luca Parla..." :
                                scribe.isConnected ? "Stop" : "Parla con Luca AI"}
                    </span>
                </button>
            </div>

            {/* Audio visualization */}
            <div className="flex items-end justify-center space-x-3 h-32 w-full max-w-md">
                {bars.map((i) => {
                    const height = scribe.isConnected && !isAISpeaking
                        ? Math.max(20, (Math.sin(Date.now() / 200 + i) + 1) * 50 + audioLevel / 3)
                        : isAISpeaking
                            ? Math.max(30, Math.sin(Date.now() / 150 + i * 0.8) * 40 + 50)
                            : 20

                    return (
                        <div
                            key={i}
                            className={`w-4 rounded-full transition-all duration-100 ${isAISpeaking
                                ? 'bg-gradient-to-t from-green-600 to-green-400'
                                : 'bg-gradient-to-t from-[#0284c7] via-[#0ea5e9] to-white'
                                } shadow-[0_0_15px_rgba(14,165,233,0.5)]`}
                            style={{
                                height: `${height}%`,
                                opacity: (scribe.isConnected || isAISpeaking) ? 0.8 + (height / 200) : 0.3,
                            }}
                        />
                    )
                })}
            </div>

            {/* Status indicator */}
            <div className="mt-10 inline-flex items-center px-6 py-3 bg-white/50 dark:bg-black/40 rounded-full border border-gray-200 dark:border-[#0ea5e9]/20 backdrop-blur-md shadow-sm">
                <span className="flex h-3 w-3 relative mr-4">
                    <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isAISpeaking ? "bg-green-400 animate-ping" :
                        scribe.isConnected ? "bg-cyan-400 animate-ping" : "bg-gray-400"
                        }`}></span>
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isAISpeaking ? "bg-green-500" :
                        scribe.isConnected ? "bg-cyan-500" : "bg-gray-500"
                        }`}></span>
                </span>
                <p className="text-lg font-semibold tracking-wide text-gray-800 dark:text-white">
                    {isAIThinking ? "Luca sta pensando..." :
                        isAISpeaking ? "Luca sta parlando..." :
                            scribe.isConnected ? "In ascolto..." : "Interfaccia Vocale Attiva"}
                </p>
            </div>

            {/* Error message */}
            {error && (
                <div className="mt-6 px-6 py-4 bg-red-500/20 border border-red-500/30 rounded-lg backdrop-blur-lg max-w-sm">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
            )}
        </div>
    )
}
