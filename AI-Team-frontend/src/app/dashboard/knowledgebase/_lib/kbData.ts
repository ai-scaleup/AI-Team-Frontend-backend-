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

export const KB_SHARED_AGENTS: KbAgent[] = [
    { key: "chiara-ai", name: "Chiara AI", role: "AI Agent", suggestion: "Upload documents for Chiara's dedicated knowledge base" },
    { key: "jennifer-ai", name: "Jennifer AI", role: "AI Agent", suggestion: "Upload documents for Jennifer's dedicated knowledge base" },
]

export const KB_AGENTS: KbAgent[] = [
    { key: "alex-ai", name: "Alex AI", role: "Cross-Platform Ads Manager", suggestion: "Upload best-practice reports for ad campaigns" },
    { key: "tony-ai", name: "Tony AI", role: "Sales Director", suggestion: "Upload sales scripts and negotiated price lists" },
    { key: "mike-ai", name: "Mike AI", role: "Marketing Director", suggestion: "Upload marketing plans and market analysis" },
    { key: "lara-ai", name: "Lara AI", role: "Social Media Manager", suggestion: "Upload past editorial calendars and company communication style rules" },
    { key: "simone-ai", name: "Simone AI", role: "SEO Copywriter", suggestion: "Upload SEO guidelines and keyword sets" },
    { key: "aladino-ai", name: "Aladino AI", role: "Offers & Products Creator", suggestion: "Upload current offers, pricing and product catalogs" },
    { key: "valentina-ai", name: "Valentina AI", role: "SEO Optimizer", suggestion: "Upload page audits and target keyword lists" },
    { key: "niko-ai", name: "Niko AI", role: "SEO Manager", suggestion: "Upload SEO strategy docs and site structure" },
    { key: "jim-ai", name: "Jim AI", role: "Sales Coach", suggestion: "Upload sales training materials" },
    { key: "daniele-ai", name: "Daniele AI", role: "Direct Response Copywriter", suggestion: "Upload winning sales letters and swipe files" },
]

export const AGENT_FILES: Record<string, KbFile[]> = {
    "lara-ai": [
        { id: "l1", name: "May-Editorial-Calendar.xlsx", size: "320 KB", uploadedAt: "Jun 02, 2026", version: 2, previousVersions: [{ version: 1, uploadedAt: "May 01, 2026" }] },
        { id: "l2", name: "Communication-Style-Rules.pdf", size: "540 KB", uploadedAt: "Apr 15, 2026", version: 1 },
    ],
    "alex-ai": [
        { id: "a1", name: "Ads-Best-Practices-2026.pdf", size: "1.1 MB", uploadedAt: "Jun 10, 2026", version: 1 },
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
                    uploadedAt: "Today",
                    size,
                    previousVersions: [{ version: f.version, uploadedAt: f.uploadedAt }, ...(f.previousVersions ?? [])],
                }
                : f
        )
    }
    return [...files, { id: `f-${Date.now()}`, name: file.name, size, uploadedAt: "Today", version: 1 }]
}
