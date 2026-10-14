export function renderDashboardHtml(botName = "DARK-DINU MD") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${botName} // CLOUD CLUSTER</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #030712;
      --card-bg: rgba(15, 23, 42, 0.75);
      --border: rgba(255, 255, 255, 0.08);
      --accent-red: #ff0044;
      --accent-cyan: #06b6d4;
      --accent-emerald: #10b981;
      --text-main: #f8fafc;
      --text-sub: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(255, 0, 68, 0.12) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(6, 182, 212, 0.12) 0px, transparent 50%);
      color: var(--text-main); min-height: 100vh; padding: 25px 16px 50px; display: flex; flex-direction: column; align-items: center;
    }
    .container { width: 100%; max-width: 920px; display: flex; flex-direction: column; gap: 20px; }
    .header-bar {
      display: flex; justify-content: space-between; align-items: center; background: var(--card-bg);
      backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: 20px; padding: 16px 22px;
    }
    .logo-area { display: flex; align-items: center; gap: 12px; }
    .logo-img { width: 44px; height: 44px; border-radius: 12px; border: 2px solid var(--accent-red); object-fit: cover; }
    .logo-text h1 { font-family: 'Orbitron', sans-serif; font-size: 17px; color: #fff; letter-spacing: 1px; }
    .logo-text p { font-size: 11px; color: var(--accent-cyan); font-weight: 700; text-transform: uppercase; }
    .live-badge {
      display: flex; align-items: center; gap: 8px; background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3); padding: 6px 14px; border-radius: 30px; font-size: 12px; font-weight: 700; color: var(--accent-emerald); font-family: 'JetBrains Mono', monospace;
    }
    .pulse-dot { width: 8px; height: 8px; background: var(--accent-emerald); border-radius: 50%; box-shadow: 0 0 10px var(--accent-emerald); animation: pulse 1.6s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(0.8); } }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
    .stat-card {
      background: var(--card-bg); backdrop-filter: blur(16px); border: 1px solid var(--border); border-radius: 16px; padding: 18px;
      position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 4px;
    }
    .stat-card::after { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, var(--accent-red), transparent); }
    .stat-title { font-size: 11px; color: var(--text-sub); text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
    .stat-value { font-family: 'Orbitron', sans-serif; font-size: 24px; font-weight: 900; color: #fff; margin: 4px 0; }
    .stat-badge { font-size: 11px; color: var(--accent-cyan); font-family: 'JetBrains Mono', monospace; }
    .main-split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 768px) { .main-split { grid-template-columns: 1fr; } }
    .glass-box {
      background: var(--card-bg); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: 22px; padding: 24px 20px; display: flex; flex-direction: column; gap: 14px;
    }
    .box-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
    .box-title { font-family: 'Orbitron', sans-serif; font-size: 14px; color: #fff; letter-spacing: 1px; }
    input {
      width: 100%; background: rgba(3, 7, 18, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
      padding: 14px 16px; font-size: 15px; font-family: 'JetBrains Mono', monospace; color: #fff; outline: none; transition: 0.25s;
    }
    input:focus { border-color: var(--accent-red); box-shadow: 0 0 14px rgba(255, 0, 68, 0.25); }
    .btn-action {
      width: 100%; padding: 14px; border-radius: 12px; border: none; background: linear-gradient(135deg, var(--accent-red), #aa0030);
      color: #fff; font-family: 'Orbitron', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1px; cursor: pointer; transition: 0.25s;
    }
    .btn-action:hover:not(:disabled) { transform: translateY(-2px); }
    .btn-action:disabled { opacity: 0.6; cursor: not-allowed; }
    #codeBox { display: none; background: rgba(6, 182, 212, 0.05); border: 1px dashed var(--accent-cyan); border-radius: 14px; padding: 14px; text-align: center; }
    .code-display { font-family: 'JetBrains Mono', monospace; font-size: 26px; font-weight: 900; color: var(--accent-cyan); letter-spacing: 4px; margin: 6px 0; }
    .btn-copy { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; padding: 8px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; width: 100%; }
    .nodes-list { display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto; }
    .node-item { display: flex; justify-content: space-between; align-items: center; background: rgba(3, 7, 18, 0.5); border: 1px solid var(--border); padding: 10px 14px; border-radius: 10px; }
    .node-phone { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; color: #fff; }
    .node-badge { background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; font-family: 'JetBrains Mono'; }
    .footer { text-align: center; font-size: 12px; color: var(--text-sub); margin-top: 10px; }
    .footer span { color: #fff; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <div class="logo-area">
        <img class="logo-img" src="https://files.catbox.moe/k315x4.jpg" alt="Logo">
        <div class="logo-text">
          <h1>${botName}</h1>
          <p>Multi-Device Cluster Manager</p>
        </div>
      </div>
      <div class="live-badge">
        <div class="pulse-dot"></div>
        <span>CLUSTER RUNNING</span>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-title">Active Sockets</span>
        <span class="stat-value" id="activeCount">0</span>
        <span class="stat-badge">Linked Bots</span>
      </div>
      <div class="stat-card">
        <span class="stat-title">System Uptime</span>
        <span class="stat-value" id="uptime">0s</span>
        <span class="stat-badge">Continuous</span>
      </div>
      <div class="stat-card">
        <span class="stat-title">Loaded Commands</span>
        <span class="stat-value" id="cmdCount">0</span>
        <span class="stat-badge">Fast RAM</span>
      </div>
      <div class="stat-card">
        <span class="stat-title">Memory Allocation</span>
        <span class="stat-value" id="ramUsage">0 MB</span>
        <span class="stat-badge">RSS Footprint</span>
      </div>
    </div>

    <div class="main-split">
      <div class="glass-box">
        <div class="box-head">
          <span class="box-title">⚡ PAIR NEW INSTANCE</span>
          <span style="font-size: 10px; color: var(--accent-cyan); font-weight: 700;">SAFARI CORE</span>
        </div>
        <p style="font-size: 12px; color: var(--text-sub);">Country code සහිත WhatsApp අංකය ඇතුළත් කරන්න (e.g. 947xxxxxxxx).</p>
        <input type="tel" id="phoneNumber" placeholder="94712345678" autocomplete="off">
        <button id="pairBtn" class="btn-action" onclick="requestPairCode()">GET PAIRING CODE</button>
        <div id="codeBox">
          <div style="font-size: 10px; color: var(--accent-cyan); font-weight: 700;">PAIRING CODE</div>
          <div id="displayCode" class="code-display">--------</div>
          <button id="copyBtn" class="btn-copy" onclick="copyCode()">Copy Code</button>
        </div>
      </div>

      <div class="glass-box">
        <div class="box-head">
          <span class="box-title">📱 LINKED INSTANCES</span>
          <span id="nodeLiveCount" style="font-size: 10px; color: var(--accent-emerald); font-weight: 700;">0 ACTIVE</span>
        </div>
        <p style="font-size: 12px; color: var(--text-sub);">Cluster එකෙහි active bot session ලැයිස්තුව.</p>
        <div class="nodes-list" id="nodesContainer">
          <div style="text-align: center; color: var(--text-sub); font-size: 12px; padding: 15px;">Scanning nodes...</div>
        </div>
      </div>
    </div>

    <div class="footer">Architected & Maintained by <span>Dinidu Heshan</span> • 24/7 Engine</div>
  </div>

  <script>
    async function syncStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('activeCount').innerText = data.activeCount;
        document.getElementById('uptime').innerText = data.uptime;
        document.getElementById('cmdCount').innerText = data.commandsCount;
        document.getElementById('ramUsage').innerText = data.memory;
        document.getElementById('nodeLiveCount').innerText = data.activeCount + ' ACTIVE';

        const list = document.getElementById('nodesContainer');
        if (data.nodes && data.nodes.length > 0) {
          list.innerHTML = data.nodes.map(n => \`
            <div class="node-item">
              <div>
                <div class="node-phone">\${n.number}</div>
                <div style="font-size: 10px; color: var(--text-sub);">\${n.sessionId}</div>
              </div>
              <span class="node-badge">🟢 ONLINE</span>
            </div>
          \`).join('');
        } else {
          list.innerHTML = '<div style="text-align:center;color:var(--text-sub);font-size:12px;padding:15px;">No bots linked yet.</div>';
        }
      } catch (_) {}
    }
    setInterval(syncStats, 3500);
    syncStats();

    async function requestPairCode() {
      const p = document.getElementById('phoneNumber').value.trim().replace(/[^0-9]/g, '');
      const btn = document.getElementById('pairBtn');
      const box = document.getElementById('codeBox');
      const codeEl = document.getElementById('displayCode');
      if (!p || p.length < 10) return alert('කරුණාකර නිවැරදි අංකයක් ඇතුළත් කරන්න!');
      btn.innerText = 'GENERATING CODE...'; btn.disabled = true;
      try {
        const res = await fetch('/pair?phone=' + p);
        const data = await res.json();
        if (data.code) {
          codeEl.innerText = data.code; box.style.display = 'block'; btn.innerText = 'CODE READY!';
          if (navigator.clipboard) navigator.clipboard.writeText(data.code.replace(/-/g, ''));
        } else {
          alert(data.error || 'Failed'); btn.innerText = 'GET PAIRING CODE'; btn.disabled = false;
        }
      } catch {
        alert('Server unreachable'); btn.innerText = 'GET PAIRING CODE'; btn.disabled = false;
      }
    }

    function copyCode() {
      const c = document.getElementById('displayCode').innerText.replace(/-/g, '');
      navigator.clipboard.writeText(c);
      document.getElementById('copyBtn').innerText = '✓ COPIED!';
      setTimeout(() => document.getElementById('copyBtn').innerText = 'Copy Code', 2000);
    }
  </script>
</body>
</html>`;
}
