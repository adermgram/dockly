"use strict";(()=>{(function(){var g;let n=document.currentScript,c=n==null?void 0:n.getAttribute("data-token");if(!c)return;let m=(g=n==null?void 0:n.src.replace("/embed.js",""))!=null?g:"https://docly.vercel.app",y=`docly_session_${c}`,a=sessionStorage.getItem(y);a||(a=Math.random().toString(36).slice(2)+Date.now().toString(36),sessionStorage.setItem(y,a));let u=document.createElement("style");u.textContent=`
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
  `,document.head.appendChild(u);let s=document.createElement("button");s.id="docly-btn",s.setAttribute("aria-label","Open chat"),s.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>';let e=document.createElement("div");e.id="docly-panel",e.innerHTML=`
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
  `,document.body.appendChild(s),document.body.appendChild(e);let o=e.querySelector("#docly-messages"),i=e.querySelector("#docly-input"),x=e.querySelector("#docly-send"),h=e.querySelector("#docly-form");s.addEventListener("click",()=>{e.classList.toggle("open"),e.classList.contains("open")&&i.focus()}),e.querySelector("#docly-close").addEventListener("click",()=>{e.classList.remove("open")});function r(p,d){let t=document.createElement("div");return t.className=`docly-msg ${p}`,t.textContent=d,o.appendChild(t),o.scrollTop=o.scrollHeight,t}h.addEventListener("submit",async p=>{p.preventDefault();let d=i.value.trim();if(!d)return;i.value="",x.disabled=!0,r("user",d);let t=document.createElement("div");t.className="docly-msg assistant",t.innerHTML='<span class="docly-dots"><span class="docly-dot"></span><span class="docly-dot"></span><span class="docly-dot"></span></span>',o.appendChild(t),o.scrollTop=o.scrollHeight;try{let l=await fetch(`${m}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({botId:c,sessionId:a,message:d})});if(t.remove(),!l.ok||!l.body){r("assistant","Sorry, something went wrong. Please try again.");return}let b=r("assistant",""),f=l.body.getReader(),v=new TextDecoder;for(;;){let{done:w,value:k}=await f.read();if(w)break;b.textContent+=v.decode(k),o.scrollTop=o.scrollHeight}}catch(l){t.remove(),r("assistant","Failed to connect. Please try again.")}finally{x.disabled=!1,i.focus()}})})();})();
