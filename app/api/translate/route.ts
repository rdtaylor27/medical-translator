import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, sourceLanguage, targetLanguage } = await request.json();

    if (!text || !sourceLanguage || !targetLanguage) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_SONIOX_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Soniox API key not configured' }, { status: 500 });
    }

    // Use Soniox translation API
    const response = await fetch('https://api.soniox.com/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        text,
        source_language: sourceLanguage,
        target_language: targetLanguage,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Soniox translation error:', errorText);
      return NextResponse.json(
        { error: 'Translation failed', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      translatedText: data.translated_text || data.text || '',
    });
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json(
      { error: 'Failed to translate', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
