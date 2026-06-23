export type KbFile = {
    id: string
    name: string
    size: string
    uploadedAt: string
    version: number
    previousVersions?: { version: number; uploadedAt: string }[]
}

export type KbAgent = {
    key: string
    name: string
    role: string
    suggestion: string
}

export const KB_AGENTS: KbAgent[] = [
    { key: "lara-ai", name: "Lara AI", role: "Social Media Manager", suggestion: "Carica i calendari editoriali passati e le regole di stile della comunicazione aziendale" },
    { key: "alex-ai", name: "Alex AI", role: "Cross-Platform ADs Manager", suggestion: "Carica i report sulle best practice da seguire per le campagne ADS" },
    { key: "tony-ai", name: "Tony AI", role: "Direttore Commerciale", suggestion: "Carica gli script di vendita e i listini negoziati" },
    { key: "mike-ai", name: "Mike AI", role: "Direttore Marketing", suggestion: "Carica i piani marketing e le analisi di mercato" },
    { key: "simone-ai", name: "Simone AI", role: "SEO Copywriter", suggestion: "Carica le linee guida SEO e i keyword set" },
    { key: "jim-ai", name: "Jim AI", role: "Coach di Vendite", suggestion: "Carica i materiali di formazione vendite" },
]

export const AGENT_FILES: Record<string, KbFile[]> = {
    "lara-ai": [
        { id: "l1", name: "Calendario-Editoriale-Maggio.xlsx", size: "320 KB", uploadedAt: "02 Giu 2026", version: 2, previousVersions: [{ version: 1, uploadedAt: "01 Mag 2026" }] },
        { id: "l2", name: "Regole-Stile-Comunicazione.pdf", size: "540 KB", uploadedAt: "15 Apr 2026", version: 1 },
    ],
    "alex-ai": [
        { id: "a1", name: "Best-Practice-ADS-2026.pdf", size: "1.1 MB", uploadedAt: "10 Giu 2026", version: 1 },
    ],
    "tony-ai": [],
    "mike-ai": [],
    "simone-ai": [],
    "jim-ai": [],
}

export function bumpFileVersion(files: KbFile[], file: File): KbFile[] {
    const existing = files.find(f => f.name === file.name)
    const size = `${(file.size / 1024 / 1024).toFixed(1)} MB`
    if (existing) {
        return files.map(f =>
            f.id === existing.id
                ? {
                    ...f,
                    version: f.version + 1,
                    uploadedAt: "Oggi",
                    size,
                    previousVersions: [{ version: f.version, uploadedAt: f.uploadedAt }, ...(f.previousVersions ?? [])],
                }
                : f
        )
    }
    return [...files, { id: `f-${Date.now()}`, name: file.name, size, uploadedAt: "Oggi", version: 1 }]
}
