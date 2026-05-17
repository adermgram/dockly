;(function () {
  const script = document.currentScript as HTMLScriptElement | null
  const token = script?.getAttribute('data-token')
  if (!token) return

  const APP_URL = script?.src.replace('/embed.js', '') ?? 'https://docly.vercel.app'
  const SESSION_KEY = `docly_session_${token}`

  let sessionId = sessionStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem(SESSION_KEY, sessionId)
  }

  // --- Styles ---
  const style = document.createElement('style')
  style.textContent = `
    #docly-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9998;
      width: 52px; height: 52px; border-radius: 50%; background: #007AFF;
      border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(0,122,255,0.4);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    #docly-btn:hover { transform: scale(1.06); box-shadow: 0 6px 18px rgba(0,122,255,0.5); }
    #docly-panel {
      position: fixed; bottom: 88px; right: 24px; z-index: 9999;
      width: 360px; height: 520px; border-radius: 16px;
      background: white; box-shadow: 0 8px 40px rgba(0,0,0,0.14);
      display: none; flex-direction: column; overflow: hidden;
      border: 0.5px solid rgba(0,0,0,0.08);
    }
    #docly-panel.open { display: flex; }
    #docly-header {
      padding: 14px 16px; border-bottom: 1px solid rgba(0,0,0,0.06);
      display: flex; align-items: center; justify-content: space-between;
    }
    #docly-title { font: 500 14px/1 system-ui,sans-serif; color: #111; }
    #docly-close { background: none; border: none; cursor: pointer; color: #999; padding: 4px; }
    #docly-messages {
      flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px;
    }
    .docly-msg { max-width: 85%; border-radius: 16px; padding: 8px 12px; font: 400 13px/1.5 system-ui,sans-serif; }
    .docly-msg.user { align-self: flex-end; background: #007AFF; color: white; border-bottom-right-radius: 4px; }
    .docly-msg.assistant { align-self: flex-start; background: #F2F2F7; color: #111; border-bottom-left-radius: 4px; }
    #docly-form {
      padding: 10px; border-top: 1px solid rgba(0,0,0,0.06);
      display: flex; gap: 8px;
    }
    #docly-input {
      flex: 1; height: 36px; padding: 0 12px; border-radius: 10px;
      border: 1px solid rgba(0,0,0,0.12); font: 400 13px system-ui,sans-serif;
      outline: none;
    }
    #docly-input:focus { border-color: #007AFF; box-shadow: 0 0 0 3px rgba(0,122,255,0.15); }
    #docly-send {
      width: 36px; height: 36px; border-radius: 10px; background: #007AFF;
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    #docly-send:disabled { opacity: 0.4; cursor: not-allowed; }
    #docly-footer {
      text-align: center; padding: 6px; font: 400 10px system-ui,sans-serif; color: #aaa;
    }
    #docly-footer a { color: #007AFF; text-decoration: none; }
    .docly-dots { display: inline-flex; gap: 4px; padding: 4px 0; }
    .docly-dot { width: 6px; height: 6px; border-radius: 50%; background: #999; animation: docly-bounce 1s infinite; }
    .docly-dot:nth-child(2) { animation-delay: 0.15s; }
    .docly-dot:nth-child(3) { animation-delay: 0.3s; }
    @keyframes docly-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
  `
  document.head.appendChild(style)

  // --- Button ---
  const btn = document.createElement('button')
  btn.id = 'docly-btn'
  btn.setAttribute('aria-label', 'Open chat')
  btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>`

  // --- Panel ---
  const panel = document.createElement('div')
  panel.id = 'docly-panel'
  panel.innerHTML = `
    <div id="docly-header">
      <span id="docly-title">Assistant</span>
      <button id="docly-close" aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
    <div id="docly-messages"></div>
    <form id="docly-form">
      <input id="docly-input" type="text" placeholder="Ask a question..." autocomplete="off" />
      <button id="docly-send" type="submit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </form>
    <div id="docly-footer">Powered by <a href="https://docly.vercel.app" target="_blank">Docly</a></div>
  `

  document.body.appendChild(btn)
  document.body.appendChild(panel)

  const messagesEl = panel.querySelector('#docly-messages') as HTMLDivElement
  const inputEl = panel.querySelector('#docly-input') as HTMLInputElement
  const sendBtn = panel.querySelector('#docly-send') as HTMLButtonElement
  const form = panel.querySelector('#docly-form') as HTMLFormElement

  // Toggle open/close
  btn.addEventListener('click', () => {
    panel.classList.toggle('open')
    if (panel.classList.contains('open')) inputEl.focus()
  })
  panel.querySelector('#docly-close')!.addEventListener('click', () => {
    panel.classList.remove('open')
  })

  function addMessage(role: 'user' | 'assistant', content: string): HTMLDivElement {
    const div = document.createElement('div')
    div.className = `docly-msg ${role}`
    div.textContent = content
    messagesEl.appendChild(div)
    messagesEl.scrollTop = messagesEl.scrollHeight
    return div
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const text = inputEl.value.trim()
    if (!text) return

    inputEl.value = ''
    sendBtn.disabled = true
    addMessage('user', text)

    const dots = document.createElement('div')
    dots.className = 'docly-msg assistant'
    dots.innerHTML = `<span class="docly-dots"><span class="docly-dot"></span><span class="docly-dot"></span><span class="docly-dot"></span></span>`
    messagesEl.appendChild(dots)
    messagesEl.scrollTop = messagesEl.scrollHeight

    try {
      const response = await fetch(`${APP_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId: token, sessionId, message: text }),
      })

      dots.remove()

      if (!response.ok || !response.body) {
        addMessage('assistant', 'Sorry, something went wrong. Please try again.')
        return
      }

      const msgEl = addMessage('assistant', '')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        msgEl.textContent += decoder.decode(value)
        messagesEl.scrollTop = messagesEl.scrollHeight
      }
    } catch {
      dots.remove()
      addMessage('assistant', 'Failed to connect. Please try again.')
    } finally {
      sendBtn.disabled = false
      inputEl.focus()
    }
  })
})()
