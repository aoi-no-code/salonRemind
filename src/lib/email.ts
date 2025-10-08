export async function sendEmail(to: string, subject: string, text: string): Promise<{ ok: boolean; id?: string; error?: any }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'no-reply@example.com'

  // 環境変数がない場合はフォールバック（本番では必ず設定）
  if (!apiKey) {
    console.log('[sendEmail:dryrun]', { to, subject, text })
    return { ok: true }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text
      })
    })
    const data = await res.json()
    if (!res.ok) {
      console.error('Resend error:', data)
      return { ok: false, error: data }
    }
    return { ok: true, id: data.id }
  } catch (error) {
    console.error('sendEmail error:', error)
    return { ok: false, error }
  }
}
