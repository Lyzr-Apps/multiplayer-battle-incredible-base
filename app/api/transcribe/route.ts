import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    // Create FormData for OpenAI API
    const openAIFormData = new FormData()
    openAIFormData.append('file', audioFile)
    openAIFormData.append('model', 'whisper-1')

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.error('OpenAI API key not configured')
      return NextResponse.json({ error: 'Transcription service not configured' }, { status: 500 })
    }

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openAIFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI API error:', errorText)
      return NextResponse.json({ error: 'Transcription failed' }, { status: response.status })
    }

    const data = await response.json()

    return NextResponse.json({ text: data.text })
  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
