"use client"

import { useState, useEffect, useRef } from "react"
import { useScribe } from "@elevenlabs/react"
import { Mic, MicOff, Volume2, VolumeX, Trash2 } from "lucide-react"

interface Message {
    id: string
    role: 'user' | 'assistant'
    text: string
    timestamp: number
}

export default function LucaAIPage() {
    const [theme, setTheme] = useState<"dark">("dark")
    const [isConnecting, setIsConnecting] = useState(false)
    const [error, setError] = useState<string>("")
    const [audioLevel, setAudioLevel] = useState(0)
    const [messages, setMessages] = useState<Message[]>([])
    const [isAIThinking, setIsAIThinking] = useState(false)
    const [isAISpeaking, setIsAISpeaking] = useState(false)
    const [isTTSEnabled, setIsTTSEnabled] = useState(true)

    const audioContextRef = useRef<AudioContext | null>(null)
    const audioQueueRef = useRef<AudioBuffer[]>([])
    const isPlayingRef = useRef(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

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

    // Auto-scroll to latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" })
    }, [messages])

    // Simulate audio level animation
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
        try {
            const response = await fetch('/api/scribe-token')
            if (!response.ok) {
                const errorData = await response.json()
                console.error('Token API error:', errorData)
                throw new Error(errorData.error || 'Impossibile ottenere il token')
            }
            const data = await response.json()
            console.log('Token fetched successfully')
            return data.token
        } catch (err: any) {
            console.error('Token fetch error:', err)
            throw new Error(err.message || 'Errore di connessione al server')
        }
    }

    const checkMicrophonePermission = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Il tuo browser non supporta l\'accesso al microfono')
            }

            console.log('Checking microphone access...')

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            })

            console.log('Microphone access granted:', stream)

            const devices = await navigator.mediaDevices.enumerateDevices()
            const audioDevices = devices.filter(device => device.kind === 'audioinput')
            console.log('Available microphones:', audioDevices)

            if (audioDevices.length === 0) {
                throw new Error('Nessun microfono trovato. Collega un microfono e riprova.')
            }

            stream.getTracks().forEach(track => track.stop())

            return true
        } catch (err: any) {
            console.error('Microphone permission error:', err)

            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                throw new Error('Permesso microfono negato. Abilita il microfono nelle impostazioni del browser.')
            } else if (err.name === 'NotFoundError') {
                throw new Error('Microfono non trovato. Assicurati che un microfono sia collegato.')
            } else if (err.name === 'NotReadableError') {
                throw new Error('Impossibile accedere al microfono. Potrebbe essere in uso da un\'altra applicazione.')
            } else {
                throw err
            }
        }
    }

    const handleStart = async () => {
        setIsConnecting(true)
        setError("")

        try {
            console.log('Starting connection process...')

            await checkMicrophonePermission()
            console.log('Microphone check passed')

            const token = await fetchToken()
            console.log('Token received, connecting to ScribeRealtime...')

            await scribe.connect({
                token,
                commitStrategy: 'vad' as any, // Use Voice Activity Detection to auto-commit
                vadSilenceThresholdSecs: 1.0, // Commit after 1 second of silence
                microphone: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            })

            console.log('Successfully connected to ScribeRealtime')
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
        // Add user message
        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            text,
            timestamp: Date.now()
        }
        setMessages(prev => [...prev, userMessage])

        // Get AI response
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

            // Add AI message
            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: aiResponse,
                timestamp: Date.now()
            }
            setMessages(prev => [...prev, aiMessage])

            // Convert to speech if enabled
            if (isTTSEnabled) {
                await speakText(aiResponse)
            }

        } catch (err: any) {
            console.error('AI response error:', err)
            setError(err.message || 'Errore nella risposta AI')
        } finally {
            setIsAIThinking(false)
        }
    }

    const speakText = async (text: string) => {
        if (!text || text.trim().length === 0) return

        console.log('🔊 speakText called with text:', text)
        setIsAISpeaking(true)
        try {
            const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js")
            console.log('✅ ElevenLabsClient imported')

            const apiKey = process.env.NEXT_PUBLIC_ELEVEN_LABS_API_KEY
            console.log('🔑 API Key exists:', !!apiKey)

            const client = new ElevenLabsClient({
                apiKey: apiKey,
            })
            console.log('✅ Client created')

            // Use Matilda voice (multilingual, works well with Italian)
            const voiceId = 'XrExE9yKIg1WjnnlVkGX'
            console.log('🎤 Using voice ID:', voiceId)

            // Call the stream method
            console.log('📡 Calling ElevenLabs TTS API...')
            const audioStream = await client.textToSpeech.stream(voiceId, {
                text: text,
                modelId: "eleven_turbo_v2_5", // Note: modelId not model_id
                voiceSettings: {
                    stability: 0.5,
                    similarityBoost: 0.75,
                },
            })
            console.log('✅ Audio stream received')

            // Read the stream properly
            const reader = audioStream.getReader()
            const chunks: Uint8Array[] = []

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                // Collect the audio chunks
                if (value) chunks.push(value)
            }
            console.log('✅ Collected', chunks.length, 'audio chunks')

            // Combine chunks into a single blob
            // Convert chunks to ensure proper ArrayBuffer type for Blob constructor
            const blobParts = chunks.map(chunk => new Uint8Array(chunk.buffer.slice(0)))
            const audioBlob = new Blob(blobParts as BlobPart[], { type: 'audio/mpeg' })
            console.log('✅ Audio blob created, size:', audioBlob.size, 'bytes')

            const audioUrl = URL.createObjectURL(audioBlob)
            console.log('✅ Audio URL created:', audioUrl)

            const audio = new Audio(audioUrl)
            console.log('✅ Audio element created')

            audio.onended = () => {
                console.log('✅ Audio playback ended')
                setIsAISpeaking(false)
                URL.revokeObjectURL(audioUrl)
            }

            audio.onerror = (e) => {
                console.error('❌ Audio playback error:', e)
                setIsAISpeaking(false)
                URL.revokeObjectURL(audioUrl)
            }

            console.log('▶️ Starting audio playback...')
            await audio.play()
            console.log('✅ Audio is playing!')

        } catch (err: any) {
            console.error('❌ TTS error:', err)
            setError('Errore nella riproduzione vocale: ' + (err.message || 'Errore sconosciuto'))
            setIsAISpeaking(false)
        }
    }

    const clearConversation = () => {
        setMessages([])
    }

    const bars = Array.from({ length: 7 }, (_, i) => i)

    return (
        <div className="min-h-screen bg-[#0a1628] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-[#0a1628] to-[#0a1628]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />

            <div className="relative z-10 min-h-screen px-4 py-8 max-w-6xl mx-auto">
                {/* Header with controls */}
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-white">Conversazione con Luca AI</h1>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setIsTTSEnabled(!isTTSEnabled)}
                            className="px-4 py-2 rounded-lg border border-cyan-500/30 bg-gray-800/40 hover:bg-gray-800/60 transition-colors flex items-center gap-2"
                        >
                            {isTTSEnabled ? (
                                <><Volume2 className="w-5 h-5 text-cyan-400" /> <span className="text-cyan-400 text-sm">Voce Attiva</span></>
                            ) : (
                                <><VolumeX className="w-5 h-5 text-gray-400" /> <span className="text-gray-400 text-sm">Voce Disattivata</span></>
                            )}
                        </button>
                        {messages.length > 0 && (
                            <button
                                onClick={clearConversation}
                                className="px-4 py-2 rounded-lg border border-red-500/30 bg-gray-800/40 hover:bg-red-500/20 transition-colors flex items-center gap-2"
                            >
                                <Trash2 className="w-5 h-5 text-red-400" />
                                <span className="text-red-400 text-sm">Cancella</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Voice Interface */}
                    <div className="lg:col-span-1">
                        <div className="flex flex-col items-center gap-8 sticky top-8">
                            {/* Microphone button */}
                            <button
                                onClick={scribe.isConnected ? handleStop : handleStart}
                                disabled={isConnecting || isAISpeaking}
                                className={`relative w-64 h-64 rounded-full transition-all duration-500 ${scribe.isConnected
                                    ? "bg-gradient-to-br from-cyan-400 to-blue-500 shadow-[0_0_80px_rgba(14,165,233,0.6)]"
                                    : "bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_50px_rgba(14,165,233,0.4)] hover:shadow-[0_0_70px_rgba(14,165,233,0.5)]"
                                    } ${(isConnecting || isAISpeaking) ? "opacity-50 cursor-not-allowed" : "hover:scale-105 cursor-pointer"}`}
                            >
                                {scribe.isConnected && (
                                    <>
                                        <div className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-30" />
                                        <div className="absolute inset-0 rounded-full bg-cyan-400 animate-pulse opacity-20" />
                                    </>
                                )}

                                {isAISpeaking && (
                                    <div className="absolute inset-0 rounded-full bg-green-400 animate-pulse opacity-30" />
                                )}

                                <div className="absolute inset-6 rounded-full bg-[#0a1628] flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-3">
                                        {scribe.isConnected ? (
                                            <MicOff className="w-16 h-16 text-cyan-400" strokeWidth={1.5} />
                                        ) : (
                                            <Mic className="w-16 h-16 text-cyan-400" strokeWidth={1.5} />
                                        )}
                                        <span className="text-cyan-400 text-sm font-bold tracking-[0.2em] uppercase text-center px-2">
                                            {isConnecting ? "Connessione..." :
                                                isAISpeaking ? "Luca Parla..." :
                                                    scribe.isConnected ? "Stop" : "Parla con Luca"}
                                        </span>
                                    </div>
                                </div>
                            </button>

                            {/* Audio visualization */}
                            <div className="flex items-end justify-center gap-2 h-24">
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
                                                : 'bg-gradient-to-t from-cyan-600 to-cyan-400'
                                                }`}
                                            style={{
                                                height: `${height}%`,
                                                opacity: (scribe.isConnected || isAISpeaking) ? 0.8 + (height / 200) : 0.3,
                                            }}
                                        />
                                    )
                                })}
                            </div>

                            {/* Status indicator */}
                            <div className={`flex items-center gap-3 px-6 py-3 rounded-full border backdrop-blur-lg ${isAISpeaking
                                ? "bg-green-500/20 border-green-500/30"
                                : scribe.isConnected
                                    ? "bg-cyan-500/20 border-cyan-500/30"
                                    : "bg-gray-800/40 border-gray-700/30"
                                }`}>
                                <div className={`w-3 h-3 rounded-full ${isAISpeaking
                                    ? "bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]"
                                    : scribe.isConnected
                                        ? "bg-cyan-500 animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                                        : "bg-gray-500"
                                    }`} />
                                <span className={`text-xs font-bold uppercase tracking-wider ${isAISpeaking ? "text-green-400" :
                                    scribe.isConnected ? "text-cyan-400" : "text-gray-400"
                                    }`}>
                                    {isAIThinking ? "Luca sta pensando..." :
                                        isAISpeaking ? "Luca sta parlando..." :
                                            scribe.isConnected ? "In ascolto..." : "Pronto"}
                                </span>
                            </div>

                            {/* Error message */}
                            {error && (
                                <div className="px-6 py-4 bg-red-500/20 border border-red-500/30 rounded-lg backdrop-blur-lg max-w-sm">
                                    <p className="text-red-400 text-sm text-center">{error}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Conversation Display */}
                    <div className="lg:col-span-2">
                        <div className="h-[600px] border border-gray-700/30 rounded-2xl bg-gray-800/20 backdrop-blur-lg p-6 flex flex-col">
                            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-transparent">
                                {messages.length === 0 ? (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="text-center max-w-md">
                                            <p className="text-gray-400 text-sm mb-2">Nessuna conversazione ancora</p>
                                            <p className="text-gray-500 text-xs">
                                                Clicca sul microfono e inizia a parlare con Luca AI
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[80%] rounded-2xl px-6 py-4 ${message.role === 'user'
                                                    ? 'bg-cyan-500/20 border border-cyan-500/30'
                                                    : 'bg-gray-700/40 border border-gray-600/30'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-xs font-bold uppercase tracking-wider ${message.role === 'user' ? 'text-cyan-400' : 'text-gray-400'
                                                        }`}>
                                                        {message.role === 'user' ? 'Tu' : 'Luca AI'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500">
                                                        {new Date(message.timestamp).toLocaleTimeString('it-IT', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-gray-200 text-base leading-relaxed">
                                                    {message.text}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                                {isAIThinking && (
                                    <div className="flex justify-start">
                                        <div className="bg-gray-700/40 border border-gray-600/30 rounded-2xl px-6 py-4">
                                            <div className="flex gap-2">
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Partial transcript display */}
                {scribe.partialTranscript && (
                    <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl backdrop-blur-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                            <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
                                In tempo reale
                            </span>
                        </div>
                        <p className="text-white text-base">{scribe.partialTranscript}</p>
                    </div>
                )}
            </div>

            <style jsx global>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.3);
          border-radius: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.5);
        }
      `}</style>
        </div>
    )
}
