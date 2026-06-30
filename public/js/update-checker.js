// ============================================================
//  UPDATE CHECKER — detecta nuevas versiones y avisa al usuario
// ============================================================

const CHECK_INTERVAL = 60000; // chequea cada 1 minuto
let currentVersion = null;
let checkTimer = null;

async function fetchVersion() {
  try {
    const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    return data.version;
  } catch (err) {
    return null;
  }
}

function showUpdateBanner() {
  if (document.getElementById('updateBanner')) return; // ya está mostrado

  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.style.cssText = `
    position: fixed;
    bottom: 90px;
    left: 16px;
    right: 16px;
    max-width: 420px;
    margin: 0 auto;
    background: var(--primary);
    color: var(--on-primary);
    padding: 14px 18px;
    border-radius: var(--radius-lg);
    box-shadow: 0 12px 30px rgba(98,89,129,0.35);
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 999;
    font-family: var(--font-body, sans-serif);
    font-size: 14px;
    animation: slideUp 0.3s ease;
  `;
  banner.innerHTML = `
    <span style="font-size:22px;">✨</span>
    <span style="flex:1;">Hay una actualización nueva de Mochi Planner</span>
    <button id="updateRefreshBtn" style="background:white;color:var(--primary);border:none;padding:8px 14px;border-radius:999px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap;">
      Actualizar
    </button>
  `;
  document.body.appendChild(banner);

  const style = document.createElement('style');
  style.textContent = `@keyframes slideUp { from { transform: translateY(20px); opacity:0; } to { transform: translateY(0); opacity:1; } }`;
  document.head.appendChild(style);

  document.getElementById('updateRefreshBtn').addEventListener('click', () => {
    // Fuerza recarga ignorando caché
    window.location.reload(true);
  });
}

export async function startUpdateChecker() {
  currentVersion = await fetchVersion();
  checkTimer = setInterval(async () => {
    const latest = await fetchVersion();
    if (latest && currentVersion && latest !== currentVersion) {
      showUpdateBanner();
      clearInterval(checkTimer);
    }
  }, CHECK_INTERVAL);

  // También chequear cuando la app vuelve a foreground (importante en mobile)
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      const latest = await fetchVersion();
      if (latest && currentVersion && latest !== currentVersion) {
        showUpdateBanner();
        clearInterval(checkTimer);
      }
    }
  });
}