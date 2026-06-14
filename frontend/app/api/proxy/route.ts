import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path') || '/'
  const targetUrl = `${BACKEND_URL}${path}`

  const res = await fetch(targetUrl)
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path') || '/'
  const body = await req.text()
  const targetUrl = `${BACKEND_URL}${path}`

  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}

export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path') || '/'
  const body = await req.text()
  const targetUrl = `${BACKEND_URL}${path}`

  const res = await fetch(targetUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
