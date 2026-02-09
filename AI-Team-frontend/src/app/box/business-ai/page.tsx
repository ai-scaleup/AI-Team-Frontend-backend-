"use client"

import React, { useState, useEffect, useRef } from 'react';
import { Check, Star, Zap, Users, MonitorPlay, Gift, ArrowRight, Sparkles, CreditCard, ChevronDown, CheckCircle2, GraduationCap, Coins, Lightbulb, Loader2, Mic, MicOff, X, Volume2, StopCircle, PhoneCall, MessageCircle, Send, Download, Database, Lamp } from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { ChatMessage } from '@/app/box/types';
import { getGiuliaSystemPrompt, getInitialGreeting } from '@/app/box/giulia-prompts';
import { queryPineconeForContext } from '@/app/box/pinecone-query';



// --- FIREBASE INIT (OUTSIDE COMPONENT) ---
let db = null;
let auth = null;
let appId = 'business-ai-gift'; // Default ID

const firebaseConfigStr = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
if (firebaseConfigStr) {
    try {
        const firebaseConfig = JSON.parse(firebaseConfigStr);
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (e) {
        console.warn("Firebase init skipped (invalid config).", e);
    }
} else {
    console.warn("Firebase config missing (NEXT_PUBLIC_FIREBASE_CONFIG).");
}

const BusinessAIGiftLanding = () => {
    const [selectedPlan, setSelectedPlan] = useState('premium');
    const [imgError, setImgError] = useState(false);
    // --- AUTH STATE ---
    const [user, setUser] = useState<User | null>(null);


    useEffect(() => {
        if (!auth) return;
        const initAuth = async () => {
            try {
                // Check for initial auth token if pushed from elsewhere (optional)
                if (typeof window !== 'undefined' && (window as any).__initial_auth_token) {
                    await signInWithCustomToken(auth, (window as any).__initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Auth Failed:", error);
            }
        };
        initAuth();
        const unsubscribe = onAuthStateChanged(auth, setUser);
        return () => unsubscribe();
    }, []);


    // --- STATI ---
    const [showContactForm, setShowContactForm] = useState(false);
    const [contactData, setContactData] = useState({ name: '', phone: '', email: '' });
    const [isSubmittingForm, setIsSubmittingForm] = useState(false);
    const [leadCaptured, setLeadCaptured] = useState(false);
    const [sectorInput, setSectorInput] = useState('');
    const [aiIdea, setAiIdea] = useState('');
    const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
    const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'success' | 'error'>('idle');
    const [isVoiceAgentOpen, setIsVoiceAgentOpen] = useState(false);

    // Chat states
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ sender: 'ai', text: getInitialGreeting() }]);
    const [chatInput, setChatInput] = useState("");
    const [isChatTyping, setIsChatTyping] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);


    // ASSETS
    const LOGO_URL = "https://www.ai-scaleup.com/wp-content/uploads/2025/12/Ai-Team-Gold-Oro-Transparent.png";
    const JENNIFER_AVATAR = "https://www.digital-coach.com/wp-content/uploads/2025/12/Giulia-small-x-chat.png";
    // Icona Aladino (Lampada)
    const ALADINO_ICON = <Lamp className="text-[#D4AF37]" size={24} />;


    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";


    // --- HANDLERS ---
    const triggerOutboundCall = async () => {
        setCallStatus('calling');
        try {
            const pearlId = process.env.NEXT_PUBLIC_PEARL_ID;
            const res = await fetch(`https://api.nlpearl.ai/v2/Outbound/${pearlId}/Lead`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_NLPEARL_API_KEY}`
                },
                body: JSON.stringify({
                    phoneNumber: "39" + contactData.phone.replace(/\s+/g, ''),
                    externalId: Date.now().toString(),
                    timeZoneId: "Europe/Rome",
                    callData: {
                        email: contactData.email,
                        name: contactData.name
                    }
                })
            });

            if (!res.ok) throw new Error('Call API failed');
            setCallStatus('success');
        } catch (error) {
            console.error("Call failed:", error);
            setCallStatus('error');
        }
    };

    const handleContactSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contactData.name || !contactData.phone || !contactData.email) return;

        setIsSubmittingForm(true);
        try {
            // 1. Save to Firebase
            if (db && user) {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'leads'), {
                    ...contactData,
                    timestamp: new Date().toISOString(),
                    source: 'Luca Voice AI - Call Request',
                    userId: (user as any).uid,
                    status: 'new'
                });
            } else {
                localStorage.setItem('last_lead', JSON.stringify(contactData));
            }

            setLeadCaptured(true);

            // 2. Trigger Call
            await triggerOutboundCall();

        } catch (error) {
            console.error(error);
            setCallStatus('error');
        } finally {
            setIsSubmittingForm(false);
        }
    };


    const downloadLeadsCSV = async () => {
        if (!db || !user) { alert("Database non connesso."); return; }
        try {
            const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'leads'));
            const snapshot = await getDocs(q);
            const leads = snapshot.docs.map(doc => doc.data());
            if (leads.length === 0) { alert("Nessun contatto."); return; }
            const csvContent = "data:text/csv;charset=utf-8," + "Nome,Telefono,Data\n" + leads.map(l => `${l.name},${l.phone},${l.timestamp}`).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "leads_ai_team.csv"); document.body.appendChild(link); link.click();
        } catch (error) { console.error(error); alert("Errore download."); }
    };


    const scrollToPricing = () => {
        const element = document.getElementById('pricing');
        if (element) element.scrollIntoView({ behavior: 'smooth' });
    };

    const handlePurchase = (plan: 'start' | 'premium') => {
        if (plan === 'start') {
            window.location.href = 'https://members.digital-coach.com/offers/ZYARvHAZ/checkout';
        } else {
            window.location.href = 'https://members.digital-coach.com/offers/yMpKZou6/checkout';
        }
    };


    // --- CHAT JENNIFER ---
    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, isChatOpen]);
    const handleChatSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim()) return;
        const userMsg = chatInput;
        const updatedMessages = [...chatMessages, { sender: 'user' as const, text: userMsg }];
        setChatMessages(updatedMessages);
        setChatInput("");
        setIsChatTyping(true);
        try {
            // Query Pinecone for relevant context (RAG)
            const namespace = process.env.NEXT_PUBLIC_BUSINESS_NAMESPACE || 'business-ai';
            const ragContext = await queryPineconeForContext(userMsg, namespace);

            // Build conversation history for context (last 10 messages)
            const conversationHistory = updatedMessages.slice(-10).map(msg =>
                `${msg.sender === 'user' ? 'UTENTE' : 'GIULIA'}: ${msg.text}`
            ).join('\n');

            const systemPrompt = getGiuliaSystemPrompt('business');
            const contextSection = ragContext ? `\n\n--- CONTESTO PRODOTTO (da knowledge base) ---\n${ragContext}` : '';
            const prompt = `${systemPrompt}${contextSection}\n\n--- CRONOLOGIA CONVERSAZIONE ---\n${conversationHistory}\n\n--- ISTRUZIONI ---\nRispondi al messaggio più recente dell'utente in modo naturale, seguendo il playbook. Usa le informazioni dal contesto prodotto se rilevanti. Max 4-5 righe. Italiano.`;

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const data = await res.json();
            setChatMessages(prev => [...prev, { sender: 'ai', text: data.candidates?.[0]?.content?.parts?.[0]?.text || "Scusa, un attimo..." }]);
        } catch (error) {
            setChatMessages(prev => [...prev, { sender: 'ai', text: "Errore di rete." }]);
        } finally {
            setIsChatTyping(false);
        }
    };





    // --- GENERATORE IDEE (ALADINO AI) ---
    const generateBusinessIdea = async () => {
        if (!sectorInput.trim()) return; setIsGeneratingIdea(true); setAiIdea('');
        try {
            const prompt = `Sei Aladino AI, esperto di innovazione. L'utente ha un sogno o vuole rilanciare un'attività nel settore: "${sectorInput}". Genera una risposta di alto valore (circa 15-20 righe) strutturata così: 🧞‍♂️ **L'Intuizione di Aladino:** (Analizza brevemente il settore e proponi un angolo innovativo). 💡 **L'Idea Business:** (Descrivi un concept di business concreto e moderno). 🚀 **Il Tuo Piano d'Azione (Cosa fare domani):** * **Step 1:** ... * **Step 2:** ... ✨ **Conclusione:** (Una frase motivante finale). Usa **grassetto** per i concetti chiave. Tono ispirazionale ma pratico.`;
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
            const data = await res.json(); setAiIdea(data.candidates?.[0]?.content?.parts?.[0]?.text || "Riprova.");
        } catch (e) { setAiIdea("Errore."); } finally { setIsGeneratingIdea(false); }
    };


    const renderFormattedText = (text: string) => {
        return text.split('\n').map((line, i) => (
            <p key={i} className="mb-2 text-sm leading-relaxed">
                {line.split(/(\[.*?\]\(.*?\)|(?:\*\*.*?\*\*))/g).map((part, j) => {
                    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
                    if (linkMatch) {
                        return (
                            <a
                                key={j}
                                href={linkMatch[2]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#0ea5e9] hover:text-[#0284c7] underline font-medium break-all"
                            >
                                {linkMatch[1]}
                            </a>
                        );
                    }
                    const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
                    if (boldMatch) {
                        return <strong key={j} className="text-[#D4AF37]">{boldMatch[1]}</strong>;
                    }
                    return part;
                })}
            </p>
        ));
    };


    return (
        <div className="min-h-screen bg-[#020817] text-white selection:bg-[#E11D48] selection:text-white font-sans relative">
            <style dangerouslySetInnerHTML={{
                __html: `
       @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&display=swap');
       body, button, input, div, h1, h2, h3, h4, p, span, li, textarea { font-family: 'Rajdhani', sans-serif !important; }
       .voice-wave { display: flex; align-items: center; justify-content: center; gap: 4px; height: 30px; }
       .voice-bar { width: 5px; background-color: #E11D48; border-radius: 3px; animation: wave 0.8s ease-in-out infinite; }
       @keyframes wave { 0%, 100% { height: 8px; opacity: 0.5; } 50% { height: 30px; opacity: 1; } }
       .voice-bar:nth-child(1) { animation-delay: 0.0s; } .voice-bar:nth-child(2) { animation-delay: 0.1s; } .voice-bar:nth-child(3) { animation-delay: 0.2s; } .voice-bar:nth-child(4) { animation-delay: 0.3s; } .voice-bar:nth-child(5) { animation-delay: 0.4s; }
       .chat-scroll::-webkit-scrollbar { width: 6px; } .chat-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); } .chat-scroll::-webkit-scrollbar-thumb { background: rgba(225, 29, 72, 0.5); border-radius: 10px; }
     `}} />


            {/* HERO SECTION */}
            {/* HERO SECTION - REWRITTEN FOR GIFT GIVER - MATCHING CARRIERA STYLE */}
            <div className="relative overflow-hidden pt-0 md:pt-12 pb-12 mt-0">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] md:h-[600px] bg-[#E11D48]/10 blur-[80px] md:blur-[120px] rounded-full pointer-events-none" />
                <div className="max-w-4xl mx-auto px-4 text-center relative z-10 flex flex-col items-center">
                    <div className="mt-2 mb-0 md:-mt-16 md:-mb-8 w-full max-w-[380px] md:max-w-[600px] h-auto flex justify-center items-center transition-opacity duration-500 hover:opacity-90 relative z-20">
                        {!imgError ? (<img src={LOGO_URL} alt="AI TEAM Logo Gold" className="w-full h-auto drop-shadow-[0_0_30px_rgba(212,175,55,0.6)]" onError={() => setImgError(true)} />) : (<div className="border-4 border-[#D4AF37] rounded-xl p-4 shadow-[0_0_30px_rgba(212,175,55,0.3)] bg-black/40 backdrop-blur-sm mt-16"><h1 className="text-6xl text-transparent bg-clip-text bg-gradient-to-r from-[#BF953F] to-[#AA771C]">AI TEAM</h1></div>)}
                    </div>
                    <div className="inline-flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full px-5 py-1.5 mb-8 backdrop-blur-md shadow relative z-10"><Gift className="w-4 h-4 text-[#D4AF37]" /><span className="text-sm font-bold text-[#D4AF37] tracking-[0.15em] uppercase">L'Idea Regalo Definitiva 2025</span></div>
                    <h1 className="text-4xl md:text-8xl font-bold tracking-tight text-white mb-6 drop-shadow-2xl leading-[0.9]">
                        NON REGALARE<br />IL SOLITO OGGETTO.<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#BF953F] via-[#FBF5B7] to-[#AA771C]">REGALA IL FUTURO!</span>
                    </h1>
                    <p className="text-slate-300 text-xl md:text-2xl mb-8 max-w-4xl mx-auto leading-relaxed font-medium">
                        Aiuta i tuoi cari a <strong>Lanciare (o RI-lanciare) la loro attività/azienda</strong> grazie alla Consulenza di <strong>10 Agenti professionisti AI</strong>, alla formazione ed al Coaching 1-1 degli esperti (umani) di Digital Coach®, la migliore Scuola Italiana di formazione sull’Intelligenza Artificiale.
                    </p>
                    <div className="max-w-lg mx-auto bg-gradient-to-r from-slate-900 to-slate-800 border border-[#D4AF37]/40 rounded-xl p-4 flex items-center justify-center gap-4 shadow-lg mb-10 transform hover:scale-105 transition-transform duration-300 cursor-pointer group"><div className="bg-[#D4AF37]/20 p-3 rounded-full shadow group-hover:bg-[#D4AF37]/30 transition-colors"><Sparkles className="w-6 h-6 text-[#FBF5B7]" /></div><div className="text-left"><p className="text-xs text-[#D4AF37] uppercase font-bold tracking-wider mb-0.5">Vantaggio Fiscale per P.IVA</p><p className="text-lg text-white font-bold">Scarica il 100% come Formazione + Detrai IVA 22%</p></div></div>
                </div>
            </div>


            {/* PRICING */}
            <div className="max-w-7xl mx-auto px-4 py-24" id="pricing">
                <div className="text-center mb-16">
                    <h2 className="text-5xl md:text-7xl font-bold text-white uppercase mb-4">Scegli il Box</h2>
                    <p className="text-slate-400 text-xl font-medium">Un investimento minimo per un valore enorme.</p>
                </div>
                <div className="flex justify-center mb-8 md:hidden relative z-40">
                    <div className="bg-[#0f172a]/90 backdrop-blur p-1.5 rounded-full border border-slate-700 flex shadow-2xl">
                        <button onClick={() => setSelectedPlan('start')} className={`px-8 py-3 rounded-full font-bold uppercase transition-all ${selectedPlan === 'start' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>START</button>
                        <button onClick={() => setSelectedPlan('premium')} className={`px-8 py-3 rounded-full font-bold uppercase transition-all ${selectedPlan === 'premium' ? 'bg-gradient-to-r from-[#BF953F] to-[#B38728] text-white' : 'text-slate-500'}`}>PREMIUM</button>
                    </div>
                </div>
                <div className="grid md:grid-cols-2 gap-8 items-stretch max-w-6xl mx-auto mb-16">
                    {/* Box START */}
                    <div className={`bg-[#0f172a]/40 backdrop-blur-sm border rounded-3xl p-6 md:p-10 flex flex-col ${selectedPlan === 'start' ? 'border-slate-500 ring-1 ring-slate-500/50' : 'border-slate-800 hidden md:flex'}`}>
                        <div className="mb-6"><h3 className="text-4xl font-bold text-white mb-2">Box START</h3><p className="text-slate-400 text-lg">L'introduzione perfetta all'AI.</p></div>
                        <div className="mb-8 pb-8 border-b border-slate-800"><div className="flex items-baseline gap-2"><span className="text-6xl font-bold text-white">€97</span><span className="text-xl font-medium text-slate-500"></span></div></div>
                        <div className="space-y-8 flex-grow mb-10">
                            <p className="text-sm font-bold text-slate-300 uppercase tracking-[0.2em] mb-4">IL BOX CONTIENE:</p>
                            <ListItem icon={<MonitorPlay />} title="Videocorso AI Power" desc="Basi fondamentali." />
                            <ListItem icon={<Users />} title="2 Sessioni Coaching" desc="Con esperto umano." />
                            <ListItem icon={<Zap />} title="3 Giorni Accesso" desc="Accesso a 5 Agenti." />
                            <ListItem icon={<Star />} title="1 Ticket Evento" desc="Live di 3 serate (Valore €380)." />
                        </div>
                        <button onClick={() => handlePurchase('start')} className="w-full py-5 rounded-xl border-2 border-slate-600 text-white text-xl font-bold uppercase hover:bg-slate-800 transition-all flex items-center justify-center gap-3">Acquista Start <ArrowRight className="w-6 h-6" /></button>
                    </div>
                    {/* Box PREMIUM */}
                    <div className={`bg-gradient-to-b from-[#0f172a] to-[#020617] border-2 rounded-3xl p-6 md:p-10 flex flex-col transform md:-translate-y-6 shadow-2xl ${selectedPlan === 'premium' ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30' : 'border-slate-800 hidden md:flex'}`}>
                        <div className="bg-gradient-to-r from-[#BF953F] via-[#FBF5B7] to-[#B38728] text-slate-900 font-black text-sm uppercase px-8 py-2.5 rounded-full shadow border border-white/40 flex items-center justify-center gap-2 whitespace-nowrap mb-4 md:absolute md:-top-5 md:left-1/2 md:-translate-x-1/2 md:mb-0 w-max mx-auto"><Gift size={18} strokeWidth={3} /> Il Regalo Più Venduto</div>
                        <div className="mb-6 mt-2"><h3 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#BF953F] via-[#FBF5B7] to-[#BF953F]">Box PREMIUM</h3><p className="text-slate-300 text-lg">Per lasciare a bocca aperta.</p></div>
                        <div className="mb-8 pb-8 border-b border-[#D4AF37]/20"><div className="flex items-baseline gap-2"><span className="text-7xl font-bold text-white">€197</span><span className="text-xl font-medium text-slate-500"></span></div></div>
                        <div className="space-y-6 flex-grow mb-10">
                            <p className="text-sm font-bold text-[#D4AF37] uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Sparkles size={16} /> COSA INCLUDE (Totale):</p>
                            <ListItem icon={<MonitorPlay />} title="Videocorso AI Power" desc="Incluso" isPremiumBase={true} />
                            <UpgradeItem icon={<Users className="text-[#FBF5B7]" />} quantity="3" unit="Sessioni Coaching" upgradeNote="+1 rispetto alla Start" />
                            {/* Highlighted Upgrade - UPDATED TEXT WITH GOLD & DOUBLE */}
                            <div className="bg-[#D4AF37]/10 p-3 rounded-xl border border-[#D4AF37]/30 shadow-sm mb-2 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D4AF37]/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                <UpgradeItem
                                    icon={<Zap className="text-[#FBF5B7]" />}
                                    quantity="10" // This is large and gold
                                    unit="10 AI Agents + 10 Giorni Accesso"
                                    upgradeNote="DOPPIO AGENTI + 7 Giorni Extra"
                                    highlight={true}
                                    goldNumber={true}
                                />
                            </div>
                            <div className="bg-gradient-to-br from-[#D4AF37]/20 to-[#B38728]/10 p-4 rounded-2xl border border-[#D4AF37]/40 shadow relative overflow-hidden">
                                <UpgradeItem icon={<Star className="text-[#FBF5B7]" />} quantity="2" unit="Ticket Evento Experience" upgradeNote="RADDOPPIATO! Valore €760." highlight={true} />
                            </div>
                        </div>
                        <button onClick={() => handlePurchase('premium')} className="w-full py-6 rounded-xl bg-gradient-to-r from-[#BF953F] via-[#D4AF37] to-[#B38728] text-white text-2xl font-bold uppercase hover:shadow-[0_0_40px_rgba(212,175,55,0.5)] transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"><span className="relative z-10 flex items-center gap-2">Acquista Premium <ArrowRight className="w-7 h-7" /></span></button>
                    </div>
                </div>
            </div>


            {/* --- SECTION: VANTAGGIO FISCALE --- */}
            <div className="max-w-4xl mx-auto bg-slate-900/80 border border-[#D4AF37]/50 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 shadow-[0_0_40px_rgba(212,175,55,0.15)] mb-20 relative overflow-hidden">
                <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="shrink-0 bg-[#D4AF37]/20 p-4 rounded-full border border-[#D4AF37]/30">
                    <Coins size={40} className="text-[#FBF5B7]" />
                </div>
                <div className="text-center md:text-left">
                    <h4 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide">Hai Partita IVA? Il Box si ripaga da solo.</h4>
                    <p className="text-slate-300 text-lg leading-relaxed">
                        Se il tuo regime fiscale lo consente, richiedendo la fattura risparmi il 22% detraendo l'IVA e in più deduci il 100% del costo come spesa in Formazione o Software.
                    </p>
                </div>
            </div>


            {/* TEST DRIVE AI (PROVAMI SUBITO - ALADINO AI) - MOBILE OPTIMIZED */}
            <div className="relative py-12 px-4 mb-20">
                <div className="max-w-3xl mx-auto bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl border border-[#D4AF37]/30 p-6 md:p-8 shadow relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="relative z-10 text-center">
                        <div className="inline-flex items-center gap-2 bg-[#D4AF37]/20 text-[#FBF5B7] px-4 py-1 rounded-full text-sm font-bold mb-4 border border-[#D4AF37]/30">
                            {ALADINO_ICON} PROVAMI SUBITO
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-3 uppercase">
                            Hai una passione o sogno nel cassetto che vorresti trasformare in un'attività in proprio?<br />
                            <span className="text-[#D4AF37]">Cerchi Idee per rilanciare la tua attività/azienda?</span>
                        </h3>
                        <p className="text-slate-400 mb-8 max-w-lg mx-auto text-lg">
                            Descrivi cosa vorresti o che problemi vuoi risolvere… <strong>Aladino AI</strong> ti offrirà subito un mini-consulenza.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mb-6">
                            <input type="text" placeholder="Scrivi qui..." className="flex-grow bg-slate-900 border border-slate-700 rounded-xl px-5 py-4 text-white focus:border-[#D4AF37] outline-none text-lg" value={sectorInput} onChange={(e) => setSectorInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && generateBusinessIdea()} />
                            <button onClick={generateBusinessIdea} disabled={isGeneratingIdea || !sectorInput} className="bg-gradient-to-r from-[#BF953F] to-[#B38728] text-white font-bold py-4 px-6 rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] whitespace-nowrap flex items-center justify-center gap-2 text-lg">{isGeneratingIdea ? <Loader2 className="animate-spin" /> : 'Chiedi ad Aladino AI ✨'}</button>
                        </div>
                        {aiIdea && (
                            <div className="mt-6 bg-slate-900/80 border border-[#D4AF37]/30 rounded-xl p-4 md:p-6 text-left animate-in fade-in">
                                <div className="flex items-start gap-3 md:gap-4">
                                    {/* Icona nascosta su mobile per dare spazio al testo */}
                                    <div className="hidden md:block bg-[#D4AF37]/20 p-2 rounded-lg shrink-0">
                                        <Sparkles className="text-[#FBF5B7]" size={24} />
                                    </div>
                                    {/* Margine ridotto e testo ottimizzato */}
                                    <div className="text-slate-200 text-base md:text-lg leading-relaxed space-y-4 w-full">
                                        {renderFormattedText(aiIdea)}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* --- SECTION: DETTAGLIO SERVIZI - Copy Aggiornato --- */}
            <div className="max-w-5xl mx-auto pb-20">
                <h3 className="text-4xl font-bold text-center text-white mb-12 uppercase tracking-widest flex items-center justify-center gap-4">
                    <span className="h-[1px] w-12 bg-slate-700"></span>
                    Cosa c'è davvero nel Box?
                    <span className="h-[1px] w-12 bg-slate-700"></span>
                </h3>


                <div className="space-y-8">
                    <ServiceDetail
                        icon={<Zap className="text-[#D4AF37]" />}
                        title="AI Team: I Nuovi Dipendenti"
                        desc={<span>Accesso a una squadra di Professionisti AI: <strong>Aladino AI</strong> (esperto in innovazione), <strong>Mike AI</strong> (Marketing Manager), <strong>Daniele AI</strong> (Copywriter), <strong>Lara AI</strong> (Social Media Manager), <strong>Alex AI</strong> (ADS Manager).<br /><br />Nella versione del <strong>BOX Premium</strong> hai accesso anche ad altri <strong>+5 specialisti</strong>: <strong>Tony AI</strong> (Consulente aumento vendite), <strong>Jim AI</strong> (Coach di vendita), <strong>Niko AI</strong> (SEO Manager), <strong>Simone AI</strong> (Copywriter SEO), <strong>Valentina AI</strong>.</span>}
                    />
                    <ServiceDetail
                        icon={<MonitorPlay className="text-[#D4AF37]" />}
                        title="Videocorso AI Power"
                        desc={<span>È un corso di <strong>Luca Papa</strong>, uno dei maggiori esperti italiani di applicazioni AI aziendali per il marketing e le vendite. Luca ti orienterà sul come sfruttare la <strong>Rivoluzione AI</strong> che ci aspetta per migliorare la tua attività professionale, la tua vita e la tua condizione economica. Una guida per non farsi tagliare fuori. <strong>Fondamentale per chi parte da zero.</strong></span>}
                    />
                    <ServiceDetail
                        icon={<Users className="text-[#D4AF37]" />}
                        title="Coaching 1-1 Human-to-Human"
                        desc={<span>Un nostro esperto farà sessioni 1-to-1 durante le quali, dopo aver analizzato insieme al cliente la sua attività professionale/azienda, gli spiegherà come l’<strong>AI può aiutarlo nel suo specifico caso</strong> e quali sono le applicazioni AI e gli AI Agents di maggiore impatto.</span>}
                    />
                    <ServiceDetail
                        icon={<Star className="text-[#D4AF37]" />}
                        title="AI Team Experience (Evento Live)"
                        desc={<span>Un evento formativo di <strong>Luca Papa</strong> ed il suo AI Team, in diretta Online di 3 serate. Frequentabile a scelta in una delle 5 edizioni annue. Si interagisce e si lavora insieme agli AI Agents, tutta <strong>Pratica Reale</strong>. Un valore immenso (€380 a biglietto il prezzo al pubblico) incluso nel Box Regalo. Nella versione <strong>BOX Premium sono inclusi 2 ticket</strong>.</span>}
                    />
                </div>


                {/* FINAL CTA */}
                <div className="mt-16 text-center">
                    <button onClick={() => handlePurchase(selectedPlan as 'start' | 'premium')} className="bg-gradient-to-r from-[#BF953F] via-[#D4AF37] to-[#B38728] text-white text-2xl font-bold uppercase tracking-[0.15em] py-5 px-12 rounded-xl hover:shadow-[0_0_50px_rgba(212,175,55,0.6)] transition-all transform hover:scale-105 border border-white/20">
                        Acquista Ora il Box {selectedPlan === 'premium' ? 'Premium' : 'Start'}
                    </button>
                </div>
            </div>


            {/* FOOTER - ADMIN & COPYRIGHT (Sempre Visibile) */}
            <div className="w-full bg-[#020617] border-t border-slate-800 p-8 text-center pb-24"> {/* Added pb-24 for floating footer */}
                <div className="text-slate-500 text-xs mb-6 space-y-1 font-medium leading-relaxed">
                    <p>HR SOLUTIONS SRL a socio unico</p>
                    <p>Partita Iva/CF: 02847580137 | iscritta in data 02/11/2004</p>
                    <p>Registro Imprese di Milano | REA: MI - 1828395</p>
                    <p>Viale Francesco Restelli 3/7, 20124 MILANO (ITALIA)</p>
                    <p>info@digital-coach.com</p>
                </div>
                <p className="text-slate-500 text-sm mb-4">© 2025 AI Team. Tutti i diritti riservati.</p>
                <button onClick={downloadLeadsCSV} className="inline-flex items-center gap-2 text-xs text-slate-600 hover:text-[#D4AF37] transition-colors border border-slate-800 rounded px-3 py-1 hover:border-[#D4AF37]">
                    <Database size={10} /> Admin: Scarica Contatti
                </button>
            </div>





            {/* FLOATING BUTTONS - POSIZIONATI PIÙ IN ALTO PER EVITARE FOOTER */}
            <div className="fixed bottom-24 md:bottom-28 left-4 z-50">
                <button onClick={() => setIsVoiceAgentOpen(true)} className="relative group bg-[#0f172a] border border-[#E11D48]/50 p-3 pr-5 rounded-full shadow-[0_0_30px_rgba(225,29,72,0.2)] hover:scale-105 transition-all flex items-center gap-3 overflow-hidden">
                    <div className="absolute inset-0 bg-[#E11D48]/5 animate-pulse"></div>
                    <div className="bg-gradient-to-br from-[#E11D48] to-[#9F1239] p-2 rounded-full shadow-lg"><PhoneCall className="text-white" size={24} /></div>
                    <div className="text-left"><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Parla a voce</p><p className="text-white font-bold text-sm leading-none">Claudia AI</p></div>
                </button>
            </div>
            <div className="fixed bottom-24 md:bottom-28 right-4 z-50">
                {!isChatOpen && (<button onClick={() => setIsChatOpen(true)} className="relative group w-16 h-16 rounded-full shadow-[0_0_30px_rgba(225,29,72,0.6)] hover:scale-110 transition-all border-2 border-[#E11D48] overflow-hidden bg-slate-900"><img src={JENNIFER_AVATAR} alt="Giulia AI" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" /><span className="absolute top-1 right-1 w-3 h-3 bg-green-500 rounded-full border border-slate-900 z-10"></span><span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-slate-900/90 text-white text-sm px-3 py-1 rounded-lg border border-[#E11D48] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Chatta con Giulia AI</span></button>)}
            </div>


            {/* MODAL JENNIFER (POSIZIONATO PIÙ IN ALTO E OTTIMIZZATO PER MOBILE) */}
            {isChatOpen && (
                <div className="fixed bottom-24 md:bottom-28 left-4 right-4 md:left-auto md:right-4 w-auto md:w-[400px] h-[550px] md:h-[600px] rounded-[30px] shadow-2xl z-[55] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300 font-sans border border-[#E11D48]/30 bg-slate-900/60 backdrop-blur-xl">
                    <div className="bg-[#E11D48] p-6 pb-6 flex items-center justify-between relative shadow-lg">
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-14 h-14 rounded-full border-2 border-white/30 p-0.5 shadow-lg relative"><img src={JENNIFER_AVATAR} alt="Jennifer" className="w-full h-full rounded-full object-cover" /><div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-[#E11D48]"></div></div>
                            <div><h4 className="text-white font-bold text-xl leading-none tracking-tight">Giulia AI</h4><p className="text-white/80 text-[10px] mt-1 uppercase tracking-widest font-bold">Assistente Operativo</p></div>
                        </div>
                        <button onClick={() => setIsChatOpen(false)} className="text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-all"><X size={20} /></button>
                    </div>
                    <div className="flex-grow p-4 md:p-5 overflow-y-auto space-y-6 chat-scroll relative bg-[#020617]/50">
                        {chatMessages.map((msg, idx) => (
                            <div key={idx} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {/* Avatar AI HIDDEN on mobile for messages to gain space, visible on desktop */}
                                {msg.sender === 'ai' && (<div className="hidden md:block w-8 h-8 rounded-full overflow-hidden mr-3 mt-1 shrink-0 border border-slate-600/50 shadow-sm"><img src={JENNIFER_AVATAR} alt="AI" className="w-full h-full object-cover opacity-90" /></div>)}
                                <div className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl text-sm leading-relaxed shadow-md backdrop-blur-md ${msg.sender === 'user' ? 'bg-[#E11D48] text-white rounded-br-none' : 'bg-slate-800/80 text-slate-100 border border-slate-700/50 rounded-tl-none shadow-inner'}`}>{renderFormattedText(msg.text)}</div>
                            </div>
                        ))}
                        {isChatTyping && (<div className="flex justify-start w-full animate-pulse"><div className="w-8 h-8 rounded-full overflow-hidden mr-3 mt-1 shrink-0 bg-slate-800 border border-slate-700 hidden md:block"></div><div className="bg-slate-800/60 p-4 rounded-2xl rounded-tl-none border border-slate-700/50 flex gap-1.5 items-center h-12 w-20"><div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div><div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div><div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div></div></div>)}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="p-4 bg-transparent relative z-10 pb-6">
                        <form onSubmit={handleChatSubmit} className="relative">
                            <input type="text" placeholder="Scrivi qui..." className="w-full bg-slate-800/90 border border-slate-700/50 rounded-full pl-6 pr-14 py-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#E11D48]/50 focus:ring-1 focus:ring-[#E11D48]/50 transition-all shadow-xl" value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
                            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#E11D48] hover:bg-[#be123c] text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-red-500/30 transition-all transform hover:scale-105"><Send size={18} className="ml-0.5" /></button>
                        </form>
                    </div>
                </div>
            )}


            {/* MODAL LUCA AI (Call Request) */}
            {isVoiceAgentOpen && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-[#0f172a] border-2 border-[#D4AF37] rounded-3xl w-full max-w-md p-8 relative shadow-[0_0_80px_rgba(212,175,55,0.2)] flex flex-col items-center">
                        <button onClick={() => { setIsVoiceAgentOpen(false); setCallStatus('idle'); }} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
                        <div className="mb-8 relative">
                            <div className={`w-32 h-32 rounded-full bg-gradient-to-br from-[#BF953F] to-[#B38728] flex items-center justify-center shadow-lg border-4 border-[#0f172a] transition-all duration-300`}>
                                <PhoneCall size={56} className="text-white" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-2">Claudia AI</h3>
                        <p className="text-[#D4AF37] text-sm uppercase tracking-widest font-bold mb-8">Consulente telefonico AI Box</p>


                        {callStatus === 'success' ? (
                            <div className="text-center animate-in mb-4">
                                <h4 className="text-2xl font-bold text-white mb-2">Chiamata inviata! 🚀</h4>
                                <p className="text-slate-300">Claudia ti sta chiamando ora sul tuo telefono.</p>
                                <p className="text-slate-400 text-sm mt-2">Rispondi per parlare con lei.</p>
                            </div>
                        ) : callStatus === 'error' ? (
                            <div className="text-center animate-in mb-4">
                                <h4 className="text-xl font-bold text-red-400 mb-2">Errore chiamata ⚠️</h4>
                                <p className="text-slate-300">Qualcosa è andato storto.</p>
                                <button onClick={() => setCallStatus('idle')} className="mt-4 text-[#D4AF37] underline">Riprova</button>
                            </div>
                        ) : (
                            <form onSubmit={handleContactSubmit} className="w-full bg-slate-900/80 p-6 rounded-2xl border border-[#D4AF37]/30 mb-4 shadow-xl z-20">
                                <h4 className="text-white text-lg font-bold mb-4 text-center">Claudia AI</h4>
                                <p className="text-slate-300 text-sm mb-4 text-center">Inserisci i tuoi dati per ricevere subito una chiamata da Claudia AI</p>
                                <div className="space-y-4">
                                    <input type="text" placeholder="Nome e Cognome" required className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] outline-none" value={contactData.name} onChange={(e) => setContactData({ ...contactData, name: e.target.value })} />
                                    <input type="email" placeholder="Email" required className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] outline-none" value={contactData.email} onChange={(e) => setContactData({ ...contactData, email: e.target.value })} />
                                    <input type="tel" placeholder="Numero di Telefono" required className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-[#D4AF37] outline-none" value={contactData.phone} onChange={(e) => setContactData({ ...contactData, phone: e.target.value })} />
                                    <button type="submit" disabled={isSubmittingForm || callStatus === 'calling'} className="w-full bg-[#D4AF37] hover:bg-[#b38f2d] text-black font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                                        {isSubmittingForm || callStatus === 'calling' ? <Loader2 className="animate-spin" /> : <>Chiamami ora! <PhoneCall size={18} /></>}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


// COMPONENTI AUSILIARI
const ServiceDetail = ({ icon, title, desc, isBonus = false }: { icon: any, title: string, desc: any, isBonus?: boolean }) => (
    <div className={`flex flex-col md:flex-row gap-6 p-6 md:p-8 rounded-2xl ${isBonus ? '' : 'bg-slate-900/50 border border-slate-800'}`}>
        <div className="shrink-0">
            <div className="w-16 h-16 rounded-full bg-[#0f172a] border border-slate-700 flex items-center justify-center shadow-lg">
                {React.cloneElement(icon, { size: 32 })}
            </div>
        </div>
        <div>
            <h4 className="text-2xl font-bold text-white mb-3 uppercase tracking-tight flex items-center gap-3">
                {title}
                {isBonus && <span className="bg-[#D4AF37] text-black text-xs px-2 py-1 rounded font-bold">SOLO PREMIUM</span>}
            </h4>
            <p className="text-slate-300 text-lg leading-relaxed">{desc}</p>
        </div>
    </div>
);


const ListItem = ({ icon, title, desc, isPremiumBase = false }: { icon: any, title: string, desc: string, isPremiumBase?: boolean }) => (<div className={`flex items-start gap-4 ${isPremiumBase ? 'opacity-70' : ''}`}><div className={`mt-1 shrink-0 p-2 rounded-lg bg-slate-800 text-slate-400`}>{React.cloneElement(icon, { size: 24 })}</div><div><div className="font-bold text-2xl leading-none mb-1 text-slate-200 uppercase">{title}</div><div className="text-base leading-tight font-medium text-slate-500">{desc}</div></div></div>);
const UpgradeItem = ({ icon, quantity, unit, upgradeNote, highlight = false, goldNumber = false }: { icon: any, quantity: string, unit: string, upgradeNote: string, highlight?: boolean, goldNumber?: boolean }) => (<div className="flex items-start gap-4"><div className={`mt-1 shrink-0 p-2 rounded-lg bg-[#D4AF37]/20 text-[#FBF5B7] shadow-[0_0_10px_rgba(212,175,55,0.2)]`}>{React.cloneElement(icon, { size: 24 })}</div><div><div className="flex items-baseline gap-2"><span className={`font-bold text-3xl leading-none ${goldNumber ? 'text-[#D4AF37] text-4xl' : highlight ? 'text-[#FBF5B7]' : 'text-white'}`}>{quantity}</span><span className={`font-bold text-lg uppercase ${highlight ? 'text-white' : 'text-[#D4AF37]'}`}>{unit}</span></div><div className={`text-sm font-bold mt-1 ${highlight ? 'text-white/90' : 'text-slate-400'}`}><CheckCircle2 size={12} className="inline mr-1 text-[#D4AF37]" />{upgradeNote}</div></div></div>);


export default BusinessAIGiftLanding;
