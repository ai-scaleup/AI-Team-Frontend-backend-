
import { Settings } from "lucide-react"

interface PreferencesButtonProps {
    onClick: () => void
}

export default function PreferencesButton({ onClick }: PreferencesButtonProps) {
    return (
        <button
            onClick={onClick}
            className="relative group z-50 cursor-pointer px-5 py-2.5 rounded-full bg-white/10 dark:bg-slate-800/50 text-slate-900 dark:text-white border border-white/20 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-white/20 dark:hover:bg-slate-800 transition-all shadow-lg hover:shadow-indigo-500/10 flex items-center gap-2 backdrop-blur-sm"
        >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-inner">
                <Settings size={16} className="text-white animate-spin-slow" />
            </div>
            <div className="flex flex-col items-start">
                <span className="text-[10px] font-bold tracking-wider text-indigo-500 dark:text-indigo-400 uppercase">Impostazioni</span>
                <span className="text-xs font-bold leading-none">IL TUO PROFILO</span>
            </div>
        </button>
    )
}
