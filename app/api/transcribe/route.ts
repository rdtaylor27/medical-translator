import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as Blob;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const apiKey = process.env.SONIOX_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Convert blob to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Call Soniox REST API directly
    const response = await fetch('https://api.soniox.com/transcribe-file-short', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio: audioBuffer.toString('base64'),
        model: 'en_v2',
        include_nonfinal: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Soniox API error:', errorData);
      return NextResponse.json(
        { error: 'Soniox API error', details: errorData },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      transcript: result.text || '',
      words: result.words || [],
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
