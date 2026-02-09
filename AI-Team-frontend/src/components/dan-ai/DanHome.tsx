import { SUBJECTS } from "@/data/dan-ai-data"
import { ArrowRight, BookOpen } from "lucide-react"

interface DanHomeProps {
    onSelectSubject: (subjectId: string) => void
    userName?: string
    onOpenSettings: () => void
}

export default function DanHome({ onSelectSubject, userName = "Student", onOpenSettings }: DanHomeProps) {
    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-transparent p-4 md:p-8 custom-scrollbar">
            <div className="max-w-7xl mx-auto">

                {/* Hero Section */}
                <div className="mb-12 text-center relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none"></div>

                    {/* Edit Preferences Button */}
                    <button
                        onClick={onOpenSettings}
                        className="absolute top-0 right-0 md:right-10 z-50 cursor-pointer px-5 py-2.5 rounded-full bg-indigo-600 text-white border border-indigo-400 hover:bg-indigo-700 hover:scale-105 transition-all shadow-lg shadow-indigo-900/20 flex items-center gap-2"
                    >
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                        <span className="text-xs font-bold tracking-wide">IL TUO PROFILO</span>
                    </button>

                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 relative z-10 font-tech uppercase tracking-wide">
                        Digital Marketing <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Academy</span>
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto relative z-10 leading-relaxed">
                        Benvenuto <strong>{userName}</strong>. Scegli una materia per iniziare o continuare il tuo percorso di apprendimento con il supporto del tuo AI Coach.
                    </p>
                </div>

                {/* Subjects Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {SUBJECTS.map((subject, idx) => {
                        const Icon = subject.icon
                        return (
                            <div
                                key={subject.id}
                                onClick={() => onSelectSubject(subject.id)}
                                className="group relative bg-white dark:bg-slate-800/80 rounded-3xl p-6 border border-slate-200 dark:border-slate-700/50 hover:border-indigo-500/50 dark:hover:border-indigo-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 cursor-pointer overflow-hidden backdrop-blur-sm"
                                style={{ animationDelay: `${idx * 100} ms` }}
                            >
                                {/* Hover Gradient Background */}
                                <div
                                    className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-transparent to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/10 transition-all duration-500"
                                ></div>

                                {/* Icon Box */}
                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
                                    style={{ backgroundColor: `${subject.color} 20` }}
                                >
                                    <Icon size={28} style={{ color: subject.color }} strokeWidth={1.5} />
                                </div>

                                {/* Content */}
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                                    {subject.name}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6 line-clamp-3">
                                    {subject.description}
                                </p>

                                {/* Footer Info */}
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700/50 text-xs font-medium text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300">
                                    <div className="flex items-center gap-1">
                                        <BookOpen size={14} /> <span>12 Lezioni</span>
                                    </div>
                                    <div className="flex items-center gap-1 group-hover:translate-x-1 transition-transform text-indigo-500 opacity-0 group-hover:opacity-100">
                                        Inizia <ArrowRight size={14} />
                                    </div>
                                </div>

                                {/* Decorative Elements */}
                                <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-gradient-to-tr from-transparent to-white/5 dark:to-white/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors duration-500"></div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
