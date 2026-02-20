"use client"

import { useEffect, useRef, useState } from "react"

// Jennifer AI N8N Endpoint
const N8N_URL = "https://n8n-c2lq.onrender.com/webhook/98312f59-4090-428e-a131-4149363dddc9/chat"
// Using Jennifer AI relevant colors (Blue/Indigo based on page theme)
const PRIMARY_COLOR = "#6366f1" // Indigo-500
const SECONDARY_COLOR = "#4f46e5" // Indigo-600
const AVATAR = "https://www.ai-scaleup.com/wp-content/uploads/2025/11/jennifer-ai.png" // Placeholder or finding real one if exists, using Giulia's logic to fallback if needed
const USER_AVATAR = "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"

export default function JenniferWidget() {
  const chatBubbleRef = useRef<HTMLDivElement>(null)
  const chatWindowRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const sendBtnRef = useRef<HTMLButtonElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  const sanitizeText = (text: string) =>
    text
      .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
      .replace(/[^\S\r\n]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()

  const addMessage = (text: string, sender: "ai" | "user") => {
    if (!chatMessagesRef.current) return null

    const msg = document.createElement("div")
    msg.className = `jennifer-message ${sender}`

    const avatar = document.createElement("div")
    avatar.className = "jennifer-message-avatar"
    // Handle potential missing avatar by checking if AVATAR variable is set or use placeholder
    const avatarSrc = sender === "ai" ? (AVATAR || "/placeholder.svg") : USER_AVATAR
    avatar.innerHTML = `<img src="${avatarSrc}" alt="${sender}">`

    const content = document.createElement("div")
    content.className = "jennifer-message-content"

    const cleanText = sanitizeText(text)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\\n/g, "<br>")
      .replace(/\n/g, "<br>")

    content.innerHTML = cleanText

    msg.appendChild(avatar)
    msg.appendChild(content)

    chatMessagesRef.current.appendChild(msg)
    chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight

    return content
  }

  const toggleOpen = (open: boolean) => {
    if (!chatWindowRef.current) return
    setIsOpen(open)
    chatWindowRef.current.classList.toggle("jennifer-open", open)
  }

  const sendMessage = async () => {
    const input = chatInputRef.current
    const messages = chatMessagesRef.current
    if (!input || !messages) return

    const text = input.value.trim()
    if (!text) return

    addMessage(text, "user")
    input.value = ""

    const aiMsg = addMessage("", "ai")
    if (aiMsg) {
      aiMsg.innerHTML = `<div class="jennifer-typing-indicator"><span></span><span></span><span></span></div>`
      messages.scrollTop = messages.scrollHeight
    }

    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const sessionId = localStorage.getItem("jennifer-session") || `${dateStr}-jennifer-${Date.now()}`
      localStorage.setItem("jennifer-session", sessionId)

      const res = await fetch(N8N_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatInput: text, sessionId, agent: "Jennifer" }),
      })

      const textData = await res.text()
      const extracted: string[] = []

      try {
        const regex = /"content"\s*:\s*"([^"]*?)"/g
        let match: RegExpExecArray | null
        while ((match = regex.exec(textData)) !== null) {
          if (match[1] && match[1].trim()) extracted.push(match[1])
        }
      } catch {
        /* ignore */
      }

      let finalText = sanitizeText(extracted.join(" ").trim())
      if (!finalText) {
        try {
          const parsed = JSON.parse(textData)
          finalText = sanitizeText(parsed.reply || parsed.message || parsed.text || "(nessuna risposta ricevuta)")
        } catch {
          finalText = "(nessuna risposta ricevuta)"
        }
      }

      if (aiMsg) {
        aiMsg.innerHTML = finalText
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\\n/g, "<br>")
          .replace(/\n/g, "<br>")
      }
    } catch (err) {
      if (aiMsg) aiMsg.textContent = "Errore di connessione. Riprova più tardi."
    }
  }

  useEffect(() => {
    addMessage("Ciao! 👋 Sono Jennifer. Come posso aiutarti oggi?", "ai")

    const bubble = chatBubbleRef.current
    const close = closeBtnRef.current
    const send = sendBtnRef.current
    const input = chatInputRef.current

    const onBubble = () => toggleOpen(true)
    const onClose = () => toggleOpen(false)
    const onSend = () => sendMessage()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    }

    bubble?.addEventListener("click", onBubble)
    close?.addEventListener("click", onClose)
    send?.addEventListener("click", onSend)
    input?.addEventListener("keydown", onKey as any)

    return () => {
      bubble?.removeEventListener("click", onBubble)
      close?.removeEventListener("click", onClose)
      send?.removeEventListener("click", onSend)
      input?.removeEventListener("keydown", onKey as any)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&display=swap');

        .jennifer-widget {
          position: fixed;
          bottom: 100px;
          left: 20px;
          z-index: 99999;
          font-family: 'Rajdhani', sans-serif;
          contain: layout style;
        }

        .jennifer-widget * {
          box-sizing: border-box;
        }

        .jennifer-chat-bubble {
          width: 70px;
          height: 70px;
          background: ${PRIMARY_COLOR};
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 30px rgba(99, 102, 241, 0.4);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          margin: 0;
          padding: 0;
        }

        .jennifer-chat-bubble:hover {
          transform: scale(1.08);
          box-shadow: 0 0 40px rgba(99, 102, 241, 0.6);
        }

        .jennifer-chat-bubble:before {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 70%);
          animation: jennifer-pulse-glow 2.5s infinite;
        }

        @keyframes jennifer-pulse-glow {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.25); opacity: 0.35; }
        }

        .jennifer-chat-bubble img {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          object-fit: cover;
          position: relative;
          z-index: 1;
          border: 2px solid rgba(255, 255, 255, 0.5);
        }

        .jennifer-chat-window {
          position: fixed;
          bottom: 100px;
          left: 20px;
          width: 400px;
          height: 600px;
          background: rgba(17, 24, 39, 0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 20px;
          overflow: hidden;
          display: none;
          flex-direction: column;
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          max-width: calc(100vw - 40px);
          max-height: calc(100vh - 140px);
        }

        .jennifer-chat-window.jennifer-open {
          display: flex;
          animation: jennifer-slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes jennifer-slideUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .jennifer-header {
          background: ${PRIMARY_COLOR};
          padding: 20px 24px;
          position: relative;
          overflow: hidden;
        }

        .jennifer-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 25% 50%, rgba(255, 255, 255, 0.12), transparent 65%);
          pointer-events: none;
        }

        .jennifer-header-content {
          display: flex;
          align-items: center;
          gap: 14px;
          position: relative;
          z-index: 1;
        }

        .jennifer-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: 2.5px solid rgba(255, 255, 255, 0.35);
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .jennifer-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .jennifer-info {
          flex: 1;
        }

        .jennifer-name {
          font-size: 22px;
          font-weight: 700;
          color: white;
          margin-bottom: 2px;
          letter-spacing: -0.3px;
        }

        .jennifer-role {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: rgba(255, 255, 255, 0.85);
          font-weight: 600;
        }

        .jennifer-close-btn {
          position: absolute;
          top: 20px;
          right: 24px;
          width: 32px;
          height: 32px;
          background: rgba(255, 255, 255, 0.12);
          border: none;
          border-radius: 50%;
          color: white;
          font-size: 22px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(8px);
          z-index: 2;
          font-weight: 300;
          line-height: 1;
        }

        .jennifer-close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: rotate(90deg);
        }

        .jennifer-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: rgba(0, 0, 0, 0.4);
        }

        .jennifer-chat-messages::-webkit-scrollbar {
          width: 6px;
        }

        .jennifer-chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .jennifer-chat-messages::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.3);
          border-radius: 3px;
        }

        .jennifer-chat-messages::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.5);
        }

        .jennifer-message {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
          animation: jennifer-fadeIn 0.35s;
        }

        @keyframes jennifer-fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .jennifer-message.ai {
          flex-direction: row;
        }

        .jennifer-message.user {
          flex-direction: row-reverse;
        }

        .jennifer-message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          border: 2px solid rgba(255, 255, 255, 0.08);
        }

        .jennifer-message-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .jennifer-message-content {
          max-width: 70%;
          padding: 12px 16px;
          border-radius: 14px;
          font-size: 15px;
          line-height: 1.5;
          font-weight: 400;
        }

        .jennifer-message.ai .jennifer-message-content {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: #e5e5e5;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px 14px 14px 4px;
          box-shadow: none;
        }

        .jennifer-message.user .jennifer-message-content {
          background: ${PRIMARY_COLOR};
          color: white;
          border-radius: 14px 14px 4px 14px;
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.3);
        }

        .jennifer-typing-indicator {
          display: flex;
          gap: 5px;
          padding: 6px 0;
        }

        .jennifer-typing-indicator span {
          width: 8px;
          height: 8px;
          background: ${PRIMARY_COLOR};
          border-radius: 50%;
          animation: jennifer-bounce 1.4s infinite;
        }

        @keyframes jennifer-bounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }

        .jennifer-chat-input-container {
          padding: 18px 20px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .jennifer-input-status {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 10px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          color: #7a8292;
          font-weight: 600;
        }

        .jennifer-offline-dot {
          width: 7px;
          height: 7px;
          background: #8a9099;
          border-radius: 50%;
        }

        .jennifer-chat-input-wrapper {
          display: flex;
          gap: 10px;
          align-items: center;
          width: 100%;
        }

        .jennifer-chat-input {
          flex: 1;
          min-width: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 12px 20px;
          color: white;
          font-size: 15px;
          outline: none;
          transition: all 0.3s;
          font-weight: 400;
        }

        .jennifer-chat-input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .jennifer-chat-input:focus {
          background: rgba(0, 0, 0, 0.6);
          border-color: ${PRIMARY_COLOR};
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
        }

        .jennifer-send-btn {
          width: 50px;
          height: 50px;
          background: ${PRIMARY_COLOR};
          border: none;
          border-radius: 50%;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
          flex-shrink: 0;
          min-width: 50px;
          min-height: 50px;
        }

        .jennifer-send-btn:hover {
          transform: scale(1.06);
          box-shadow: 0 8px 28px rgba(99, 102, 241, 0.5);
        }

        .jennifer-send-btn:active {
          transform: scale(0.96);
        }

        .jennifer-send-btn svg {
          width: 20px;
          height: 20px;
          fill: white;
        }

        @media (max-width: 768px) {
          .jennifer-chat-window {
            width: calc(100vw - 40px);
            max-width: 380px;
            height: 580px;
            bottom: 100px;
            left: 20px;
          }
        }

        @media (max-width: 480px) {
          .jennifer-widget {
            bottom: 58px;
            left: 16px;
          }

          .jennifer-chat-bubble {
            width: 60px;
            height: 60px;
          }

          .jennifer-chat-bubble img {
            width: 36px;
            height: 36px;
          }

          .jennifer-chat-window {
            width: calc(100vw - 32px);
            height: calc(100vh - 120px);
            bottom: 90px;
            left: 16px;
            border-radius: 18px;
          }

          .jennifer-header {
            padding: 18px 20px;
          }

          .jennifer-chat-messages {
            padding: 16px;
          }

          .jennifer-chat-input-container {
            padding: 16px 18px;
          }

          .jennifer-chat-input {
            font-size: 14px;
            padding: 11px 18px;
          }

          .jennifer-send-btn {
            width: 46px;
            height: 46px;
            min-width: 46px;
            min-height: 46px;
          }

          .jennifer-send-btn svg {
            width: 18px;
            height: 18px;
          }

          .jennifer-message-content {
            max-width: 75%;
            font-size: 14px;
          }
        }

        @media (max-width: 360px) {
          .jennifer-chat-input {
            font-size: 13px;
            padding: 10px 16px;
          }

          .jennifer-send-btn {
            width: 44px;
            height: 44px;
            min-width: 44px;
            min-height: 44px;
          }
        }
      `}</style>

      <div className="jennifer-widget">
        <div className="jennifer-chat-bubble" ref={chatBubbleRef}>
          <img src={AVATAR || "/placeholder.svg"} alt="Jennifer AI" />
        </div>

        <div className="jennifer-chat-window" ref={chatWindowRef}>
          <div className="jennifer-header">
            <button className="jennifer-close-btn" ref={closeBtnRef}>
              ×
            </button>
            <div className="jennifer-header-content">
              <div className="jennifer-avatar">
                <img src={AVATAR || "/placeholder.svg"} alt="Jennifer AI" />
              </div>
              <div className="jennifer-info">
                <div className="jennifer-name">Jennifer AI</div>
                <div className="jennifer-role">Review Manager</div>
              </div>
            </div>
          </div>

          <div className="jennifer-chat-messages" ref={chatMessagesRef}></div>

          <div className="jennifer-chat-input-container">
            <div className="jennifer-input-status">
              <div className="jennifer-offline-dot"></div>
              <span>Offline</span>
            </div>
            <div className="jennifer-chat-input-wrapper">
              <input type="text" className="jennifer-chat-input" placeholder="Come posso esserti utile?" ref={chatInputRef} />
              <button className="jennifer-send-btn" ref={sendBtnRef}>
                <svg viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
