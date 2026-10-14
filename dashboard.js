export function renderDashboardHtml(botName = "DARK-DINU MD") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${botName} // CLOUD ECOSYSTEM</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #030712;
      --card-bg: rgba(15, 23, 42, 0.75);
      --border: rgba(255, 255, 255, 0.08);
      --accent-red: #ff0044;
      --accent-cyan: #00f0ff;
      --accent-purple: #8b5cf6;
      --accent-emerald: #10b981;
      --text-main: #f8fafc;
      --text-sub: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(255, 0, 68, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(0, 240, 255, 0.12) 0px, transparent 50%),
        radial-gradient(at 50% 50%, rgba(139, 92, 246, 0.06) 0px, transparent 50%);
      color: var(--text-main); min-height: 100vh; padding: 20px 16px 60px; display: flex; flex-direction: column; align-items: center; overflow-x: hidden;
    }
    .container { width: 100%; max-width: 900px; display: flex; flex-direction: column; gap: 20px; position: relative; }
    
    /* Top Bar */
    .header-bar {
      display: flex; justify-content: space-between; align-items: center; background: var(--card-bg);
      backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: 20px; padding: 14px 20px; position: relative; z-index: 50;
    }
    .logo-area { display: flex; align-items: center; gap: 12px; }
    .logo-img { width: 42px; height: 42px; border-radius: 12px; border: 2px solid var(--accent-red); object-fit: cover; }
    .logo-text h1 { font-family: 'Orbitron', sans-serif; font-size: 17px; color: #fff; letter-spacing: 1px; }
    .logo-text p { font-size: 10px; color: var(--accent-cyan); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }

    /* Animated Hamburger Menu Button */
    .menu-btn {
      background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); border-radius: 12px;
      width: 44px; height: 44px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 5px; cursor: pointer; transition: 0.3s;
    }
    .menu-btn:hover { background: rgba(255, 0, 68, 0.15); border-color: var(--accent-red); }
    .menu-line { width: 20px; height: 2px; background: #fff; border-radius: 2px; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .menu-btn.open .line1 { transform: translateY(7px) rotate(45deg); background: var(--accent-red); }
    .menu-btn.open .line2 { opacity: 0; transform: translateX(-10px); }
    .menu-btn.open .line3 { transform: translateY(-7px) rotate(-45deg); background: var(--accent-red); }

    /* Sliding Drawer / Sidebar */
    .sidebar-overlay {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(6px);
      z-index: 90; opacity: 0; pointer-events: none; transition: 0.35s ease;
    }
    .sidebar-overlay.active { opacity: 1; pointer-events: all; }
    .sidebar {
      position: fixed; top: 0; right: -360px; width: 340px; height: 100vh; background: #070a16;
      border-left: 1px solid var(--border); z-index: 100; padding: 30px 22px; display: flex; flex-direction: column; gap: 24px;
      transition: 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: -15px 0 40px rgba(0, 0, 0, 0.8); overflow-y: auto;
    }
    .sidebar.active { right: 0; }
    .sidebar-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 15px; }
    .sidebar-title { font-family: 'Orbitron'; font-size: 15px; color: var(--accent-cyan); font-weight: 800; letter-spacing: 1px; }

    /* Welcome Banner */
    .welcome-card {
      background: linear-gradient(135deg, rgba(255, 0, 68, 0.15), rgba(0, 240, 255, 0.08));
      border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 22px 20px; display: flex; flex-direction: column; gap: 8px; position: relative; overflow: hidden;
    }
    .welcome-badge {
      display: inline-flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 800;
      color: var(--accent-emerald); background: rgba(16, 185, 129, 0.12); padding: 4px 10px; border-radius: 20px; width: fit-content; text-transform: uppercase;
    }
    .welcome-title { font-family: 'Orbitron'; font-size: 18px; font-weight: 800; color: #fff; }
    .welcome-desc { font-size: 12px; color: var(--text-sub); line-height: 1.5; }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
    .stat-card {
      background: var(--card-bg); backdrop-filter: blur(16px); border: 1px solid var(--border); border-radius: 16px; padding: 18px;
      position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 4px;
    }
    .stat-card::after { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, var(--accent-red), transparent); }
    .stat-title { font-size: 10px; color: var(--text-sub); text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; }
    .stat-value { font-family: 'Orbitron', sans-serif; font-size: 24px; font-weight: 900; color: #fff; margin: 4px 0; }
    .stat-badge { font-size: 11px; color: var(--accent-cyan); font-family: 'JetBrains Mono', monospace; }

    /* Main Grid Split */
    .main-split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 768px) { .main-split { grid-template-columns: 1fr; } }
    .glass-box {
      background: var(--card-bg); backdrop-filter: blur(20px); border: 1px solid var(--border); border-radius: 22px; padding: 24px 20px; display: flex; flex-direction: column; gap: 14px;
    }
    .box-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
    .box-title { font-family: 'Orbitron', sans-serif; font-size: 14px; color: #fff; letter-spacing: 1px; }

    /* Inputs & Buttons */
    input {
      width: 100%; background: rgba(3, 7, 18, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px;
      padding: 14px 16px; font-size: 14px; font-family: 'JetBrains Mono', monospace; color: #fff; outline: none; transition: 0.25s;
    }
    input:focus { border-color: var(--accent-red); box-shadow: 0 0 14px rgba(255, 0, 68, 0.25); }
    .btn-action {
      width: 100%; padding: 14px; border-radius: 12px; border: none; background: linear-gradient(135deg, var(--accent-red), #aa0030);
      color: #fff; font-family: 'Orbitron', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 1px; cursor: pointer; transition: 0.25s;
    }
    .btn-action:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(255, 0, 68, 0.4); }
    .btn-action:disabled { opacity: 0.6; cursor: not-allowed; }

    #codeBox { display: none; background: rgba(0, 240, 255, 0.05); border: 1px dashed var(--accent-cyan); border-radius: 14px; padding: 14px; text-align: center; }
    .code-display { font-family: 'JetBrains Mono', monospace; font-size: 26px; font-weight: 900; color: var(--accent-cyan); letter-spacing: 4px; margin: 6px 0; }
    .btn-copy { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #fff; padding: 8px; border-radius: 8px; font-size: 11px; font-weight: 600; cursor: pointer; width: 100%; }

    /* Privacy Protected Nodes */
    .nodes-list { display: flex; flex-direction: column; gap: 8px; max-height: 250px; overflow-y: auto; }
    .node-item { display: flex; justify-content: space-between; align-items: center; background: rgba(3, 7, 18, 0.5); border: 1px solid var(--border); padding: 12px 14px; border-radius: 12px; }
    .node-ident { display: flex; align-items: center; gap: 10px; }
    .node-icon { width: 30px; height: 30px; background: rgba(255, 0, 68, 0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
    .node-id { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; color: #fff; }
    .node-tag { font-size: 10px; color: var(--accent-cyan); }
    .node-badge { background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; font-family: 'JetBrains Mono'; }

    /* Sidebar Suite Sections */
    .tool-section { display: flex; flex-direction: column; gap: 10px; }
    .tool-title { font-size: 12px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 6px; }
    .tool-desc { font-size: 11px; color: var(--text-sub); line-height: 1.4; }
    .btn-tool {
      width: 100%; padding: 12px; border-radius: 10px; border: 1px solid rgba(0, 240, 255, 0.3); background: rgba(0, 240, 255, 0.08);
      color: var(--accent-cyan); font-family: 'Orbitron'; font-size: 11px; font-weight: 700; cursor: pointer; transition: 0.25s;
    }
    .btn-tool:hover { background: var(--accent-cyan); color: #000; }

    .footer { text-align: center; font-size: 12px; color: var(--text-sub); margin-top: 10px; }
    .footer span { color: #fff; font-weight: 600; }
  </style>
</head>
<body>

  <!-- Drawer Menu Backdrop -->
  <div class="sidebar-overlay" id="overlay" onclick="toggleMenu()"></div>

  <!-- Animated Sidebar Drawer -->
  <div class="sidebar" id="sidebar">
    <div class="sidebar-head">
      <span class="sidebar-title">⚡ CLUSTER SUITE</span>
      <div style="cursor:pointer; color:#fff; font-size:18px;" onclick="toggleMenu()">✕</div>
    </div>

    <!-- Tool 1: Channel React Suite -->
    <div class="tool-section">
      <div class="tool-title">💖 AUTO CHANNEL REACT</div>
      <p class="tool-desc">ඔබේ WhatsApp Channel එකට වැටෙන සියලුම Posts වලට cluster එකෙන්ම instant auto reactions ලබාගන්න.</p>
      <input type="text" id="reactChannelLink" placeholder="https://whatsapp.com/channel/..." autocomplete="off">
      <button class="btn-tool" onclick="triggerChannelTool('react')">ACTIVATE REACTIONS</button>
    </div>

    <hr style="border: 0; border-top: 1px solid var(--border);">

    <!-- Tool 2: Channel Follower Booster -->
    <div class="tool-section">
      <div class="tool-title">📢 CHANNEL FOLLOWER SYNC</div>
      <p class="tool-desc">Cluster එකේ සිටින සියලුම Active Botsලා එකවර ඔබගේ Channel එක follow කරවන්න.</p>
      <input type="text" id="followChannelLink" placeholder="https://whatsapp.com/channel/..." autocomplete="off">
      <button class="btn-tool" style="border-color: rgba(255, 0, 68, 0.3); background: rgba(255, 0, 68, 0.08); color: var(--accent-red);" onclick="triggerChannelTool('follow')">FOLLOW WITH ALL BOTS</button>
    </div>

    <hr style="border: 0; border-top: 1px solid var(--border);">

    <!-- Ecosystem Info -->
    <div style="font-size: 11px; color: var(--text-sub); line-height: 1.6;">
      🔒 <b>Privacy Shield:</b> Connected bot credentials and phone numbers are encrypted with SHA-256 session isolation.
    </div>
  </div>

  <div class="container">
    
    <!-- Top Header -->
    <div class="header-bar">
      <div class="logo-area">
        <img class="logo-img" src="https://files.catbox.moe/k315x4.jpg" alt="Logo">
        <div class="logo-text">
          <h1>${botName}</h1>
          <p>Next-Gen Multi-Device Portal</p>
        </div>
      </div>
      
      <!-- Right Hamburger Button -->
      <div class="menu-btn" id="menuBtn" onclick="toggleMenu()">
        <div class="menu-line line1"></div>
        <div class="menu-line line2"></div>
        <div class="menu-line line3"></div>
      </div>
    </div>

    <!-- Official Welcome Card -->
    <div class="welcome-card">
      <div class="welcome-badge">✦ Official Cloud Network 2026</div>
      <h2 class="welcome-title">WELCOME TO DARK-DINU CLUSTER</h2>
      <p class="welcome-desc">High-speed multi-device WhatsApp automation suite with privacy protection, persistent memory, and automated cluster routing.</p>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-title">Active Sockets</span>
        <span class="stat-value" id="activeCount">0</span>
        <span class="stat-badge">Encrypted Nodes</span>
      </div>
      <div class="stat-card">
        <span class="stat-title">System Uptime</span>
        <span class="stat-value" id="uptime">0s</span>
        <span class="stat-badge">Continuous Runtime</span>
      </div>
      <div class="stat-card">
        <span class="stat-title">Engine Latency</span>
        <span class="stat-value" style="color: var(--accent-emerald);">~24ms</span>
        <span class="stat-badge">Ultra-Fast Pipeline</span>
      </div>
      <div class="stat-card">
        <span class="stat-title">Memory Allocation</span>
        <span class="stat-value" id="ramUsage">0 MB</span>
        <span class="stat-badge">Zero Leak RSS</span>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="main-split">
      
      <!-- Pairing Box -->
      <div class="glass-box">
        <div class="box-head">
          <span class="box-title">⚡ PAIR NEW INSTANCE</span>
          <span style="font-size: 10px; color: var(--accent-cyan); font-weight: 700;">SAFARI ENGINE</span>
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

      <!-- Anonymous Privacy Protected Nodes -->
      <div class="glass-box">
        <div class="box-head">
          <span class="box-title">🛡️ CLUSTER INSTANCES</span>
          <span id="nodeLiveCount" style="font-size: 10px; color: var(--accent-emerald); font-weight: 700;">0 NODES</span>
        </div>
        <p style="font-size: 12px; color: var(--text-sub);">Active instances are masked for privacy & security protection.</p>
        
        <div class="nodes-list" id="nodesContainer">
          <div style="text-align: center; color: var(--text-sub); font-size: 12px; padding: 15px;">Scanning cluster...</div>
        </div>
      </div>

    </div>

    <div class="footer">Architected & Maintained by <span>Dinidu Heshan</span> • 24/7 Engine</div>
  </div>

  <script>
    // Hamburger Toggle
    function toggleMenu() {
      const btn = document.getElementById('menuBtn');
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('overlay');
      btn.classList.toggle('open');
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
    }

    // Real-Time Stats & Masked Nodes Polling
    async function syncStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('activeCount').innerText = data.activeCount;
        document.getElementById('uptime').innerText = data.uptime;
        document.getElementById('ramUsage').innerText = data.memory;
        document.getElementById('nodeLiveCount').innerText = data.activeCount + ' NODES ONLINE';

        const list = document.getElementById('nodesContainer');
        if (data.nodes && data.nodes.length > 0) {
          list.innerHTML = data.nodes.map((n, idx) => \`
            <div class="node-item">
              <div class="node-ident">
                <div class="node-icon">🤖</div>
                <div>
                  <div class="node-id">\${n.maskedNumber}</div>
                  <div class="node-tag">Node Tag: CLUSTER-\${String(idx + 1).padStart(2, '0')}</div>
                </div>
              </div>
              <span class="node-badge">🟢 SECURED</span>
            </div>
          \`).join('');
        } else {
          list.innerHTML = '<div style="text-align:center;color:var(--text-sub);font-size:12px;padding:15px;">No active instances. Link one using pairing portal!</div>';
        }
      } catch (_) {}
    }
    setInterval(syncStats, 3500);
    syncStats();

    // Pairing Request
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

    // Trigger Channel React / Follow from Web
    async function triggerChannelTool(action) {
      const inputEl = document.getElementById(action === 'react' ? 'reactChannelLink' : 'followChannelLink');
      const link = inputEl.value.trim();
      if (!link) return alert('කරුණාකර WhatsApp Channel Link එක ඇතුළත් කරන්න!');
      
      try {
        const res = await fetch('/api/channel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, link })
        });
        const data = await res.json();
        if (data.status) {
          alert('✅ ' + data.message);
          inputEl.value = '';
          toggleMenu();
        } else {
          alert('❌ ' + (data.error || 'Failed to process request!'));
        }
      } catch {
        alert('Server communication error!');
      }
    }
  </script>
</body>
</html>`;
}
