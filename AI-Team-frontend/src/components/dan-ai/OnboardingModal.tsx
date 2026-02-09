import { useState, useRef, useEffect } from "react"
import { ONBOARDING_STEPS } from "@/data/dan-ai-data"
import { ChevronRight, ChevronLeft, Check, Sparkles } from "lucide-react"

interface OnboardingModalProps {
    onComplete: (preferences: Record<string, any>) => void
    isOpen: boolean
    initialValues?: Record<string, any>
}

export default function OnboardingModal({ onComplete, isOpen, initialValues = {} }: OnboardingModalProps) {
    const [currentStep, setCurrentStep] = useState(0)
    const [answers, setAnswers] = useState<Record<string, any>>(initialValues)
    const [isClosing, setIsClosing] = useState(false)

    // Reset/Update answers when initialValues changes or modal opens
    // For simpler UX, we trust initialValues passed on mount or re-render
    useEffect(() => {
        if (isOpen && initialValues && Object.keys(initialValues).length > 0) {
            setAnswers(prev => ({ ...prev, ...initialValues }))
        }
    }, [isOpen, initialValues])

    // Check if we are in "Edit Mode" (meaning we have some initial values)
    const isEditMode = initialValues && Object.keys(initialValues).length > 0;


    if (!isOpen) return null

    const stepData = ONBOARDING_STEPS[currentStep]
    const totalSteps = ONBOARDING_STEPS.length
    const progress = ((currentStep + 1) / totalSteps) * 100

    const handleOptionSelect = (questionId: string, value: string, isMultiselect: boolean) => {
        if (isMultiselect) {
            setAnswers(prev => {
                const current = (prev[questionId] as string[]) || []
                if (current.includes(value)) {
                    return { ...prev, [questionId]: current.filter(v => v !== value) }
                } else {
                    return { ...prev, [questionId]: [...current, value] }
                }
            })
        } else {
            setAnswers((prev) => ({ ...prev, [questionId]: value }))
        }
    }

    const handleTextChange = (questionId: string, value: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: value }))
    }

    const handleNext = () => {
        if (currentStep < totalSteps - 1) {
            setCurrentStep((prev) => prev + 1)
        } else {
            finishOnboarding()
        }
    }

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1)
        }
    }

    const finishOnboarding = () => {
        setIsClosing(true)
        setTimeout(() => {
            onComplete(answers)
        }, 500)
    }

    const isCurrentStepValid = () => {
        // Validation: Check if questions (except textarea/optional) have answers
        // For multiselect ensure at least one is picked
        return stepData.questions.every(q => {
            if (q.type === 'textarea' && q.id === 'companyDetails') {
                // Conditional Logic Check: If they said they will provide info, enforce it?
                // For simplicity, let's keep textarea optional or enforce if "no_provide" was selected in previous q? 
                // Simplest for MVP: Optional.
                return true
            }
            if (q.type === 'text' || q.type === 'textarea') return true

            const val = answers[q.id]
            if (Array.isArray(val)) return val.length > 0
            return !!val
        })
    }

    return (
        <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-500 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
            <div className={`w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 transform transition-all duration-500 flex flex-col max-h-[90vh] ${isClosing ? 'scale-95' : 'scale-100'}`}>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 shrink-0">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all duration-500 ease-out"
                        style={{ width: `${progress}% ` }}
                    />
                </div>

                <div className="p-6 md:p-8 flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="mb-6 shrink-0">
                        <span className="inline-block px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-2">
                            Sezione {currentStep + 1} di {totalSteps}
                        </span>
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                            {stepData.title} {currentStep === 0 && <Sparkles className="text-yellow-400" fill="currentColor" />}
                        </h2>
                    </div>

                    {/* Content - Scrollable */}
                    <div className="space-y-8 overflow-y-auto px-1 custom-scrollbar pb-4">
                        {stepData.questions.map((q) => (
                            <div key={q.id} className="animate-in fade-in slide-in-from-right-4 duration-500">
                                <label className="block text-lg font-medium text-slate-800 dark:text-slate-200 mb-3 leading-tight">
                                    {q.question}
                                </label>

                                {q.type === "text" && (
                                    <input
                                        type="text"
                                        value={answers[q.id] || ""}
                                        onChange={(e) => handleTextChange(q.id, e.target.value)}
                                        placeholder={q.placeholder}
                                        className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-slate-900 dark:text-white"
                                        autoFocus
                                    />
                                )}

                                {q.type === "textarea" && (
                                    <textarea
                                        value={answers[q.id] || ""}
                                        onChange={(e) => handleTextChange(q.id, e.target.value)}
                                        placeholder={q.placeholder}
                                        rows={4}
                                        className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-slate-900 dark:text-white resize-none"
                                    />
                                )}

                                {(q.type === "select" || q.type === "multiselect") && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {q.options?.map((opt) => {
                                            const val = answers[q.id]
                                            const isSelected = q.type === 'multiselect'
                                                ? Array.isArray(val) && val.includes(opt.value)
                                                : val === opt.value

                                            return (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => handleOptionSelect(q.id, opt.value, q.type === 'multiselect')}
                                                    className={`p-3.5 rounded-xl text-left border-2 transition-all duration-200 flex items-center justify-between group
                                    ${isSelected
                                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 shadow-md transform scale-[1.02]'
                                                            : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                        }
`}
                                                >
                                                    <span className="font-medium text-sm leading-snug">{opt.label}</span>
                                                    {isSelected && <Check size={18} className="text-indigo-500 shrink-0 ml-2" />}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Footer Navigation */}
                    <div className="flex items-center justify-between mt-4 md:mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                        <button
                            onClick={handleBack}
                            disabled={currentStep === 0}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors
                    ${currentStep === 0
                                    ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }
`}
                        >
                            <ChevronLeft size={18} /> Indietro
                        </button>

                        <button
                            onClick={handleNext}
                            disabled={!isCurrentStepValid()}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all transform active:scale-95
                    ${!isCurrentStepValid()
                                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
                                    : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-indigo-500/40 hover:-translate-y-1'
                                }
`}
                        >
                            {currentStep === totalSteps - 1 ? "Inizia il Corso!" : "Avanti"} <ChevronRight size={18} />
                        </button>
                    </div>

                    {/* Save & Exit for Edit Mode */}
                    {isEditMode && (
                        <button
                            onClick={() => onComplete(answers)}
                            className="absolute left-6 bottom-6 text-xs text-slate-400 hover:text-indigo-500 underline decoration-indigo-500/30 underline-offset-4 transition-colors font-medium"
                        >
                            Salva modifiche ed esci
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

