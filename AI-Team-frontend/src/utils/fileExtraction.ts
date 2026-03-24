import mammoth from "mammoth"
import * as XLSX from "xlsx"

/**
 * Extracts text content from a File object based on its type/extension.
 * Supports: PDF, DOCX, XLSX/XLS, CSV, JSON, HTML, MD, TXT, and code files.
 */
export async function extractFileContent(file: File): Promise<string> {
    const fileType = file.type
    const fileName = file.name.toLowerCase()

    try {
        // PDF
        if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
            const { extractText, getDocumentProxy } = await import("unpdf")
            const arrayBuffer = await file.arrayBuffer()
            const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer))
            const { text } = await extractText(pdf, { mergePages: true })
            return text.trim()
        }

        // Word (DOCX)
        if (
            fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            fileName.endsWith(".docx")
        ) {
            const arrayBuffer = await file.arrayBuffer()
            const result = await mammoth.extractRawText({ arrayBuffer })
            return result.value.trim()
        }

        // Excel (XLSX, XLS)
        if (
            fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            fileType === "application/vnd.ms-excel" ||
            fileName.endsWith(".xlsx") ||
            fileName.endsWith(".xls")
        ) {
            const arrayBuffer = await file.arrayBuffer()
            const workbook = XLSX.read(arrayBuffer, { type: "array" })
            let text = ""
            workbook.SheetNames.forEach((sheetName) => {
                const sheet = workbook.Sheets[sheetName]
                const csv = XLSX.utils.sheet_to_csv(sheet)
                text += `Sheet: ${sheetName}\n${csv}\n\n`
            })
            return text.trim()
        }

        // CSV
        if (fileType === "text/csv" || fileName.endsWith(".csv")) {
            return await file.text()
        }

        // JSON
        if (fileType === "application/json" || fileName.endsWith(".json")) {
            const text = await file.text()
            try {
                const json = JSON.parse(text)
                return JSON.stringify(json, null, 2)
            } catch {
                return text
            }
        }

        // HTML
        if (fileType === "text/html" || fileName.endsWith(".html") || fileName.endsWith(".htm")) {
            const text = await file.text()
            // Strip tags for cleaner text content
            const div = document.createElement("div")
            div.innerHTML = text
            return div.textContent || div.innerText || text
        }

        // Markdown
        if (fileType === "text/markdown" || fileName.endsWith(".md")) {
            return await file.text()
        }

        // Code / Text files
        if (
            fileType.startsWith("text/") ||
            fileName.endsWith(".txt") ||
            fileName.endsWith(".js") ||
            fileName.endsWith(".ts") ||
            fileName.endsWith(".jsx") ||
            fileName.endsWith(".tsx") ||
            fileName.endsWith(".py") ||
            fileName.endsWith(".java") ||
            fileName.endsWith(".c") ||
            fileName.endsWith(".cpp") ||
            fileName.endsWith(".css") ||
            fileName.endsWith(".scss") ||
            fileName.endsWith(".sql") ||
            fileName.endsWith(".xml") ||
            fileName.endsWith(".yaml") ||
            fileName.endsWith(".yml") ||
            fileName.endsWith(".json") // redundant but safe
        ) {
            return await file.text()
        }

        // Binary / Media files - return metadata only
        if (fileType.startsWith("image/")) {
            return `[Image file: ${file.name}, Type: ${fileType}, Size: ${(file.size / 1024).toFixed(2)} KB]`
        }

        if (fileType.startsWith("audio/")) {
            return `[Audio file: ${file.name}, Type: ${fileType}, Size: ${(file.size / 1024).toFixed(2)} KB]`
        }

        if (fileType.startsWith("video/")) {
            return `[Video file: ${file.name}, Type: ${fileType}, Size: ${(file.size / 1024).toFixed(2)} KB]`
        }

        // Fallback for other text-like files or unknown binaries
        try {
            // Try reading as text first
            const text = await file.text()
            // Simple check if it looks like binary (lots of null chars or non-printable)
            // For now, just return it if it reads successfully, or maybe limit length
            return text
        } catch {
            return `[Binary file: ${file.name}, Type: ${fileType}, Size: ${(file.size / 1024).toFixed(2)} KB]`
        }

    } catch (error) {
        console.error(`Error extracting content from ${file.name}:`, error)
        return `[Error extracting content from ${file.name}: ${error instanceof Error ? error.message : String(error)}]`
    }
}
