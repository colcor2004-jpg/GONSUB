/* ============================================================
   GONSUB — Plataforma de Transporte, Encomiendas y Delivery
   app.js · Lógica completa con persistencia en localStorage
   ============================================================ */
'use strict';

/* ==================== 1. UTILIDADES ==================== */
const $  = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const uid = () => 'G' + Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
const money = (n) => '$ ' + Number(n).toFixed(2);
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => new Date(iso).toLocaleString('es-419', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });

/* ==================== 2. ALMACENAMIENTO ==================== */
const K = { USERS:'gonsub_users', ORDERS:'gonsub_orders', RATES:'gonsub_rates', SESSION:'gonsub_session' };

const DB = {
  get(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

const DEFAULT_RATES = {
  delivery:    { label:'Delivery de comida / compras', base:1.50, perKm:0.60, commission:15 },
  mototaxi:    { label:'Carrera / Moto taxi',            base:1.00, perKm:0.50, commission:12 },
  encomienda:  { label:'Encomienda / Paquetería',        base:2.00, perKm:0.80, commission:18 }
};

const SERVICES = {
  delivery:   { icon:'🍔', name:'Delivery',        desc:'Comida, farmacias y compras a domicilio en minutos.' },
  mototaxi:   { icon:'🏍️', name:'Carrera / Moto',  desc:'Traslados rápidos y seguros por la ciudad.' },
  encomienda: { icon:'📦', name:'Encomiendas',     desc:'Envía paquetes y documentos con seguimiento.' }
};

/* ==================== 3. DATOS SEMILLA ==================== */
function seed() {
  if (!DB.get(K.USERS, null)) {
    DB.set(K.USERS, [
      { id:'ADM01', name:'Administrador GONSUB', email:'admin@gonsub.com', pass:'admin123', role:'admin', approved:true, available:true, created: todayStr() },
      { id:'MOT01', name:'Carlos Rider',  email:'carlos@gonsub.com', pass:'demo123', role:'rider', approved:true,  available:true,  created: todayStr(), vehicle:'Moto Honda XR 150 · ABC-1234' },
      { id:'MOT02', name:'Luis Falcón',   email:'luis@gonsub.com',   pass:'demo123', role:'rider', approved:false, available:true,  created: todayStr(), vehicle:'Moto Yamaha FZ 2.0 · XYZ-9876' },
      { id:'CLI01', name:'María Pérez',   email:'maria@gonsub.com',  pass:'demo123', role:'client', approved:true, available:true, created: todayStr() }
    ]);
  }
  if (!DB.get(K.ORDERS, null)) {
    DB.set(K.ORDERS, [
      { id:uid(), clientId:'CLI01', clientName:'María Pérez', riderId:null, riderName:null, type:'delivery',   from:'Av. Principal 120', to:'Calle 8, Casa 45', km:3.2,  fare:3.42, status:'pendiente',  created:new Date().toISOString(), history:[] },
      { id:uid(), clientId:'CLI01', clientName:'María Pérez', riderId:'MOT01', riderName:'Carlos Rider', type:'mototaxi', from:'Centro Comercial Norte', to:'Av. Universidad 300', km:6.5, fare:4.25, status:'en_camino', created:new Date().toISOString(), history:[{ s:'pendiente', t:new Date().toISOString() },{ s:'aceptada', t:new Date().toISOString() }] },
      { id:uid(), clientId:'CLI01', clientName:'María Pérez', riderId:'MOT01', riderName:'Carlos Rider', type:'encomienda', from:'Oficina A, Torre Empresarial', to:'Zona Industrial, Galpón 12', km:9.0, fare:9.20, status:'entregada', created:new Date(Date.now()-864e5).toISOString(), history:[] }
    ]);
  }
  if (!DB.get(K.RATES, null)) DB.set(K.RATES, DEFAULT_RATES);
}
seed();

/* ==================== 4. ESTADO GLOBAL ==================== */
let sessionId   = DB.get(K.SESSION, null);
let selService  = 'delivery';
let selRole     = 'client';
let authMode    = 'login';
let clientTab   = 'nuevo';
let riderTab    = 'disponibles';
let adminTab    = 'pedidos';

const users  = () => DB.get(K.USERS, []);
const orders = () => DB.get(K.ORDERS, []);
const rates  = () => DB.get(K.RATES, DEFAULT_RATES);
const me     = () => users().find((u) => u.id === sessionId) || null;

function saveUsers(list)  { DB.set(K.USERS, list); }
function saveOrders(list) { DB.set(K.ORDERS, list); }
function saveRatesObj(r)  { DB.set(K.RATES, r); }

/* ==================== 5. TOAST Y MODAL ==================== */
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toast-root').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 2600);
  setTimeout(() => el.remove(), 3100);
}

function openModal(html) {
  $('#modal-root').innerHTML =
    `<div class="modal-overlay" onclick="if(event.target===this) G.closeModal()">
       <div class="modal">${html}</div>
     </div>`;
}
function closeModal() { $('#modal-root').innerHTML = ''; }

/* ==================== 6. TARIFAS ==================== */
function calcFare(type, km) {
  const r = rates()[type];
  const dist = Math.max(0, Number(km) || 0);
  return +(r.base + r.perKm * dist).toFixed(2);
}
function commissionOf(order) {
  return +((order.fare * rates()[order.type].commission) / 100).toFixed(2);
}

/* ==================== 7. RENDER PRINCIPAL ==================== */
function render() {
  renderTopbar();
  renderNavbar();
  const u = me();
  if (!u) { renderLanding(); return; }
  if (u.role === 'client') renderClient();
  else if (u.role === 'rider') renderRider();
  else renderAdmin();
  if (u.role === 'rider') $('#navbar')?.classList.remove('hidden');
}

function renderTopbar() {
  const u = me();
  const roleLabel = { client:'Cliente', rider:'Motorizado', admin:'Administrador' };
  $('#topbar').innerHTML = `
    <div class="brand" onclick="G.goHome()">GON<em>SUB</em></div>
    <div class="top-actions">
      ${u ? `
        <span class="chip-status ${u.role === 'rider' && !u.available ? 'ocupado' : ''}">
          ${u.role === 'rider' ? (u.available ? '● Disponible' : '● Ocupado') : roleLabel[u.role]}
        </span>
        <div class="avatar" title="${esc(u.name)}">${esc(u.name.charAt(0).toUpperCase())}</div>
        <button class="btn btn-ghost btn-sm" onclick="G.logout()">Salir</button>
      ` : `
        <button class="btn btn-ghost btn-sm" onclick="G.setAuth('login')">Iniciar sesión</button>
        <button class="btn btn-primary btn-sm" onclick="G.setAuth('register')">Crear cuenta</button>
      `}
    </div>`;
}

function renderNavbar() {
  const u = me();
  const nav = $('#navbar');
  if (!u) { nav.classList.add('hidden'); return; }
  nav.classList.remove('hidden');
  const items = u.role === 'client'
    ? [['nuevo','🧾','Solicitar'],['historial','🕒','Historial']]
    : u.role === 'rider'
    ? [['panel','🏍️','Panel'],['disponibles','📋','Pedidos'],['mis-carreras','✅','Mis carreras']]
    : [['resumen','📊','Resumen'],['pedidos','🛵','Carreras'],['usuarios','👥','Usuarios'],['tarifas','💲','Tarifas']];
  nav.innerHTML = items.map(([id, ico, label]) =>
    `<button class="nav-item ${navActive(u, id) ? 'active' : ''}" onclick="G.navGo('${id}')">
       <span class="ni">${ico}</span>${label}
     </button>`).join('');
}

function navActive(u, id) {
  if (u.role === 'client') return clientTab === (id === 'nuevo' ? 'nuevo' : 'historial');
  if (u.role === 'rider')  return riderTab === id || (id === 'panel' && riderTab === 'panel');
  return adminTab === id || (id === 'resumen' && adminTab === 'resumen');
}

/* ==================== 8. VISTA PÚBLICA (LANDING) ==================== */
function renderLanding() {
  const r = rates();
  $('#app').innerHTML = `
  <div class="view">
    <section class="hero">
      <div class="hero-badge">⚡ Servicio rápido en tu ciudad</div>
      <h1>Pide un <span class="hl">delivery</span>, una <span class="hl">carrera</span> o envía una <span class="hl">encomienda</span></h1>
      <p>GONSUB conecta clientes con motorizados verificados. Cotiza al instante, paga al recibir y sigue tu pedido en tiempo real.</p>
      <div class="row-flex">
        <button class="btn btn-primary" onclick="G.setAuth('register')">Solicitar ahora →</button>
        <button class="btn btn-ghost" onclick="G.setAuth('login')">Ya tengo cuenta</button>
      </div>
    </section>

    <h2 class="section-title">Elige tu servicio</h2>
    <div class="services-grid">
      ${Object.entries(SERVICES).map(([key, s]) => `
        <div class="service-card ${selService === key ? 'active' : ''}" data-svc="${key}" onclick="G.pickService('${key}')">
          <div class="service-icon">${s.icon}</div>
          <h3>${s.name}</h3>
          <p>${s.desc}</p>
          <div class="service-price">Desde ${money(r[key].base)} + ${money(r[key].perKm)}/km</div>
        </div>`).join('')}
    </div>

    <div class="panel">
      <h2>🧮 Cotiza tu servicio</h2>
      <p class="sub">Tarifa estimada según distancia en kilómetros.</p>
      <div class="form-grid">
        <div class="field">
          <label>Tipo de servicio</label>
          <select id="q-type" onchange="G.pickService(this.value)">
            ${Object.entries(SERVICES).map(([k, s]) => `<option value="${k}" ${k === selService ? 'selected' : ''}>${s.icon} ${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Distancia estimada (km)</label>
          <input id="q-km" type="number" min="0.5" step="0.1" value="4" oninput="G.updateQuote()" />
        </div>
      </div>
      <div class="fare-box">
        <div>
          <div class="fare-label">Tarifa estimada</div>
          <div class="fare-detail" id="q-detail"></div>
        </div>
        <div class="fare-value" id="q-fare"></div>
      </div>
      <button class="btn btn-green btn-block mt-2" onclick="G.setAuth('register')">Regístrate gratis para pedir</button>
    </div>
  </div>`;
  updateQuote();
}

function updateQuote() {
  const kmEl = $('#q-km'); if (!kmEl) return;
  const km = parseFloat(kmEl.value) || 0;
  const fare = calcFare(selService, km);
  $('#q-fare').textContent = money(fare);
  const r = rates()[selService];
  $('#q-detail').textContent = `${r.label} · Base ${money(r.base)} + ${money(r.perKm)}/km × ${km} km · Comisión GONSUB ${r.commission}%`;
}

/* ==================== 9. AUTENTICACIÓN ==================== */
function renderAuth() {
  const isLogin = authMode === 'login';
  $('#navbar').classList.add('hidden');
  $('#app').innerHTML = `
  <div class="view auth-wrap">
    <div class="auth-logo"><span class="brand">GON<em>SUB</em></span></div>
    <div class="panel">
      <h2>${isLogin ? '👋 Bienvenido de nuevo' : '🚀 Crea tu cuenta'}</h2>
      <p class="sub">${isLogin ? 'Ingresa para pedir o trabajar con GONSUB.' : 'Elige tu tipo de cuenta y comienza en segundos.'}</p>

      ${!isLogin ? `
      <label>Tipo de cuenta</label>
      <div class="role-picker">
        <div class="role-opt ${selRole === 'client' ? 'active' : ''}" onclick="G.pickRole('client')"><span class="ri">🛍️</span><span>Cliente</span></div>
        <div class="role-opt ${selRole === 'rider' ? 'active' : ''}" onclick="G.pickRole('rider')"><span class="ri">🏍️</span><span>Motorizado</span></div>
        <div class="role-opt ${selRole === 'admin' ? 'active' : ''}" onclick="G.pickRole('admin')"><span class="ri">🛠️</span><span>Admin</span></div>
      </div>` : ''}

      <div class="field"><label>Nombre completo</label><input id="a-name" placeholder="Ej. Ana Torres" value="${isLogin ? '' : ''}" /></div>
      <div class="field"><label>Correo electrónico</label><input id="a-email" type="email" placeholder="tucorreo@email.com" /></div>
      ${!isLogin && selRole === 'rider' ? `
      <div class="field"><label>Vehículo y placa</label><input id="a-vehicle" placeholder="Ej. Moto Honda XR · ABC-1234" /></div>` : ''}
      <div class="field"><label>Contraseña</label><input id="a-pass" type="password" placeholder="Mínimo 6 caracteres" /></div>

      <button class="btn btn-primary btn-block" onclick="G.submitAuth()">${isLogin ? 'Iniciar sesión' : 'Registrarme'}</button>

      <div class="auth-switch">
        ${isLogin ? '¿No tienes cuenta? <a href="#" onclick="G.setAuth(\'register\')">Regístrate</a>'
                  : '¿Ya tienes cuenta? <a href="#" onclick="G.setAuth(\'login\')">Inicia sesión</a>'}
      </div>
    </div>
    ${isLogin ? `
    <div class="panel" style="font-size:13px;color:var(--muted)">
      <b style="color:var(--text)">Cuentas demo:</b><br/>
      👑 Admin: admin@gonsub.com / admin123<br/>
      🏍️ Motorizado: carlos@gonsub.com / demo123 (aprobado)<br/>
      🏍️ Motorizado: luis@gonsub.com / demo123 (pendiente)<br/>
      🛍️ Cliente: maria@gonsub.com / demo123
    </div>` : ''}
  </div>`;
}

function submitAuth() {
  const name  = ($('#a-name')?.value || '').trim();
  const email = ($('#a-email')?.value || '').trim().toLowerCase();
  const pass  = $('#a-pass')?.value || '';
  const list = users();

  if (authMode === 'login') {
    const u = list.find((x) => x.email === email && x.pass === pass);
    if (!u) return toast('Correo o contraseña incorrectos.', 'err');
    if (u.role === 'rider' && !u.approved) return toast('Tu cuenta de motorizado está pendiente de aprobación por el administrador.', 'err');
    sessionId = u.id; DB.set(K.SESSION, sessionId);
    toast(`¡Hola, ${u.name.split(' ')[0]}!`, 'ok');
    render();
    return;
  }

  if (name.length < 3)  return toast('Ingresa tu nombre completo.', 'err');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Ingresa un correo válido.', 'err');
  if (pass.length < 6)  return toast('La contraseña debe tener mínimo 6 caracteres.', 'err');
  if (list.some((x) => x.email === email)) return toast('Ese correo ya está registrado.', 'err');

  const vehicle = selRole === 'rider' ? ($('#a-vehicle')?.value || '').trim() : '';
  if (selRole === 'rider' && vehicle.length < 5) return toast('Indica tu vehículo y placa.', 'err');

  const u = {
    id: uid(), name, email, pass, role: selRole,
    approved: selRole !== 'rider', available: true,
    vehicle: vehicle || undefined, created: todayStr()
  };
  list.push(u); saveUsers(list);
  sessionId = u.id; DB.set(K.SESSION, sessionId);
  toast(selRole === 'rider' ? 'Cuenta creada. Quedas pendiente de aprobación.' : '¡Cuenta creada con éxito!', 'ok');
  render();
}

function logout() {
  sessionId = null; DB.set(K.SESSION, null);
  clientTab = 'nuevo'; riderTab = 'disponibles'; adminTab = 'pedidos';
  toast('Sesión cerrada.');
  render();
}

/* ==================== 10. VISTA CLIENTE ==================== */
function renderClient() {
  const u = me();
  const myOrders = orders().filter((o) => o.clientId === u.id).sort((a, b) => b.created.localeCompare(a.created));
  const tab = clientTab;

  let body = '';
  if (tab === 'nuevo') {
    body = `
    <div class="panel">
      <h2>🧾 Solicitar servicio</h2>
      <p class="sub">Completa los datos y confirma tu pedido.</p>
      <label>Tipo de servicio</label>
      <div class="services-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
        ${Object.entries(SERVICES).map(([key, s]) => `
          <div class="service-card ${selService === key ? 'active' : ''}" data-svc="${key}" onclick="G.pickService('${key}', true)" style="padding:16px">
            <div class="service-icon" style="width:42px;height:42px;font-size:21px;margin-bottom:10px">${s.icon}</div>
            <h3 style="font-size:15px">${s.name}</h3>
          </div>`).join('')}
      </div>
      <div class="form-grid mt-2">
        <div class="field"><label>📍 Punto de recogida</label><input id="o-from" placeholder="Dirección de origen" /></div>
        <div class="field"><label>🏁 Destino</label><input id="o-to" placeholder="Dirección de entrega" /></div>
      </div>
      <div class="form-grid mt-1">
        <div class="field"><label>Distancia estimada (km)</label><input id="o-km" type="number" min="0.5" step="0.1" value="4" oninput="G.updateClientFare()" /></div>
        <div class="field"><label>Nota para el motorizado (opcional)</label><input id="o-note" placeholder="Ej. Tocar el timbre 2 veces" /></div>
      </div>
      <div class="fare-box">
        <div>
          <div class="fare-label">Total a pagar (estimado)</div>
          <div class="fare-detail" id="o-detail"></div>
        </div>
        <div class="fare-value" id="o-fare"></div>
      </div>
      <button class="btn btn-green btn-block mt-2" onclick="G.submitOrder()">Confirmar pedido 🚀</button>
    </div>`;
  } else {
    body = `
    <h2 class="section-title">🕒 Mi historial</h2>
    ${myOrders.length === 0 ? `<div class="empty"><span class="ei">📭</span>Aún no tienes pedidos. ¡Solicita tu primer servicio!</div>` : `
    <div class="orders-list">
      ${myOrders.map(orderCard).join('')}
    </div>`}`;
  }

  $('#app').innerHTML = `<div class="view">${body}</div>`;
  if (tab === 'nuevo') updateClientFare();
}

function updateClientFare() {
  const kmEl = $('#o-km'); if (!kmEl) return;
  const km = parseFloat(kmEl.value) || 0;
  const fare = calcFare(selService, km);
  $('#o-fare').textContent = money(fare);
  const r = rates()[selService];
  $('#o-detail').textContent = `${r.label} · Base ${money(r.base)} + ${money(r.perKm)}/km × ${km} km`;
}

function submitOrder() {
  const u = me();
  const from = ($('#o-from')?.value || '').trim();
  const to   = ($('#o-to')?.value || '').trim();
  const km   = parseFloat($('#o-km')?.value) || 0;
  const note = ($('#o-note')?.value || '').trim();

  if (from.length < 4) return toast('Indica el punto de recogida.', 'err');
  if (to.length < 4)   return toast('Indica el destino.', 'err');
  if (km <= 0)         return toast('La distancia debe ser mayor a 0 km.', 'err');

  const order = {
    id: uid(), clientId: u.id, clientName: u.name,
    riderId: null, riderName: null,
    type: selService, from, to, km: +km.toFixed(1),
    fare: calcFare(selService, km), note,
    status: 'pendiente', created: new Date().toISOString(),
    history: [{ s: 'pendiente', t: new Date().toISOString() }]
  };
  const list = orders(); list.push(order); saveOrders(list);
  clientTab = 'historial';
  toast(`¡Pedido ${order.id} creado! Buscando motorizado…`, 'ok');
  render();
}

/* ==================== 11. VISTA MOTORIZADO ==================== */
function renderRider() {
  const u = me();
  if (!u.approved) {
    $('#app').innerHTML = `<div class="view"><div class="empty mt-3"><span class="ei">⏳</span>
      Tu cuenta está <b>pendiente de aprobación</b> por el administrador.<br/>Te notificaremos cuando puedas recibir carreras.</div></div>`;
    return;
  }

  const all = orders().sort((a, b) => b.created.localeCompare(a.created));
  const disponibles = all.filter((o) => o.status === 'pendiente' && !o.riderId);
  const mias = all.filter((o) => o.riderId === u.id && o.status !== 'entregada');
  const historial = all.filter((o) => o.riderId === u.id && o.status === 'entregada');

  let body = `
  <div class="panel" style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
    <div>
      <h2>🏍️ Hola, ${esc(u.name.split(' ')[0])}</h2>
      <p class="sub" style="margin:0">${esc(u.vehicle || 'Motorizado GONSUB')}</p>
    </div>
    <div class="row-flex">
      <span style="font-size:13.5px;font-weight:700;color:${u.available ? 'var(--green)' : 'var(--red)'}">
        ${u.available ? 'Disponible para carreras' : 'Ocupado'}
      </span>
      <label class="switch">
        <input type="checkbox" ${u.available ? 'checked' : ''} onchange="G.toggleAvailability()" />
        <span class="slider-tg"></span>
      </label>
    </div>
  </div>`;

  if (riderTab === 'disponibles') {
    body += `
    <h2 class="section-title"><span class="live-dot"></span> Pedidos disponibles (${disponibles.length})</h2>
    ${disponibles.length === 0 ? `<div class="empty"><span class="ei">🛵</span>No hay pedidos nuevos por ahora. Mantente disponible.</div>` : `
    <div class="orders-list">
      ${disponibles.map((o) => orderCard(o, true)).join('')}
    </div>`}`;
  } else if (riderTab === 'mis-carreras') {
    body += `
    <h2 class="section-title">✅ Mis carreras activas (${mias.length})</h2>
    ${mias.length === 0 ? `<div class="empty"><span class="ei">📭</span>No tienes carreras activas.</div>` : `
    <div class="orders-list">${mias.map((o) => orderCard(o, false, true)).join('')}</div>`}
    ${historial.length ? `
    <h2 class="section-title mt-3">🏁 Historial de entregas</h2>
    <div class="orders-list">${historial.map((o) => orderCard(o)).join('')}</div>` : ''}`;
  } else {
    // panel resumen
    const ganancia = historial.reduce((acc, o) => acc + (o.fare - commissionOf(o)), 0);
    body += `
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-ico">📦</span><div class="stat-num">${mias.length}</div><div class="stat-label">Carreras activas</div></div>
      <div class="stat-card g"><span class="stat-ico">✅</span><div class="stat-num">${historial.length}</div><div class="stat-label">Entregadas</div></div>
      <div class="stat-card b"><span class="stat-ico">💵</span><div class="stat-num">${money(ganancia)}</div><div class="stat-label">Ganancias netas</div></div>
    </div>
    <h2 class="section-title"><span class="live-dot"></span> Últimos pedidos disponibles</h2>
    ${disponibles.length === 0 ? `<div class="empty"><span class="ei">🛵</span>Sin pedidos nuevos.</div>` : `
    <div class="orders-list">${disponibles.slice(0, 3).map((o) => orderCard(o, true)).join('')}</div>`}`;
  }

  $('#app').innerHTML = `<div class="view">${body}</div>`;
}

function toggleAvailability() {
  const list = users();
  const u = list.find((x) => x.id === sessionId);
  u.available = !u.available;
  saveUsers(list);
  toast(u.available ? 'Ahora estás disponible ✅' : 'Estás ocupado, no recibirás carreras', u.available ? 'ok' : '');
  render();
}

function acceptOrder(id) {
  const u = me();
  if (!u.available) return toast('Estás ocupado. Activa "Disponible" para aceptar.', 'err');
  const list = orders();
  const o = list.find((x) => x.id === id);
  if (!o || o.status !== 'pendiente') return toast('Este pedido ya fue tomado.', 'err');
  o.status = 'aceptada'; o.riderId = u.id; o.riderName = u.name;
  o.history.push({ s: 'aceptada', t: new Date().toISOString() });
  saveOrders(list);
  const ul = users(); const ru = ul.find((x) => x.id === u.id);
  ru.available = false; saveUsers(ul);
  riderTab = 'mis-carreras';
  toast(`Carrera ${o.id} aceptada. ¡A rodar! 🏍️`, 'ok');
  render();
}

function advanceOrder(id) {
  const flow = { aceptada: 'en_camino', en_camino: 'entregada' };
  const label = { en_camino: 'En camino 🚦', entregada: 'Entregada ✅' };
  const list = orders();
  const o = list.find((x) => x.id === id);
  if (!o) return;
  const next = flow[o.status];
  if (!next) return;
  o.status = next;
  o.history.push({ s: next, t: new Date().toISOString() });
  saveOrders(list);
  if (next === 'entregada') {
    const ul = users(); const ru = ul.find((x) => x.id === sessionId);
    if (ru) { ru.available = true; saveUsers(ul); }
  }
  toast(`Pedido marcado como: ${label[next]}`, 'ok');
  render();
}

/* ==================== 12. VISTA ADMIN ==================== */
function renderAdmin() {
  const all = orders().sort((a, b) => b.created.localeCompare(a.created));
  const todayOrders = all.filter((o) => o.created.slice(0, 10) === todayStr());
  const us = users();
  const riders = us.filter((x) => x.role === 'rider');
  const ridersActive = riders.filter((x) => x.approved && x.available).length;
  const clients = us.filter((x) => x.role === 'client').length;
  const pendingRiders = riders.filter((x) => !x.approved);
  const ingresos = todayOrders.reduce((acc, o) => acc + commissionOf(o), 0);

  let body = '';

  if (adminTab === 'resumen') {
    body = `
    <div class="stats-grid">
      <div class="stat-card"><span class="stat-ico">🧾</span><div class="stat-num">${todayOrders.length}</div><div class="stat-label">Pedidos de hoy</div></div>
      <div class="stat-card g"><span class="stat-ico">🏍️</span><div class="stat-num">${ridersActive}</div><div class="stat-label">Motorizados activos</div></div>
      <div class="stat-card b"><span class="stat-ico">🛍️</span><div class="stat-num">${clients}</div><div class="stat-label">Clientes registrados</div></div>
      <div class="stat-card"><span class="stat-ico">💲</span><div class="stat-num">${money(ingresos)}</div><div class="stat-label">Comisión del día</div></div>
    </div>
    ${pendingRiders.length ? `
    <div class="panel" style="border-color:rgba(255,212,0,.4)">
      <h2>⚠️ Motorizados pendientes de aprobación (${pendingRiders.length})</h2>
      <p class="sub">Aprueba sus cuentas para que puedan recibir carreras.</p>
      <div class="orders-list">
        ${pendingRiders.map((r) => `
        <div class="order-card" style="flex-direction:row;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div><b>${esc(r.name)}</b><br/><span style="color:var(--muted);font-size:12.5px">${esc(r.email)} · ${esc(r.vehicle || '')}</span></div>
          <div class="row-flex">
            <button class="btn btn-green btn-sm" onclick="G.approveUser('${r.id}')">✅ Aprobar</button>
            <button class="btn btn-danger btn-sm" onclick="G.rejectUser('${r.id}')">Rechazar</button>
          </div>
        </div>`).join('')}
      </div>
    </div>` : ''}
    <h2 class="section-title"><span class="live-dot"></span> Solicitudes en tiempo real</h2>
    ${all.length === 0 ? `<div class="empty"><span class="ei">📭</span>Sin solicitudes todavía.</div>` : `
    <div class="orders-list">${all.slice(0, 5).map((o) => orderCard(o)).join('')}</div>`}`;
  }

  else if (adminTab === 'pedidos') {
    body = `
    <h2 class="section-title"><span class="live-dot"></span> Todas las carreras (${all.length})</h2>
    ${all.length === 0 ? `<div class="empty"><span class="ei">📭</span>Sin carreras registradas.</div>` : `
    <div class="panel table-wrap"><table>
      <thead><tr><th>ID</th><th>Servicio</th><th>Cliente</th><th>Motorizado</th><th>Tarifa</th><th>Comisión</th><th>Estado</th></tr></thead>
      <tbody>
        ${all.map((o) => `<tr>
          <td style="font-family:monospace;font-size:12px">${o.id}</td>
          <td>${SERVICES[o.type].icon} ${SERVICES[o.type].name}</td>
          <td>${esc(o.clientName)}</td>
          <td>${esc(o.riderName || '—')}</td>
          <td><b>${money(o.fare)}</b></td>
          <td style="color:var(--green)">${money(commissionOf(o))}</td>
          <td>${statusBadge(o.status)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`}`;
  }

  else if (adminTab === 'usuarios') {
    body = `
    <h2 class="section-title">👥 Gestión de usuarios (${us.length})</h2>
    <div class="panel table-wrap"><table>
      <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>
        ${us.map((x) => `<tr>
          <td><b>${esc(x.name)}</b></td>
          <td>${esc(x.email)}</td>
          <td>${{ client:'🛍️ Cliente', rider:'🏍️ Motorizado', admin:'👑 Admin' }[x.role]}</td>
          <td>${x.role === 'rider'
            ? (x.approved
                ? (x.available ? '<span class="badge badge-green">Aprobado · Disponible</span>' : '<span class="badge badge-red">Aprobado · Ocupado</span>')
                : '<span class="badge badge-yellow">Pendiente</span>')
            : '<span class="badge badge-blue">Activo</span>'}</td>
          <td>${x.role === 'rider' ? `
            ${x.approved
              ? `<button class="btn btn-danger btn-sm" onclick="G.suspendUser('${x.id}')">Suspender</button>`
              : `<button class="btn btn-green btn-sm" onclick="G.approveUser('${x.id}')">Aprobar</button>`}
          ` : '<span style="color:var(--muted);font-size:12px">—</span>'}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  else if (adminTab === 'tarifas') {
    body = `
    <h2 class="section-title">💲 Tarifas y comisiones</h2>
    <div class="panel">
      <p class="sub">Ajusta la tarifa base, el costo por kilómetro y la comisión de GONSUB por servicio.</p>
      ${Object.entries(rates()).map(([key, r]) => `
      <div class="panel" style="background:var(--bg-3);padding:18px;margin-bottom:14px">
        <h2 style="font-size:16px">${SERVICES[key].icon} ${r.label}</h2>
        <div class="form-grid" style="grid-template-columns:repeat(3,1fr);margin-top:12px">
          <div class="field"><label>Tarifa base ($)</label><input id="r-base-${key}" type="number" step="0.05" min="0" value="${r.base}" /></div>
          <div class="field"><label>Por km ($)</label><input id="r-km-${key}" type="number" step="0.05" min="0" value="${r.perKm}" /></div>
          <div class="field"><label>Comisión (%)</label><input id="r-com-${key}" type="number" step="1" min="0" max="100" value="${r.commission}" /></div>
        </div>
      </div>`).join('')}
      <button class="btn btn-primary btn-block" onclick="G.saveRates()">💾 Guardar tarifas</button>
    </div>`;
  }

  $('#app').innerHTML = `<div class="view">${body}</div>`;
}

function approveUser(id) {
  const list = users(); const u = list.find((x) => x.id === id);
  if (!u) return;
  u.approved = true; saveUsers(list);
  toast(`${u.name} aprobado como motorizado 🎉`, 'ok');
  render();
}
function rejectUser(id) {
  saveUsers(users().filter((x) => x.id !== id));
  toast('Solicitud rechazada y eliminada.');
  render();
}
function suspendUser(id) {
  const list = users(); const u = list.find((x) => x.id === id);
  if (!u) return;
  u.approved = false; saveUsers(list);
  toast(`${u.name} suspendido.`, 'err');
  render();
}
function saveRates() {
  const r = rates();
  for (const key of Object.keys(r)) {
    const b = parseFloat($(`#r-base-${key}`)?.value);
    const k = parseFloat($(`#r-km-${key}`)?.value);
    const c = parseFloat($(`#r-com-${key}`)?.value);
    if (isNaN(b) || isNaN(k) || isNaN(c)) return toast('Todos los valores deben ser numéricos.', 'err');
    r[key] = { ...r[key], base: b, perKm: k, commission: c };
  }
  saveRatesObj(r);
  toast('Tarifas actualizadas correctamente 💾', 'ok');
}

/* ==================== 13. TARJETA DE PEDIDO ==================== */
function statusBadge(s) {
  return {
    pendiente: '<span class="badge badge-yellow">Pendiente</span>',
    aceptada:  '<span class="badge badge-blue">Aceptada</span>',
    en_camino: '<span class="badge badge-yellow">En camino</span>',
    entregada: '<span class="badge badge-green">Entregada</span>'
  }[s] || s;
}

function orderCard(o, canAccept = false, canAdvance = false) {
  const nextBtn = canAdvance ? {
    aceptada:  `<button class="btn btn-primary btn-sm" onclick="G.advanceOrder('${o.id}')">Marcar "En camino" 🚦</button>`,
    en_camino: `<button class="btn btn-green btn-sm" onclick="G.advanceOrder('${o.id}')">Marcar "Entregada" ✅</button>`
  }[o.status] || '' : '';

  return `
  <div class="order-card">
    <div class="order-top">
      <div class="row-flex" style="gap:8px">
        <span style="font-size:20px">${SERVICES[o.type].icon}</span>
        <b>${SERVICES[o.type].name}</b>
        <span style="color:var(--muted);font-size:12px;font-family:monospace">${o.id}</span>
      </div>
      ${statusBadge(o.status)}
    </div>
    <div class="order-route">
      <span class="dot dot-a"></span><span>${esc(o.from)}</span>
      <span style="color:var(--muted)">→</span>
      <span class="dot dot-b"></span><span>${esc(o.to)}</span>
    </div>
    <div class="order-meta">
      <span>👤 <b>${esc(o.clientName)}</b></span>
      ${o.riderName ? `<span>🏍️ <b>${esc(o.riderName)}</b></span>` : ''}
      <span>📏 <b>${o.km} km</b></span>
      <span>💵 <b>${money(o.fare)}</b></span>
      <span>🕒 ${fmtDate(o.created)}</span>
      ${o.note ? `<span>📝 ${esc(o.note)}</span>` : ''}
    </div>
    ${canAccept || nextBtn ? `
    <div class="row-flex">
      ${canAccept ? `<button class="btn btn-green btn-sm" onclick="G.acceptOrder('${o.id}')" ${me() && !me().available ? 'disabled' : ''}>Aceptar carrera 🏍️</button>` : ''}
      ${nextBtn}
    </div>` : ''}
  </div>`;
}

/* ==================== 14. API GLOBAL Y ARRANQUE ==================== */
const G = {
  goHome() { clientTab = 'nuevo'; riderTab = 'disponibles'; adminTab = 'pedidos'; render(); },
  navGo(id) {
    const u = me(); if (!u) return;
    if (u.role === 'client') clientTab = id === 'historial' ? 'historial' : 'nuevo';
    else if (u.role === 'rider') riderTab = id;
    else adminTab = id;
    render();
  },
  setAuth(mode) { authMode = mode; renderAuth(); window.scrollTo({ top: 0 }); },
  pickRole(role) { selRole = role; renderAuth(); },
  pickService(key, isClient = false) {
    selService = key;
    if (me() && me().role === 'client' && isClient) { renderClient(); return; }
    document.querySelectorAll('.service-card').forEach((c) =>
      c.classList.toggle('active', c.dataset.svc === key));
    const sel = $('#q-type'); if (sel) sel.value = key;
    updateQuote();
  },
  updateQuote, updateClientFare,
  submitAuth, logout, submitOrder,
  toggleAvailability, acceptOrder, advanceOrder,
  approveUser, rejectUser, suspendUser, saveRates,
  closeModal,
  resetDemo() {
    localStorage.removeItem(K.USERS); localStorage.removeItem(K.ORDERS);
    localStorage.removeItem(K.RATES); localStorage.removeItem(K.SESSION);
    location.reload();
  }
};
window.G = G;

/* Refresh "tiempo real": recarga silenciosa cada 10 s en paneles operativos */
setInterval(() => {
  const u = me();
  if (!u) return;
  if (u.role === 'rider' && (riderTab === 'disponibles' || riderTab === 'panel')) renderRider();
  if (u.role === 'admin' && (adminTab === 'resumen' || adminTab === 'pedidos')) renderAdmin();
}, 10000);

render();
