/**
 * The one list of agents the dashboard knows about. The grid on /dashboard and
 * the access guard both read it, so an agent cannot appear in one and be
 * unknown to the other.
 */
export type UiAgent = {
  key: string
  name: string
  role: string
  image: string
  href: string
}

export const agents: UiAgent[] = [
  {
    key: "SARA_AI",
    name: "Sara AI",
    role: "WhatsApp Assistant",
    image: "/assets/agents/sara-ai-1768406582163-0145e544-2c36-4790-b956-81dcdea1057d.jpeg",
    href: "/dashboard/sara-ai",
  },
  {
    key: "ALEX",
    name: "Alex AI",
    role: "Cross-Platform ADs Manager",
    image: "/assets/agents/Alex-AI.png",
    href: "/dashboard/alex-ai",
  },
  {
    key: "TONY",
    name: "Tony AI",
    role: "Direttore Commerciale",
    image: "/assets/agents/Tony-AI.png",
    href: "/dashboard/tony-ai",
  },
  {
    key: "MIKE",
    name: "Mike AI",
    role: "Direttore Marketing",
    image: "/assets/agents/Mike-AI.png",
    href: "/dashboard/mike-ai",
  },

  {
    key: "LARA",
    name: "Lara AI",
    role: "Social Media Manager",
    image: "/assets/agents/Lara-AI-1.png",
    href: "/dashboard/lara-ai",
  },
  {
    key: "SIMONE",
    name: "Simone AI",
    role: "SEO Copywriter",
    image: "/assets/agents/SImone-ai.png",
    href: "/dashboard/simone-ai",
  },
  {
    key: "ALADINO",
    name: "Aladino AI",
    role: "Creatore di nuove offerte e prodotti",
    image: "/assets/agents/Aladdin-AI.png",
    href: "/dashboard/aladino-ai",
  },
  {
    key: "VALENTINA",
    name: "Valentina AI",
    role: "SEO Optimizer",
    image: "/assets/agents/Valentina-AI.png",
    href: "/dashboard/valentina-ai",
  },
  {
    key: "NIKO",
    name: "Niko AI",
    role: "SEO Manager",
    image: "/assets/agents/Niko-AI.png",
    href: "/dashboard/niko-ai",
  },
  {
    key: "JIM",
    name: "Jim AI",
    role: "Coach di Vendite",
    image: "/assets/agents/JIM-ai.png",
    href: "/dashboard/jim-ai",
  },
  {
    key: "DANIELE",
    name: "Daniele AI",
    role: "Copywriter per Vendere (Direct Response)",
    image: "/assets/agents/Daniele-ai.png",
    href: "/dashboard/daniele-ai",
  },
  {
    key: "LAURA",
    name: "Laura AI",
    role: "AI Assistant",
    image: "/assets/agents/Laura-ai.png",
    href: "/dashboard/laura-ai",
  },
  {
    key: "DAN",
    name: "Dan AI",
    role: "Test AI Agent",
    image: "/assets/agents/daniele_ai_direct_response_copywriter.png",
    href: "/dashboard/dan-ai",
  },
  {
    key: "MAX",
    name: "Max AI",
    role: "Business Development Manager",
    image: "/assets/agents/Tony-AI-strategiest.png",
    href: "/dashboard/max-ai",
  },
  {
    key: "SOFIA",
    name: "Sofia AI",
    role: "Content Marketing Strategist",
    image: "/assets/agents/Sofia-ai-1.png",
    href: "/dashboard/sofia-ai",
  },
  {
    key: "ROBERTA",
    name: "Roberta AI",
    role: "Customer Success Manager",
    image: "/assets/agents/Valentina-AI-AI-SEO-optimizer.png",
    href: "/dashboard/roberta-ai",
  },
  {
    key: "JENNIFER_AI",
    name: "Jennifer AI",
    role: "AI Assistant",
    image: "/assets/agents/chiara-ai-Whats-App-Image-2026-02-25-at-15-34-49-1.jpg",
    href: "/dashboard/jennifer-ai",
  },
  {
    key: "CHIARA_AI",
    name: "Chiara AI",
    role: "AI Receptionist",
    image: "/assets/agents/Lara-AI-1.png",
    href: "/dashboard/chiara-ai",
  },
  {
    key: "FREAP_CHIARA",
    name: "Freap Chiara",
    role: "AI Receptionist",
    image: "/assets/agents/Lara-AI-1.png",
    href: "/dashboard/freap-chiara",
  },
  {
    key: "VANESSA",
    name: "Vanessa",
    role: "AI Receptionist",
    image: "/assets/agents/Lara-AI-1.png",
    href: "/dashboard/vanessa",
  },
  {
    key: "FREAP_JENNIFER",
    name: "Freap Jennifer",
    role: "AI Assistant",
    image: "/assets/agents/chiara-ai-Whats-App-Image-2026-02-25-at-15-34-49-1.jpg",
    href: "/dashboard/freap-jennifer",
  },
  {
    key: "PEARL_ADMIN",
    name: "Pearl Admin",
    role: "User Data Control Center",
    image: "/assets/agents/pearl-admin.svg",
    href: "/dashboard/pearl-admin",
  },
  {
    key: "TEST_MIKE",
    name: "Test Mike AI",
    role: "Test Direttore Marketing",
    image: "/assets/agents/Mike-AI.png",
    href: "/dashboard/test-mike-ai",
  },
  {
    key: "TEST_ALEX",
    name: "Test Alex AI",
    role: "Test Cross-Platform ADs Manager",
    image: "/assets/agents/Alex-AI.png",
    href: "/dashboard/test-alex-ai",
  },
  {
    key: "TEST_TONY",
    name: "Test Tony AI",
    role: "Test Direttore Commerciale",
    image: "/assets/agents/Tony-AI.png",
    href: "/dashboard/test-tony-ai",
  },
  {
    key: "TEST_JIM",
    name: "Test Jim AI",
    role: "Test Coach di Vendite",
    image: "/assets/agents/JIM-ai.png",
    href: "/dashboard/test-jim-ai",
  },
  {
    key: "TEST_LARA",
    name: "Test Lara AI",
    role: "Test Social Media Manager",
    image: "/assets/agents/Lara-AI-1.png",
    href: "/dashboard/test-lara-ai",
  },
  {
    key: "TEST_VALENTINA",
    name: "Test Valentina AI",
    role: "Test SEO Optimizer",
    image: "/assets/agents/Valentina-AI.png",
    href: "/dashboard/test-valentina-ai",
  },
  {
    key: "TEST_DANIELE",
    name: "Test Daniele AI",
    role: "Test Copywriter per Vendere (Direct Response)",
    image: "/assets/agents/Daniele-ai.png",
    href: "/dashboard/test-daniele-ai",
  },
  {
    key: "TEST_SIMONE",
    name: "Test Simone AI",
    role: "Test SEO Copywriter",
    image: "/assets/agents/SImone-ai.png",
    href: "/dashboard/test-simone-ai",
  },
  {
    key: "TEST_NIKO",
    name: "Test Niko AI",
    role: "Test SEO Manager",
    image: "/assets/agents/Niko-AI.png",
    href: "/dashboard/test-niko-ai",
  },
  {
    key: "TEST_ALADINO",
    name: "Test Aladino AI",
    role: "Test Creatore di nuove offerte e prodotti",
    image: "/assets/agents/Aladdin-AI.png",
    href: "/dashboard/test-aladino-ai",
  },
]

/** AgentName behind a dashboard path, or null when the path is not an agent. */
export const agentKeyForPath = (pathname: string): string | null => {
  const normalized = pathname.replace(/\/+$/, "");
  return agents.find((agent) => agent.href === normalized)?.key ?? null;
};

/** The catalogue entry behind a dashboard path, for naming it in the UI. */
export const agentForPath = (pathname: string): UiAgent | null => {
  const normalized = pathname.replace(/\/+$/, "");
  return agents.find((agent) => agent.href === normalized) ?? null;
};
