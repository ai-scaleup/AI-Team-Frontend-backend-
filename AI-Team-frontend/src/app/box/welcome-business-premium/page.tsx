"use client";

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
    TrendingUp,
    Building2,
    Rocket,
    Award,
    Cpu
} from 'lucide-react';

/**
 * BUSINESS AI PREMIUM - WELCOME PAGE (LATO RICEVENTE REGALO)
 * * Style: Matches "Ai Team Gift Box" (Dark #020817, Gold #D4AF37)
 * * Updates: Compact Footer, Specific "Powered By" text.
 */

const BusinessAIPremium = () => {
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

        /* ZOHO DARK MODE HACK */
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
                                    <span className="text-[10px] text-[#D4AF37] tracking-[0.3em] uppercase font-bold">Business Premium</span>
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
                            Benvenuto nella Tua <br />
                            <span className="text-gold-gradient">
                                Nuova Azienda
                            </span>
                        </h1>

                        <p className="font-opensans text-lg md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
                            Congratulazioni! Qualcuno che crede ciecamente nella tua visione imprenditoriale ti ha appena regalato il motore per far scalare il tuo business.
                        </p>

                        {/* --- HERO IMAGE (SUPERHERO TEAM) --- */}
                        <div className="relative w-full max-w-4xl mb-10 group animate-in fade-in zoom-in duration-700">
                            <div className="absolute inset-0 bg-[#D4AF37]/20 blur-3xl rounded-full opacity-40 group-hover:opacity-60 transition-opacity duration-700"></div>
                            <img
                                src={TEAM_IMG_URL}
                                alt="AI Team Superheroes"
                                className="relative z-10 w-full h-auto drop-shadow-2xl rounded-xl border border-white/5"
                            />
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-[#D4AF37]/30 text-[#D4AF37] text-xs md:text-sm uppercase tracking-widest font-bold hidden md:block shadow-lg">
                                AI Team Superheroes: I Tuoi Nuovi Manager AI
                            </div>
                        </div>

                        <p className="font-opensans text-lg md:text-xl text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
                            Hai ricevuto <strong>Business AI Premium</strong>: l'accesso esclusivo a una forza lavoro di AI Agents, consulenza strategica d'élite e formazione per imprenditori visionari.
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
                        <p className="font-opensans text-slate-400 max-w-3xl mx-auto text-lg">
                            Non è un semplice software, è un intero <strong>Dipartimento digitale di Marketing</strong> pronto a lavorare per te. Ecco gli asset che hai ora a disposizione.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">

                        {/* ITEM 1: 10 AGENTI AI */}
                        <div className="group relative bg-[#0f172a]/60 border border-[#D4AF37]/30 rounded-3xl p-8 hover:bg-[#0f172a]/80 transition-all duration-300 hover:shadow-[0_0_30px_rgba(212,175,55,0.1)] md:col-span-2 lg:col-span-2">
                            <div className="absolute top-4 right-4 bg-[#D4AF37]/20 text-[#D4AF37] text-xs font-bold px-3 py-1 rounded border border-[#D4AF37]/30 uppercase">
                                Accesso 10 Giorni
                            </div>
                            <div className="flex flex-col md:flex-row gap-6 items-start">
                                <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-2xl flex items-center justify-center text-[#D4AF37] mb-6 border border-[#D4AF37]/20 group-hover:scale-110 transition-transform shrink-0">
                                    <Rocket size={32} />
                                </div>
                                <div>
                                    <h3 className="font-montserrat font-bold text-xl text-white mb-2">10 Agenti AI & Marketing Manager</h3>
                                    <p className="font-opensans text-slate-400 text-sm leading-relaxed mb-4">
                                        Accesso completo a un team di 10 specialisti AI tra cui il tuo Marketing Manager (Mike AI). Potrai delegare strategie, copy, social, e sales 24/7 senza costi di personale aggiuntivi.
                                    </p>
                                    <div className="bg-[#020617]/50 rounded-xl p-4 border border-slate-700/50">
                                        <p className="text-xs text-slate-300 leading-relaxed font-medium">
                                            <strong className="text-[#D4AF37]">La tua Squadra:</strong> Aladino AI (Innovazione), Mike AI (Marketing Mgr), Daniele AI (Copy), Lara AI (SMM), Alex AI (Ads), Tony AI (Sales), Jim AI (Sales Coach), Niko AI (SEO Mgr), Simone AI (SEO Copy), Valentina AI (SEO Optimizer).
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ITEM 2: AI POWER COURSE */}
                        <div className="group relative bg-[#0f172a]/60 border border-slate-800 rounded-3xl p-8 hover:border-slate-600 transition-all duration-300">
                            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 mb-6 group-hover:scale-110 transition-transform">
                                <MonitorPlay size={32} />
                            </div>
                            <h3 className="font-montserrat font-bold text-xl text-white mb-2">Videocorso AI Power</h3>
                            <p className="font-opensans text-slate-400 text-sm leading-relaxed mb-4">
                                Un corso di Luca Papa, esperto italiano di AI aziendale. Ti orienterà su come sfruttare la Rivoluzione AI per migliorare la tua attività, la tua vita e la tua condizione economica.
                            </p>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                                Fondamentale per chi parte da zero
                            </div>
                        </div>

                        {/* ITEM 3: 3 CONSULENZE */}
                        <div className="group relative bg-[#0f172a]/60 border border-[#D4AF37]/30 rounded-3xl p-8 hover:bg-[#0f172a]/80 transition-all duration-300">
                            <div className="absolute top-4 right-4 bg-[#D4AF37]/20 text-[#D4AF37] text-xs font-bold px-3 py-1 rounded border border-[#D4AF37]/30 uppercase">
                                Strategia Business
                            </div>
                            <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-2xl flex items-center justify-center text-[#D4AF37] mb-6 border border-[#D4AF37]/20 group-hover:scale-110 transition-transform">
                                <Briefcase size={32} />
                            </div>
                            <h3 className="font-montserrat font-bold text-xl text-white mb-2">3 Consulenze Business 1-1</h3>
                            <p className="font-opensans text-slate-400 text-sm leading-relaxed mb-4">
                                Un nostro esperto umano analizzerà la tua attività e ti spiegherà quali sono le applicazioni AI e gli AI Agents di maggiore impatto nel tuo caso specifico.
                            </p>
                        </div>

                        {/* ITEM 4: AI TEAM EXPERIENCE (2 Biglietti) */}
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
                                        Un evento formativo di Luca Papa e il suo Ai Team, in diretta Online di 3 serate. Con il pacchetto Premium hai <strong>2 biglietti</strong>: porta il tuo socio, un manager chiave o chi ti ha fatto questo regalo. Vivrete insieme l'esperienza di dirigere un'azienda potenziata dall'IA.
                                    </p>
                                    <div className="flex gap-4 text-xs font-bold text-[#D4AF37] uppercase tracking-wider mt-4">
                                        <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Automazione</span>
                                        <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Management AI</span>
                                        <span className="flex items-center gap-1"><CheckCircle2 size={14} /> Scalabilità</span>
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
                        <h2 className="font-montserrat font-bold text-3xl text-center text-white mb-12">Roadmap per la Digital Transformation</h2>

                        <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#D4AF37]/50 before:to-transparent">

                            {/* Step 1 */}
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-[#D4AF37] bg-[#020617] shadow-[0_0_15px_rgba(212,175,55,0.3)] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 text-[#D4AF37] font-bold z-10">
                                    1
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-lg">
                                    <div className="font-bold text-white text-lg font-montserrat mb-2">Prenota il Kick-off</div>
                                    <div className="text-slate-400 text-sm font-opensans">
                                        Usa il calendario qui sotto per fissare la sessione di onboarding strategica con un nostro Business Specialist.
                                    </div>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-slate-700 bg-[#020617] text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-bold z-10 group-hover:border-[#D4AF37] transition-colors">
                                    2
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-lg">
                                    <div className="font-bold text-white text-lg font-montserrat mb-2">Setup Aziendale</div>
                                    <div className="text-slate-400 text-sm font-opensans">
                                        Durante la chiamata, configureremo il tuo AI Team e definiremo come sfruttare la potenza dei tuoi nuovi agenti digitali.
                                    </div>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-slate-700 bg-[#020617] text-slate-500 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 font-bold z-10 group-hover:border-[#D4AF37] transition-colors">
                                    3
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-lg">
                                    <div className="font-bold text-white text-lg font-montserrat mb-2">Accelerazione Business</div>
                                    <div className="text-slate-400 text-sm font-opensans">
                                        Gli Ai Agents produrranno per te strategie, contenuti, piani per portare al next level la tua attività.
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </section>

            {/* --- INFO SECTION (Digital Coach / AI Team) --- */}
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
                                    È la scuola di formazione leader in Italia nel business digitale. Supportiamo PMI e imprenditori nell'adozione delle tecnologie più avanzate per competere sui mercati globali.
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
                                    È la soluzione per avere un intero team di marketing e vendite AI. Non solo chatbot, ma veri dipendenti digitali capaci di aiutarti nelle attività di marketing finalizzate ad acquisire nuovi clienti.
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
                                Il tuo pacchetto <strong>Business AI Premium</strong> include una sessione prioritaria di onboarding.
                                Ti guideremo attraverso la piattaforma, configureremo gli accessi per te e il tuo staff, e ti consegneremo le chiavi della tua nuova azienda AI-Driven.
                            </p>

                            <div className="bg-[#D4AF37]/10 backdrop-blur-sm p-6 rounded-xl border border-[#D4AF37]/30">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-[#D4AF37] rounded-full text-black shadow-lg">
                                        <Unlock size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold font-montserrat text-lg text-[#D4AF37]">Agenda della Sessione:</h4>
                                        <ul className="text-sm text-slate-300 mt-3 space-y-2">
                                            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#D4AF37]" /> Analisi preliminare business</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#D4AF37]" /> Creazione account Admin</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-[#D4AF37]" /> Attivazione dei primi agenti AI</li>
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
            <footer className="bg-[#020617] text-slate-500 py-8 border-t border-slate-800">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 text-xs">

                        {/* Column 1: Brand */}
                        <div className="md:col-span-1">
                            <div className="w-28 mb-4">
                                {!imgError ? (
                                    <img src={LOGO_URL} alt="AI TEAM Logo" className="w-full h-auto opacity-80" />
                                ) : (
                                    <span className="font-montserrat font-bold text-white text-lg">AI TEAM</span>
                                )}
                            </div>
                            <p className="leading-relaxed text-slate-500">
                                La prima forza lavoro digitale on-demand. Agenti AI specializzati pronti a scalare il tuo business.
                            </p>
                        </div>

                        {/* Column 2: Digital Coach */}
                        <div className="md:col-span-1">
                            <h4 className="text-white font-bold mb-3 font-montserrat uppercase tracking-wider">Powered By</h4>
                            <p className="text-slate-400 mb-1 font-bold">Digital Coach® ed AI Scale Up®</p>
                            <p className="text-slate-500 leading-relaxed italic mb-2">
                                by HR Solutions srl
                            </p>
                            <p className="text-slate-600 leading-relaxed opacity-90">
                                Viale Francesco Restelli 3, 20124 Milano (MI)<br />
                                P.IVA 02987250960
                            </p>
                        </div>

                        {/* Column 3: Links (Static) */}
                        <div className="md:col-span-1">
                            <h4 className="text-white font-bold mb-3 font-montserrat uppercase tracking-wider">Risorse</h4>
                            <ul className="text-slate-500 space-y-1">
                                <li className="hover:text-[#D4AF37] cursor-pointer">Termini e Condizioni</li>
                                <li className="hover:text-[#D4AF37] cursor-pointer">Privacy Policy</li>
                                <li className="hover:text-[#D4AF37] cursor-pointer">Supporto</li>
                            </ul>
                        </div>

                        {/* Column 4: Social/Contact */}
                        <div className="md:col-span-1">
                            <h4 className="text-white font-bold mb-3 font-montserrat uppercase tracking-wider">Contatti</h4>
                            <p className="text-slate-500 mb-1">Hai bisogno di aiuto per riscattare il regalo?</p>
                            <a href="mailto:info@digital-coach.com" className="text-[#D4AF37] font-bold hover:underline">info@digital-coach.com</a>
                        </div>

                    </div>

                    <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row justify-between items-center text-[10px]">
                        <div>&copy; {new Date().getFullYear()} AI TEAM & Digital Coach. Tutti i diritti riservati.</div>
                        <div className="mt-2 md:mt-0 flex gap-4">
                            <span className="opacity-50">Made with ❤️ for Visionary Leaders</span>
                        </div>
                    </div>
                </div>
            </footer>

        </div>
    );
};

export default BusinessAIPremium;
