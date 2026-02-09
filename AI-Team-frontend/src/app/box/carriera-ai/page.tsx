'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Check, Star, Zap, Users, MonitorPlay, Gift, ArrowRight, Sparkles,
    CreditCard, ChevronDown, CheckCircle2, GraduationCap, Coins,
    Lightbulb, Loader2, Mic, MicOff, X, Volume2, StopCircle,
    PhoneCall, MessageCircle, Send, Download, Database, Lamp, Briefcase
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, Firestore } from 'firebase/firestore';
import { ContactData, ChatMessage } from '@/app/box/types';
import { getGiuliaSystemPrompt, getInitialGreeting } from '@/app/box/giulia-prompts';
import { queryPineconeForContext } from '@/app/box/pinecone-query';

// --- FIREBASE INIT ---
let db: Firestore | null = null;
let auth: Auth | null = null;
let appId = 'ai-career-gift';

// Safely initialize Firebase on the client side
if (typeof window !== 'undefined') {
    try {
        const configStr = process.env.NEXT_PUBLIC_FIREBASE_CONFIG;
        if (configStr) {
            const firebaseConfig = JSON.parse(configStr);
            // Avoid double initialization in strict mode/Next.js navigation
            const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
            auth = getAuth(app);
            db = getFirestore(app);
        }
    } catch (e) {
        console.warn("Firebase init skipped or failed:", e);
    }
}

const BusinessAIGiftLanding: React.FC = () => {
    const [selectedPlan, setSelectedPlan] = useState<'start' | 'premium'>('premium');
    const [imgError, setImgError] = useState(false);

    // --- AUTH STATE ---
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        if (!auth) return;
        const initAuth = async () => {
            try {
                if ((window as any).__initial_auth_token) {
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

    // --- STATES ---
    const [showContactForm, setShowContactForm] = useState(false);
    const [contactData, setContactData] = useState<{ name: string, phone: string, email: string }>({ name: '', phone: '', email: '' });
    const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'success' | 'error'>('idle');
    const [isSubmittingForm, setIsSubmittingForm] = useState(false);
    const [leadCaptured, setLeadCaptured] = useState(false);

    const [careerInput, setCareerInput] = useState('');
    const [aiIdea, setAiIdea] = useState('');
    const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);

    const [isVoiceAgentOpen, setIsVoiceAgentOpen] = useState(false);

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ sender: 'ai', text: getInitialGreeting() }]);
    const [chatInput, setChatInput] = useState("");
    const [isChatTyping, setIsChatTyping] = useState(false);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const conversationActiveRef = useRef(false);

    // ASSETS
    const LOGO_URL = "https://www.ai-scaleup.com/wp-content/uploads/2025/12/Ai-Team-Gold-Oro-Transparent.png";
    const JENNIFER_AVATAR = "https://www.digital-coach.com/wp-content/uploads/2025/12/Giulia-small-x-chat.png";
    const ALADINO_ICON = <Lamp className="text-[#D4AF37]" size={24} />;

    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

    // --- HANDLERS ---
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
            if (db && user) {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'leads'), {
                    ...contactData,
                    timestamp: new Date().toISOString(),
                    source: 'Claudia Voice AI - Gift B2C',
                    userId: user.uid,
                    status: 'new'
                });
            } else {
                localStorage.setItem('last_lead', JSON.stringify(contactData));
            }
            setLeadCaptured(true);

            // Trigger Call
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
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "leads_ai_gift.csv");
            document.body.appendChild(link);
            link.click();
        } catch (error) {
            console.error(error);
            alert("Errore download.");
        }
    };

    const scrollToPricing = () => {
        const element = document.getElementById('pricing');
        if (element) element.scrollIntoView({ behavior: 'smooth' });
    };

    const handlePurchase = (plan: 'start' | 'premium') => {
        if (plan === 'start') {
            window.location.href = 'https://members.digital-coach.com/offers/pF8FCd6y/checkout';
        } else {
            window.location.href = 'https://members.digital-coach.com/offers/K2Dz8dP2/checkout';
        }
    };

    // --- CHAT JENNIFER / GIULIA ---
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
            const namespace = process.env.NEXT_PUBLIC_CARRIERA_NAMESPACE || 'carriera-ai';
            const ragContext = await queryPineconeForContext(userMsg, namespace);

            // Build conversation history for context (last 10 messages)
            const conversationHistory = updatedMessages.slice(-10).map(msg =>
                `${msg.sender === 'user' ? 'UTENTE' : 'GIULIA'}: ${msg.text}`
            ).join('\n');

            const systemPrompt = getGiuliaSystemPrompt('carriera');
            const contextSection = ragContext ? `\n\n--- CONTESTO PRODOTTO (da knowledge base) ---\n${ragContext}` : '';
            const prompt = `${systemPrompt}${contextSection}\n\n--- CRONOLOGIA CONVERSAZIONE ---\n${conversationHistory}\n\n--- ISTRUZIONI ---\nRispondi al messaggio più recente dell'utente in modo naturale, seguendo il playbook. Usa le informazioni dal contesto prodotto se rilevanti. Max 4-5 righe. Italiano.`;

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const data = await res.json();
            setChatMessages(prev => [...prev, { sender: 'ai', text: data.candidates?.[0]?.content?.parts?.[0]?.text || "Sto elaborando la tua richiesta..." }]);
        } catch (error) {
            setChatMessages(prev => [...prev, { sender: 'ai', text: "Errore di connessione." }]);
        } finally {
            setIsChatTyping(false);
        }
    };




    // --- GENERATORE CARRIERA (LAURA AI -> IDEA REGALO) ---
    const generateCareerPath = async () => {
        if (!careerInput.trim()) return; setIsGeneratingIdea(true); setAiIdea('');
        try {
            const prompt = `Sei Laura AI, Career Coach esperta. L'utente vuole fare un regalo a qualcuno e ti descrive la persona e i suoi sogni/paure: "${careerInput}". Genera un consiglio su perché un corso AI sarebbe il regalo perfetto per QUESTA persona specifica. Struttura: 🧞‍♂️ **Analisi:** (Basata su ciò che ha detto). 💡 **Potenziale:** (Quale ruolo AI potrebbe fare). 🎁 **Perché questo regalo:** (Perché è meglio di oggetti fisici). ✨ **Conclusione.** 15 righe circa. Tono persuasivo per chi compra il regalo.`;
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
        .voice-wave { display: flex; align-items: center; justify-content: center; gap: 4px; height: 30px; }
        .voice-bar { width: 5px; background-color: #E11D48; border-radius: 3px; animation: wave 0.8s ease-in-out infinite; }
        @keyframes wave { 0%, 100% { height: 8px; opacity: 0.5; } 50% { height: 30px; opacity: 1; } }
        .voice-bar:nth-child(1) { animation-delay: 0.0s; } .voice-bar:nth-child(2) { animation-delay: 0.1s; } .voice-bar:nth-child(3) { animation-delay: 0.2s; } .voice-bar:nth-child(4) { animation-delay: 0.3s; } .voice-bar:nth-child(5) { animation-delay: 0.4s; }
        .chat-scroll::-webkit-scrollbar { width: 6px; } .chat-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); } .chat-scroll::-webkit-scrollbar-thumb { background: rgba(225, 29, 72, 0.5); border-radius: 10px; }
      `}} />

            {/* HERO SECTION - REWRITTEN FOR GIFT GIVER - UPDATED */}
            <div className="relative overflow-hidden pt-0 md:pt-12 pb-12 mt-0">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[400px] md:h-[600px] bg-[#E11D48]/10 blur-[80px] md:blur-[120px] rounded-full pointer-events-none" />
                <div className="max-w-4xl mx-auto px-4 text-center relative z-10 flex flex-col items-center">
                    <div className="mt-2 mb-0 md:-mt-16 md:-mb-8 w-full max-w-[380px] md:max-w-[600px] h-auto flex justify-center items-center transition-opacity duration-500 hover:opacity-90 relative z-20">
                        {!imgError ? (<img src={LOGO_URL} alt="AI TEAM Logo Gold" className="w-full h-auto drop-shadow-[0_0_30px_rgba(212,175,55,0.6)]" onError={() => setImgError(true)} />) : (<div className="border-4 border-[#D4AF37] rounded-xl p-4 shadow-[0_0_30px_rgba(212,175,55,0.3)] bg-black/40 backdrop-blur-sm mt-16"><h1 className="text-6xl text-transparent bg-clip-text bg-gradient-to-r from-[#BF953F] to-[#AA771C]">AI TEAM</h1></div>)}
                    </div>
                    <div className="inline-flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-full px-5 py-1.5 mb-8 backdrop-blur-md shadow relative z-10"><Gift className="w-4 h-4 text-[#D4AF37]" /><span className="text-sm font-bold text-[#D4AF37] tracking-[0.15em] uppercase">Il Regalo Più Originale del 2025</span></div>
                    <h1 className="text-4xl md:text-8xl font-bold tracking-tight text-white mb-6 drop-shadow-2xl leading-[0.9]">
                        REGALA IL FUTURO<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#BF953F] via-[#FBF5B7] to-[#AA771C]">IL PASS PER AVVIARE</span><br />
                        UNA CARRIERA AI
                    </h1>
                    <p className="text-slate-300 text-xl md:text-2xl mb-8 max-w-4xl mx-auto leading-relaxed font-medium">
                        Basta con i soliti regali. Dona le competenze che le aziende si contenderanno nei prossimi anni!
                        Aiuta i tuoi cari ad avviare una nuova carriera nel mercato dell’ <strong>INTELLIGENZA ARTIFICIALE</strong> che avrà tassi di crescita annui di oltre il <strong>30%</strong> da qui al 2033.<br /><br />
                        Offri loro la formazione, la consulenza di Carriera e il Coaching 1-1 degli esperti (umani) di <strong>Digital Coach®</strong>, la migliore Scuola Italiana di formazione sull’Intelligenza Artificiale.
                    </p>
                    <div className="max-w-lg mx-auto bg-gradient-to-r from-slate-900 to-slate-800 border border-[#D4AF37]/40 rounded-xl p-4 flex items-center justify-center gap-4 shadow-lg mb-10 transform hover:scale-105 transition-transform duration-300 cursor-pointer group"><div className="bg-[#D4AF37]/20 p-3 rounded-full shadow group-hover:bg-[#D4AF37]/30 transition-colors"><Sparkles className="w-6 h-6 text-[#FBF5B7]" /></div><div className="text-left"><p className="text-xs text-[#D4AF37] uppercase font-bold tracking-wider mb-0.5">Vantaggio Fiscale</p><p className="text-lg text-white font-bold">Hai P.IVA? Scarica il 100% e detrai l’IVA</p></div></div>
                </div>
            </div>

            {/* PRICING - REWRITTEN AS GIFT OPTIONS */}
            <div className="max-w-7xl mx-auto px-4 py-24 pt-32 md:pt-24" id="pricing">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-7xl font-bold text-white uppercase mb-4">Scegli il Regalo</h2>
                    <p className="text-slate-400 text-xl font-medium">Due pacchetti regalo per lasciare a bocca aperta chi lo riceve.</p>
                </div>
                <div className="flex justify-center mb-8 md:hidden relative z-40">
                    <div className="bg-[#0f172a]/90 backdrop-blur p-1 rounded-full border border-slate-700 flex shadow-2xl scale-90">
                        <button onClick={() => setSelectedPlan('start')} className={`px-6 py-3 rounded-full font-bold uppercase transition-all text-sm ${selectedPlan === 'start' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>START</button>
                        <button onClick={() => setSelectedPlan('premium')} className={`px-6 py-3 rounded-full font-bold uppercase transition-all text-sm ${selectedPlan === 'premium' ? 'bg-gradient-to-r from-[#BF953F] to-[#B38728] text-white' : 'text-slate-500'}`}>PREMIUM</button>
                    </div>
                </div>
                <div className="grid md:grid-cols-2 gap-8 items-stretch max-w-6xl mx-auto mb-16 pt-12 md:pt-0">
                    {/* Box START - GIFT */}
                    <div className={`bg-[#0f172a]/40 backdrop-blur-sm border rounded-3xl p-6 md:p-10 flex flex-col ${selectedPlan === 'start' ? 'border-slate-500 ring-1 ring-slate-500/50' : 'border-slate-800 hidden md:flex'}`}>
                        <div className="mb-6"><h3 className="text-3xl md:text-4xl font-bold text-white mb-2">Regalo START</h3><p className="text-slate-400 text-base md:text-lg">Il pensiero che accende la passione.</p></div>
                        <div className="mb-8 pb-8 border-b border-slate-800">
                            <div className="text-2xl md:text-4xl text-slate-400 font-bold mb-2 ml-1 line-through decoration-[#D4AF37] decoration-4">Valore Reale €877</div>
                            <div className="flex items-baseline gap-2"><span className="text-5xl md:text-6xl font-bold text-white">€97</span><span className="text-xl font-medium text-slate-500"></span></div>
                        </div>
                        <div className="space-y-8 flex-grow mb-10">
                            <p className="text-sm font-bold text-slate-300 uppercase tracking-[0.2em] mb-4">IL TUO REGALO INCLUDE:</p>
                            <ListItem icon={<MonitorPlay />} title="Video corso AI Power" desc="Per imparare le basi dell'IA." value="Valore €197" />
                            <ListItem icon={<Users />} title="2 Consulenze Carriera" desc="Con Esperto Umano." value="Valore €300" />
                            <ListItem icon={<Star />} title="1 Biglietto Evento" desc="Ai Team Experience (Valore €380)." value="Valore €380" />
                        </div>
                        <button onClick={() => handlePurchase('start')} className="w-full py-5 rounded-xl border-2 border-slate-600 text-white text-xl font-bold uppercase hover:bg-slate-800 transition-all flex items-center justify-center gap-3">Acquista Ora <ArrowRight className="w-6 h-6" /></button>
                    </div>
                    {/* Box PREMIUM - GIFT */}
                    <div className={`bg-gradient-to-b from-[#0f172a] to-[#020617] border-2 rounded-3xl p-6 md:p-10 flex flex-col transform md:-translate-y-6 shadow-2xl ${selectedPlan === 'premium' ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30' : 'border-slate-800 hidden md:flex'}`}>
                        <div className="bg-gradient-to-r from-[#BF953F] via-[#FBF5B7] to-[#B38728] text-slate-900 font-black text-xs md:text-sm uppercase px-6 md:px-8 py-2 md:py-2.5 rounded-full shadow border border-white/40 flex items-center justify-center gap-2 whitespace-nowrap mb-4 md:absolute md:-top-5 md:left-1/2 md:-translate-x-1/2 md:mb-0 w-max mx-auto"><Gift size={16} strokeWidth={3} /> Best Gift 2025</div>
                        <div className="mb-6 mt-2"><h3 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#BF953F] via-[#FBF5B7] to-[#BF953F]">Regalo PREMIUM</h3><p className="text-slate-300 text-base md:text-lg">Per chi vuoi vedere decollare.</p></div>
                        <div className="mb-8 pb-8 border-b border-[#D4AF37]/20">
                            <div className="text-2xl md:text-4xl text-slate-400 font-bold mb-2 ml-1 line-through decoration-[#D4AF37] decoration-4">Valore Reale €1.898</div>
                            <div className="flex items-baseline gap-2"><span className="text-6xl md:text-7xl font-bold text-white">€197</span><span className="text-xl font-medium text-slate-500"></span></div>
                        </div>
                        <div className="space-y-6 flex-grow mb-10">
                            <p className="text-sm font-bold text-[#D4AF37] uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Sparkles size={16} /> COSA REGALI (Valore Totale):</p>
                            <ListItem icon={<MonitorPlay />} title="Videocorso AI Power" desc="Incluso nel pacchetto" isPremiumBase={true} value="Valore €197" />

                            <UpgradeItem
                                icon={<Briefcase className="text-[#FBF5B7]" />}
                                quantity="Test & Report"
                                unit="Analisi Personalità Professionale"
                                upgradeNote="Per trovare la carriera perfetta"
                                value="Valore €147"
                            />

                            <div className="bg-[#D4AF37]/10 p-3 rounded-xl border border-[#D4AF37]/30 shadow-sm mb-2 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D4AF37]/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                                <UpgradeItem
                                    icon={<Zap className="text-[#FBF5B7]" />}
                                    quantity="Laura AI"
                                    unit="Career Coach Personale (30gg)"
                                    upgradeNote="Un'assistente dedicata H24"
                                    highlight={true}
                                    goldNumber={true}
                                    value="Valore €197"
                                />
                            </div>

                            <ListItem icon={<MonitorPlay />} title="Videocorso LinkedIn" desc="Per trovare lavoro velocemente." isPremiumBase={true} value="Valore €147" />

                            <UpgradeItem icon={<Users className="text-[#FBF5B7]" />} quantity="3" unit="Consulenze 1-1" upgradeNote="+1 rispetto alla Start" value="Valore €450" />

                            <div className="bg-gradient-to-br from-[#D4AF37]/20 to-[#B38728]/10 p-4 rounded-2xl border border-[#D4AF37]/40 shadow relative overflow-hidden">
                                <UpgradeItem icon={<Star className="text-[#FBF5B7]" />} quantity="2" unit="Ticket Evento Experience" upgradeNote="UNO PER LUI/LEI + UNO PER TE!" highlight={true} value="Valore €760" />
                            </div>
                        </div>
                        <button onClick={() => handlePurchase('premium')} className="w-full py-6 rounded-xl bg-gradient-to-r from-[#BF953F] via-[#D4AF37] to-[#B38728] text-white text-2xl font-bold uppercase hover:shadow-[0_0_40px_rgba(212,175,55,0.5)] transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"><span className="relative z-10 flex items-center gap-2">Acquista Ora <ArrowRight className="w-7 h-7" /></span></button>
                    </div>
                </div>
            </div>

            {/* --- SECTION: VANTAGGIO FISCALE (GIFT CONTEXT) --- */}
            <div className="max-w-4xl mx-auto bg-slate-900/80 border border-[#D4AF37]/50 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 shadow-[0_0_40px_rgba(212,175,55,0.15)] mb-20 relative overflow-hidden">
                <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="shrink-0 bg-[#D4AF37]/20 p-4 rounded-full border border-[#D4AF37]/30">
                    <Coins size={40} className="text-[#FBF5B7]" />
                </div>
                <div className="text-center md:text-left">
                    <h4 className="text-2xl font-bold text-white mb-2 uppercase tracking-wide">Hai Partita IVA? Il regalo ti costa Zero!</h4>
                    <p className="text-slate-300 text-lg leading-relaxed">
                        Fornendoci i dati di fatturazione puoi <strong>scaricare il 100% del costo</strong> e recuperare il 22% di Iva se il tuo regime fiscale (quasi sempre) prevede spese in formazione o software.
                    </p>
                </div>
            </div>

            {/* TEST DRIVE AI (LAURA AI - GIFT ADVISOR) */}
            <div className="relative py-12 px-4 mb-20">
                <div className="max-w-3xl mx-auto bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-3xl border border-[#D4AF37]/30 p-1 p-8 shadow relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="relative z-10 text-center">
                        <div className="inline-flex items-center gap-2 bg-[#D4AF37]/20 text-[#FBF5B7] px-4 py-1 rounded-full text-sm font-bold mb-4 border border-[#D4AF37]/30">
                            {ALADINO_ICON} PROVA UNA MINI CONSULENZA CON LAURA AI
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-3 uppercase">
                            Chiedi al Genio se questo regalo<br />
                            <span className="text-[#D4AF37]">è adatto alla persona a cui pensi!</span>
                        </h3>
                        <p className="text-slate-400 mb-8 max-w-lg mx-auto text-lg">
                            Descrivi la persona a cui vuoi fare il regalo: i suoi sogni o passioni, i suoi problemi e paure. Ti dirò perché questo pacchetto la renderà felice.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mb-6">
                            <input type="text" placeholder="Es: la mia ragazza che non sopporta il suo capo e sogna di lavorare viaggiando..." className="flex-grow bg-slate-900 border border-slate-700 rounded-xl px-5 py-4 text-white focus:border-[#D4AF37] outline-none text-lg" value={careerInput} onChange={(e) => setCareerInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && generateCareerPath()} />
                            <button onClick={generateCareerPath} disabled={isGeneratingIdea || !careerInput} className="bg-gradient-to-r from-[#BF953F] to-[#B38728] text-white font-bold py-4 px-6 rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] whitespace-nowrap flex items-center justify-center gap-2 text-lg">{isGeneratingIdea ? <Loader2 className="animate-spin" /> : 'Dammi un Consiglio ✨'}</button>
                        </div>
                        {aiIdea && (
                            <div className="mt-6 bg-slate-900/80 border border-[#D4AF37]/30 rounded-xl p-4 md:p-6 text-left animate-in fade-in">
                                <div className="flex items-start gap-3 md:gap-4">
                                    <div className="hidden md:block bg-[#D4AF37]/20 p-2 rounded-lg shrink-0">
                                        <Sparkles className="text-[#FBF5B7]" size={24} />
                                    </div>
                                    <div className="text-slate-200 text-base md:text-lg leading-relaxed space-y-4 w-full">
                                        {renderFormattedText(aiIdea)}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- SECTION: DETTAGLIO SERVIZI - Copy Gift Oriented --- */}
            <div className="max-w-5xl mx-auto pb-20">
                <h3 className="text-4xl font-bold text-center text-white mb-12 uppercase tracking-widest flex items-center justify-center gap-4">
                    <span className="h-[1px] w-12 bg-slate-700"></span>
                    Cosa contiene il Pacchetto Regalo?
                    <span className="h-[1px] w-12 bg-slate-700"></span>
                </h3>

                <div className="space-y-8">
                    <ServiceDetail
                        icon={<Zap className="text-[#D4AF37]" />}
                        title="Laura AI: La Sua Nuova Consulente di Carriera"
                        desc={<span>Nel regalo Premium, la persona riceverà l'accesso per 30 giorni a <strong>Laura AI</strong>. Immagina di regalarle un consulente esperto disponibile 24/7 per aiutarla a <strong>comprendere i suoi punti di forza</strong>, orientarla verso i lavori che la renderebbero felice e in cui farebbe più strada, guidarla nelle scelte professionali di lungo termine, scrivere il CV perfetto e prepararsi ai colloqui. Un aiuto concreto che vale più di mille oggetti.</span>}
                        isBonus={true}
                    />
                    <ServiceDetail
                        icon={<MonitorPlay className="text-[#D4AF37]" />}
                        title="Video corso AI Power"
                        desc={<span>La base per non restare indietro. Con questo corso di orientamento <strong>Luca Papa</strong>, uno dei più affermati formatori italiani in ambito tecnologico, anticipa ciò che accadrà nel mondo del lavoro a seguito della Rivoluzione tecnologica più grande del nostro secolo. Gli spiegherà come non rimanere travolto dall’onda AI ma anzi, salirci sopra e cavalcarla! Come l’ AI può <strong>migliorare il nostro lavoro, il nostro stipendio e il nostro stile di vita!</strong> Stai regalando un vantaggio competitivo enorme.</span>}
                    />
                    <ServiceDetail
                        icon={<Briefcase className="text-[#D4AF37]" />}
                        title="Mappa della Personalità & Carriera"
                        desc={<span>Spesso non sappiamo per cosa siamo portati, non conosciamo abbastanza i nostri <strong>talenti</strong>, i nostri punti di forza le nostre attitudini e motivazioni. Questo regalo include un <strong>Test Professionale</strong> e un Report personalizzato che la aiuterà a capire dove e come esprimere il proprio potenziale professionale per avviare finalmente una carriera appagante e redditizia dal punto di vista economico.</span>}
                    />
                    <ServiceDetail
                        icon={<Users className="text-[#D4AF37]" />}
                        title="Consulenze Private 1-1"
                        desc={<span>Oltre alla tecnologia abbiamo pensato anche all’ <strong>esperienza umana</strong>. Regalerai sessioni private con esperti veri che guarderanno il suo CV e la guideranno passo passo. Inclusa la strategia per usare <strong>LinkedIn</strong> e farsi trovare e scegliere dalle aziende.</span>}
                    />
                    <ServiceDetail
                        icon={<Star className="text-[#D4AF37]" />}
                        title="AI Team Experience (Evento Esperienza Live)"
                        desc={<span>Un evento formativo di Luca Papa ed il suo Ai Team, in diretta Online di 3 serate. Frequentabile a scelta in una delle 5 edizioni annue. Con il pacchetto Premium, <strong>i biglietti sono 2!</strong> Significa che potrai partecipare anche tu insieme a lei/lui, oppure potrà portare un amico. Un'esperienza interattiva nella quale gli metteremo a disposizione un <strong>team di 10 agenti professionisti AI</strong> con i quali potrà provare cosa significa diventare il manager di un team AI che ogni azienda si contenderà!</span>}
                    />
                </div>

                {/* FINAL CTA */}
                <div className="mt-16 text-center">
                    <button onClick={() => handlePurchase(selectedPlan)} className="bg-gradient-to-r from-[#BF953F] via-[#D4AF37] to-[#B38728] text-white text-2xl font-bold uppercase tracking-[0.15em] py-5 px-12 rounded-xl hover:shadow-[0_0_50px_rgba(212,175,55,0.6)] transition-all transform hover:scale-105 border border-white/20">
                        Regala Ora Carriera {selectedPlan === 'premium' ? 'Premium' : 'Start'}
                    </button>
                    <p className="mt-4 text-slate-500 text-sm font-medium">Fai un regalo che lascia il segno.</p>
                </div>
            </div>

            {/* FOOTER - ADMIN & COPYRIGHT */}
            <div className="w-full bg-[#020617] border-t border-slate-800 p-8 text-center pb-24">
                <div className="text-slate-500 text-xs mb-6 space-y-1 font-medium leading-relaxed">
                    <p>HR SOLUTIONS SRL a socio unico</p>
                    <p>Partita Iva/CF: 02847580137 | iscritta in data 02/11/2004</p>
                    <p>Registro Imprese di Milano | REA: MI - 1828395</p>
                    <p>Viale Francesco Restelli 3/7, 20124 MILANO (ITALIA)</p>
                    <p>info@digital-coach.com</p>
                </div>
                <p className="text-slate-500 text-sm mb-4">© 2025 AI Team. Tutti i diritti riservati.</p>
                <button onClick={downloadLeadsCSV} className="inline-flex items-center gap-2 text-xs text-slate-600 hover:text-[#D4AF37] transition-colors border border-slate-800 rounded px-3 py-1 hover:border-[#D4AF37]">
                    <Database size={10} /> Admin: Scarica Leads
                </button>
            </div>

            {/* FOOTER FIXED - ACQUISTA ORA */}
            <div className="fixed bottom-0 w-full bg-[#020617]/95 backdrop-blur-lg border-t border-[#D4AF37]/30 p-4 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] pb-6">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                    <div className="text-xs text-slate-300">
                        <span className="block font-bold text-white text-sm uppercase tracking-wide text-[#D4AF37]">OFFERTA REGALO</span>
                        Promo valida fino al 25 dicembre
                    </div>
                    <button
                        onClick={scrollToPricing}
                        className="bg-gradient-to-r from-[#BF953F] to-[#B38728] text-white font-bold uppercase tracking-wider py-3 px-8 rounded-xl text-sm shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:scale-105 transition-transform"
                    >
                        Fai il Regalo
                    </button>
                </div>
            </div>

            {/* FLOATING BUTTONS */}
            <div className="fixed bottom-24 md:bottom-28 left-4 z-50">
                <button onClick={() => setIsVoiceAgentOpen(true)} className="relative group bg-[#0f172a] border border-[#E11D48]/50 p-3 pr-5 rounded-full shadow-[0_0_30px_rgba(225,29,72,0.2)] hover:scale-105 transition-all flex items-center gap-3 overflow-hidden">
                    <div className="absolute inset-0 bg-[#E11D48]/5 animate-pulse"></div>
                    <div className="bg-gradient-to-br from-[#E11D48] to-[#9F1239] p-2 rounded-full shadow-lg"><PhoneCall className="text-white" size={24} /></div>
                    <div className="text-left"><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Chiedi info a voce</p><p className="text-white font-bold text-sm leading-none">Claudia AI</p></div>
                </button>
            </div>
            <div className="fixed bottom-24 md:bottom-28 right-4 z-50">
                {!isChatOpen && (<button onClick={() => setIsChatOpen(true)} className="relative group w-16 h-16 rounded-full shadow-[0_0_30px_rgba(225,29,72,0.6)] hover:scale-110 transition-all border-2 border-[#E11D48] overflow-hidden bg-slate-900"><img src={JENNIFER_AVATAR} alt="Giulia AI" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" /><span className="absolute top-1 right-1 w-3 h-3 bg-green-500 rounded-full border border-slate-900 z-10"></span><span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-slate-900/90 text-white text-sm px-3 py-1 rounded-lg border border-[#E11D48] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">Chatta con Giulia</span></button>)}
            </div>

            {/* MODAL JENNIFER / GIULIA */}
            {isChatOpen && (
                <div className="fixed bottom-24 md:bottom-28 right-4 w-[350px] md:w-[400px] h-[600px] rounded-[30px] shadow-2xl z-[55] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300 font-sans border border-[#E11D48]/30 bg-slate-900/60 backdrop-blur-xl">
                    <div className="bg-[#E11D48] p-6 pb-6 flex items-center justify-between relative shadow-lg">
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="w-14 h-14 rounded-full border-2 border-white/30 p-0.5 shadow-lg relative"><img src={JENNIFER_AVATAR} alt="Jennifer" className="w-full h-full rounded-full object-cover" /><div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-[#E11D48]"></div></div>
                            <div><h4 className="text-white font-bold text-xl leading-none tracking-tight">Giulia AI</h4><p className="text-white/80 text-[10px] mt-1 uppercase tracking-widest font-bold">Gift Advisor</p></div>
                        </div>
                        <button onClick={() => setIsChatOpen(false)} className="text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-all"><X size={20} /></button>
                    </div>
                    <div className="flex-grow p-4 md:p-5 overflow-y-auto space-y-6 chat-scroll relative bg-[#020617]/50">
                        {chatMessages.map((msg, idx) => (
                            <div key={idx} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.sender === 'ai' && (<div className="hidden md:block w-8 h-8 rounded-full overflow-hidden mr-3 mt-1 shrink-0 border border-slate-600/50 shadow-sm"><img src={JENNIFER_AVATAR} alt="AI" className="w-full h-full object-cover opacity-90" /></div>)}
                                <div className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl text-sm leading-relaxed shadow-md backdrop-blur-md ${msg.sender === 'user' ? 'bg-[#E11D48] text-white rounded-br-none' : 'bg-slate-800/80 text-slate-100 border border-slate-700/50 rounded-tl-none shadow-inner'}`}>{renderFormattedText(msg.text)}</div>
                            </div>
                        ))}
                        {isChatTyping && (<div className="flex justify-start w-full animate-pulse"><div className="w-8 h-8 rounded-full overflow-hidden mr-3 mt-1 shrink-0 bg-slate-800 border border-slate-700 hidden md:block"></div><div className="bg-slate-800/60 p-4 rounded-2xl rounded-tl-none border border-slate-700/50 flex gap-1.5 items-center h-12 w-20"><div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div><div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div><div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div></div></div>)}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="p-4 bg-transparent relative z-10 pb-6">
                        <form onSubmit={handleChatSubmit} className="relative">
                            <input type="text" placeholder="Per chi è il regalo?" className="w-full bg-slate-800/90 border border-slate-700/50 rounded-full pl-6 pr-14 py-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#E11D48]/50 focus:ring-1 focus:ring-[#E11D48]/50 transition-all shadow-xl" value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
                            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#E11D48] hover:bg-[#be123c] text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-red-500/30 transition-all transform hover:scale-105"><Send size={18} className="ml-0.5" /></button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL CLAUDIA AI (Call Request) */}
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
const ServiceDetail = ({ icon, title, desc, isBonus = false }: { icon: any, title: string, desc: React.ReactNode, isBonus?: boolean }) => (
    <div className={`flex flex-col md:flex-row gap-4 md:gap-6 p-6 md:p-8 rounded-2xl ${isBonus ? '' : 'bg-slate-900/50 border border-slate-800'}`}>
        <div className="shrink-0 flex justify-center md:block">
            <div className="w-16 h-16 rounded-full bg-[#0f172a] border border-slate-700 flex items-center justify-center shadow-lg">
                {React.cloneElement(icon as any, { size: 32 })}
            </div>
        </div>
        <div className="text-center md:text-left">
            <h4 className="text-xl md:text-2xl font-bold text-white mb-3 uppercase tracking-tight flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-3">
                {title}
                {isBonus && <span className="bg-[#D4AF37] text-black text-[10px] md:text-xs px-2 py-1 rounded font-bold whitespace-nowrap">SOLO PREMIUM</span>}
            </h4>
            <div className="text-slate-300 text-base md:text-lg leading-relaxed">{desc}</div>
        </div>
    </div>
);

const ListItem = ({ icon, title, desc, isPremiumBase = false, value }: { icon: any, title: string, desc: string, isPremiumBase?: boolean, value?: string }) => (
    <div className={`flex flex-col md:flex-row items-start gap-3 md:gap-4 ${isPremiumBase ? 'opacity-70' : ''}`}>
        <div className={`mt-1 shrink-0 p-2 rounded-lg bg-slate-800 text-slate-400 hidden md:block`}>{React.cloneElement(icon as any, { size: 24 })}</div>
        <div className="w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-1 md:gap-0">
                <div className="font-bold text-lg md:text-2xl leading-none mb-1 text-slate-200 uppercase flex items-center gap-2">
                    <span className="md:hidden">{React.cloneElement(icon as any, { size: 18 })}</span> {title}
                </div>
                {value && <div className="text-[10px] md:text-xs font-bold text-[#D4AF37]/80 bg-[#D4AF37]/10 px-2 py-1 rounded self-start md:self-auto">{value}</div>}
            </div>
            <div className="text-sm md:text-base leading-tight font-medium text-slate-500">{desc}</div>
        </div>
    </div>
);

const UpgradeItem = ({ icon, quantity, unit, upgradeNote, highlight = false, goldNumber = false, value }: { icon: any, quantity: string, unit: string, upgradeNote: string, highlight?: boolean, goldNumber?: boolean, value?: string }) => (
    <div className="flex flex-col md:flex-row items-start gap-3 md:gap-4">
        <div className={`mt-1 shrink-0 p-2 rounded-lg bg-[#D4AF37]/20 text-[#FBF5B7] shadow-[0_0_10px_rgba(212,175,55,0.2)] hidden md:block`}>
            {React.cloneElement(icon as any, { size: 24 })}
        </div>
        <div className="w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-start gap-1 md:gap-0">
                <div className="flex items-baseline gap-2">
                    <span className="md:hidden self-center mr-1 p-1.5 rounded-lg bg-[#D4AF37]/20 text-[#FBF5B7]">{React.cloneElement(icon as any, { size: 16 })}</span>
                    <span className={`font-bold text-2xl md:text-3xl leading-none ${goldNumber ? 'text-[#D4AF37] text-3xl md:text-4xl' : highlight ? 'text-[#FBF5B7]' : 'text-white'}`}>{quantity}</span>
                    <span className={`font-bold text-base md:text-lg uppercase ${highlight ? 'text-white' : 'text-[#D4AF37]'}`}>{unit}</span>
                </div>
                {value && <div className="text-[10px] md:text-xs font-bold text-[#D4AF37]/80 bg-[#D4AF37]/10 px-2 py-1 rounded mt-1 md:mt-0 self-start md:self-auto">{value}</div>}
            </div>
            <div className={`text-sm font-bold mt-1 ${highlight ? 'text-white/90' : 'text-slate-400'}`}>
                <CheckCircle2 size={12} className="inline mr-1 text-[#D4AF37]" />
                {upgradeNote}
            </div>
        </div>
    </div>
);

export default BusinessAIGiftLanding;