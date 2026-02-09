import { FileText, Download, X, Eye } from "lucide-react"

interface Resource {
    id: string
    title: string
    type: "pdf" | "doc" | "video"
    size: string
    url: string
}

interface ResourcesPanelProps {
    isOpen: boolean
    onClose: () => void
    subjectName: string
}

// Dummy resources generator based on subject
const getResources = (subjectName: string): Resource[] => {
    return [
        { id: "1", title: `Introduzione a ${subjectName}`, type: "pdf", size: "2.4 MB", url: "#" },
        { id: "2", title: "Template Strategico 2024", type: "doc", size: "1.1 MB", url: "#" },
        { id: "3", title: "Checklist Operativa", type: "pdf", size: "850 KB", url: "#" },
        { id: "4", title: "Case Study: Brand X", type: "pdf", size: "3.2 MB", url: "#" },
    ]
}

export default function ResourcesPanel({ isOpen, onClose, subjectName }: ResourcesPanelProps) {
    const resources = getResources(subjectName)

    return (
        <div
            className={`fixed inset-y-0 right-0 w-80 bg-white dark:bg-slate-900 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 border-l border-slate-200 dark:border-slate-800 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Materiali Didattici</h3>
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">{subjectName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {resources.map((res) => (
                        <div key={res.id} className="group p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900 bg-slate-50/50 dark:bg-slate-800/20 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all">
                            <div className="flex items-start gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-500">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight mb-1">
                                        {res.title}
                                    </h4>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                                        {res.type} • {res.size}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-2">
                                <button className="flex-1 py-1.5 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                    <Eye size={12} /> Anteprima
                                </button>
                                <button className="flex-1 py-1.5 px-3 rounded-lg bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20">
                                    <Download size={12} /> Scarica
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-500/30">
                        <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed text-center">
                            Completa le lezioni per sbloccare nuovi materiali esclusivi.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
