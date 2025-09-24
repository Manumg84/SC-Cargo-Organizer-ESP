const ORDER_KEY = 'manualRouteOrder_v1';

function getMissionsFromStore() {
  try { return JSON.parse(localStorage.getItem('missions')) || []; } catch { return []; }
}
function getCargoOverallStatusLocal(cargo) {
  if (!cargo?.containers?.length) return 'pending';
  const allDelivered = cargo.containers.every(c => c.status === 'delivered');
  if (allDelivered) return 'delivered';
  const allLoaded = cargo.containers.every(c => c.status === 'loaded' || c.status === 'delivered');
  return allLoaded ? 'loaded' : 'pending';
}
function parseLocationLocal(s) {
  const m = (s||'').match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { name: m[1].trim(), details: m[2].trim() } : { name: (s||'').trim(), details: null };
}
function fullLocationLabel(s) {
  const p = parseLocationLocal(s);
  return p.details ? `${p.name} (${p.details})` : p.name;
}
function formatContainersLocal(containers=[]) {
  if (!containers.length) return 'Unspecified';
  const counts = {};
  containers.forEach(c => counts[c.size] = (counts[c.size]||0)+1);
  return Object.entries(counts).sort((a,b)=>a[0]-b[0]).map(([s,c])=>`${c}x${s}scu`).join(' ');
}

function buildSteps() {
  const missions = getMissionsFromStore();
  const steps = [];
  missions.forEach(m => (m.cargos||[]).forEach(c => {
    const status = getCargoOverallStatusLocal(c);
    if (status === 'delivered') return; // Ocultar todo cuando ya fue entregado
    if (status === 'pending') {
      steps.push({
        id: `pickup-${c.id}`, type: 'pickup', missionId: m.id, cargoId: c.id,
        location: fullLocationLabel(c.pickupLocation), missionName: m.name, missionType: m.type,
        material: c.material, containersText: formatContainersLocal(c.containers)
      });
      steps.push({
        id: `delivery-${c.id}`, type: 'delivery', missionId: m.id, cargoId: c.id,
        location: fullLocationLabel(c.dropoffLocation), missionName: m.name, missionType: m.type,
        material: c.material, containersText: formatContainersLocal(c.containers),
        readyForDelivery: false
      });
    } else if (status === 'loaded') {
      steps.push({
        id: `delivery-${c.id}`, type: 'delivery', missionId: m.id, cargoId: c.id,
        location: fullLocationLabel(c.dropoffLocation), missionName: m.name, missionType: m.type,
        material: c.material, containersText: formatContainersLocal(c.containers),
        readyForDelivery: true
      });
    }
  }));
  return steps;
}

function loadOrder() {
  try { return JSON.parse(localStorage.getItem(ORDER_KEY)) || []; } catch { return []; }
}
function saveOrder(orderIds) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(orderIds));
}
function orderedSteps(steps) {
  const map = new Map(steps.map(s => [s.id, s]));
  const order = loadOrder().filter(id => map.has(id));
  const ordered = order.map(id => map.get(id));
  steps.forEach(s => { if (!order.includes(s.id)) ordered.push(s); });
  if (ordered.length !== order.length) saveOrder(ordered.map(s=>s.id));
  return ordered;
}

function renderManualList() {
  const host = document.getElementById('route-manual-list');
  if (!host) return;
  const steps = orderedSteps(buildSteps());
  host.innerHTML = '';
  if (!steps.length) {
    host.innerHTML = `<div class="text-muted-glow small p-2">No hay pasos de ruta aún.</div>`;
    return;
  }
  steps.forEach((s, idx) => {
    const card = document.createElement('div');
    card.className = 'route-card';
    card.draggable = true;
    card.dataset.stepId = s.id;
    const badge = s.type === 'pickup' ? 'badge-pickup' : 'badge-delivery';
    const badgeText = s.type === 'pickup' ? 'Recogida' : 'Entrega';
    const readyIcon = s.type === 'delivery' && s.readyForDelivery
      ? '<i class="bi bi-check-circle-fill text-success ms-2" title="Mercancía lista para entrega"></i>'
      : '';
    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start">
        <div class="me-2">
          <div><span class="badge ${badge} me-2">${badgeText}</span><strong>${s.location}</strong>${readyIcon}</div>
          <div class="small mt-1"><i class="bi bi-collection me-1"></i><span class="mission-type-badge-sm me-2">${(s.missionType||'').toString().toUpperCase()}</span>${s.missionName}</div>
          <div class="small"><i class="bi bi-box me-1"></i>${s.material} — ${s.containersText}</div>
        </div>
        <div class="btn-group btn-group-vertical">
          <button class="btn btn-outline-light btn-move btn-up" title="Mover arriba">↑</button>
          <button class="btn btn-outline-light btn-move btn-down" title="Mover abajo">↓</button>
        </div>
      </div>
    `;
    host.appendChild(card);
  });
  attachDnD(host);
}

function attachDnD(host) {
  let dragEl = null;
  host.querySelectorAll('.route-card').forEach(el => {
    el.addEventListener('dragstart', () => { dragEl = el; el.classList.add('dragging'); });
    el.addEventListener('dragend', () => { if (dragEl) dragEl.classList.remove('dragging'); dragEl = null; persistFromDom(host); });
  });
  host.addEventListener('dragover', (e) => {
    e.preventDefault();
    const after = getAfterElement(host, e.clientY);
    if (!dragEl) return;
    if (after == null) host.appendChild(dragEl); else host.insertBefore(dragEl, after);
  });
  host.addEventListener('click', (e) => {
    const card = e.target.closest('.route-card'); if (!card) return;
    if (e.target.classList.contains('btn-up')) {
      const prev = card.previousElementSibling; if (prev) host.insertBefore(card, prev); persistFromDom(host);
    } else if (e.target.classList.contains('btn-down')) {
      const next = card.nextElementSibling; if (next) host.insertBefore(next, card); persistFromDom(host);
    }
  });
}
function getAfterElement(container, y) {
  const els = [...container.querySelectorAll('.route-card:not(.dragging)')];
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height/2;
    if (offset < 0 && offset > closest.offset) { return { offset, element: child }; }
    else return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}
function persistFromDom(host) {
  const ids = [...host.querySelectorAll('.route-card')].map(el => el.dataset.stepId);
  saveOrder(ids);
}

function scheduleRender() { requestAnimationFrame(renderManualList); }

window.addEventListener('missions-updated', scheduleRender);
window.addEventListener('storage', (e) => { if (e.key === 'missions' || e.key === ORDER_KEY) scheduleRender(); });
document.addEventListener('DOMContentLoaded', scheduleRender);