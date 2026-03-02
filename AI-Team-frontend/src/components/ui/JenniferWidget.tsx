"use client"

import { useEffect, useRef, useState } from "react"

// Jennifer AI N8N Endpoint
const N8N_URL = "https://n8n-c2lq.onrender.com/webhook/98312f59-4090-428e-a131-4149363dddc9/chat"
// Using Jennifer AI relevant colors
const PRIMARY_COLOR = "#b12a32" // Red base
const LIGHT_BG = "#f4f5f9"
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
    if (!chatWindowRef.current || !chatBubbleRef.current) return
    setIsOpen(open)
    chatWindowRef.current.classList.toggle("jennifer-open", open)
    chatBubbleRef.current.classList.toggle("jennifer-open", open)
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
    addMessage("Ciao! Sono Jennifer e sarò lieta di poterti assistere. Con chi ho il piacere di parlare?", "ai")

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
          bottom: 20px;
          right: 20px;
          z-index: 99999;
          font-family: 'Rajdhani', sans-serif;
          contain: layout style;
        }

        .jennifer-widget * {
          box-sizing: border-box;
        }

        .jennifer-chat-bubble {
          width: 60px;
          height: 60px;
          background: ${PRIMARY_COLOR};
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(177, 42, 50, 0.4);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: absolute;
          bottom: 0;
          right: 0;
          overflow: hidden;
        }

        .jennifer-chat-bubble:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(177, 42, 50, 0.5);
        }

        .jennifer-chat-bubble img {
          width: 34px;
          height: 34px;
          object-fit: cover;
          transition: opacity 0.3s;
        }
        
        .jennifer-chat-bubble svg {
           width: 32px;
           height: 32px;
           stroke: white;
           display: none;
           transition: opacity 0.3s;
        }

        .jennifer-chat-bubble.jennifer-open {
          transform: rotate(0deg);
        }

        .jennifer-chat-bubble.jennifer-open img {
          display: none;
        }

        .jennifer-chat-bubble.jennifer-open svg {
          display: block;
        }

        .jennifer-chat-window {
          position: absolute;
          bottom: 80px;
          right: 0;
          width: 360px;
          height: 540px;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          display: none;
          flex-direction: column;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
          border: 1px solid #eee;
        }

        .jennifer-chat-window.jennifer-open {
          display: flex;
          animation: jennifer-slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes jennifer-slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .jennifer-header {
          background: ${PRIMARY_COLOR};
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: white;
        }

        .jennifer-header-title {
          font-size: 16px;
          font-weight: 600;
        }

        .jennifer-header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .jennifer-action-btn {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          opacity: 0.9;
          transition: opacity 0.2s;
        }

        .jennifer-action-btn:hover {
          opacity: 1;
        }

        .jennifer-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: white;
        }

        .jennifer-chat-messages::-webkit-scrollbar {
          width: 6px;
        }

        .jennifer-chat-messages::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.15);
          border-radius: 3px;
        }

        .jennifer-message {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          animation: jennifer-fadeIn 0.3s;
        }

        @keyframes jennifer-fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .jennifer-message.ai {
          flex-direction: row;
        }

        .jennifer-message.user {
          flex-direction: row-reverse;
        }

        .jennifer-message-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          background: #eee;
        }

        .jennifer-message-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .jennifer-message-content {
          max-width: 75%;
          padding: 14px 16px;
          font-size: 15px;
          line-height: 1.4;
          font-weight: 400;
        }

        .jennifer-message.ai .jennifer-message-content {
          background: #f4f5f9;
          color: #1a1a1a;
          border-radius: 4px 16px 16px 16px;
        }

        .jennifer-message.user .jennifer-message-content {
          background: ${PRIMARY_COLOR};
          color: white;
          border-radius: 16px 4px 16px 16px;
        }

        .jennifer-typing-indicator {
          display: flex;
          gap: 4px;
          padding: 4px 0;
        }

        .jennifer-typing-indicator span {
          width: 6px;
          height: 6px;
          background: #888;
          border-radius: 50%;
          animation: jennifer-bounce 1.4s infinite;
        }

        .jennifer-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .jennifer-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes jennifer-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
          30% { transform: translateY(-4px); opacity: 1; }
        }

        .jennifer-chat-input-container {
          padding: 16px;
          background: white;
          border-top: 1px solid #f0f0f0;
        }

        .jennifer-chat-input-wrapper {
          display: flex;
          align-items: center;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 6px 12px;
          background: white;
          transition: border-color 0.2s;
        }
        
        .jennifer-chat-input-wrapper:focus-within {
          border-color: ${PRIMARY_COLOR};
        }

        .jennifer-chat-input {
          flex: 1;
          border: none;
          padding: 8px 0;
          font-size: 14px;
          color: #333;
          outline: none;
          background: transparent;
          font-family: inherit;
        }

        .jennifer-chat-input::placeholder {
          color: #999;
        }

        .jennifer-send-btn {
          background: none;
          border: none;
          color: ${PRIMARY_COLOR};
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          margin-left: 4px;
          transition: transform 0.2s;
        }

        .jennifer-send-btn:hover {
          transform: scale(1.1);
        }

        .jennifer-send-btn svg {
          width: 20px;
          height: 20px;
          fill: currentColor;
        }

        .jennifer-powered-by {
          text-align: center;
          font-size: 11px;
          color: #888;
          margin-top: 12px;
        }
        
        .jennifer-powered-by strong {
          color: #333;
          font-weight: 600;
        }

        @media (max-width: 480px) {
          .jennifer-widget {
            bottom: 20px;
            right: 20px;
          }
          .jennifer-chat-window {
            width: calc(100vw - 40px);
            height: calc(100vh - 120px);
            bottom: 70px;
          }
        }
      `}</style>

      <div className="jennifer-widget">
        <div className="jennifer-chat-window" ref={chatWindowRef}>
          <div className="jennifer-header">
            <div className="jennifer-header-title">AI Scale UP</div>
            <div className="jennifer-header-actions">
              <button className="jennifer-action-btn" onClick={() => {
                if (chatMessagesRef.current) {
                  chatMessagesRef.current.innerHTML = "";
                  addMessage("Ciao! Sono Jennifer e sarò lieta di poterti assistere. Con chi ho il piacere di parlare?", "ai");
                }
              }}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" /></svg>
              </button>
              <button className="jennifer-action-btn" ref={closeBtnRef}>
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>

          <div className="jennifer-chat-messages" ref={chatMessagesRef}></div>

          <div className="jennifer-chat-input-container">
            <div className="jennifer-chat-input-wrapper">
              <input type="text" className="jennifer-chat-input" placeholder="Scrivi la tua domanda" ref={chatInputRef} />
              <button className="jennifer-send-btn" ref={sendBtnRef}>
                <svg viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
            <div className="jennifer-powered-by">
              Powered by <strong>AI Scale Up</strong>
            </div>
          </div>
        </div>

        <div className="jennifer-chat-bubble" ref={chatBubbleRef}>
          <img src={AVATAR || "/placeholder.svg"} alt="Jennifer AI" />
          <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>
    </>
  )
}
