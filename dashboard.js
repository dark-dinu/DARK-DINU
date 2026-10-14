export function renderDashboardHtml(botName = "DARK-DINU OFC") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${botName} // CYBER CORE</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&family=JetBrains+Mono:wght@500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <!-- Font Awesome Icons -->
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
      --accent-cyan-glow: rgba(0, 240, 255, 0.25);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #475569;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
      -webkit-tap-highlight-color: transparent;
      scroll-behavior: smooth;
    }

    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      min-height: 100vh;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }

    .bg-grid {
      position: fixed;
      inset: 0;
      background-image: 
        linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 32px 32px;
      pointer-events: none;
      z-index: 0;
    }

    .ambient-glow-1 {
      position: fixed;
      top: -150px;
      left: 50%;
      transform: translateX(-50%);
      width: 500px;
      height: 350px;
      background: radial-gradient(circle, rgba(255, 45, 85, 0.22) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
      filter: blur(40px);
    }

    .ambient-glow-2 {
      position: fixed;
      bottom: -100px;
      right: -50px;
      width: 400px;
      height: 300px;
      background: radial-gradient(circle, rgba(0, 240, 255, 0.12) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
      filter: blur(50px);
    }

    .wrapper {
      width: 100%;
      max-width: 540px;
      padding: 20px 18px 80px 18px;
      display: flex;
      flex-direction: column;
      gap: 28px;
      position: relative;
      z-index: 10;
    }

    /* Navbar */
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: rgba(16, 18, 27, 0.6);
      border: 1px solid var(--card-border-subtle);
      border-radius: 18px;
      backdrop-filter: blur(16px);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      position: relative;
      padding: 2px;
      background: linear-gradient(135deg, var(--accent-pink), var(--accent-cyan));
      box-shadow: 0 0 16px var(--accent-pink-glow);
    }

    .brand-icon img {
      width: 100%;
      height: 100%;
      border-radius: 8px;
      object-fit: cover;
      display: block;
    }

    .brand-text h2 {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #fff;
    }

    .brand-text p {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: var(--accent-cyan);
      text-transform: uppercase;
      margin-top: 1px;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-nav-contact {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 45, 85, 0.12);
      border: 1px solid rgba(255, 45, 85, 0.35);
      color: #fff;
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
      transition: 0.25s;
      cursor: pointer;
    }

    .btn-nav-contact:hover {
      background: var(--accent-pink);
      box-shadow: 0 0 15px var(--accent-pink-glow);
    }

    .menu-trigger {
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--card-border-subtle);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #fff;
      font-size: 15px;
      transition: 0.25s;
    }

    .menu-trigger:hover {
      background: rgba(255, 45, 85, 0.15);
      border-color: var(--accent-pink);
    }

    /* Hero Card */
    .hero-card {
      background: linear-gradient(145deg, rgba(20, 24, 36, 0.8), rgba(10, 11, 16, 0.7));
      border: 1px solid var(--card-border-subtle);
      border-radius: 24px;
      padding: 28px 24px;
      backdrop-filter: blur(20px);
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }

    .hero-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--accent-pink), var(--accent-cyan), transparent);
    }

    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #10b981;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 14px;
    }

    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
      animation: pulse 1.8s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .hero-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 30px;
      font-weight: 800;
      letter-spacing: -0.5px;
      line-height: 1.15;
      color: #fff;
      margin-bottom: 10px;
    }

    .hero-title span {
      background: linear-gradient(135deg, var(--accent-pink) 0%, #ff758c 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-desc {
      font-size: 13px;
      line-height: 1.6;
      color: var(--text-muted);
      margin-bottom: 20px;
    }

    .social-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }

    .social-btn {
      height: 44px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border-subtle);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #fff;
      text-decoration: none;
      font-size: 15px;
      transition: all 0.25s ease;
      gap: 3px;
    }

    .social-btn span {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.3px;
      color: var(--text-muted);
    }

    .social-btn:hover {
      border-color: var(--accent-pink);
      background: rgba(255, 45, 85, 0.1);
      transform: translateY(-2px);
      box-shadow: 0 4px 15px var(--accent-pink-glow);
    }

    .social-btn:hover span {
      color: #fff;
    }

    /* Diagnostics Panel */
    .diagnostics-panel {
      background: linear-gradient(170deg, #101119 0%, #08090d 100%);
      border: 1px solid rgba(255, 45, 85, 0.22);
      border-radius: 26px;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      position: relative;
      box-shadow: 0 15px 45px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(16px);
    }

    .diag-head {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .diag-tag {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: var(--accent-pink);
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .diag-tag .red-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent-pink);
      box-shadow: 0 0 10px var(--accent-pink);
      animation: pulse 1.5s infinite;
    }

    .diag-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
    }

    .diag-title span {
      color: var(--accent-pink);
    }

    .diag-subtext {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: var(--text-muted);
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .diag-subtext span {
      color: #fff;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* Filter Tabs */
    .filter-tabs {
      display: flex;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border-subtle);
      border-radius: 12px;
      padding: 4px;
      gap: 4px;
    }

    .tab-btn {
      flex: 1;
      padding: 8px 0;
      border: none;
      background: transparent;
      color: var(--text-muted);
      font-size: 12px;
      font-weight: 800;
      border-radius: 8px;
      cursor: pointer;
      transition: 0.25s ease;
      font-family: 'JetBrains Mono', monospace;
    }

    .tab-btn.active {
      background: var(--accent-pink);
      color: #fff;
      box-shadow: 0 0 16px var(--accent-pink-glow);
    }

    /* Diagnostics Grid */
    .diag-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    .diag-stat-card {
      background: rgba(18, 20, 30, 0.6);
      border: 1px solid var(--card-border-subtle);
      border-radius: 16px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .diag-stat-label {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .diag-stat-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 20px;
      font-weight: 800;
      color: #fff;
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .diag-stat-val small {
      font-size: 10px;
      color: var(--accent-pink);
      letter-spacing: 1px;
    }

    /* Waveform Graph */
    .graph-card {
      background: rgba(11, 13, 20, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 18px;
      padding: 16px 14px 10px 14px;
      position: relative;
    }

    .graph-container {
      width: 100%;
      height: 125px;
      position: relative;
    }

    .graph-svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .graph-labels-x {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      padding: 0 4px;
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-dim);
    }

    .diag-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      padding: 0 4px;
    }

    .btn-refresh {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--card-border-subtle);
      border-radius: 8px;
      color: #fff;
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: 0.2s;
    }

    .btn-refresh:hover {
      background: rgba(255, 45, 85, 0.15);
      border-color: var(--accent-pink);
    }

    .btn-create-bot {
      width: 100%;
      padding: 15px;
      border-radius: 14px;
      border: none;
      background: linear-gradient(135deg, var(--accent-pink) 0%, #d81b43 100%);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.5px;
      cursor: pointer;
      box-shadow: 0 6px 25px var(--accent-pink-glow);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.25s ease;
      text-decoration: none;
    }

    .btn-create-bot:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px var(--accent-pink-glow);
      filter: brightness(1.1);
    }

    .sync-sublabel {
      font-size: 10px;
      color: var(--text-dim);
      text-align: center;
      letter-spacing: 1px;
      text-transform: uppercase;
      font-weight: 700;
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding: 0 4px;
    }

    .section-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: var(--text-muted);
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-title i {
      color: var(--accent-pink);
    }

    /* Pairing Tool Card */
    .tool-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 22px;
      padding: 22px;
      backdrop-filter: blur(16px);
      position: relative;
      box-shadow: 0 10px 35px rgba(0, 0, 0, 0.5);
    }

    .tool-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .tool-title {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .tool-tag {
      font-size: 9px;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      color: var(--accent-cyan);
      background: rgba(0, 240, 255, 0.1);
      border: 1px solid rgba(0, 240, 255, 0.25);
      padding: 3px 8px;
      border-radius: 6px;
    }

    .input-wrapper {
      position: relative;
      margin-top: 14px;
      margin-bottom: 14px;
    }

    .input-wrapper i {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-dim);
      font-size: 14px;
    }

    input[type="text"], input[type="tel"] {
      width: 100%;
      background: rgba(6, 7, 10, 0.8);
      border: 1px solid var(--card-border-subtle);
      border-radius: 14px;
      padding: 15px 16px 15px 44px;
      font-size: 14px;
      font-family: 'JetBrains Mono', monospace;
      color: #fff;
      outline: none;
      transition: 0.25s;
    }

    input:focus {
      border-color: var(--accent-pink);
      box-shadow: 0 0 20px var(--accent-pink-glow);
    }

    .btn-submit {
      width: 100%;
      padding: 15px;
      border-radius: 14px;
      border: none;
      background: linear-gradient(135deg, var(--accent-pink) 0%, #d81b43 100%);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.5px;
      cursor: pointer;
      box-shadow: 0 6px 25px var(--accent-pink-glow);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.25s ease;
    }

    .btn-submit:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px var(--accent-pink-glow);
      filter: brightness(1.1);
    }

    .btn-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      filter: grayscale(1);
    }

    #codeDisplayBox {
      display: none;
      margin-top: 16px;
      background: rgba(0, 0, 0, 0.6);
      border: 1px dashed var(--accent-pink);
      border-radius: 16px;
      padding: 18px;
      text-align: center;
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .code-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 28px;
      font-weight: 800;
      color: #fff;
      letter-spacing: 5px;
      margin: 8px 0 12px 0;
      text-shadow: 0 0 15px var(--accent-pink-glow);
    }

    .btn-copy-code {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--card-border-subtle);
      color: #fff;
      padding: 11px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: 0.2s;
    }

    .btn-copy-code:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    /* Modules List */
    .modules-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .module-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--card-bg);
      border: 1px solid var(--card-border-subtle);
      padding: 14px 18px;
      border-radius: 16px;
      cursor: pointer;
      transition: 0.25s ease;
      backdrop-filter: blur(12px);
      text-decoration: none;
      color: #fff;
    }

    .module-item:hover {
      border-color: rgba(255, 45, 85, 0.4);
      background: rgba(20, 24, 36, 0.8);
      transform: translateX(4px);
    }

    .module-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .module-icon-wrap {
      width: 36px;
      height: 36px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border-subtle);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-pink);
      font-size: 14px;
    }

    .module-label {
      font-size: 13px;
      font-weight: 700;
    }

    /* Developer Section */
    .dev-profile-card {
      background: linear-gradient(145deg, rgba(17, 20, 30, 0.95), rgba(9, 10, 16, 0.9));
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 26px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      position: relative;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(20px);
    }

    .dev-avatar-wrap {
      width: 108px;
      height: 108px;
      border-radius: 50%;
      padding: 3px;
      background: linear-gradient(135deg, var(--accent-pink), var(--accent-cyan));
      box-shadow: 0 0 25px var(--accent-pink-glow);
      margin-bottom: 16px;
      position: relative;
    }

    .dev-avatar-img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      display: block;
      border: 3px solid #050608;
    }

    .dev-verified-badge {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 24px;
      height: 24px;
      background: #00f0ff;
      color: #050608;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      border: 2px solid #050608;
    }

    .dev-name {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 20px;
      font-weight: 800;
      color: #fff;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .dev-role {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: var(--accent-cyan);
      text-transform: uppercase;
      margin-bottom: 14px;
      font-family: 'JetBrains Mono', monospace;
    }

    .dev-bio {
      font-size: 12.5px;
      color: var(--text-muted);
      line-height: 1.6;
      max-width: 440px;
      margin-bottom: 20px;
    }

    .dev-contact-grid {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .dev-contact-btn {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border-subtle);
      border-radius: 14px;
      padding: 12px 16px;
      color: #fff;
      text-decoration: none;
      font-size: 13px;
      transition: all 0.2s ease;
    }

    .dev-contact-btn:hover {
      background: rgba(255, 45, 85, 0.1);
      border-color: var(--accent-pink);
      transform: translateY(-2px);
    }

    .dev-btn-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .dev-btn-left i {
      color: var(--accent-pink);
      font-size: 15px;
      width: 20px;
      text-align: center;
    }

    /* Drawer Sidebar */
    .drawer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      z-index: 100;
      opacity: 0;
      pointer-events: none;
      transition: 0.3s ease;
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
      background: #090a10;
      border-left: 1px solid var(--card-border-subtle);
      z-index: 110;
      padding: 26px 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      transition: 0.35s cubic-bezier(0.16, 1, 0.3, 1);
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
      border-bottom: 1px solid var(--card-border-subtle);
      padding-bottom: 14px;
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
      font-size: 18px;
      transition: 0.2s;
    }

    .btn-close:hover {
      color: #fff;
    }

    .typewriter-banner {
      background: rgba(255, 45, 85, 0.08);
      border: 1px solid rgba(255, 45, 85, 0.25);
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--accent-pink);
      min-height: 44px;
      display: flex;
      align-items: center;
    }

    .drawer-btn-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border-subtle);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: 0.25s;
    }

    .drawer-btn-card:hover {
      border-color: rgba(255, 45, 85, 0.4);
      background: rgba(255, 45, 85, 0.04);
    }

    .drawer-card-title {
      font-size: 13px;
      font-weight: 800;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .drawer-card-desc {
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .btn-drawer-action {
      width: 100%;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(255, 45, 85, 0.35);
      background: linear-gradient(135deg, rgba(255, 45, 85, 0.15), rgba(255, 45, 85, 0.05));
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: 0.25s;
    }

    .btn-drawer-action:hover {
      background: var(--accent-pink);
      box-shadow: 0 4px 20px var(--accent-pink-glow);
    }

    /* Channel React Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(12px);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      opacity: 0;
      pointer-events: none;
      transition: 0.3s ease;
    }

    .modal-overlay.active {
      opacity: 1;
      pointer-events: all;
    }

    .modal-box {
      width: 100%;
      max-width: 440px;
      background: #0d0f16;
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 24px;
      position: relative;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
      transform: translateY(20px);
      transition: 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .modal-overlay.active .modal-box {
      transform: translateY(0);
    }

    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .modal-head h3 {
      font-size: 15px;
      font-weight: 800;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .daily-limit-badge {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(0, 240, 255, 0.08);
      border: 1px solid rgba(0, 240, 255, 0.25);
      border-radius: 12px;
      padding: 8px 12px;
      margin-bottom: 16px;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
    }

    .daily-limit-badge span {
      color: var(--text-muted);
    }

    .daily-limit-val {
      font-weight: 800;
      color: var(--accent-cyan);
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .emoji-picker-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin: 14px 0 20px 0;
    }

    .emoji-item {
      aspect-ratio: 1;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--card-border-subtle);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      cursor: pointer;
      transition: 0.2s;
      user-select: none;
    }

    .emoji-item:hover {
      background: rgba(255, 45, 85, 0.15);
      border-color: var(--accent-pink);
      transform: scale(1.08);
    }

    .emoji-item.selected {
      background: rgba(255, 45, 85, 0.25);
      border-color: var(--accent-pink);
      box-shadow: 0 0 12px var(--accent-pink-glow);
      transform: scale(1.05);
    }

    .selected-count-badge {
      font-size: 11px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      color: var(--accent-pink);
    }
  </style>
</head>
<body>

  <div class="bg-grid"></div>
  <div class="ambient-glow-1"></div>
  <div class="ambient-glow-2"></div>

  <!-- Menu Drawer Overlay -->
  <div class="drawer-overlay" id="overlay" onclick="toggleMenu()"></div>

  <!-- Drawer Menu -->
  <div class="drawer" id="drawer">
    <div class="drawer-head">
      <h3><i class="fa-solid fa-layer-group" style="color: var(--accent-pink); margin-right: 6px;"></i> DIGITAL SUITE</h3>
      <div class="btn-close" onclick="toggleMenu()"><i class="fa-solid fa-xmark"></i></div>
    </div>

    <!-- Typewriter Box -->
    <div class="typewriter-banner">
      <span id="typewriterText"></span>
      <span style="animation: pulse 0.8s infinite; margin-left: 2px;">|</span>
    </div>

    <!-- Tool 1: Dedicated Channel React Flow Button -->
    <div class="drawer-btn-card">
      <div class="drawer-card-title">
        <i class="fa-solid fa-bolt" style="color: #fbbf24;"></i>
        <span>Channel React Engine</span>
      </div>
      <p class="drawer-card-desc">
        Send custom reaction batches to WhatsApp Channel posts (Daily 10 Reactions Limit).
      </p>
      <button class="btn-drawer-action" onclick="openReactModal()">
        <i class="fa-solid fa-fire"></i> LAUNCH CHANNEL REACT
      </button>
    </div>

    <!-- Tool 2: View Developer -->
    <div class="drawer-btn-card">
      <div class="drawer-card-title">
        <i class="fa-solid fa-user-astronaut" style="color: var(--accent-cyan);"></i>
        <span>Developer Console</span>
      </div>
      <p class="drawer-card-desc">
        View creator profile, system portfolio, and official direct contact channels with one click.
      </p>
      <button class="btn-drawer-action" style="border-color: rgba(0, 240, 255, 0.35); background: rgba(0, 240, 255, 0.08);" onclick="scrollToDeveloper()">
        <i class="fa-solid fa-address-card"></i> VIEW PROFILE
      </button>
    </div>

    <div style="margin-top: auto; font-size: 11px; color: var(--text-dim); text-align: center;">
      Built & Engineered by Dinidu Heshan
    </div>
  </div>

  <!-- Channel React Multi-Step Modal -->
  <div class="modal-overlay" id="reactModal">
    <div class="modal-box">
      <div class="modal-head">
        <h3><i class="fa-solid fa-icons" style="color: var(--accent-pink);"></i> Channel React Tool</h3>
        <div class="btn-close" onclick="closeReactModal()"><i class="fa-solid fa-xmark"></i></div>
      </div>

      <!-- Live Daily Limit Counter Badge -->
      <div class="daily-limit-badge">
        <span><i class="fa-regular fa-clock" style="margin-right: 4px;"></i> DAILY REACT LIMIT:</span>
        <div class="daily-limit-val">
          <i class="fa-solid fa-bolt"></i> <span id="dailyLimitText">10/10</span>
        </div>
      </div>

      <!-- Step 1: Link Input -->
      <div id="step1Box">
        <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 12px;">
          Enter the target WhatsApp Channel <b>Post Link</b>:
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
          <span class="selected-count-badge" id="emojiCountBadge">0 / 5 Selected</span>
        </div>

        <!-- Emoji Grid -->
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
          <button class="btn-submit" style="background: rgba(255,255,255,0.06); box-shadow: none; flex: 1;" onclick="backToStep1()">
            Back
          </button>
          <button id="confirmReactBtn" class="btn-submit" style="flex: 2;" onclick="confirmAndSendReactions()">
            <i class="fa-solid fa-check"></i> CONFIRM & REACT
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="wrapper">

    <!-- Navbar -->
    <nav class="navbar">
      <div class="brand-group">
        <div class="brand-icon">
          <!-- Official Bot Logo Loaded Directly -->
          <img src="/logo.jpg" onerror="this.onerror=null; this.src='https://files.catbox.moe/k315x4.jpg';" alt="Bot Logo">
        </div>
        <div class="brand-text">
          <h2>${botName}</h2>
          <p>DIGITAL SYSTEMS</p>
        </div>
      </div>

      <div class="nav-actions">
        <a class="btn-nav-contact" href="#developerSection">
          <i class="fa-solid fa-address-card"></i> Contact
        </a>
        <div class="menu-trigger" onclick="toggleMenu()" title="Open Suite">
          <i class="fa-solid fa-bars-staggered"></i>
        </div>
      </div>
    </nav>

    <!-- Hero Card -->
    <section class="hero-card">
      <div class="badge-status">
        <span class="pulse-dot"></span>
        <span>Systems Online</span>
      </div>

      <h1 class="hero-title">${botName} <span>CORE</span></h1>
      <p class="hero-desc">
        Empowering next-generation automated bot clusters, intelligent cloud nodes, and high-performance Web APIs.
      </p>

      <div class="social-row">
        <a class="social-btn" href="https://whatsapp.com/channel/0029VbAQYhXDZ4Lfo9K5gh1V" target="_blank" title="WhatsApp Channel">
          <i class="fa-brands fa-whatsapp" style="color: #25D366;"></i>
          <span>Channel</span>
        </a>
        <a class="social-btn" href="https://heshan.devofc.top" target="_blank" title="Official Web">
          <i class="fa-solid fa-globe" style="color: var(--accent-cyan);"></i>
          <span>Website</span>
        </a>
        <a class="social-btn" href="https://vt.tiktok.com/ZSgJSCL5k/" target="_blank" title="TikTok">
          <i class="fa-brands fa-tiktok" style="color: #ff0050;"></i>
          <span>TikTok</span>
        </a>
        <a class="social-btn" href="https://www.youtube.com/@Heshan_DH" target="_blank" title="YouTube">
          <i class="fa-brands fa-youtube" style="color: #FF0000;"></i>
          <span>YouTube</span>
        </a>
      </div>
    </section>

    <!-- Diagnostics Panel -->
    <section class="diagnostics-panel">
      
      <!-- Panel Header -->
      <div class="diag-head">
        <div class="diag-tag">
          <span class="red-dot"></span> LIVE DIAGNOSTICS
        </div>
        <div class="diag-title">DARK DINU <span>AI SYSTEM</span></div>
        <div class="diag-subtext">
          REAL-TIME ACTIVE ANALYSIS &bull; <span><i class="fa-solid fa-wifi"></i> LIVE</span>
        </div>
      </div>

      <!-- Time Filter Tabs -->
      <div class="filter-tabs">
        <button class="tab-btn" onclick="switchFilter(this, '7D')">7D</button>
        <button class="tab-btn active" onclick="switchFilter(this, '30D')">30D</button>
        <button class="tab-btn" onclick="switchFilter(this, 'ALL')">ALL</button>
      </div>

      <!-- 4 Stats Cards Grid -->
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
          <div class="diag-stat-label"><i class="fa-solid fa-arrow-rotate-right"></i> STATUS</div>
          <div class="diag-stat-val" style="color: #10b981; font-size: 16px;">ONLINE</div>
        </div>
      </div>

      <!-- Live Neon Waveform Graph -->
      <div class="graph-card">
        <div class="graph-container">
          <svg class="graph-svg" viewBox="0 0 450 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id="neonRedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ff2d55" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#ff2d55" stop-opacity="0.0"/>
              </linearGradient>
              <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#ff2d55"/>
              </filter>
            </defs>

            <!-- Grid Lines -->
            <line x1="0" y1="20" x2="450" y2="20" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3,3"/>
            <line x1="0" y1="55" x2="450" y2="55" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3,3"/>
            <line x1="0" y1="90" x2="450" y2="90" stroke="rgba(255,255,255,0.04)" stroke-dasharray="3,3"/>

            <!-- Area Fill -->
            <path id="graphArea" d="M 0,90 L 40,90 L 55,40 L 75,40 L 90,90 L 130,90 L 145,40 L 175,40 L 190,90 L 225,90 L 240,40 L 270,40 L 285,90 L 320,90 L 335,40 L 365,40 L 380,90 L 410,90 L 425,40 L 440,90 L 450,90 L 450,120 L 0,120 Z" fill="url(#neonRedGrad)"/>

            <!-- Line Stroke with Glow -->
            <path id="graphLine" d="M 0,90 L 40,90 L 55,40 L 75,40 L 90,90 L 130,90 L 145,40 L 175,40 L 190,90 L 225,90 L 240,40 L 270,40 L 285,90 L 320,90 L 335,40 L 365,40 L 380,90 L 410,90 L 425,40 L 440,90 L 450,90" fill="none" stroke="#ff2d55" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#neonGlow)"/>
          </svg>
        </div>

        <!-- Graph X-Axis Dates -->
        <div class="graph-labels-x">
          <span id="dateLabel1">Sep 14</span>
          <span id="dateLabel2">Sep 24</span>
          <span id="dateLabel3">Oct 04</span>
          <span id="dateLabel4">Oct 14</span>
        </div>
      </div>

      <!-- Sync Info & Refresh Button -->
      <div class="diag-footer">
        <div>
          <span class="red-dot" style="display:inline-block; width:6px; height:6px; margin-right:4px;"></span>
          Last sync: <span id="lastSyncTime">--:--:--</span>
        </div>
        <button class="btn-refresh" onclick="refreshDiagnostics()">
          <i class="fa-solid fa-arrows-rotate"></i> REFRESH NOW
        </button>
      </div>

      <!-- Action Button -->
      <a class="btn-create-bot" href="#pairingSection">
        <i class="fa-solid fa-robot"></i> CREATE BOT
      </a>

      <div class="sync-sublabel">
        AUTO-SYNC EVERY 30 SECONDS &bull; LIVE CLUSTER NODE
      </div>
    </section>

    <!-- Pairing Studio -->
    <section id="pairingSection">
      <div class="section-head">
        <div class="section-title"><i class="fa-solid fa-link"></i> Bot Studio // Pairing</div>
      </div>
      <div class="tool-card">
        <div class="tool-meta">
          <div class="tool-title">
            <i class="fa-solid fa-qrcode" style="color: var(--accent-pink);"></i> Link WhatsApp Node
          </div>
          <div class="tool-tag">SAFARI V2</div>
        </div>
        <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5;">
          Enter your WhatsApp number with country code to generate your 8-digit Pairing Code.
        </p>

        <div class="input-wrapper">
          <i class="fa-solid fa-phone"></i>
          <input type="tel" id="userPhone" placeholder="e.g. 94712345678" autocomplete="off">
        </div>

        <button id="genBtn" class="btn-submit" onclick="requestPairCode()">
          <i class="fa-solid fa-key"></i> GET PAIRING CODE
        </button>

        <div id="codeDisplayBox">
          <div style="font-size: 10px; color: var(--accent-pink); font-weight: 800; letter-spacing: 1.5px;">YOUR PAIRING CODE</div>
          <div class="code-val" id="codeVal">--------</div>
          <button class="btn-copy-code" id="copyCodeBtn" onclick="copyCode()">
            <i class="fa-regular fa-copy"></i> Copy Pairing Code
          </button>
        </div>
      </div>
    </section>

    <!-- Quick Modules -->
    <section>
      <div class="section-head">
        <div class="section-title"><i class="fa-solid fa-shapes"></i> Quick Modules</div>
      </div>
      <div class="modules-list">
        <div class="module-item" onclick="document.getElementById('pairingSection').scrollIntoView({behavior:'smooth'})">
          <div class="module-left">
            <div class="module-icon-wrap"><i class="fa-solid fa-robot"></i></div>
            <div class="module-label">Bot Studio Linking</div>
          </div>
          <i class="fa-solid fa-chevron-right" style="color: var(--text-dim); font-size: 12px;"></i>
        </div>

        <div class="module-item" onclick="openReactModal()">
          <div class="module-left">
            <div class="module-icon-wrap"><i class="fa-solid fa-bolt" style="color: #fbbf24;"></i></div>
            <div class="module-label">Auto Channel React Suite</div>
          </div>
          <i class="fa-solid fa-chevron-right" style="color: var(--text-dim); font-size: 12px;"></i>
        </div>

        <div class="module-item" onclick="scrollToDeveloper()">
          <div class="module-left">
            <div class="module-icon-wrap"><i class="fa-solid fa-user-gear" style="color: var(--accent-cyan);"></i></div>
            <div class="module-label">Developer Profile & Contact</div>
          </div>
          <i class="fa-solid fa-chevron-right" style="color: var(--text-dim); font-size: 12px;"></i>
        </div>
      </div>
    </section>

    <!-- Developer Profile & Contact Section -->
    <section id="developerSection">
      <div class="section-head">
        <div class="section-title"><i class="fa-solid fa-user-astronaut"></i> System Architect</div>
      </div>
      <div class="dev-profile-card">
        
        <div class="dev-avatar-wrap">
          <img class="dev-avatar-img" src="https://files.catbox.moe/6k22ob.jpg" alt="Dinidu Heshan">
          <div class="dev-verified-badge" title="Verified Creator">
            <i class="fa-solid fa-check"></i>
          </div>
        </div>

        <h3 class="dev-name">Dinidu Heshan Samaranayaka</h3>
        <p class="dev-role">&lt; Full-Stack & Bot Automation Dev /&gt;</p>
        
        <p class="dev-bio">
          Lead architect developing next-generation AI Bot Solutions, custom WhatsApp Multi-Device modules, web applications, and secure cloud ecosystems.
        </p>

        <div class="dev-contact-grid">
          <a class="dev-contact-btn" href="https://wa.me/94719845166" target="_blank">
            <div class="dev-btn-left">
              <i class="fa-brands fa-whatsapp" style="color: #25D366;"></i>
              <span>WhatsApp Direct Chat</span>
            </div>
            <span style="font-family: 'JetBrains Mono'; color: var(--accent-cyan); font-size: 12px;">+94 71 984 5166</span>
          </a>

          <a class="dev-contact-btn" href="tel:+94719845166">
            <div class="dev-btn-left">
              <i class="fa-solid fa-phone"></i>
              <span>Call Developer</span>
            </div>
            <i class="fa-solid fa-arrow-right" style="color: var(--text-dim); font-size: 11px;"></i>
          </a>

          <a class="dev-contact-btn" href="https://heshan.devofc.top" target="_blank">
            <div class="dev-btn-left">
              <i class="fa-solid fa-globe" style="color: var(--accent-cyan);"></i>
              <span>Official Developer Portfolio</span>
            </div>
            <span style="font-family: 'JetBrains Mono'; color: var(--text-muted); font-size: 11px;">heshan.devofc.top</span>
          </a>

          <a class="dev-contact-btn" href="mailto:heshan@devofc.top">
            <div class="dev-btn-left">
              <i class="fa-regular fa-envelope"></i>
              <span>Official Email</span>
            </div>
            <span style="font-family: 'JetBrains Mono'; color: var(--text-muted); font-size: 11px;">heshan@devofc.top</span>
          </a>
        </div>
      </div>
    </section>

  </div>

  <script>
    // Typewriter effect
    const typewriterPhrases = [
      "Connecting to Dinidu Heshan...",
      "Full-Stack Developer // DARK-DINU",
      "Ready to build next-gen bots?",
      "Official Support // +94 71 984 5166"
    ];
    let phraseIdx = 0;
    let charIdx = 0;
    let isDeleting = false;

    function runTypewriter() {
      const el = document.getElementById('typewriterText');
      if (!el) return;
      const currentPhrase = typewriterPhrases[phraseIdx];

      if (isDeleting) {
        el.innerText = currentPhrase.substring(0, charIdx - 1);
        charIdx--;
      } else {
        el.innerText = currentPhrase.substring(0, charIdx + 1);
        charIdx++;
      }

      let speed = isDeleting ? 40 : 80;

      if (!isDeleting && charIdx === currentPhrase.length) {
        speed = 1800;
        isDeleting = true;
      } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        phraseIdx = (phraseIdx + 1) % typewriterPhrases.length;
        speed = 400;
      }

      setTimeout(runTypewriter, speed);
    }
    runTypewriter();

    function toggleMenu() {
      document.getElementById('drawer').classList.toggle('active');
      document.getElementById('overlay').classList.toggle('active');
    }

    function scrollToDeveloper() {
      if (document.getElementById('drawer').classList.contains('active')) {
        toggleMenu();
      }
      setTimeout(() => {
        document.getElementById('developerSection').scrollIntoView({ behavior: 'smooth' });
      }, 200);
    }

    /* Live Diagnostics Sync */
    function updateSyncTimestamp() {
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      const el = document.getElementById('lastSyncTime');
      if (el) el.innerText = timeStr;
    }

    function switchFilter(btn, mode) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      refreshDiagnostics();
    }

    async function refreshDiagnostics() {
      updateSyncTimestamp();
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        const count = data.activeCount || 0;
        document.getElementById('diagCurrent').innerHTML = count + ' <small>BOTS</small>';
        document.getElementById('diagPeak').innerHTML = count + ' <small>BOTS</small>';
        document.getElementById('diagAvg').innerHTML = count + ' <small>BOTS</small>';
      } catch (_) {}
    }
    setInterval(refreshDiagnostics, 30000);
    refreshDiagnostics();

    /* Daily Limit Management */
    const MAX_DAILY_LIMIT = 10;

    function getTodayKey() {
      const d = new Date();
      return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }

    function getRemainingLimit() {
      const savedDate = localStorage.getItem('react_limit_date');
      const today = getTodayKey();

      if (savedDate !== today) {
        localStorage.setItem('react_limit_date', today);
        localStorage.setItem('react_limit_count', MAX_DAILY_LIMIT.toString());
        return MAX_DAILY_LIMIT;
      }

      const count = parseInt(localStorage.getItem('react_limit_count') || '10', 10);
      return isNaN(count) ? MAX_DAILY_LIMIT : count;
    }

    function updateLimitUI() {
      const rem = getRemainingLimit();
      const badge = document.getElementById('dailyLimitText');
      if (badge) {
        badge.innerText = (rem < 10 ? '0' + rem : rem) + '/10';
        badge.style.color = rem === 0 ? 'var(--accent-pink)' : 'var(--accent-cyan)';
      }
      const confirmBtn = document.getElementById('confirmReactBtn');
      const step1Btn = document.getElementById('step1NextBtn');
      if (rem <= 0) {
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.innerHTML = '<i class="fa-solid fa-ban"></i> DAILY LIMIT EXCEEDED (00/10)';
        }
        if (step1Btn) {
          step1Btn.disabled = true;
          step1Btn.innerHTML = '<span>DAILY LIMIT REACHED (00/10)</span>';
        }
      } else {
        if (confirmBtn) confirmBtn.disabled = false;
        if (step1Btn) step1Btn.disabled = false;
      }
    }

    function decrementLimit() {
      let rem = getRemainingLimit();
      if (rem > 0) {
        rem--;
        localStorage.setItem('react_limit_count', rem.toString());
      }
      updateLimitUI();
    }

    /* Channel React Multi-Step Modal Handling */
    let selectedEmojis = [];

    function openReactModal() {
      if (document.getElementById('drawer').classList.contains('active')) {
        toggleMenu();
      }
      updateLimitUI();
      document.getElementById('reactModal').classList.add('active');
      backToStep1();
    }

    function closeReactModal() {
      document.getElementById('reactModal').classList.remove('active');
    }

    function proceedToEmojiStep() {
      if (getRemainingLimit() <= 0) {
        return alert('Your daily limit of 10/10 reactions has been reached!');
      }

      const link = document.getElementById('targetPostLink').value.trim();
      if (!link || !link.includes('whatsapp.com/channel/')) {
        return alert('Please enter a valid WhatsApp Channel Post Link!');
      }
      document.getElementById('step1Box').style.display = 'none';
      document.getElementById('step2Box').style.display = 'block';
    }

    function backToStep1() {
      document.getElementById('step2Box').style.display = 'none';
      document.getElementById('step1Box').style.display = 'block';
    }

    function toggleEmoji(el, emoji) {
      const idx = selectedEmojis.indexOf(emoji);
      if (idx > -1) {
        selectedEmojis.splice(idx, 1);
        el.classList.remove('selected');
      } else {
        if (selectedEmojis.length >= 5) {
          return alert('You can select a maximum of 5 emojis!');
        }
        selectedEmojis.push(emoji);
        el.classList.add('selected');
      }
      document.getElementById('emojiCountBadge').innerText = selectedEmojis.length + ' / 5 Selected';
    }

    async function confirmAndSendReactions() {
      if (getRemainingLimit() <= 0) {
        return alert('Daily reaction limit reached! Please try again tomorrow.');
      }

      const link = document.getElementById('targetPostLink').value.trim();
      if (selectedEmojis.length === 0) {
        return alert('Please select at least one emoji!');
      }

      const btn = document.getElementById('confirmReactBtn');
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> FIRING REACTIONS...';
      btn.disabled = true;

      try {
        const res = await fetch('/api/channel-react', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postLink: link,
            emojis: selectedEmojis,
            repeatCount: 1
          })
        });

        const d = await res.json();
        if (d.status || res.ok) {
          decrementLimit();
          const currentLeft = getRemainingLimit();
          alert('Reactions successfully deployed to channel post!\\nRemaining runs: ' + (currentLeft < 10 ? '0' + currentLeft : currentLeft) + '/10');
          
          closeReactModal();
          
          selectedEmojis = [];
          document.querySelectorAll('.emoji-item.selected').forEach(e => e.classList.remove('selected'));
          document.getElementById('emojiCountBadge').innerText = '0 / 5 Selected';
          document.getElementById('targetPostLink').value = '';
        } else {
          alert('Failed to deploy reactions: ' + (d.error || 'Unknown error occurred.'));
        }
      } catch (err) {
        alert('Server communication error. Please try again.');
      } finally {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> CONFIRM & REACT';
        updateLimitUI();
      }
    }

    /* Pairing Code Request */
    async function requestPairCode() {
      const p = document.getElementById('userPhone').value.trim().replace(/[^0-9]/g, '');
      const btn = document.getElementById('genBtn');
      const box = document.getElementById('codeDisplayBox');
      const codeEl = document.getElementById('codeVal');

      if (!p || p.length < 10) {
        return alert('Please enter a valid WhatsApp phone number with country code!');
      }
      
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> GENERATING...';
      btn.disabled = true;

      try {
        const res = await fetch('/pair?phone=' + p);
        const data = await res.json();
        if (data.code) {
          codeEl.innerText = data.code;
          box.style.display = 'block';
          btn.innerHTML = '<i class="fa-solid fa-check"></i> CODE READY!';
          if (navigator.clipboard) {
            navigator.clipboard.writeText(data.code.replace(/-/g, ''));
          }
        } else {
          alert(data.error || 'Pairing error occurred.');
          btn.innerHTML = '<i class="fa-solid fa-key"></i> GET PAIRING CODE';
          btn.disabled = false;
        }
      } catch {
        alert('Server unreachable. Please verify your connection.');
        btn.innerHTML = '<i class="fa-solid fa-key"></i> GET PAIRING CODE';
        btn.disabled = false;
      }
    }

    function copyCode() {
      const c = document.getElementById('codeVal').innerText.replace(/-/g, '');
      navigator.clipboard.writeText(c);
      const copyBtn = document.getElementById('copyCodeBtn');
      copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> COPIED!';
      setTimeout(() => {
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy Pairing Code';
      }, 2000);
    }

    updateLimitUI();
  </script>
</body>
</html>`;
}
