export function renderDashboardHtml(botName = "DARK-DINU OFC") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${botName} // DIGITAL SYSTEMS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07070a;
      --card-bg: #0f1015;
      --card-border: rgba(255, 255, 255, 0.07);
      --accent-pink: #ff2d55;
      --accent-pink-glow: rgba(255, 45, 85, 0.25);
      --accent-cyan: #00f0ff;
      --text-main: #ffffff;
      --text-muted: #8e8e99;
      --text-dim: #555562;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      background-color: var(--bg);
      color: var(--text-main);
      min-height: 100vh;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-bottom: 60px;
    }

    /* Ambient Background Glow */
    .glow-top {
      position: absolute;
      top: -120px;
      left: 50%;
      transform: translateX(-50%);
      width: 480px;
      height: 280px;
      background: radial-gradient(circle, rgba(255, 45, 85, 0.15) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }

    .wrapper {
      width: 100%;
      max-width: 520px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 32px;
      position: relative;
      z-index: 10;
    }

    /* Navbar Header */
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8px;
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-icon {
      width: 42px;
      height: 42px;
      background: #14141b;
      border: 1px solid rgba(255, 45, 85, 0.4);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 15px var(--accent-pink-glow);
    }

    .brand-icon img {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      object-fit: cover;
    }

    .brand-text h2 {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.8px;
      color: #fff;
      text-transform: uppercase;
    }

    .brand-text p {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-top: 2px;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn-launch {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 45, 85, 0.12);
      border: 1px solid rgba(255, 45, 85, 0.35);
      color: #fff;
      padding: 9px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      transition: 0.25s;
      cursor: pointer;
    }

    .btn-launch:hover {
      background: var(--accent-pink);
      border-color: var(--accent-pink);
    }

    .menu-trigger {
      width: 42px;
      height: 42px;
      background: #14141b;
      border: 1px solid var(--card-border);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      transition: 0.25s;
    }

    .menu-trigger span {
      width: 18px;
      height: 2px;
      background: #fff;
      border-radius: 2px;
      transition: 0.3s;
    }

    /* Hero Section */
    .hero-section {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 10px;
    }

    .hero-title {
      font-size: 32px;
      font-weight: 900;
      letter-spacing: -0.5px;
      line-height: 1.1;
      color: #ffffff;
    }

    .hero-title span {
      color: var(--accent-pink);
    }

    .hero-desc {
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-muted);
      font-weight: 500;
    }

    /* Social Icons Row */
    .social-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 4px;
    }

    .social-btn {
      width: 48px;
      height: 48px;
      background: #111218;
      border: 1px solid var(--card-border);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      text-decoration: none;
      font-size: 18px;
      transition: 0.25s;
    }

    .social-btn:hover {
      border-color: var(--accent-pink);
      background: rgba(255, 45, 85, 0.1);
      transform: translateY(-2px);
    }

    /* Section Headers */
    .section-title {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 1.8px;
      color: #fff;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    /* Modules List View */
    .modules-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .module-item {
      display: flex;
      align-items: center;
      gap: 14px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      padding: 16px 18px;
      border-radius: 14px;
      cursor: pointer;
      transition: 0.25s ease;
      text-decoration: none;
      color: #fff;
    }

    .module-item:hover {
      border-color: rgba(255, 45, 85, 0.4);
      background: #14151e;
      transform: translateX(4px);
    }

    .module-icon {
      font-size: 18px;
      color: var(--text-muted);
    }

    .module-label {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.2px;
    }

    /* Interactive Pairing Card Drawer */
    .tool-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .tool-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .tool-title {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 0.5px;
    }

    .tool-tag {
      font-size: 10px;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      color: var(--accent-pink);
      background: rgba(255, 45, 85, 0.12);
      padding: 3px 8px;
      border-radius: 6px;
    }

    input {
      width: 100%;
      background: #090a0f;
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 15px 18px;
      font-size: 15px;
      font-family: 'JetBrains Mono', monospace;
      color: #fff;
      outline: none;
      transition: 0.25s;
    }

    input:focus {
      border-color: var(--accent-pink);
      box-shadow: 0 0 15px var(--accent-pink-glow);
    }

    .btn-submit {
      width: 100%;
      padding: 15px;
      border-radius: 12px;
      border: none;
      background: var(--accent-pink);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.5px;
      cursor: pointer;
      box-shadow: 0 5px 20px rgba(255, 45, 85, 0.35);
      transition: 0.25s;
    }

    .btn-submit:hover:not(:disabled) {
      opacity: 0.95;
      transform: translateY(-2px);
    }

    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    #codeDisplayBox {
      display: none;
      background: #090a0f;
      border: 1px dashed var(--accent-pink);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }

    .code-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 28px;
      font-weight: 800;
      color: #fff;
      letter-spacing: 4px;
      margin: 6px 0;
    }

    .btn-copy-code {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--card-border);
      color: #fff;
      padding: 9px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
    }

    /* Live Cluster Metrics Badge */
    .cluster-live-box {
      background: #111218;
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 16px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .cluster-info-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      font-weight: 700;
    }

    .cluster-info-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
      font-weight: 800;
      color: var(--accent-pink);
      margin-top: 3px;
    }

    /* Connect Section (Footer Meta) */
    .connect-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 8px;
    }

    .connect-item {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 14px;
      color: var(--text-muted);
      text-decoration: none;
      font-weight: 500;
    }

    .connect-icon {
      color: var(--accent-pink);
      font-size: 16px;
    }

    /* Animated Slide-in Sidebar (Menu Drawer) */
    .drawer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      z-index: 100;
      opacity: 0;
      pointer-events: none;
      transition: 0.35s ease;
    }

    .drawer-overlay.active {
      opacity: 1;
      pointer-events: all;
    }

    .drawer {
      position: fixed;
      top: 0;
      right: -360px;
      width: 320px;
      height: 100vh;
      background: #0c0d12;
      border-left: 1px solid var(--card-border);
      z-index: 110;
      padding: 30px 22px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      transition: 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: -15px 0 40px rgba(0, 0, 0, 0.8);
      overflow-y: auto;
    }

    .drawer.active {
      right: 0;
    }

    .drawer-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 15px;
    }

    .drawer-head h3 {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 1px;
      color: #fff;
    }

    .btn-close {
      cursor: pointer;
      color: var(--text-muted);
      font-size: 20px;
    }

    .btn-drawer-tool {
      width: 100%;
      padding: 13px;
      border-radius: 10px;
      border: 1px solid rgba(255, 45, 85, 0.3);
      background: rgba(255, 45, 85, 0.08);
      color: var(--accent-pink);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: 0.25s;
    }

    .btn-drawer-tool:hover {
      background: var(--accent-pink);
      color: #fff;
    }
  </style>
</head>
<body>

  <div class="glow-top"></div>

  <!-- Drawer Menu Overlay -->
  <div class="drawer-overlay" id="overlay" onclick="toggleMenu()"></div>

  <!-- Drawer Sidebar -->
  <div class="drawer" id="drawer">
    <div class="drawer-head">
      <h3>DIGITAL SUITE</h3>
      <div class="btn-close" onclick="toggleMenu()">✕</div>
    </div>

    <!-- Tool A: Channel React Tool -->
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <div style="font-size: 12px; font-weight: 800; color: #fff; text-transform: uppercase;">⚡ Auto Channel React</div>
      <p style="font-size: 11px; color: var(--text-muted); line-height: 1.5;">WhatsApp Channel Link එක ලබා දී cluster reactions activate කරගන්න.</p>
      <input type="text" id="reactLink" placeholder="https://whatsapp.com/channel/..." autocomplete="off">
      <button class="btn-drawer-tool" onclick="runChannelTool('react')">ACTIVATE REACTIONS</button>
    </div>

    <hr style="border: 0; border-top: 1px solid var(--card-border);">

    <!-- Tool B: Channel Follower Booster -->
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <div style="font-size: 12px; font-weight: 800; color: #fff; text-transform: uppercase;">📢 Multi-Follow Engine</div>
      <p style="font-size: 11px; color: var(--text-muted); line-height: 1.5;">Cluster එකේ සිටින සියලුම botsලා එකවර channel එක follow කරවන්න.</p>
      <input type="text" id="followLink" placeholder="https://whatsapp.com/channel/..." autocomplete="off">
      <button class="btn-drawer-tool" style="background: rgba(255,255,255,0.06); border-color: var(--card-border); color: #fff;" onclick="runChannelTool('follow')">FOLLOW WITH ALL BOTS</button>
    </div>

    <div style="margin-top: auto; font-size: 11px; color: var(--text-dim); text-align: center;">
      Built & Engineered by Dinidu Heshan
    </div>
  </div>

  <div class="wrapper">

    <!-- Top Navbar -->
    <nav class="navbar">
      <div class="brand-group">
        <div class="brand-icon">
          <img src="https://files.catbox.moe/k315x4.jpg" alt="Icon">
        </div>
        <div class="brand-text">
          <h2>DARK-DINU OFC</h2>
          <p>DIGITAL SYSTEMS</p>
        </div>
      </div>

      <div class="nav-actions">
        <a class="btn-launch" href="#pairingSection">
          Launch Bot ↗
        </a>
        <div class="menu-trigger" onclick="toggleMenu()">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </nav>

    <!-- Hero Title -->
    <section class="hero-section">
      <h1 class="hero-title">DARK-DINU <span>OFC</span></h1>
      <p class="hero-desc">
        Empowering the digital future with cutting-edge Web Development, AI solutions, and next-generation intelligent bots.
      </p>

      <!-- Social Links -->
      <div class="social-row">
        <a class="social-btn" href="https://wa.me/94719845166" target="_blank" title="WhatsApp">💬</a>
        <a class="social-btn" href="https://facebook.com" target="_blank" title="Facebook">📘</a>
        <a class="social-btn" href="https://youtube.com" target="_blank" title="YouTube">📺</a>
      </div>
    </section>

    <!-- Modules List -->
    <section>
      <div class="section-title">MODULES</div>
      <div class="modules-list">
        <div class="module-item" onclick="document.getElementById('pairingSection').scrollIntoView({behavior:'smooth'})">
          <div class="module-icon">🤖</div>
          <div class="module-label">Bot Studio</div>
        </div>
        <div class="module-item" onclick="toggleMenu()">
          <div class="module-icon">⚡</div>
          <div class="module-label">Digital Services</div>
        </div>
        <div class="module-item" onclick="alert('Session isolation and dynamic cluster modes are pre-configured.')">
          <div class="module-icon">⚙️</div>
          <div class="module-label">Settings</div>
        </div>
      </div>
    </section>

    <!-- Pairing Module (Bot Studio) -->
    <section id="pairingSection">
      <div class="section-title">BOT STUDIO // ACCESS</div>
      <div class="tool-card">
        <div class="tool-head">
          <div class="tool-title">Instant Node Linking</div>
          <div class="tool-tag">SAFARI CORE</div>
        </div>
        <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
          Country code සහිත WhatsApp අංකය ඇතුළත් කර pairing code එක ලබාගන්න.
        </p>

        <input type="tel" id="userPhone" placeholder="e.g. 94712345678" autocomplete="off">
        <button id="genBtn" class="btn-submit" onclick="requestPairCode()">GET PAIRING CODE</button>

        <div id="codeDisplayBox">
          <div style="font-size: 10px; color: var(--accent-pink); font-weight: 800; letter-spacing: 1px;">PAIRING CODE</div>
          <div class="code-val" id="codeVal">--------</div>
          <button class="btn-copy-code" id="copyCodeBtn" onclick="copyCode()">Copy Pairing Code</button>
        </div>
      </div>
    </section>

    <!-- Live Cluster Monitor -->
    <section>
      <div class="cluster-live-box">
        <div>
          <div class="cluster-info-title">Active Cloud Instances</div>
          <div class="cluster-info-val" id="activeBotsCount">0 Sockets</div>
        </div>
        <div style="text-align: right;">
          <div class="cluster-info-title">Runtime Latency</div>
          <div style="font-family: 'JetBrains Mono'; font-size: 14px; color: #10b981; font-weight: 700; margin-top: 5px;">~18ms Optimal</div>
        </div>
      </div>
    </section>

    <!-- Connect Meta Footer -->
    <section class="connect-section">
      <div class="section-title">CONNECT</div>
      
      <div class="connect-item">
        <div class="connect-icon">&lt;&gt;</div>
        <div>Designed by DARK-DINU OFC</div>
      </div>

      <a class="connect-item" href="mailto:heshan@devofc.top">
        <div class="connect-icon">✉</div>
        <div>heshan@devofc.top</div>
      </a>

      <a class="connect-item" href="tel:+94719845166">
        <div class="connect-icon">📞</div>
        <div>+94 71 984 5166</div>
      </a>

      <div class="connect-item">
        <div class="connect-icon">📍</div>
        <div>Sri Lanka</div>
      </div>
    </section>

  </div>

  <script>
    function toggleMenu() {
      document.getElementById('drawer').classList.toggle('active');
      document.getElementById('overlay').classList.toggle('active');
    }

    async function syncStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        document.getElementById('activeBotsCount').innerText = data.activeCount + ' Sockets';
      } catch (_) {}
    }
    setInterval(syncStats, 3500);
    syncStats();

    async function requestPairCode() {
      const p = document.getElementById('userPhone').value.trim().replace(/[^0-9]/g, '');
      const btn = document.getElementById('genBtn');
      const box = document.getElementById('codeDisplayBox');
      const codeEl = document.getElementById('codeVal');

      if (!p || p.length < 10) return alert('කරුණාකර වලංගු WhatsApp අංකයක් ඇතුළත් කරන්න!');
      
      btn.innerText = 'GENERATING CODE...';
      btn.disabled = true;

      try {
        const res = await fetch('/pair?phone=' + p);
        const data = await res.json();
        if (data.code) {
          codeEl.innerText = data.code;
          box.style.display = 'block';
          btn.innerText = 'CODE READY!';
          if (navigator.clipboard) navigator.clipboard.writeText(data.code.replace(/-/g, ''));
        } else {
          alert(data.error || 'Failed');
          btn.innerText = 'GET PAIRING CODE';
          btn.disabled = false;
        }
      } catch {
        alert('Server unreachable');
        btn.innerText = 'GET PAIRING CODE';
        btn.disabled = false;
      }
    }

    function copyCode() {
      const c = document.getElementById('codeVal').innerText.replace(/-/g, '');
      navigator.clipboard.writeText(c);
      document.getElementById('copyCodeBtn').innerText = '✓ COPIED!';
      setTimeout(() => document.getElementById('copyCodeBtn').innerText = 'Copy Pairing Code', 2000);
    }

    async function runChannelTool(action) {
      const link = document.getElementById(action === 'react' ? 'reactLink' : 'followLink').value.trim();
      if (!link) return alert('කරුණාකර Channel Link එක ඇතුළත් කරන්න!');
      
      try {
        const res = await fetch('/api/channel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, link })
        });
        const d = await res.json();
        if (d.status) {
          alert('✅ ' + d.message);
          toggleMenu();
        } else {
          alert('❌ ' + (d.error || 'Failed'));
        }
      } catch {
        alert('Server error!');
      }
    }
  </script>
</body>
</html>`;
}
