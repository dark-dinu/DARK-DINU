export function renderDashboardHtml(botName = "DARK-DINU OFC") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${botName} // CYBER CORE</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

  <style>
    :root {
      --bg-dark: #050608;
      --card-bg: rgba(13, 15, 22, 0.85);
      --card-border: rgba(255, 45, 85, 0.2);
      --card-border-subtle: rgba(255, 255, 255, 0.07);
      --accent-pink: #ff2d55;
      --accent-pink-glow: rgba(255, 45, 85, 0.35);
      --accent-cyan: #00f0ff;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #475569;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; -webkit-tap-highlight-color: transparent; scroll-behavior: smooth; }
    body { background-color: var(--bg-dark); color: var(--text-main); min-height: 100vh; overflow-x: hidden; display: flex; flex-direction: column; align-items: center; position: relative; }
    .bg-grid { position: fixed; inset: 0; background-image: linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 32px 32px; pointer-events: none; z-index: 0; }
    .ambient-glow-1 { position: fixed; top: -150px; left: 50%; transform: translateX(-50%); width: 500px; height: 350px; background: radial-gradient(circle, rgba(255, 45, 85, 0.22) 0%, transparent 70%); pointer-events: none; z-index: 0; filter: blur(40px); }

    .wrapper { width: 100%; max-width: 540px; padding: 20px 18px 80px 18px; display: flex; flex-direction: column; gap: 28px; position: relative; z-index: 10; }

    /* Navbar */
    .navbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(16, 18, 27, 0.6); border: 1px solid var(--card-border-subtle); border-radius: 18px; backdrop-filter: blur(16px); }
    .brand-group { display: flex; align-items: center; gap: 12px; }
    .brand-icon { width: 42px; height: 42px; border-radius: 12px; position: relative; padding: 2px; background: linear-gradient(135deg, var(--accent-pink), var(--accent-cyan)); box-shadow: 0 0 16px var(--accent-pink-glow); }
    .brand-icon img { width: 100%; height: 100%; border-radius: 10px; object-fit: cover; display: block; background: #111; }
    .brand-text h2 { font-size: 14px; font-weight: 800; color: #fff; }
    .brand-text p { font-size: 9px; font-weight: 800; letter-spacing: 1.5px; color: var(--accent-cyan); text-transform: uppercase; margin-top: 1px; }

    .nav-actions { display: flex; align-items: center; gap: 8px; }
    .btn-nav-contact { display: inline-flex; align-items: center; gap: 6px; background: rgba(255, 45, 85, 0.12); border: 1px solid rgba(255, 45, 85, 0.35); color: #fff; padding: 8px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; text-decoration: none; cursor: pointer; }
    .menu-trigger { width: 40px; height: 40px; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--card-border-subtle); border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; font-size: 15px; }

    /* Hero Card */
    .hero-card { background: linear-gradient(145deg, rgba(20, 24, 36, 0.8), rgba(10, 11, 16, 0.7)); border: 1px solid var(--card-border-subtle); border-radius: 24px; padding: 28px 24px; backdrop-filter: blur(20px); position: relative; overflow: hidden; }
    .hero-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--accent-pink), var(--accent-cyan), transparent); }
    .badge-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 14px; }
    .pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; animation: pulse 1.8s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }

    .hero-title { font-family: 'Space Grotesk', sans-serif; font-size: 30px; font-weight: 800; color: #fff; margin-bottom: 10px; }
    .hero-title span { background: linear-gradient(135deg, var(--accent-pink) 0%, #ff758c 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero-desc { font-size: 13px; line-height: 1.6; color: var(--text-muted); margin-bottom: 20px; }
    .social-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .social-btn { height: 44px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--card-border-subtle); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; text-decoration: none; font-size: 15px; gap: 3px; }
    .social-btn span { font-size: 9px; font-weight: 700; color: var(--text-muted); }

    /* Diagnostics Panel */
    .diagnostics-panel { background: linear-gradient(170deg, #101119 0%, #08090d 100%); border: 1px solid rgba(255, 45, 85, 0.22); border-radius: 26px; padding: 24px 20px; display: flex; flex-direction: column; gap: 18px; box-shadow: 0 15px 45px rgba(0, 0, 0, 0.6); }
    .diag-head { display: flex; flex-direction: column; gap: 4px; }
    .diag-tag { font-size: 10px; font-weight: 800; letter-spacing: 1.5px; color: var(--accent-pink); text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
    .diag-tag .red-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-pink); box-shadow: 0 0 10px var(--accent-pink); }
    .diag-title { font-family: 'Space Grotesk', sans-serif; font-size: 24px; font-weight: 800; color: #fff; }
    .diag-title span { color: var(--accent-pink); }
    .diag-subtext { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: var(--text-muted); text-transform: uppercase; }

    .filter-tabs { display: flex; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--card-border-subtle); border-radius: 12px; padding: 4px; gap: 4px; }
    .tab-btn { flex: 1; padding: 8px 0; border: none; background: transparent; color: var(--text-muted); font-size: 12px; font-weight: 800; border-radius: 8px; cursor: pointer; font-family: 'JetBrains Mono', monospace; }
    .tab-btn.active { background: var(--accent-pink); color: #fff; box-shadow: 0 0 16px var(--accent-pink-glow); }

    .diag-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .diag-stat-card { background: rgba(18, 20, 30, 0.6); border: 1px solid var(--card-border-subtle); border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
    .diag-stat-label { font-size: 10px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: var(--text-muted); }
    .diag-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 800; color: #fff; display: flex; align-items: baseline; gap: 4px; }
    .diag-stat-val small { font-size: 10px; color: var(--accent-pink); }

    /* Live Dynamic Waveform Graph */
    .graph-card { background: rgba(11, 13, 20, 0.9); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 18px; padding: 16px 14px 10px 14px; position: relative; }
    .graph-container { width: 100%; height: 125px; position: relative; }
    .graph-svg { width: 100%; height: 100%; overflow: visible; }
    .graph-labels-x { display: flex; justify-content: space-between; margin-top: 8px; padding: 0 4px; font-size: 10px; font-family: 'JetBrains Mono', monospace; color: var(--text-dim); }

    .diag-footer { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; padding: 0 4px; }
    .btn-refresh { background: rgba(255, 255, 255, 0.04); border: 1px solid var(--card-border-subtle); border-radius: 8px; color: #fff; padding: 6px 12px; font-size: 11px; font-weight: 700; cursor: pointer; }

    .btn-create-bot { width: 100%; padding: 15px; border-radius: 14px; border: none; background: linear-gradient(135deg, var(--accent-pink) 0%, #d81b43 100%); color: #fff; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 6px 25px var(--accent-pink-glow); display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; }
    .sync-sublabel { font-size: 10px; color: var(--text-dim); text-align: center; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; }

    /* Tool & Pairing Card */
    .tool-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 22px; padding: 22px; backdrop-filter: blur(16px); }
    .tool-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .tool-title { font-size: 15px; font-weight: 700; color: #fff; }
    .tool-tag { font-size: 9px; font-weight: 800; font-family: 'JetBrains Mono', monospace; color: var(--accent-cyan); background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.25); padding: 3px 8px; border-radius: 6px; }

    .input-wrapper { position: relative; margin: 14px 0; }
    .input-wrapper i { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-dim); font-size: 14px; }
    input[type="text"], input[type="tel"] { width: 100%; background: rgba(6, 7, 10, 0.8); border: 1px solid var(--card-border-subtle); border-radius: 14px; padding: 15px 16px 15px 44px; font-size: 14px; font-family: 'JetBrains Mono', monospace; color: #fff; outline: none; }
    input:focus { border-color: var(--accent-pink); box-shadow: 0 0 20px var(--accent-pink-glow); }

    .btn-submit { width: 100%; padding: 15px; border-radius: 14px; border: none; background: linear-gradient(135deg, var(--accent-pink) 0%, #d81b43 100%); color: #fff; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 6px 25px var(--accent-pink-glow); display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    #codeDisplayBox { display: none; margin-top: 16px; background: rgba(0, 0, 0, 0.6); border: 1px dashed var(--accent-pink); border-radius: 16px; padding: 18px; text-align: center; }
    .code-val { font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 800; color: #fff; letter-spacing: 5px; margin: 8px 0 12px 0; text-shadow: 0 0 15px var(--accent-pink-glow); }
    .btn-copy-code { background: rgba(255, 255, 255, 0.06); border: 1px solid var(--card-border-subtle); color: #fff; padding: 11px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; }

    /* Drawer & Modal */
    .drawer-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); z-index: 100; opacity: 0; pointer-events: none; transition: 0.3s; }
    .drawer-overlay.active { opacity: 1; pointer-events: all; }
    .drawer { position: fixed; top: 0; right: -360px; width: 320px; height: 100vh; background: #090a10; border-left: 1px solid var(--card-border-subtle); z-index: 110; padding: 26px 20px; display: flex; flex-direction: column; gap: 18px; transition: 0.35s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: -15px 0 40px rgba(0, 0, 0, 0.8); overflow-y: auto; }
    .drawer.active { right: 0; }
    .drawer-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--card-border-subtle); padding-bottom: 14px; }
    .drawer-btn-card { background: rgba(255, 255, 255, 0.03); border: 1px solid var(--card-border-subtle); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(12px); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 18px; opacity: 0; pointer-events: none; transition: 0.3s; }
    .modal-overlay.active { opacity: 1; pointer-events: all; }
    .modal-box { width: 100%; max-width: 440px; background: #0d0f16; border: 1px solid var(--card-border); border-radius: 24px; padding: 24px; }

    .daily-limit-badge { display: flex; align-items: center; justify-content: space-between; background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.25); border-radius: 12px; padding: 8px 12px; margin-bottom: 16px; font-size: 11px; font-family: 'JetBrains Mono', monospace; }
    .emoji-picker-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 14px 0 20px 0; }
    .emoji-item { aspect-ratio: 1; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--card-border-subtle); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; user-select: none; }
    .emoji-item.selected { background: rgba(255, 45, 85, 0.25); border-color: var(--accent-pink); box-shadow: 0 0 12px var(--accent-pink-glow); }
  </style>
</head>
<body>

  <div class="bg-grid"></div>
  <div class="ambient-glow-1"></div>

  <!-- Drawer Menu Overlay -->
  <div class="drawer-overlay" id="overlay" onclick="toggleMenu()"></div>

  <!-- Drawer Menu -->
  <div class="drawer" id="drawer">
    <div class="drawer-head">
      <h3 style="color:#fff; font-size:14px; font-weight:800;"><i class="fa-solid fa-layer-group" style="color: var(--accent-pink); margin-right: 6px;"></i> DIGITAL SUITE</h3>
      <div style="cursor:pointer; color:#fff;" onclick="toggleMenu()"><i class="fa-solid fa-xmark"></i></div>
    </div>

    <div class="drawer-btn-card">
      <div style="font-size:13px; font-weight:800; color:#fff;"><i class="fa-solid fa-bolt" style="color: #fbbf24; margin-right:6px;"></i> Channel React Tool</div>
      <p style="font-size:11px; color:var(--text-muted); line-height:1.5;">Send instant custom reaction waves to WhatsApp Channel posts.</p>
      <button class="btn-submit" style="padding:10px; font-size:11px;" onclick="openReactModal()"><i class="fa-solid fa-fire"></i> LAUNCH TOOL</button>
    </div>
  </div>

  <!-- Channel React Multi-Step Modal -->
  <div class="modal-overlay" id="reactModal">
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="font-size:15px; font-weight:800; color:#fff;"><i class="fa-solid fa-icons" style="color: var(--accent-pink);"></i> Channel React Tool</h3>
        <div style="cursor:pointer; color:var(--text-muted);" onclick="closeReactModal()"><i class="fa-solid fa-xmark"></i></div>
      </div>

      <div class="daily-limit-badge">
        <span><i class="fa-regular fa-clock"></i> DAILY REACT LIMIT:</span>
        <div style="font-weight:800; color:var(--accent-cyan);"><i class="fa-solid fa-bolt"></i> <span id="dailyLimitText">10/10</span></div>
      </div>

      <!-- Step 1: Link Input -->
      <div id="step1Box">
        <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 12px;">
          Enter the specific WhatsApp Channel <b>Post Link</b> (e.g. .../channel/code/123):
        </p>
        <div class="input-wrapper" style="margin-top: 0;">
          <i class="fa-solid fa-link"></i>
          <input type="text" id="targetPostLink" placeholder="https://whatsapp.com/channel/.../123" autocomplete="off">
        </div>
        <button id="step1NextBtn" class="btn-submit" onclick="proceedToEmojiStep()">
          <span>CONTINUE TO EMOJIS</span> <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>

      <!-- Step 2: Emoji Selection & Confirmation -->
      <div id="step2Box" style="display: none;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; font-weight: 700; color: #fff;">Select Emojis (Max 5)</span>
          <span style="font-size:11px; font-weight:700; color:var(--accent-pink);" id="emojiCountBadge">0 / 5 Selected</span>
        </div>

        <div class="emoji-picker-grid">
          <div class="emoji-item" onclick="toggleEmoji(this, '❤️')">❤️</div>
          <div class="emoji-item" onclick="toggleEmoji(this, '🔥')">🔥</div>
          <div class="emoji-item" onclick="toggleEmoji(this, '👍')">👍</div>
          <div class="emoji-item" onclick="toggleEmoji(this, '😂')">😂</div>
          <div class="emoji-item" onclick="toggleEmoji(this, '😮')">😮</div>
          <div class="emoji-item" onclick="toggleEmoji(this, '🎉')">🎉</div>
          <div class="emoji-item" onclick="toggleEmoji(this, '👏')">👏</div>
          <div class="emoji-item" onclick="toggleEmoji(this, '💯')">💯</div>
          <div class="emoji-item" onclick="toggleEmoji(this, '⚡')">⚡</div>
          <div class="emoji-item" onclick="toggleEmoji(this, '🚀')">🚀</div>
          <div class="emoji-item" onclick="toggleEmoji(this, '😍')">😍</div>
          <div class="emoji-item" onclick="toggleEmoji(this, '💎')">💎</div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="btn-submit" style="background: rgba(255,255,255,0.06); box-shadow: none; flex: 1;" onclick="backToStep1()">Back</button>
          <button id="confirmReactBtn" class="btn-submit" style="flex: 2;" onclick="confirmAndSendReactions()"><i class="fa-solid fa-check"></i> CONFIRM & REACT</button>
        </div>
      </div>
    </div>
  </div>

  <div class="wrapper">
    <!-- Navbar -->
    <nav class="navbar">
      <div class="brand-group">
        <div class="brand-icon">
          <img src="/logo.jpg" onerror="this.onerror=null; this.src='https://files.catbox.moe/k315x4.jpg';" alt="Logo">
        </div>
        <div class="brand-text">
          <h2>${botName}</h2>
          <p>DIGITAL SYSTEMS</p>
        </div>
      </div>

      <div class="nav-actions">
        <a class="btn-nav-contact" href="https://wa.me/94719845166" target="_blank"><i class="fa-solid fa-address-card"></i> Contact</a>
        <div class="menu-trigger" onclick="toggleMenu()"><i class="fa-solid fa-bars-staggered"></i></div>
      </div>
    </nav>

    <!-- Hero Card -->
    <section class="hero-card">
      <div class="badge-status"><span class="pulse-dot"></span><span>Systems Online</span></div>
      <h1 class="hero-title">${botName} <span>CORE</span></h1>
      <p class="hero-desc">Empowering next-generation automated bot clusters, intelligent cloud nodes, and high-performance Web APIs.</p>

      <div class="social-row">
        <a class="social-btn" href="https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V" target="_blank">
          <i class="fa-brands fa-whatsapp" style="color: #25D366;"></i><span>Channel</span>
        </a>
        <a class="social-btn" href="https://heshan.devofc.top" target="_blank">
          <i class="fa-solid fa-globe" style="color: var(--accent-cyan);"></i><span>Website</span>
        </a>
        <a class="social-btn" href="https://vt.tiktok.com/ZSgJSCL5k/" target="_blank">
          <i class="fa-brands fa-tiktok" style="color: #ff0050;"></i><span>TikTok</span>
        </a>
        <a class="social-btn" href="https://www.youtube.com/@Heshan_DH" target="_blank">
          <i class="fa-brands fa-youtube" style="color: #FF0000;"></i><span>YouTube</span>
        </a>
      </div>
    </section>

    <!-- Diagnostics Panel with Dynamic Smooth Neon Waveform -->
    <section class="diagnostics-panel">
      <div class="diag-head">
        <div class="diag-tag"><span class="red-dot"></span> LIVE DIAGNOSTICS</div>
        <div class="diag-title">DARK DINU <span>AI SYSTEM</span></div>
        <div class="diag-subtext">REAL-TIME ACTIVE ANALYSIS &bull; <span style="color:#10b981;"><i class="fa-solid fa-wifi"></i> LIVE</span></div>
      </div>

      <div class="filter-tabs">
        <button class="tab-btn" onclick="switchFilter(this, '7D')">7D</button>
        <button class="tab-btn active" onclick="switchFilter(this, '30D')">30D</button>
        <button class="tab-btn" onclick="switchFilter(this, 'ALL')">ALL</button>
      </div>

      <div class="diag-stats-grid">
        <div class="diag-stat-card">
          <div class="diag-stat-label"><i class="fa-solid fa-wave-square"></i> CURRENT</div>
          <div class="diag-stat-val" id="diagCurrent">0 <small>BOTS</small></div>
        </div>
        <div class="diag-stat-card">
          <div class="diag-stat-label"><i class="fa-solid fa-server"></i> PEAK</div>
          <div class="diag-stat-val" id="diagPeak">0 <small>BOTS</small></div>
        </div>
        <div class="diag-stat-card">
          <div class="diag-stat-label"><i class="fa-regular fa-clock"></i> AVERAGE</div>
          <div class="diag-stat-val" id="diagAvg">0 <small>BOTS</small></div>
        </div>
        <div class="diag-stat-card">
          <div class="diag-stat-label"><i class="fa-solid fa-signal"></i> STATUS</div>
          <div class="diag-stat-val" style="color: #10b981; font-size: 17px;">ONLINE</div>
        </div>
      </div>

      <!-- Waveform Graph with Dynamic Smooth Spline -->
      <div class="graph-card">
        <div class="graph-container">
          <svg class="graph-svg" viewBox="0 0 450 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id="neonRedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ff2d55" stop-opacity="0.38"/>
                <stop offset="100%" stop-color="#ff2d55" stop-opacity="0.0"/>
              </linearGradient>
              <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="#ff2d55"/>
              </filter>
            </defs>
            <line x1="0" y1="25" x2="450" y2="25" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3,3"/>
            <line x1="0" y1="65" x2="450" y2="65" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3,3"/>
            <path id="graphArea" d="" fill="url(#neonRedGrad)"/>
            <path id="graphLine" d="" fill="none" stroke="#ff2d55" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#neonGlow)"/>
          </svg>
        </div>

        <div class="graph-labels-x" id="graphDates">
          <span>Loading...</span>
        </div>
      </div>

      <div class="diag-footer">
        <div><span class="red-dot" style="display:inline-block; width:6px; height:6px; margin-right:4px;"></span> Last sync: <span id="lastSyncTime">--:--:--</span></div>
        <button class="btn-refresh" onclick="refreshDiagnostics()"><i class="fa-solid fa-arrows-rotate"></i> REFRESH NOW</button>
      </div>

      <a class="btn-create-bot" href="#pairingSection"><i class="fa-solid fa-robot"></i> CREATE BOT</a>
      <div class="sync-sublabel">AUTO-SYNC EVERY 15 SECONDS &bull; LIVE CLUSTER NODE</div>
    </section>

    <!-- Pairing Studio -->
    <section id="pairingSection">
      <div class="tool-card">
        <div class="tool-meta">
          <div class="tool-title"><i class="fa-solid fa-qrcode" style="color: var(--accent-pink);"></i> Link WhatsApp Node</div>
          <div class="tool-tag">SAFARI V2</div>
        </div>
        <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5;">Enter WhatsApp number with country code to generate your 8-digit Pairing Code.</p>
        <div class="input-wrapper">
          <i class="fa-solid fa-phone"></i>
          <input type="tel" id="userPhone" placeholder="e.g. 94712345678" autocomplete="off">
        </div>
        <button id="genBtn" class="btn-submit" onclick="requestPairCode()"><i class="fa-solid fa-key"></i> GET PAIRING CODE</button>
        <div id="codeDisplayBox">
          <div style="font-size: 10px; color: var(--accent-pink); font-weight: 800; letter-spacing: 1.5px;">YOUR PAIRING CODE</div>
          <div class="code-val" id="codeVal">--------</div>
          <button class="btn-copy-code" id="copyCodeBtn" onclick="copyCode()"><i class="fa-regular fa-copy"></i> Copy Pairing Code</button>
        </div>
      </div>
    </section>
  </div>

  <script>
    function toggleMenu() {
      document.getElementById('drawer').classList.toggle('active');
      document.getElementById('overlay').classList.toggle('active');
    }

    /* Auto-Generate Real Rolling Date Labels (Last 30 / 7 Days) */
    function updateDateLabels(days = 30) {
      const datesBox = document.getElementById('graphDates');
      const now = new Date();
      const labels = [];
      const step = Math.floor(days / 4);

      for (let i = 3; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - (i * step));
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      }
      datesBox.innerHTML = labels.map(l => '<span>' + l + '</span>').join('');
    }
    updateDateLabels(30);

    /* Render Dynamic Smooth Spline SVG Path */
    function drawSmoothCurve(points) {
      if (!points || points.length === 0) return;
      const width = 450;
      const height = 110;
      const maxVal = Math.max(...points, 5) * 1.25;
      const stepX = width / (points.length - 1);

      const coords = points.map((val, idx) => ({
        x: idx * stepX,
        y: height - ((val / maxVal) * (height - 20))
      }));

      // Generate cubic bezier spline
      let pathD = 'M ' + coords[0].x + ',' + coords[0].y;
      for (let i = 0; i < coords.length - 1; i++) {
        const curr = coords[i];
        const next = coords[i + 1];
        const midX = (curr.x + next.x) / 2;
        pathD += ' C ' + midX + ',' + curr.y + ' ' + midX + ',' + next.y + ' ' + next.x + ',' + next.y;
      }

      document.getElementById('graphLine').setAttribute('d', pathD);
      const areaD = pathD + ' L ' + width + ',120 L 0,120 Z';
      document.getElementById('graphArea').setAttribute('d', areaD);
    }

    async function refreshDiagnostics() {
      document.getElementById('lastSyncTime').innerText = new Date().toLocaleTimeString();
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        const count = data.activeCount || 0;

        document.getElementById('diagCurrent').innerHTML = count + ' <small>BOTS</small>';
        document.getElementById('diagPeak').innerHTML = (data.peakCount || count) + ' <small>BOTS</small>';
        document.getElementById('diagAvg').innerHTML = (data.avgCount || count) + ' <small>BOTS</small>';

        if (Array.isArray(data.history)) {
          drawSmoothCurve(data.history);
        }
      } catch (_) {}
    }
    setInterval(refreshDiagnostics, 15000);
    refreshDiagnostics();

    function switchFilter(btn, mode) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateDateLabels(mode === '7D' ? 7 : mode === '30D' ? 30 : 90);
      refreshDiagnostics();
    }

    /* Daily Limit Management */
    const MAX_DAILY_LIMIT = 10;
    function getRemainingLimit() {
      const today = new Date().toDateString();
      if (localStorage.getItem('react_limit_date') !== today) {
        localStorage.setItem('react_limit_date', today);
        localStorage.setItem('react_limit_count', MAX_DAILY_LIMIT.toString());
        return MAX_DAILY_LIMIT;
      }
      return parseInt(localStorage.getItem('react_limit_count') || '10', 10);
    }

    function updateLimitUI() {
      const rem = getRemainingLimit();
      const badge = document.getElementById('dailyLimitText');
      if (badge) badge.innerText = (rem < 10 ? '0' + rem : rem) + '/10';
      const confirmBtn = document.getElementById('confirmReactBtn');
      if (confirmBtn) confirmBtn.disabled = rem <= 0;
    }

    function decrementLimit() {
      let rem = getRemainingLimit();
      if (rem > 0) {
        rem--;
        localStorage.setItem('react_limit_count', rem.toString());
      }
      updateLimitUI();
    }

    /* Modal Management */
    let selectedEmojis = [];
    function openReactModal() {
      if (document.getElementById('drawer').classList.contains('active')) toggleMenu();
      updateLimitUI();
      document.getElementById('reactModal').classList.add('active');
      backToStep1();
    }
    function closeReactModal() { document.getElementById('reactModal').classList.remove('active'); }
    function backToStep1() {
      document.getElementById('step2Box').style.display = 'none';
      document.getElementById('step1Box').style.display = 'block';
    }

    function proceedToEmojiStep() {
      if (getRemainingLimit() <= 0) return alert('Your daily limit of 10/10 reactions has been reached!');
      const link = document.getElementById('targetPostLink').value.trim();
      if (!link || !link.includes('whatsapp.com/channel/')) {
        return alert('Please enter a valid WhatsApp Channel Post Link!');
      }
      document.getElementById('step1Box').style.display = 'none';
      document.getElementById('step2Box').style.display = 'block';
    }

    function toggleEmoji(el, emoji) {
      const idx = selectedEmojis.indexOf(emoji);
      if (idx > -1) {
        selectedEmojis.splice(idx, 1);
        el.classList.remove('selected');
      } else {
        if (selectedEmojis.length >= 5) return alert('You can select a maximum of 5 emojis!');
        selectedEmojis.push(emoji);
        el.classList.add('selected');
      }
      document.getElementById('emojiCountBadge').innerText = selectedEmojis.length + ' / 5 Selected';
    }

    async function confirmAndSendReactions() {
      if (getRemainingLimit() <= 0) return alert('Daily reaction limit reached!');
      const link = document.getElementById('targetPostLink').value.trim();
      if (selectedEmojis.length === 0) return alert('Please select at least one emoji!');

      const btn = document.getElementById('confirmReactBtn');
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> FIRING REACTIONS...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/channel-react', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postLink: link, emojis: selectedEmojis })
        });
        const d = await res.json();
        if (d.status || res.ok) {
          decrementLimit();
          alert('Reactions deployed successfully! Remaining runs: ' + getRemainingLimit() + '/10');
          closeReactModal();
          selectedEmojis = [];
          document.querySelectorAll('.emoji-item.selected').forEach(e => e.classList.remove('selected'));
          document.getElementById('emojiCountBadge').innerText = '0 / 5 Selected';
          document.getElementById('targetPostLink').value = '';
        } else {
          alert('Failed: ' + (d.error || 'Server error.'));
        }
      } catch {
        alert('Server connection error. Please try again.');
      } finally {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> CONFIRM & REACT';
        updateLimitUI();
      }
    }

    async function requestPairCode() {
      const p = document.getElementById('userPhone').value.trim().replace(/[^0-9]/g, '');
      const btn = document.getElementById('genBtn');
      const box = document.getElementById('codeDisplayBox');
      const codeEl = document.getElementById('codeVal');

      if (!p || p.length < 10) return alert('Please enter a valid WhatsApp phone number!');
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> GENERATING...';
      btn.disabled = true;

      try {
        const res = await fetch('/pair?phone=' + p);
        const data = await res.json();
        if (data.code) {
          codeEl.innerText = data.code;
          box.style.display = 'block';
          btn.innerHTML = '<i class="fa-solid fa-check"></i> CODE READY!';
          if (navigator.clipboard) navigator.clipboard.writeText(data.code.replace(/-/g, ''));
        } else {
          alert(data.error || 'Pairing error.');
          btn.innerHTML = '<i class="fa-solid fa-key"></i> GET PAIRING CODE';
          btn.disabled = false;
        }
      } catch {
        alert('Server unreachable');
        btn.innerHTML = '<i class="fa-solid fa-key"></i> GET PAIRING CODE';
        btn.disabled = false;
      }
    }

    function copyCode() {
      navigator.clipboard.writeText(document.getElementById('codeVal').innerText.replace(/-/g, ''));
      document.getElementById('copyCodeBtn').innerHTML = '<i class="fa-solid fa-check"></i> COPIED!';
      setTimeout(() => { document.getElementById('copyCodeBtn').innerHTML = '<i class="fa-regular fa-copy"></i> Copy Pairing Code'; }, 2000);
    }
  </script>
</body>
</html>`;
}
