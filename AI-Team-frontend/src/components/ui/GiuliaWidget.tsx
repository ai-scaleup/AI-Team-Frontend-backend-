"use client"

import { useEffect, useRef, useState } from "react"

const N8N_URL = "https://n8n-c2lq.onrender.com/webhook/4e27c666-aa21-4d92-b78a-34229167245b/chat"
const AVATAR = "https://www.ai-scaleup.com/wp-content/uploads/2025/11/Giulia-ai.png"
const USER_AVATAR = "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"

export default function GiuliaWidget() {
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
    msg.className = `giulia-message ${sender}`

    const avatar = document.createElement("div")
    avatar.className = "giulia-message-avatar"
    avatar.innerHTML = `<img src="${sender === "ai" ? AVATAR : USER_AVATAR}" alt="${sender}">`

    const content = document.createElement("div")
    content.className = "giulia-message-content"

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
    chatWindowRef.current.classList.toggle("giulia-open", open)
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
      aiMsg.innerHTML = `<div class="giulia-typing-indicator"><span></span><span></span><span></span></div>`
      messages.scrollTop = messages.scrollHeight
    }

    try {
      const sessionId = localStorage.getItem("giulia-session") || `giulia-${Date.now()}`
      localStorage.setItem("giulia-session", sessionId)

      const res = await fetch(N8N_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatInput: text, sessionId, agent: "Giulia" }),
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

      let finalText = sanitizeText(extracted.join("").trim())
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
    addMessage("Ciao! 👋 Sono Giulia. Come posso aiutarti a gestire il tuo team oggi?", "ai")

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

        .giulia-widget {
          position: fixed;
          bottom: 100px;
          right: 20px;
          z-index: 9999;
          font-family: 'Rajdhani', sans-serif;
          contain: layout style;
        }

        .giulia-widget * {
          box-sizing: border-box;
        }

        .giulia-chat-bubble {
          width: 70px;
          height: 70px;
          background: #E52B50;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 30px rgba(229, 43, 80, 0.4);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          margin: 0;
          padding: 0;
        }

        .giulia-chat-bubble:hover {
          transform: scale(1.08);
          box-shadow: 0 0 40px rgba(229, 43, 80, 0.6);
        }

        .giulia-chat-bubble:before {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 70%);
          animation: giulia-pulse-glow 2.5s infinite;
        }

        @keyframes giulia-pulse-glow {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.25); opacity: 0.35; }
        }

        .giulia-chat-bubble img {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          object-fit: cover;
          position: relative;
          z-index: 1;
          border: 2px solid rgba(255, 255, 255, 0.5);
        }

        .giulia-chat-window {
          position: fixed;
          bottom: 100px;
          right: 20px;
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

        .giulia-chat-window.giulia-open {
          display: flex;
          animation: giulia-slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes giulia-slideUp {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .giulia-header {
          background: #E52B50;
          padding: 20px 24px;
          position: relative;
          overflow: hidden;
        }

        .giulia-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 25% 50%, rgba(255, 255, 255, 0.12), transparent 65%);
          pointer-events: none;
        }

        .giulia-header-content {
          display: flex;
          align-items: center;
          gap: 14px;
          position: relative;
          z-index: 1;
        }

        .giulia-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: 2.5px solid rgba(255, 255, 255, 0.35);
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .giulia-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .giulia-info {
          flex: 1;
        }

        .giulia-name {
          font-size: 22px;
          font-weight: 700;
          color: white;
          margin-bottom: 2px;
          letter-spacing: -0.3px;
        }

        .giulia-role {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: rgba(255, 255, 255, 0.85);
          font-weight: 600;
        }

        .giulia-close-btn {
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

        .giulia-close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: rotate(90deg);
        }

        .giulia-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: rgba(0, 0, 0, 0.4);
        }

        .giulia-chat-messages::-webkit-scrollbar {
          width: 6px;
        }

        .giulia-chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .giulia-chat-messages::-webkit-scrollbar-thumb {
          background: rgba(229, 43, 80, 0.3);
          border-radius: 3px;
        }

        .giulia-chat-messages::-webkit-scrollbar-thumb:hover {
          background: rgba(229, 43, 80, 0.5);
        }

        .giulia-message {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
          animation: giulia-fadeIn 0.35s;
        }

        @keyframes giulia-fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .giulia-message.ai {
          flex-direction: row;
        }

        .giulia-message.user {
          flex-direction: row-reverse;
        }

        .giulia-message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          border: 2px solid rgba(255, 255, 255, 0.08);
        }

        .giulia-message-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .giulia-message-content {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 14px;
          font-size: 15px;
          line-height: 1.5;
          font-weight: 400;
          word-break: keep-all;
          overflow-wrap: break-word;
          hyphens: none;
          white-space: normal;
          word-spacing: normal;
        }

        .giulia-message.ai .giulia-message-content {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: #e5e5e5;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 14px 14px 14px 4px;
          box-shadow: none;
        }

        .giulia-message.user .giulia-message-content {
          background: #E52B50;
          color: white;
          border-radius: 14px 14px 4px 14px;
          box-shadow: 0 4px 16px rgba(229, 43, 80, 0.3);
        }

        .giulia-typing-indicator {
          display: flex;
          gap: 5px;
          padding: 6px 0;
        }

        .giulia-typing-indicator span {
          width: 8px;
          height: 8px;
          background: #E52B50;
          border-radius: 50%;
          animation: giulia-bounce 1.4s infinite;
        }

        @keyframes giulia-bounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }

        .giulia-chat-input-container {
          padding: 18px 20px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .giulia-input-status {
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

        .giulia-offline-dot {
          width: 7px;
          height: 7px;
          background: #8a9099;
          border-radius: 50%;
        }

        .giulia-chat-input-wrapper {
          display: flex;
          gap: 10px;
          align-items: center;
          width: 100%;
        }

        .giulia-chat-input {
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

        .giulia-chat-input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .giulia-chat-input:focus {
          background: rgba(0, 0, 0, 0.6);
          border-color: #E52B50;
          box-shadow: 0 0 0 3px rgba(229, 43, 80, 0.15);
        }

        .giulia-send-btn {
          width: 50px;
          height: 50px;
          background: #E52B50;
          border: none;
          border-radius: 50%;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
          box-shadow: 0 6px 20px rgba(229, 43, 80, 0.35);
          flex-shrink: 0;
          min-width: 50px;
          min-height: 50px;
        }

        .giulia-send-btn:hover {
          transform: scale(1.06);
          box-shadow: 0 8px 28px rgba(229, 43, 80, 0.5);
        }

        .giulia-send-btn:active {
          transform: scale(0.96);
        }

        .giulia-send-btn svg {
          width: 20px;
          height: 20px;
          fill: white;
        }

        @media (max-width: 768px) {
          .giulia-chat-window {
            width: calc(100vw - 40px);
            max-width: 380px;
            height: 580px;
            bottom: 100px;
            right: 20px;
          }
        }

        @media (max-width: 480px) {
          .giulia-widget {
            bottom: 58px;
            right: 16px;
          }

          .giulia-chat-bubble {
            width: 60px;
            height: 60px;
          }

          .giulia-chat-bubble img {
            width: 36px;
            height: 36px;
          }

          .giulia-chat-window {
            width: calc(100vw - 32px);
            height: calc(100vh - 120px);
            bottom: 90px;
            right: 16px;
            border-radius: 18px;
          }

          .giulia-header {
            padding: 18px 20px;
          }

          .giulia-chat-messages {
            padding: 16px;
          }

          .giulia-chat-input-container {
            padding: 16px 18px;
          }

          .giulia-chat-input {
            font-size: 14px;
            padding: 11px 18px;
          }

          .giulia-send-btn {
            width: 46px;
            height: 46px;
            min-width: 46px;
            min-height: 46px;
          }

          .giulia-send-btn svg {
            width: 18px;
            height: 18px;
          }

          .giulia-message-content {
            max-width: 75%;
            font-size: 14px;
          }
        }

        @media (max-width: 360px) {
          .giulia-chat-input {
            font-size: 13px;
            padding: 10px 16px;
          }

          .giulia-send-btn {
            width: 44px;
            height: 44px;
            min-width: 44px;
            min-height: 44px;
          }
        }
      `}</style>

      <div className="giulia-widget">
        <div className="giulia-chat-bubble" ref={chatBubbleRef}>
          <img src={AVATAR || "/placeholder.svg"} alt="Giulia AI" />
        </div>

        <div className="giulia-chat-window" ref={chatWindowRef}>
          <div className="giulia-header">
            <button className="giulia-close-btn" ref={closeBtnRef}>
              ×
            </button>
            <div className="giulia-header-content">
              <div className="giulia-avatar">
                <img src={AVATAR || "/placeholder.svg"} alt="Giulia AI" />
              </div>
              <div className="giulia-info">
                <div className="giulia-name">Giulia AI</div>
                <div className="giulia-role">Assistente Operativo</div>
              </div>
            </div>
          </div>

          <div className="giulia-chat-messages" ref={chatMessagesRef}></div>

          <div className="giulia-chat-input-container">
            <div className="giulia-input-status">
              <div className="giulia-offline-dot"></div>
              <span>Offline</span>
            </div>
            <div className="giulia-chat-input-wrapper">
              <input type="text" className="giulia-chat-input" placeholder="Come posso esserti utile?" ref={chatInputRef} />
              <button className="giulia-send-btn" ref={sendBtnRef}>
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



