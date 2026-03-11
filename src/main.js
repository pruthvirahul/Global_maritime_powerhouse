import './style.css'

// ─── STATE ───────────────────────────────────────────────────────
let allShips = []
let allMissiles = []
let currentView = 'rankings'
let currentClassFilter = 'all'
let currentNationFilter = 'all'
let currentMissileType = 'all'
let currentMissileNation = 'all'
let searchQuery = ''
let missileSearchQuery = ''
let ballisticMissilesIntegrated = {}
let selectedUpgradeMissile = null
let upgradeSearchQuery = ''
let currentThreatSort = 'default'

const NATIONS = ['USA', 'China', 'Russia', 'UK', 'India', 'South Korea', 'France', 'Japan', 'Australia']

const COUNTRY_CODES = {
  'USA': 'US', 'China': 'CN', 'Russia': 'RU', 'UK': 'GB',
  'India': 'IN', 'South Korea': 'KR', 'France': 'FR',
  'Japan': 'JP', 'Australia': 'AU',
}

const COUNTRY_COLORS = {
  'USA': '#3b82f6', 'China': '#ef4444', 'Russia': '#f59e0b',
  'UK': '#8b5cf6', 'India': '#f97316', 'South Korea': '#06b6d4',
  'France': '#6366f1', 'Japan': '#ec4899', 'Australia': '#10b981',
}

// ─── BOOT ────────────────────────────────────────────────────────
const app = document.querySelector('#app')

function boot() {
  app.innerHTML = `
    <header>
      <div class="logo-row">
        <div class="logo-icon">⚓</div>
        <div>
          <h1>Maritime Powerhouse</h1>
          <p class="subtitle">Real-time Advanced Naval Assets Analytics</p>
        </div>
        <div class="credit-badge">Made by <span class="credit-name">Pruthvi Rahul</span> <span class="credit-heart">❤️</span></div>
      </div>
      <nav class="main-nav" id="main-nav"></nav>
    </header>
    <main id="view-container">
      <div class="boot-loader">
        <div class="loader-ring"></div>
        <p>INITIALIZING STRATEGIC COMMAND...</p>
      </div>
    </main>
  `
  renderNav()
  fetchAll()
}

function renderNav() {
  const nav = document.querySelector('#main-nav')
  const tabs = [
    { id: 'rankings', icon: '📊', label: 'Power Rankings' },
    { id: 'fleet', icon: '🚢', label: 'Global Fleet' },
    { id: 'missiles', icon: '🚀', label: 'Missile Arsenal' },
    { id: 'upgrade', icon: '🔬', label: 'Upgrade Lab' },
  ]
  nav.innerHTML = tabs.map(t => `
    <button class="nav-tab ${currentView === t.id ? 'active' : ''}" data-view="${t.id}">
      <span class="nav-tab-icon">${t.icon}</span>
      <span class="nav-tab-label">${t.label}</span>
    </button>
  `).join('')

  nav.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view
      renderNav()
      renderView()
    })
  })
}

async function fetchAll() {
  try {
    const [shipRes, missileRes] = await Promise.all([
      fetch('http://localhost:3001/api/ships'),
      fetch('http://localhost:3001/api/missiles'),
    ])
    if (!shipRes.ok || !missileRes.ok) throw new Error('Backend error')
    allShips = await shipRes.json()
    allMissiles = await missileRes.json()
    // Don't re-render Upgrade Lab on auto-refresh to avoid disrupting user interaction
    if (currentView !== 'upgrade') renderView()
  } catch (e) {
    document.querySelector('#view-container').innerHTML = `
      <div class="error-container">
        <div class="error-icon">📡</div>
        <h2 class="error-msg">TACTICAL LINK OFFLINE</h2>
        <p class="error-sub">Backend server unreachable. Run <code>npm run start</code></p>
        <button class="retry-btn" onclick="location.reload()">RECONNECT</button>
      </div>
    `
  }
}

function renderView() {
  const c = document.querySelector('#view-container')
  if (currentView === 'rankings') renderRankings(c)
  else if (currentView === 'fleet') renderFleet(c)
  else if (currentView === 'missiles') renderMissiles(c)
  else if (currentView === 'upgrade') renderUpgradeLab(c)
}

// ─── UTILS ───────────────────────────────────────────────────────
function badge(nation, size = 'lg') {
  const code = COUNTRY_CODES[nation] || '??'
  const color = COUNTRY_COLORS[nation] || '#64748b'
  return `<span class="badge badge-${size}" style="--bc:${color}">${code}</span>`
}

function nationPills(selected, filterKey, containerId) {
  const nations = [...new Set([...NATIONS])]
  return `
    <div class="nation-pills" id="${containerId}">
      <button class="pill ${selected === 'all' ? 'active' : ''}" data-nation="all">All Nations</button>
      ${nations.map(n => {
    const color = COUNTRY_COLORS[n] || '#64748b'
    return `<button class="pill ${selected === n ? 'active' : ''}" data-nation="${n}" style="--pill-color:${color}">
          ${badge(n, 'xs')} ${n}
        </button>`
  }).join('')}
    </div>
  `
}

function miniStat(label, value, color) {
  return `<div class="mstat"><span class="mstat-l">${label}</span><span class="mstat-v" ${color ? `style="color:${color}"` : ''}>${value}</span></div>`
}

function statBar(label, value, color, boosted) {
  return `
    <div class="sbar">
      <div class="sbar-head">
        <span>${label}${boosted ? ' <span class="bmi-tag">BMI+</span>' : ''}</span>
        <span class="${boosted ? 'boosted-val' : ''}">${value}%</span>
      </div>
      <div class="sbar-track"><div class="sbar-fill" data-w="${value}" ${color ? `style="background:${color}"` : ''}></div></div>
    </div>
  `
}

function animateBars(selector = '.sbar-fill') {
  requestAnimationFrame(() => {
    document.querySelectorAll(selector).forEach(b => { b.style.width = b.dataset.w + '%' })
  })
}

// ─── RANKINGS VIEW ───────────────────────────────────────────────
function computeCountryData() {
  const countries = {}
  allShips.forEach(ship => {
    if (!countries[ship.nation]) {
      countries[ship.nation] = { nation: ship.nation, ships: [], tF: 0, tSt: 0, tE: 0, tV: 0, hist: 0 }
    }
    const c = countries[ship.nation]
    c.ships.push(ship)
    const bmi = ballisticMissilesIntegrated[ship.nation]
    c.tF += bmi ? Math.min(100, ship.stats.firepower + 5) : ship.stats.firepower
    c.tSt += ship.stats.stealth
    c.tE += ship.stats.endurance
    c.tV += bmi ? Math.min(100, ship.stats.versatility + 3) : ship.stats.versatility
    c.hist += (ship.stats.firepower + ship.stats.stealth + ship.stats.endurance + ship.stats.versatility) / 4 - (ship.nation.length % 5)
  })

  // Also count missiles per nation
  const missileCounts = {}
  allMissiles.forEach(m => { missileCounts[m.nation] = (missileCounts[m.nation] || 0) + 1 })

  return Object.values(countries).map(c => {
    const n = c.ships.length
    const avg = v => Math.round(v / n)
    const pwr = Math.round((c.tF + c.tSt + c.tE + c.tV) / (n * 4))
    const hist = Math.round(c.hist / n)
    const yoy = hist > 0 ? (((pwr - hist) / hist) * 100).toFixed(1) : '0.0'
    return {
      nation: c.nation, ships: c.ships,
      avgF: avg(c.tF), avgS: avg(c.tSt), avgE: avg(c.tE), avgV: avg(c.tV),
      pwr, yoy, fleetSize: n,
      missileCount: missileCounts[c.nation] || 0,
    }
  }).sort((a, b) => b.pwr - a.pwr)
}

function renderRankings(container) {
  const data = computeCountryData()
  const maxPwr = data[0]?.pwr || 100

  container.innerHTML = `
    <section class="view-section">
      <div class="view-header">
        <h2>⚓ Strategic Maritime Power Index</h2>
        <p>Aggregate fleet strength with Ballistic Missile Integration (BMI) capability</p>
      </div>
      <div class="ranking-grid">
        ${data.map((c, i) => {
    const color = COUNTRY_COLORS[c.nation] || '#64748b'
    const bmi = ballisticMissilesIntegrated[c.nation]
    const barW = Math.max(15, (c.pwr / maxPwr) * 100)
    return `
          <div class="rank-card" style="--cc:${color}; animation-delay:${i * 80}ms">
            <div class="rank-num">#${i + 1}</div>
            <div class="rank-head">
              ${badge(c.nation)}
              <div class="rank-info">
                <h3>${c.nation}</h3>
                <div class="yoy ${parseFloat(c.yoy) >= 0 ? 'up' : 'dn'}">
                  ${parseFloat(c.yoy) >= 0 ? '▲' : '▼'} ${Math.abs(c.yoy)}% YoY
                </div>
              </div>
              <div class="pwr-block">
                <span class="pwr-val">${c.pwr}</span>
                <span class="pwr-unit">PWR</span>
              </div>
            </div>
            <div class="rank-bar-track"><div class="rank-bar-fill" data-w="${barW}" style="background:linear-gradient(90deg,${color},${color}44)"></div></div>
            <div class="mstat-row">
              ${miniStat('FPR', c.avgF)} ${miniStat('STL', c.avgS)}
              ${miniStat('END', c.avgE)} ${miniStat('VRS', c.avgV)}
            </div>
            ${bmi ? `
              <div class="synergy-info">
                <span class="syn-label">Active Synergies:</span>
                <div class="syn-list">
                  ${[...new Set(allMissiles.filter(m => m.nation === c.nation).map(m => m.type))].map(t => `<span class="syn-tag">${t.replace(' Missile', '')}</span>`).join('')}
                </div>
              </div>
            ` : ''}
            <div class="rank-footer">
              <div class="rank-meta">
                <span>🚢 ${c.fleetSize} Vessels</span>
                <span>🚀 ${c.missileCount} Systems</span>
              </div>
              <button class="bmi-btn ${bmi ? 'on' : ''}" data-nation="${c.nation}">
                ${bmi ? '✅ BMI ACTIVE' : '🚀 INTEGRATE BMI'}
              </button>
            </div>
          </div>`
  }).join('')}
      </div>
    </section>
  `

  animateBars('.rank-bar-fill')

  container.querySelectorAll('.bmi-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ballisticMissilesIntegrated[btn.dataset.nation] = !ballisticMissilesIntegrated[btn.dataset.nation]
      renderView()
    })
  })
}

// ─── FLEET VIEW ──────────────────────────────────────────────────
function renderFleet(container) {
  const classes = ['all', 'Carrier', 'Destroyer', 'Submarine', 'Frigate']
  container.innerHTML = `
    <section class="view-section">
      <div class="view-header">
        <h2>🚢 Global Naval Assets Database</h2>
        <p>Complete fleet intelligence with advanced multi-parameter filtering</p>
      </div>
      <div class="filter-panel">
        <input type="text" class="search-input" id="fleet-search" placeholder="Search vessels..." value="${searchQuery}" />
        ${nationPills(currentNationFilter, 'nation', 'fleet-nations')}
        <div class="class-pills">
          ${classes.map(c => `<button class="cpill ${currentClassFilter === c ? 'active' : ''}" data-cls="${c}">${c === 'all' ? 'All Classes' : c + 's'}</button>`).join('')}
        </div>
      </div>
      <div class="ship-grid" id="ship-grid"></div>
    </section>
  `

  document.querySelector('#fleet-search').addEventListener('input', e => { searchQuery = e.target.value; updateFleet() })
  document.querySelectorAll('#fleet-nations .pill').forEach(b => {
    b.addEventListener('click', () => { currentNationFilter = b.dataset.nation; renderFleet(container) })
  })
  document.querySelectorAll('.cpill').forEach(b => {
    b.addEventListener('click', () => { currentClassFilter = b.dataset.cls; renderFleet(container) })
  })

  updateFleet()
}

function updateFleet() {
  const grid = document.querySelector('#ship-grid')
  const f = allShips.filter(s => {
    const ms = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.class.toLowerCase().includes(searchQuery.toLowerCase())
    const mc = currentClassFilter === 'all' || s.class.includes(currentClassFilter)
    const mn = currentNationFilter === 'all' || s.nation === currentNationFilter
    return ms && mc && mn
  })

  if (!f.length) { grid.innerHTML = '<div class="empty-state">No vessels match your tactical parameters.</div>'; return }

  grid.innerHTML = f.map(ship => {
    const bmi = ballisticMissilesIntegrated[ship.nation]
    const fp = bmi ? Math.min(100, ship.stats.firepower + 5) : ship.stats.firepower
    const vr = bmi ? Math.min(100, ship.stats.versatility + 3) : ship.stats.versatility
    const color = COUNTRY_COLORS[ship.nation] || '#64748b'

    // FIND COMPATIBLE MISSILES
    const shipMissiles = allMissiles.filter(m => {
      const isSub = ship.class.toLowerCase().includes('submarine')
      const mPlatforms = m.launch_platform.map(p => p.toLowerCase())
      const isCompatible = (isSub && mPlatforms.includes('submarine')) || (!isSub && mPlatforms.includes('ship'))
      return m.nation === ship.nation && isCompatible
    })

    return `
      <div class="ship-card" style="--sc:${color}">
        <div class="card-accent"></div>
        <div class="ship-top">
          <div>
            <h3 class="ship-name">${ship.name}</h3>
            <p class="ship-class">${ship.class} • ${ship.displacement}</p>
          </div>
          <span class="nation-chip">${badge(ship.nation, 'sm')} ${ship.nation}</span>
        </div>
        
        <div class="ship-stats">
          ${statBar('Firepower', fp, bmi && fp > ship.stats.firepower ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : null, bmi && fp > ship.stats.firepower)}
          ${statBar('Stealth', ship.stats.stealth)}
          ${statBar('Endurance', ship.stats.endurance)}
          ${statBar('Versatility', vr, bmi && vr > ship.stats.versatility ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : null, bmi && vr > ship.stats.versatility)}
        </div>

        <div class="ship-arsenal">
          <h4 class="arsenal-title">Tactical Arsenal ${bmi ? '<span class="int-status">INTEGRATED</span>' : ''}</h4>
          <div class="arsenal-chips">
            ${shipMissiles.length ? shipMissiles.map(m => `
              <button class="m-chip" data-mid="${m.id}">
                <span class="m-chip-icon">🚀</span>
                <span class="m-chip-name">${m.name}</span>
              </button>
            `).join('') : '<span class="no-systems">No compatible systems found.</span>'}
          </div>
        </div>

        <div class="ship-features">
          <div class="feat-col">
            <h4>Strengths</h4>
            <ul>${ship.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
          </div>
          <div class="feat-col feat-draw">
            <h4>Drawbacks</h4>
            <ul>${ship.drawbacks.map(s => `<li>${s}</li>`).join('')}</ul>
          </div>
        </div>
        <div class="ship-rt">
          <span><span class="rt-dot ${ship.realtime.systemStatus.includes('Warning') ? 'warn' : ''}"></span> ${ship.realtime.systemStatus}</span>
          <span>⚡ ${ship.realtime.energyOutput}</span>
        </div>
      </div>
    `
  }).join('')

  // Add click listeners to missile chips
  grid.querySelectorAll('.m-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      currentView = 'missiles'
      missileSearchQuery = chip.querySelector('.m-chip-name').innerText
      renderNav()
      renderView()

      // Flash the card
      setTimeout(() => {
        const target = document.querySelector('.missile-card')
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' })
          target.classList.add('highlight-flash')
        }
      }, 100)
    })
  })

  animateBars()
}

// ─── MISSILES VIEW ───────────────────────────────────────────────
function renderMissiles(container) {
  const types = ['all', 'Cruise Missile', 'Ballistic Missile', 'Hypersonic Missile', 'Surface-to-Air / Anti-Ship']
  container.innerHTML = `
    <section class="view-section">
      <div class="view-header">
        <h2>🚀 Global Missile Arsenal</h2>
        <p>Comprehensive intelligence on naval missile systems across all major powers</p>
      </div>
      <div class="filter-panel">
        <input type="text" class="search-input" id="missile-search" placeholder="Search missiles..." value="${missileSearchQuery}" />
        ${nationPills(currentMissileNation, 'nation', 'missile-nations')}
        <div class="class-pills">
          ${types.map(t => `<button class="cpill ${currentMissileType === t ? 'active' : ''}" data-cls="${t}">${t === 'all' ? 'All Types' : t.replace(' Missile', '').replace('Surface-to-Air / Anti-Ship', 'Multi-Role')}</button>`).join('')}
        </div>
        <div class="threat-sort-row">
          <span class="threat-sort-label">⚠ Threat Level:</span>
          <div class="threat-sort-pills" id="threat-sort-pills">
            <button class="tpill ${currentThreatSort === 'default' ? 'active' : ''}" data-sort="default">Default</button>
            <button class="tpill ${currentThreatSort === 'high' ? 'active' : ''}" data-sort="high">Highest First</button>
            <button class="tpill ${currentThreatSort === 'low' ? 'active' : ''}" data-sort="low">Lowest First</button>
          </div>
        </div>
      </div>
      <div class="missile-grid" id="missile-grid"></div>
    </section>
  `

  document.querySelector('#missile-search').addEventListener('input', e => { missileSearchQuery = e.target.value; updateMissiles() })
  document.querySelectorAll('#missile-nations .pill').forEach(b => {
    b.addEventListener('click', () => { currentMissileNation = b.dataset.nation; renderMissiles(container) })
  })
  document.querySelectorAll('.cpill').forEach(b => {
    b.addEventListener('click', () => { currentMissileType = b.dataset.cls; renderMissiles(container) })
  })
  document.querySelectorAll('#threat-sort-pills .tpill').forEach(b => {
    b.addEventListener('click', () => { currentThreatSort = b.dataset.sort; renderMissiles(container) })
  })

  updateMissiles()
}

function updateMissiles() {
  const grid = document.querySelector('#missile-grid')
  let f = allMissiles.filter(m => {
    const ms = m.name.toLowerCase().includes(missileSearchQuery.toLowerCase()) || m.category.toLowerCase().includes(missileSearchQuery.toLowerCase())
    const mt = currentMissileType === 'all' || m.type === currentMissileType
    const mn = currentMissileNation === 'all' || m.nation === currentMissileNation
    return ms && mt && mn
  })

  if (currentThreatSort === 'high') f.sort((a, b) => b.threat_level - a.threat_level)
  else if (currentThreatSort === 'low') f.sort((a, b) => a.threat_level - b.threat_level)

  if (!f.length) { grid.innerHTML = '<div class="empty-state">No missile systems match your search criteria.</div>'; return }

  grid.innerHTML = f.map(m => {
    const color = COUNTRY_COLORS[m.nation] || '#64748b'
    const threatColor = m.threat_level >= 90 ? '#ef4444' : m.threat_level >= 75 ? '#f59e0b' : '#10b981'

    // FIND COMPATIBLE SHIPS
    const deployedOn = allShips.filter(s => {
      if (s.nation !== m.nation) return false
      const isSub = s.class.toLowerCase().includes('submarine')
      const mPlatforms = m.launch_platform.map(p => p.toLowerCase())
      return (isSub && mPlatforms.includes('submarine')) || (!isSub && mPlatforms.includes('ship'))
    })

    return `
      <div class="missile-card" style="--mc:${color}" data-mid="${m.id}">
        <div class="missile-accent" style="background:linear-gradient(90deg,${color},transparent)"></div>
        <div class="missile-top">
          <div>
            <h3 class="missile-name">${m.name}</h3>
            <div class="missile-meta">
              <span class="mtype-tag">${m.type}</span>
              <span class="mcat-tag">${m.category}</span>
            </div>
          </div>
          <div class="threat-ring" style="--tc:${threatColor}">
            <span class="threat-val">${m.threat_level}</span>
            <span class="threat-label">THREAT</span>
          </div>
        </div>

        <p class="missile-desc">${m.description}</p>

        <div class="deployment-info">
          <h4 class="dep-title">Active Deployment Platforms</h4>
          <div class="dep-list">
            ${deployedOn.length
        ? deployedOn.map(s => `<span class="dep-item">🚢 ${s.name}</span>`).join('')
        : '<span class="dep-none">No active naval platforms found for this system.</span>'}
          </div>
        </div>

        <div class="missile-specs">
          <div class="spec"><span class="spec-label">Range</span><span class="spec-val">${m.range_km.toLocaleString()} km</span></div>
          <div class="spec"><span class="spec-label">Speed</span><span class="spec-val">${m.speed}</span></div>
          <div class="spec"><span class="spec-label">Warhead</span><span class="spec-val">${m.warhead_kg} kg</span></div>
          <div class="spec"><span class="spec-label">Generation</span><span class="spec-val">${m.generation}</span></div>
        </div>

        <div class="missile-stats">
          ${statBar('Range', m.stats.range, `linear-gradient(90deg,${color},${color}66)`)}
          ${statBar('Speed', m.stats.speed, m.stats.speed >= 85 ? 'linear-gradient(90deg,#ef4444,#f97316)' : null)}
          ${statBar('Accuracy', m.stats.accuracy)}
          ${statBar('Lethality', m.stats.lethality, m.stats.lethality >= 90 ? 'linear-gradient(90deg,#ef4444,#dc2626)' : null)}
          ${statBar('Evasion', m.stats.evasion, m.stats.evasion >= 85 ? 'linear-gradient(90deg,#8b5cf6,#6366f1)' : null)}
        </div>

        <div class="missile-footer">
          <span class="nation-chip">${badge(m.nation, 'sm')} ${m.nation}</span>
          <div class="platform-tags">
            ${m.launch_platform.map(p => `<span class="plat-tag">${p}</span>`).join('')}
          </div>
        </div>
      </div>
    `
  }).join('')

  animateBars()
}

// ─── UPGRADE LAB VIEW ────────────────────────────────────────────
const UPGRADE_RECS = {
  range: [
    { threshold: 10, text: 'Minor fuel tank optimization and nozzle tuning' },
    { threshold: 30, text: 'Extended fuel capacity with composite tanks and improved aerodynamics' },
    { threshold: 101, text: 'Full propulsion overhaul: scramjet/ramjet integration with extended-range booster stage' },
  ],
  speed: [
    { threshold: 10, text: 'Aerodynamic refinement and drag reduction coatings' },
    { threshold: 30, text: 'Advanced turbojet upgrade with afterburner optimization' },
    { threshold: 101, text: 'Next-gen hypersonic engine: dual-mode ramjet/scramjet with thermal protection system' },
  ],
  accuracy: [
    { threshold: 10, text: 'Software update to guidance algorithms and sensor calibration' },
    { threshold: 30, text: 'Multi-spectral seeker upgrade with enhanced INS/GPS fusion' },
    { threshold: 101, text: 'Full AI-guided terminal seeker with real-time target recognition and multi-spectral imaging' },
  ],
  lethality: [
    { threshold: 10, text: 'Warhead fragmentation pattern optimization' },
    { threshold: 30, text: 'Enhanced shaped-charge warhead with penetrator upgrade' },
    { threshold: 101, text: 'Next-gen thermobaric/penetrator hybrid warhead with programmable detonation' },
  ],
  evasion: [
    { threshold: 10, text: 'ECM software update and chaff/flare timing refinement' },
    { threshold: 30, text: 'Low-RCS body panels and active radar-absorbing material coating' },
    { threshold: 101, text: 'Full stealth airframe redesign with AI-driven electronic countermeasure suite and plasma shielding R&D' },
  ],
}

function getUpgradeRec(stat, gap) {
  if (gap === 0) return 'MAXIMUM CAPABILITY — No upgrade required'
  const recs = UPGRADE_RECS[stat]
  for (const r of recs) {
    if (gap <= r.threshold) return r.text
  }
  return recs[recs.length - 1].text
}

function getPriority(gap) {
  if (gap === 0) return { label: 'MAX', color: '#10b981' }
  if (gap < 10) return { label: 'Optimal', color: '#10b981' }
  if (gap <= 30) return { label: 'Moderate', color: '#f59e0b' }
  return { label: 'Critical', color: '#ef4444' }
}

function renderUpgradeLab(container) {
  if (selectedUpgradeMissile) {
    const m = allMissiles.find(x => x.id === selectedUpgradeMissile)
    if (m) { renderUpgradeDetail(container, m); return }
  }

  const missiles = allMissiles.map(m => {
    const s = m.stats
    const avg = Math.round((s.range + s.speed + s.accuracy + s.lethality + s.evasion) / 5)
    return { ...m, readiness: avg, deficit: 100 - avg }
  }).sort((a, b) => a.readiness - b.readiness).filter(m => {
    if (!upgradeSearchQuery) return true
    const q = upgradeSearchQuery.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.nation.toLowerCase().includes(q) || m.type.toLowerCase().includes(q)
  })

  container.innerHTML = `
    <section class="view-section">
      <div class="view-header">
        <h2>🔬 Missile Upgrade Lab</h2>
        <p>Strategic pathway analysis: what each system needs to achieve 100% capability</p>
      </div>
      <div class="filter-panel">
        <input type="text" class="search-input" id="upgrade-search" placeholder="Search missile systems by name, nation, or type..." value="${upgradeSearchQuery}" />
      </div>
      <div class="upgrade-grid">
        ${missiles.map((m, i) => {
    const color = COUNTRY_COLORS[m.nation] || '#64748b'
    const ringColor = m.readiness >= 80 ? '#10b981' : m.readiness >= 60 ? '#f59e0b' : '#ef4444'
    const circumference = 2 * Math.PI * 28
    const offset = circumference - (m.readiness / 100) * circumference
    return `
            <div class="upgrade-card" style="--uc:${color}; animation-delay:${i * 60}ms">
              <div class="upgrade-card-top">
                <div class="upgrade-info">
                  ${badge(m.nation)}
                  <div>
                    <h3 class="upgrade-name">${m.name}</h3>
                    <div class="upgrade-tags">
                      <span class="mtype-tag">${m.type}</span>
                      <span class="nation-chip">${m.nation}</span>
                    </div>
                  </div>
                </div>
                <div class="readiness-ring-wrap">
                  <svg class="readiness-ring" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="4"/>
                    <circle cx="32" cy="32" r="28" fill="none" stroke="${ringColor}" stroke-width="4"
                      stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
                      stroke-linecap="round" transform="rotate(-90 32 32)"
                      style="transition: stroke-dashoffset 1.5s ease"/>
                  </svg>
                  <div class="readiness-text">
                    <span class="readiness-val" style="color:${ringColor}">${m.readiness}</span>
                    <span class="readiness-unit">%</span>
                  </div>
                </div>
              </div>
              <div class="upgrade-deficit-row">
                <span class="deficit-label">Upgrade Deficit</span>
                <span class="deficit-val" style="color:${m.deficit > 20 ? '#ef4444' : '#f59e0b'}">${m.deficit} pts</span>
              </div>
              <div class="upgrade-mini-bars">
                ${['range', 'speed', 'accuracy', 'lethality', 'evasion'].map(k => `
                  <div class="umb">
                    <span class="umb-label">${k.slice(0, 3).toUpperCase()}</span>
                    <div class="umb-track">
                      <div class="umb-fill" style="width:${m.stats[k]}%;background:${m.stats[k] >= 85 ? '#10b981' : m.stats[k] >= 60 ? '#f59e0b' : '#ef4444'}"></div>
                    </div>
                    <span class="umb-val">${m.stats[k]}</span>
                  </div>
                `).join('')}
              </div>
              <button class="analyze-btn" data-mid="${m.id}">
                <span>ANALYZE UPGRADE PATH</span>
                <span class="analyze-arrow">→</span>
              </button>
            </div>
          `
  }).join('')}
      </div>
    </section>
  `

  document.querySelector('#upgrade-search').addEventListener('input', e => {
    upgradeSearchQuery = e.target.value
    renderUpgradeLab(container)
  })

  container.querySelectorAll('.analyze-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedUpgradeMissile = btn.dataset.mid
      renderView()
    })
  })
}

function renderUpgradeDetail(container, m) {
  const color = COUNTRY_COLORS[m.nation] || '#64748b'
  const stats = ['range', 'speed', 'accuracy', 'lethality', 'evasion']
  const statLabels = { range: 'Range', speed: 'Speed', accuracy: 'Accuracy', lethality: 'Lethality', evasion: 'Evasion' }
  const statIcons = { range: '📏', speed: '⚡', accuracy: '🎯', lethality: '💥', evasion: '👻' }
  const avg = Math.round(stats.reduce((a, k) => a + m.stats[k], 0) / stats.length)
  const totalCostUSD = stats.reduce((a, k) => a + (100 - m.stats[k]) * 50, 0)

  // Multi-currency exchange rates (simulated real-time)
  const EXCHANGE_RATES = {
    INR: { rate: 83.12, symbol: '₹', name: 'Indian Rupee' },
    RUB: { rate: 92.45, symbol: '₽', name: 'Russian Ruble' },
    CNY: { rate: 7.24, symbol: '¥', name: 'Chinese Yuan' },
  }
  const rateTimestamp = new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short', year: 'numeric' })

  function formatCurrency(usdMillions, rate) {
    const converted = usdMillions * rate
    if (converted >= 1000000) return (converted / 1000000).toFixed(1) + 'T'
    if (converted >= 1000) return (converted / 1000).toFixed(1) + 'B'
    return converted.toFixed(0) + 'M'
  }

  // Strategic Recommendations
  const weakest = stats.reduce((w, k) => m.stats[k] < m.stats[w] ? k : w, stats[0])
  const strongest = stats.reduce((s, k) => m.stats[k] > m.stats[s] ? k : s, stats[0])
  const criticalStats = stats.filter(k => (100 - m.stats[k]) > 30)
  const optimalStats = stats.filter(k => (100 - m.stats[k]) < 10)

  const recommendations = []
  if (criticalStats.length >= 3) {
    recommendations.push({ icon: '🚨', title: 'Full Platform Overhaul Required', text: `${criticalStats.length} of 5 parameters are critically below standard. Consider a next-generation replacement program rather than incremental upgrades.`, type: 'critical' })
  } else if (criticalStats.length > 0) {
    recommendations.push({ icon: '⚠️', title: `Priority: ${statLabels[weakest]} Enhancement`, text: `${statLabels[weakest]} at ${m.stats[weakest]}% is the weakest parameter. Focus initial R&D budget here for maximum combat effectiveness improvement.`, type: 'warning' })
  }
  if (optimalStats.length >= 4) {
    recommendations.push({ icon: '✅', title: 'Near-Peak Performance', text: `${optimalStats.length} parameters are near or at maximum. This system requires only minor maintenance upgrades to sustain its edge.`, type: 'success' })
  }
  if (m.stats.speed >= 85 && m.stats.evasion < 70) {
    recommendations.push({ icon: '💡', title: 'Evasion-Speed Mismatch', text: `High speed (${m.stats.speed}%) but low evasion (${m.stats.evasion}%) indicates the missile relies on kinetic performance alone. Investing in ECM/stealth upgrades would create a more survivable strike package.`, type: 'info' })
  }
  if (m.stats.lethality >= 85 && m.stats.accuracy < 75) {
    recommendations.push({ icon: '💡', title: 'Accuracy-Lethality Gap', text: `High warhead lethality (${m.stats.lethality}%) is undercut by accuracy at ${m.stats.accuracy}%. Terminal guidance upgrades would maximize kill probability per round.`, type: 'info' })
  }
  if (m.stats.range < 50) {
    recommendations.push({ icon: '🌍', title: 'Limited Stand-Off Capability', text: `Range at ${m.stats.range}% limits operational flexibility. Launching platforms must close to dangerous distances, increasing vulnerability to counter-fire.`, type: 'warning' })
  }
  recommendations.push({ icon: '📊', title: 'Cost Efficiency Rating', text: `Strongest capability is ${statLabels[strongest]} at ${m.stats[strongest]}%. Cost-per-point to reach 100%: $${Math.round(totalCostUSD / (500 - stats.reduce((a, k) => a + m.stats[k], 0)))}M per point across all stats.`, type: 'info' })

  container.innerHTML = `
    <section class="view-section">
      <button class="back-btn" id="back-to-lab">← Back to Upgrade Lab</button>
      <div class="detail-hero" style="--dc:${color}">
        <div class="detail-hero-left">
          ${badge(m.nation)}
          <div>
            <h2 class="detail-name">${m.name}</h2>
            <div class="detail-tags">
              <span class="mtype-tag">${m.type}</span>
              <span class="mcat-tag">${m.category}</span>
              <span class="nation-chip">${badge(m.nation, 'sm')} ${m.nation}</span>
            </div>
            <p class="detail-desc">${m.description}</p>
          </div>
        </div>
        <div class="detail-hero-right">
          <div class="detail-readiness">
            <span class="dr-val" style="color:${avg >= 80 ? '#10b981' : avg >= 60 ? '#f59e0b' : '#ef4444'}">${avg}%</span>
            <span class="dr-label">Overall Readiness</span>
          </div>
          <div class="detail-cost">
            <span class="dc-val">$${(totalCostUSD / 1000).toFixed(1)}B</span>
            <span class="dc-label">Est. Total R&D</span>
          </div>
        </div>
      </div>

      <div class="currency-panel">
        <h4 class="currency-title">💱 Multi-Currency R&D Cost Estimate</h4>
        <span class="rate-timestamp">Exchange rates as of ${rateTimestamp}</span>
        <div class="currency-grid">
          <div class="currency-card usd">
            <span class="curr-flag">🇺🇸</span>
            <div class="curr-info">
              <span class="curr-val">$${(totalCostUSD / 1000).toFixed(2)}B</span>
              <span class="curr-name">US Dollar (USD)</span>
              <span class="curr-rate">Base currency</span>
            </div>
          </div>
          ${Object.entries(EXCHANGE_RATES).map(([code, { rate, symbol, name }]) => `
            <div class="currency-card">
              <span class="curr-flag">${code === 'INR' ? '🇮🇳' : code === 'RUB' ? '🇷🇺' : '🇨🇳'}</span>
              <div class="curr-info">
                <span class="curr-val">${symbol}${formatCurrency(totalCostUSD, rate)}</span>
                <span class="curr-name">${name} (${code})</span>
                <span class="curr-rate">1 USD = ${symbol}${rate.toFixed(2)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="upgrade-analysis">
        <h3 class="analysis-heading">Upgrade Pathway Analysis</h3>
        <div class="analysis-grid">
          ${stats.map(k => {
    const val = m.stats[k]
    const gap = 100 - val
    const p = getPriority(gap)
    const rec = getUpgradeRec(k, gap)
    const costUSD = gap * 50
    return `
              <div class="analysis-card ${gap === 0 ? 'maxed' : ''}">
                <div class="ac-header">
                  <div class="ac-stat">
                    <span class="ac-icon">${statIcons[k]}</span>
                    <span class="ac-name">${statLabels[k]}</span>
                  </div>
                  <span class="priority-tag" style="--pc:${p.color}">${p.label}</span>
                </div>
                <div class="ac-bar-section">
                  <div class="ac-bar-labels">
                    <span>Current: <b>${val}%</b></span>
                    <span style="color:${gap > 0 ? '#ef4444' : '#10b981'}">Gap: <b>${gap}%</b></span>
                  </div>
                  <div class="ac-bar-track">
                    <div class="ac-bar-current" style="width:${val}%;background:linear-gradient(90deg,${color},${color}aa)"></div>
                    ${gap > 0 ? `<div class="ac-bar-gap" style="width:${gap}%;left:${val}%"></div>` : ''}
                  </div>
                </div>
                <div class="ac-rec">
                  <span class="ac-rec-label">UPGRADE REQUIREMENT</span>
                  <p class="ac-rec-text">${rec}</p>
                </div>
                <div class="ac-footer">
                  <span class="cost-tag">💰 $${costUSD}M</span>
                  <span class="cost-tag inr">₹${formatCurrency(costUSD, EXCHANGE_RATES.INR.rate)}</span>
                  <span class="cost-tag rub">₽${formatCurrency(costUSD, EXCHANGE_RATES.RUB.rate)}</span>
                  <span class="cost-tag cny">¥${formatCurrency(costUSD, EXCHANGE_RATES.CNY.rate)}</span>
                </div>
              </div>
            `
  }).join('')}
        </div>
      </div>

      <div class="reco-panel">
        <h3 class="reco-heading">🎯 Strategic Recommendations</h3>
        <div class="reco-grid">
          ${recommendations.map(r => `
            <div class="reco-card reco-${r.type}">
              <span class="reco-icon">${r.icon}</span>
              <div class="reco-body">
                <h4 class="reco-title">${r.title}</h4>
                <p class="reco-text">${r.text}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `

  document.querySelector('#back-to-lab').addEventListener('click', () => {
    selectedUpgradeMissile = null
    renderView()
  })
}

// ─── INIT ────────────────────────────────────────────────────────
boot()
setInterval(fetchAll, 10000)
