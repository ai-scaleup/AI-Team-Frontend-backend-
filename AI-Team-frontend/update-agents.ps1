# Script to add new AI agents to all existing agent page.tsx files

# List of agent folders to update
$agentFolders = @(
    "tony-ai", "mike-ai", "lara-ai", "laura-ai",  
    "simone-ai", "valentina-ai", "alex-ai", "aladino-ai", 
    "jim-ai", "daniele-ai", "dan-ai"
)

foreach ($agent in $agentFolders) {
    $filePath = "d:\AI-Team\AI-Team-frontend\src\app\dashboard\$agent\page.tsx"
    
    if (Test-Path $filePath) {
        Write-Host "Updating $agent..." -ForegroundColor Cyan
        
        $content = Get-Content $filePath -Raw
        
        # Replacement pattern for AGENTS_DB - add new agents before the closing brace
        $agentsToAdd = '  "max-ai": {
    name: "Max AI",
    role: "Business Development Manager",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Max-AI-business-development.png",
    description: "Sviluppo opportunità di business e partnership strategiche per accelerare la crescita aziendale.",
    primaryColor: "#10b981",
    accentColor: "#34d399",
    route: "/dashboard/max-ai",
  },
  "sofia-ai": {
    name: "Sofia AI",
    role: "Content Marketing Strategist",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Sofia-AI-content-strategist.png",
    description: "Creo strategie di content marketing data-driven per aumentare brand awareness e conversioni.",
    primaryColor: "#ec4899",
    accentColor: "#f472b6",
    route: "/dashboard/sofia-ai",
  },
  "roberta-ai": {
    name: "Roberta AI",
    role: "Customer Success Manager",
    image: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Roberta-AI-customer-success.png",
    description: "Gestisco la relazione con i clienti e ottimizzo la customer experience per massimizzare la retention.",
    primaryColor: "#8b5cf6",
    accentColor: "#f472b6",
    route: "/dashboard/roberta-ai",
  },
}'
        
        # Find and replace for AGENTS_DB
        $pattern1 = '(  },\r?\n})'
        if ($content -match '  "dan-ai": \{[^}]+},\r?\n}') {
            $content = $content -replace '(  "dan-ai": \{[^}]+},\r?\n)(})', "`$1$agentsToAdd`n}"
        }
        
        # Add to AI_TEAM_LIST
        $aiTeamAdditions = '  { id: "max-ai" },
  { id: "sofia-ai" },
  { id: "roberta-ai" },
'
        $content = $content -replace '(  \{ id: "dan-ai" },\r?\n)(\])', "`$1$aiTeamAdditions]"
        
        Set-Content $filePath $content -NoNewline
        Write-Host "Updated $agent successfully" -ForegroundColor Green
    } else {
        Write-Host "File not found: $filePath" -ForegroundColor Red
    }
}

Write-Host "All agent files have been updated!" -ForegroundColor Green
