"use client"

import React, { useState, useEffect } from 'react';
import {
    Calendar,
    CheckCircle2,
    Star,
    Briefcase,
    Users,
    Zap,
    MonitorPlay,
    ArrowRight,
    Gift,
    Sparkles,
    Unlock,
    FileText,
    Building2,
    Award
} from 'lucide-react';

/**
 * CARRIERA AI PREMIUM - WELCOME PAGE (LATO RICEVENTE REGALO)
 * * Style: Matches "Ai Team Gift Box" (Dark #020817, Gold #D4AF37)
 * * Updates: 
 * - Zoho Calendar styling using CSS filters to simulate Dark Mode/Gold Theme integration.
 */

const CarrieraAIWelcome = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [imgError, setImgError] = useState(false);

    // LOGO URL
    const LOGO_URL = "https://www.ai-scaleup.com/wp-content/uploads/2025/12/Ai-Team-Gold-Oro-Transparent.png";
    // TEAM IMAGE URL
    const TEAM_IMG_URL = "https://www.ai-scaleup.com/wp-content/uploads/2025/08/Ai-Team-Header-DAshboard.png";

    // Handle scroll effect for navbar
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToOnboarding = () => {
        const element = document.getElementById('onboarding');
        if (element) element.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen font-sans text-slate-300 bg-[#020817] selection:bg-[#D4AF37] selection:text-black overflow-x-hidden">

            {/* --- STYLES INJECTION --- */}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Open+Sans:wght@400;500;600&display=swap');
        
        .font-montserrat { font-family: 'Montserrat', sans-serif; }
        .font-opensans { font-family: 'Open Sans', sans-serif; }
        
        /* Gold Gradient Text */
        .text-gold-gradient {
          background: linear-gradient(to right, #BF953F, #FBF5B7, #AA771C);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        /* Gold Button Style */
        .btn-gold {
          background: linear-gradient(to right, #BF953F, #D4AF37, #B38728);
          color: white;
          border: 1px solid rgba(255,255,255,0.2);
          transition: all 0.3s ease;
        }
        .btn-gold:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 30px rgba(212,175,55,0.4);
        }

        /* ZOHO DARK MODE HACK 
           Inverte i colori dell'iframe per renderlo scuro.
           hue-rotate cerca di correggere i colori invertiti (es. blu diventa arancio, rotazione lo riporta verso il blu/oro).
        */
        .zoho-dark-mode {
           filter: invert(0.92) hue-rotate(180deg) contrast(0.9);
        }
      `}</style>

            {/* --- NAVIGATION --- */}
            <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-[#020817]/95 backdrop-blur-md border-b border-[#D4AF37]/20 py-3' : 'bg-transparent py-6'}`}>
                <div className="container mx-auto px-6 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-32 md:w-40 transition-all">
                            {!imgError ? (
                                <img src={LOGO_URL} alt="AI TEAM" className="w-full h-auto" onError={() => setImgError(true)} />
                            ) : (
                                <div className="flex flex-col leading-none">
                                    <span className="font-montserrat font-bold text-2xl text-white tracking-tight">AI TEAM</span>
                                    <span className="text-[10px] text-[#D4AF37] tracking-[0.3em] uppercase font-bold">Carriera Premium</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="hidden md:flex items-center gap-6 font-opensans text-sm font-semibold">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37]">
                            <Gift size={14} /> Gift Recipient Mode
                        </div>
                    </div>
                </div>
            </nav>

            {/* --- HERO SECTION --- */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[#D4AF37]/10 blur-[120px] rounded-full pointer-events-none -z-10" />

                <div className="container mx-auto px-6 relative z-10">
                    <div className="max-w-5xl mx-auto text-center flex flex-col items-center">

                        <div className="inline-flex items-center gap-2 px-6 py-2 bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded-full font-bold text-sm uppercase tracking-widest text-[#D4AF37] mb-8 shadow-[0_0_20px_rgba(212,175,55,0.2)] animate-fade-in-up">
                            <Sparkles size={16} /> Regalo Sbloccato con Successo
                        </div>

                        <h1 className="font-montserrat font-extrabold text-4xl md:text-7xl text-white leading-tight mb-8">
                            Benvenuto nel Tuo <br />
                            <span className="text-gold-gradient">
                                Nuovo Futuro
                            </span>
                        </h1>

                        <p className="font-opensans text-lg md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
                            Congratulazioni! Qualcuno che crede ciecamente nel tuo potenziale ti ha appena regalato il pass per accelerare la tua carriera.
                        </p>

                        {/* --- HERO IMAGE (SUPERHERO TEAM) --- */}
                        <div className="relative w-full max-w-4xl mb-10 group animate-in fade-in zoom-in duration-700">
                            <div className="absolute inset-0 bg-[#D4AF37]/20 blur-3xl rounded-full opacity-40 group-hover:opacity-60 transition-opacity duration-700"></div>
                            <img
                                src={TEAM_IMG_URL}
                                alt="AI Team Superheroes"
                                className="relative z-10 w-full h-auto drop-shadow-2xl rounded-xl border border-white/5"
                            />
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-[#D4AF37]/30 text-[#D4AF37] text-xs uppercase tracking-widest font-bold hidden md:block">
                                Il Tuo Nuovo Team di AI Agents
                            </div>
                        </div>

                        <p className="font-opensans text-lg md:text-xl text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
                            Hai ricevuto <strong>Carriera AI Premium</strong>: l'accesso esclusivo a tecnologie AI, formazione d'élite e consulenti umani dedicati al tuo successo.
                        </p>

                        <div className="flex flex-col sm:flex-row justify-center gap-6 w-full max-w-lg">
                            <button onClick={scrollToOnboarding} className="btn-gold px-8 py-5 rounded-xl font-bold font-montserrat flex items-center justify-center gap-3 shadow-xl text-lg w-full uppercase tracking-wider">
                                Attiva il Tuo Regalo
                                <ArrowRight size={22} />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* --- WHAT'S INSIDE --- */}
            <section className="py-24 bg-[#020617] relative border-t border-[#D4AF37]/10">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-20">
                        <h2 className="font-montserrat font-bold text-3xl md:text-4xl text-white mb-6">Cosa Contiene il Tuo Pacchetto Premium?</h2>
                        <p className="font-opensans text-slate-400 max-w-2xl mx-auto text-lg">
                            Non è un semplice corso, è un ecosistema completo per la tua crescita professionale. Ecco gli strumenti che hai ora a disposizione.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">

                        {/* ITEM 1: TEST & REPORT */}
                        <div className="group relative bg-[#0f172a]/60 border border-slate-800 rounded-3xl p-8 hover:border-slate-600 transition-all duration-300">
                            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 mb-6 group-hover:scale-110 transition-transform">
                                <FileText size={32} />
                            </div>
                            <h3 className="font-montserrat font-bold text-xl text-white mb-2">Test & Report Carriera</h3>
                            <p className="font-opensans text-slate-400 text-sm leading-relaxed mb-4">
                                Un'analisi professionale della tua personalità per scoprire talenti nascosti e attitudini. Capirai finalmente dove esprimere al meglio il tuo potenziale.
                            </p>
                        </div>

                        {/* ITEM 2: 3 CONSULENZE */}
                        <div className="group relative bg-[#0f172a]/60 border border-[#D4AF37]/30 rounded-3xl p-8 hover:bg-[#0f172a]/80 transition-all duration-300">
                            <div className="absolute top-4 right-4 bg-[#D4AF37]/20 text-[#D4AF37] text-xs font-bold px-3 py-1 rounded border border-[#D4AF37]/30 uppercase">
                                Valore Umano
                            </div>
                            <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-2xl flex items-center justify-center text-[#D4AF37] mb-6 border border-[#D4AF37]/20 group-hover:scale-110 transition-transform">
                                <Users size={32} />
                            </div>
                            <h3 className="font-montserrat font-bold text-xl text-white mb-2">3 Consulenze di Carriera 1-1</h3>
                            <p className="font-opensans text-slate-400 text-sm leading-relaxed mb-4">
                                Sessioni private con esperti reali. Analizzeremo insieme i risultati del tuo test, le tue motivazioni ed ambizioni per aiutarti a individuare la tua CArriera ideale nella nuova era dell’intelligenza artificiale.
                            </p>
                        </div>

                        {/* ITEM 3: LAURA AI */}
                        <div className="group relative bg-[#0f172a]/60 border border-[#D4AF37]/30 rounded-3xl p-8 hover:bg-[#0f172a]/80 transition-all duration-300 hover:shadow-[0_0_30px_rgba(212,175,55,0.1)]">
                            <div className="absolute top-4 right-4 bg-[#D4AF37]/20 text-[#D4AF37] text-xs font-bold px-3 py-1 rounded border border-[#D4AF37]/30 uppercase">
                                Coach H24
                            </div>
                            <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-2xl flex items-center justify-center text-[#D4AF37] mb-6 border border-[#D4AF37]/20 group-hover:scale-110 transition-transform">
                                <Zap size={32} />
                            </div>
                            <h3 className="font-montserrat font-bold text-xl text-white mb-2">Laura AI (30 Giorni)</h3>
                            <p className="font-opensans text-slate-400 text-sm leading-relaxed mb-4">
                                La tua nuova Career Coach personale. Ti aiuterà a capire i tuoi punti di forza, orientarti verso lavori appaganti, scrivere il CV perfetto e prepararti ai colloqui. Disponibile 24/7.
                            </p>
                        </div>

                        {/* ITEM 4: AI POWER COURSE */}
                        <div className="group relative bg-[#0f172a]/60 border border-slate-800 rounded-3xl p-8 hover:border-slate-600 transition-all duration-300">
                            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 mb-6 group-hover:scale-110 transition-transform">
                                <MonitorPlay size={32} />
                            </div>
                            <h3 className="font-montserrat font-bold text-xl text-white mb-2">Video Corso AI Power</h3>
                            <p className="font-opensans text-slate-400 text-sm leading-relaxed mb-4">
                                Scopri come l'AI può migliorare il tuo lavoro, il tuo stipendio e il tuo stile di vita in questo breve corso di Orientamento alle opportunità professionali che si aprono con l’intelligenza artificiale.
                            </p>
                        </div>

                        {/* ITEM 5: AI TEAM EXPERIENCE */}
                        <div className="group relative bg-gradient-to-br from-[#D4AF37]/10 to-[#0f172a] border border-[#D4AF37]/40 rounded-3xl p-8 md:col-span-2 lg:col-span-2">
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="w-16 h-16 bg-[#D4AF37] rounded-2xl flex items-center justify-center text-black shrink-0 shadow-[0_0_20px_rgba(212,175,55,0.4)]">
                                    <Star size={32} fill="currentColor" />
                                </div>
                                <div>
                                    <h3 className="font-montserrat font-bold text-xl text-white mb-2 flex items-center gap-3">
                                        AI Team Experience (2 Biglietti)
                                        <span className="bg-[#D4AF37] text-black text-[10px] px-2 py-1 rounded font-bold uppercase">Evento Live</span>
                                    </h3>
                                    <p className="font-opensans text-slate-300 text-sm leading-relaxed mb-4">
                                        Partecipa a un evento formativo in diretta online di 3 serate con Luca Papa e il suo AI Team. Con il pacchetto Premium hai <strong>2 biglietti</strong>: puoi invitare anche chi ti ha fatto questo regalo (o un amico) per vivere insieme l'esperienza di gestire un team di AI Agents che lavora per te.
                                    </p>
                                    <div className="flex gap-4 text-xs font-bold text-[#D4AF37] uppercase tracking-wider mt-4">
                                        <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Networking</span>
                                        <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Formazione Live</span>
                                        <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Strategia</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* --- TIMELINE --- */}
            <section className="py-20 bg-[#0f172a]/50 border-y border-slate-800">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="font-montserrat font-bold text-3xl text-center text-white mb-12">La Tua Roadmap verso il Successo</h2>

                        <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#D4AF37]/50 before:to-transparent">

                            {/* Step 1 */}
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#D4AF37] bg-[#020617] shadow-[0_0_15px_rgba(212,175,55,0.3)] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 text-[#D4AF37] font-bold z-10">
                                    1
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-lg">
                                    <div className="font-bold text-white text-lg font-montserrat mb-2">Prenota la Sessione</div>
                                    <div className="text-slate-400 text-sm font-opensans">
                                        Usa il calendario qui sotto per fissare la tua onboarding 1-1 con un nostro Customer Support Specialist.
                                    </div>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-slate-700 bg-[#020617] text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-bold z-10 group-hover:border-[#D4AF37] transition-colors">
                                    2
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-lg">
                                    <div className="font-bold text-white text-lg font-montserrat mb-2">Attivazione Account</div>
                                    <div className="text-slate-400 text-sm font-opensans">
                                        Durante la chiamata, ti orienteremo e guideremo nell’accedere ai servizi inclusi nel tuo programma
                                    </div>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-slate-700 bg-[#020617] text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-bold z-10 group-hover:border-[#D4AF37] transition-colors">
                                    3
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-lg">
                                    <div className="font-bold text-white text-lg font-montserrat mb-2">Decollo Carriera</div>
                                    <div className="text-slate-400 text-sm font-opensans">
                                        muovi i primi passi verso la tua nuova vita professionale nella nuova Era che si apre con l’intelligenza artificiale!
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </section>

            {/* --- INFO SECTION (Reduced since image is top) --- */}
            <section className="py-24 bg-[#020617] relative overflow-hidden">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col items-center">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">

                            {/* Box Digital Coach */}
                            <div className="bg-[#0f172a]/80 border border-slate-700 p-8 rounded-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Building2 size={80} className="text-white" />
                                </div>
                                <h3 className="font-montserrat font-bold text-xl text-white mb-3 flex items-center gap-2">
                                    <Award className="text-[#D4AF37]" size={24} /> Chi è Digital Coach?
                                </h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                                    È la scuola di formazione leader in Italia nel settore digitale. Con oltre <strong>50.000 professionisti formati</strong>, Digital Coach fornisce la metodologia didattica e gli esperti umani che ti guideranno nel tuo percorso.
                                </p>
                            </div>

                            {/* Box AI Team */}
                            <div className="bg-[#0f172a]/80 border border-[#D4AF37]/30 p-8 rounded-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Zap size={80} className="text-[#D4AF37]" />
                                </div>
                                <h3 className="font-montserrat font-bold text-xl text-white mb-3 flex items-center gap-2">
                                    <Sparkles className="text-[#D4AF37]" size={24} /> Cos'è AI Team?
                                </h3>
                                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                                    È la piattaforma di Intelligenza Artificiale sviluppata per potenziare il lavoro umano. Durante l'evento <strong>AI Team Experience</strong>, avrai l'opportunità unica di collaborare direttamente con questi agenti e capire come integrarli nel tuo futuro lavorativo.
                                </p>
                            </div>

                        </div>

                    </div>
                </div>
            </section>

            {/* --- ONBOARDING BOOKING SECTION (WITH ZOHO DARK MODE) --- */}
            <section id="onboarding" className="py-24 bg-gradient-to-b from-[#020617] to-[#0f172a] relative overflow-hidden border-t border-slate-800">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-[#D4AF37]/5 -skew-x-12 translate-x-32 -z-10"></div>

                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

                        {/* Left Column: Text */}
                        <div className="space-y-8 sticky top-32">
                            <h2 className="font-montserrat font-bold text-3xl md:text-5xl leading-tight text-white">
                                Riscatta il Tuo Regalo. <br />
                                <span className="text-gold-gradient">Prenota il Setup.</span>
                            </h2>
                            <p className="font-opensans text-lg text-slate-300 leading-relaxed">
                                Il tuo pacchetto <strong>Carriera AI Premium</strong> include una sessione privata di onboarding.
                                Ti guideremo attraverso la piattaforma, configureremo le tue credenziali e ti consegneremo le chiavi della tua nuova forza lavoro AI.
                            </p>

                            <div className="bg-[#D4AF37]/10 backdrop-blur-sm p-6 rounded-xl border border-[#D4AF37]/30">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-[#D4AF37] rounded-full text-black shadow-lg">
                                        <Unlock size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold font-montserrat text-lg text-[#D4AF37]">Cosa faremo in questa sessione?</h4>
                                        <ul className="text-sm text-slate-300 mt-3 space-y-2">
                                            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#D4AF37]" /> Tour completo della piattaforma</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#D4AF37]" /> Creazione credenziali di accesso</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#D4AF37]" /> Definizione obiettivi con esperto umano</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#D4AF37]" /> Test della personalità</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#D4AF37]" /> Accesso immediato a Laura AI Career Coach</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#D4AF37]" /> Accesso al Videocorso “Ai power”</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: REAL ZOHO CALENDAR EMBED with DARK FILTER */}
                        <div className="zoho-container bg-[#0f172a] rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(212,175,55,0.2)] border-2 border-[#D4AF37]/50 relative z-10 h-[800px]">
                            <div className="bg-slate-900 text-center py-2 border-b border-[#D4AF37]/20">
                                <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                    <Calendar size={12} /> Calendario Ufficiale
                                </span>
                            </div>
                            <iframe
                                width='100%'
                                height='750px'
                                src='https://calendario-digital-coach.zohobookings.com/portal-embed#/business-coaching'
                                frameBorder='0'
                                allowFullScreen={true}
                                title="Prenota Sessione"
                                className="w-full h-full zoho-dark-mode"
                            >
                            </iframe>
                        </div>

                    </div>
                </div>
            </section>

            {/* --- FOOTER --- */}
            <footer className="bg-[#020617] text-slate-500 py-16 border-t border-slate-800">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">

                        {/* Column 1: Brand */}
                        <div className="md:col-span-1">
                            <div className="w-32 mb-6">
                                {!imgError ? (
                                    <img src={LOGO_URL} alt="AI TEAM Logo" className="w-full h-auto opacity-80" />
                                ) : (
                                    <span className="font-montserrat font-bold text-white text-xl">AI TEAM</span>
                                )}
                            </div>
                            <p className="text-xs leading-relaxed text-slate-500">
                                La prima forza lavoro digitale on-demand. Agenti AI specializzati pronti a scalare il tuo business o la tua carriera.
                            </p>
                        </div>

                        {/* Column 2: Digital Coach */}
                        <div className="md:col-span-1">
                            <h4 className="text-white font-bold mb-4 font-montserrat uppercase text-sm tracking-wider">Powered By</h4>
                            <p className="text-slate-400 text-sm mb-2 font-bold">Digital Coach Italia</p>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                La scuola N.1 per le professioni digitali.<br />
                                Viale Francesco Restelli 3, 20124 Milano (MI)<br />
                                P.IVA 02987250960
                            </p>
                        </div>

                        {/* Column 3: Links (Static) */}
                        <div className="md:col-span-1">
                            <h4 className="text-white font-bold mb-4 font-montserrat uppercase text-sm tracking-wider">Risorse</h4>
                            <ul className="text-xs text-slate-500 space-y-2">
                                <li className="hover:text-[#D4AF37] cursor-pointer">Termini e Condizioni</li>
                                <li className="hover:text-[#D4AF37] cursor-pointer">Privacy Policy</li>
                                <li className="hover:text-[#D4AF37] cursor-pointer">Supporto</li>
                            </ul>
                        </div>

                        {/* Column 4: Social/Contact */}
                        <div className="md:col-span-1">
                            <h4 className="text-white font-bold mb-4 font-montserrat uppercase text-sm tracking-wider">Contatti</h4>
                            <p className="text-xs text-slate-500 mb-2">Hai bisogno di aiuto per riscattare il regalo?</p>
                            <a href="mailto:info@digital-coach.com" className="text-[#D4AF37] text-sm font-bold hover:underline">info@digital-coach.com</a>
                        </div>

                    </div>

                    <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center text-xs">
                        <div>&copy; {new Date().getFullYear()} AI TEAM & Digital Coach. Tutti i diritti riservati.</div>
                        <div className="mt-2 md:mt-0 flex gap-4">
                            {/* Optional Social Icons Placeholder */}
                            <span className="opacity-50">Made with ❤️ for Future Leaders</span>
                        </div>
                    </div>
                </div>
            </footer>

        </div>
    );
};

export default CarrieraAIWelcome;
