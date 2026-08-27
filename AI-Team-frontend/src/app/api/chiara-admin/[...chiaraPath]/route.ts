import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { isDevAuthEnabled } from "@/lib/devToken"

const DEFAULT_CHIARA_API_URL = "https://chiara-backend.onrender.com"

type RouteContext = {
  params: Promise<{
    chiaraPath: string[]
  }>
}

async function proxyChiaraRequest(request: NextRequest, context: RouteContext) {
  // A development-token session has no Clerk user, and does not need one.
  if (!isDevAuthEnabled()) {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const apiUrl = process.env.CHIARA_API_URL || process.env.NEXT_PUBLIC_CHIARA_API_URL || DEFAULT_CHIARA_API_URL
  const adminToken = process.env.CHIARA_ADMIN_TOKEN || process.env.NEXT_PUBLIC_CHIARA_ADMIN_TOKEN

  if (!adminToken) {
    return NextResponse.json(
      { error: "Chiara admin token is not configured. Set CHIARA_ADMIN_TOKEN in the frontend environment." },
      { status: 500 },
    )
  }

  const { chiaraPath } = await context.params
  const upstreamUrl = new URL(chiaraPath.join("/"), apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`)
  upstreamUrl.search = request.nextUrl.search

  const headers = new Headers()
  headers.set("Authorization", `Bearer ${adminToken}`)

  const contentType = request.headers.get("Content-Type")
  if (contentType) {
    headers.set("Content-Type", contentType)
  }

  let upstreamResponse: Response
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      cache: "no-store",
    })
  } catch (error) {
    console.error("[chiara-admin] upstream request failed:", error)
    return NextResponse.json({ error: "Failed to reach Chiara backend" }, { status: 502 })
  }

  const responseContentType = upstreamResponse.headers.get("Content-Type") || "application/json"
  const body = await upstreamResponse.text()

  return new NextResponse(body, {
    status: upstreamResponse.status,
    headers: {
      "Content-Type": responseContentType,
      "Cache-Control": "no-store",
    },
  })
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyChiaraRequest(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyChiaraRequest(request, context)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyChiaraRequest(request, context)
}
