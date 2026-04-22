// ── STATE ──
let items = [];
let opts = { other: false, discount: false, tax: false, duration: false, notes: false, 'qris-dynamic': false };

// ── INIT ──
window.onload = () => {
  const today = new Date();
  const due = new Date(); due.setDate(due.getDate() + 14);
  document.getElementById('inv-date').value = formatDateInput(today);
  document.getElementById('inv-due').value = formatDateInput(due);
  generateInvoiceNumber();
  addItem();
  renderInvoice();
};

function formatDateInput(d) {
  return d.toISOString().slice(0,10);
}

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
}

function formatRp(num) {
  if (isNaN(num) || num === '') return 'Rp 0';
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

// ── ITEMS ──
function addItem() {
  items.push({ name: '', note: '', qty: 1, price: 0 });
  renderItemsList();
  renderInvoice();
}

function removeItem(i) {
  items.splice(i, 1);
  renderItemsList();
  renderInvoice();
}

function renderItemsList() {
  const list = document.getElementById('items-list');
  list.innerHTML = '';
  items.forEach((item, i) => {
    const sub = (item.qty || 0) * (item.price || 0);
    const el = document.createElement('div');
    el.className = 'item-card';
    el.innerHTML = `
      <div class="item-num">Item ${i+1}</div>
      ${items.length > 1 ? `<button class="btn-remove-item" onclick="removeItem(${i})">×</button>` : ''}
      <div class="item-row">
        <div>
          <div class="item-label">Nama Item</div>
          <input type="text" value="${escHtml(item.name)}" placeholder="Nama produk/jasa..." 
            oninput="updateItem(${i},'name',this.value)">
        </div>
        <div>
          <div class="item-label">Qty</div>
          <input type="number" value="${item.qty}" min="1" 
            oninput="updateItem(${i},'qty',this.value)">
        </div>
        <div>
          <div class="item-label">Harga (Rp)</div>
          <input type="number" value="${item.price || ''}" placeholder="0"
            oninput="updateItem(${i},'price',this.value)">
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="flex:1;margin-right:10px">
          <div class="item-label">Catatan (opsional)</div>
          <input type="text" value="${escHtml(item.note)}" placeholder="Deskripsi tambahan..."
            oninput="updateItem(${i},'note',this.value)">
        </div>
        <div class="item-subtotal">${formatRp(sub)}</div>
      </div>
    `;
    list.appendChild(el);
  });
}

function updateItem(i, key, val) {
  if (key === 'qty' || key === 'price') val = parseFloat(val) || 0;
  items[i][key] = val;
  // update subtotal display
  const cards = document.querySelectorAll('.item-subtotal');
  if (cards[i]) {
    const sub = (items[i].qty || 0) * (items[i].price || 0);
    cards[i].textContent = formatRp(sub);
  }
  renderInvoice();
}

function escHtml(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── OPTIONAL TOGGLES ──
function toggleOpt(key) {
  opts[key] = !opts[key];
  const tog = document.getElementById('tog-' + key);
  const field = document.getElementById('opt-' + key);
  if (opts[key]) {
    tog.classList.add('active');
    field.classList.add('visible');
  } else {
    tog.classList.remove('active');
    field.classList.remove('visible');
  }
  renderInvoice();
}

// ── QRIS DINAMIS ──
// Payload QRIS @mcnsterjae (hardcoded, decoded dari scan)
const QRIS_STATIC_BASE = "00020101021226570011ID.DANA.WWW011893600915361003764302096100376430303UMI51440014ID.CO.QRIS.WWW0215ID10243156623030303UMI52048999530336054{AMT}5802ID5911@mcnsterjae6014Kota Palembang6105301276304";

function crc16Ccitt(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildDynamicQris(amount) {
  const amtStr = Math.round(amount).toString();
  const amtTag = amtStr.length.toString().padStart(2, '0') + amtStr;
  const base = QRIS_STATIC_BASE.replace('{AMT}', amtTag);
  return base + crc16Ccitt(base);
}

function buildStaticQris() {
  // Static QRIS without tag 54, original CRC
  return "00020101021126570011ID.DANA.WWW011893600915361003764302096100376430303UMI51440014ID.CO.QRIS.WWW0215ID10243156623030303UMI5204899953033605802ID5911@mcnsterjae6014Kota Palembang610530127630449F68";
}

function drawQrisToCanvas(payload) {
  const canvas = document.getElementById('d-qris-canvas');
  if (!canvas) return;
  // Use QRCode generation via a tiny inline approach
  // We'll use the qrcode-generator approach via data URL trick
  generateQROnCanvas(canvas, payload);
}

// Minimal QR matrix generator using qr-code-styling approach
// We use a canvas-based QR renderer
function generateQROnCanvas(canvas, text) {
  const size = 120;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);

  // Use Image approach: generate via google charts API-like local approach
  // Since we have jsQR for decoding but not encoding, use a QR encode lib
  // We'll load qrcodejs dynamically if not present
  if (typeof QRCode !== 'undefined') {
    // Create temp div, generate, copy to canvas
    const tmp = document.createElement('div');
    tmp.style.display = 'none';
    document.body.appendChild(tmp);
    const qr = new QRCode(tmp, {
      text: text,
      width: size,
      height: size,
      colorDark: '#000',
      colorLight: '#fff',
      correctLevel: QRCode.CorrectLevel.M
    });
    setTimeout(() => {
      const img = tmp.querySelector('img') || tmp.querySelector('canvas');
      if (img) {
        if (img.tagName === 'CANVAS') {
          ctx.drawImage(img, 0, 0, size, size);
        } else {
          const i = new Image();
          i.onload = () => ctx.drawImage(i, 0, 0, size, size);
          i.src = img.src;
        }
      }
      document.body.removeChild(tmp);
    }, 80);
  }
}

// Ensure qrcodejs is loaded
(function loadQRLib() {
  if (typeof QRCode !== 'undefined') return;
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  s.onload = () => { renderInvoice(); };
  document.head.appendChild(s);
})();

// ── CALCULATIONS ──
function calcTotals() {
  const subtotal = items.reduce((s, it) => s + (it.qty||0)*(it.price||0), 0);

  let other = 0;
  if (opts.other) other = parseFloat(document.getElementById('other-amount').value) || 0;

  let discountAmt = 0;
  if (opts.discount) {
    const dType = document.getElementById('discount-type').value;
    const dVal = parseFloat(document.getElementById('discount-val').value) || 0;
    if (dType === 'pct') discountAmt = (subtotal + other) * dVal / 100;
    else discountAmt = dVal;
  }

  const afterDiscount = subtotal + other - discountAmt;

  let taxAmt = 0;
  if (opts.tax) {
    const tPct = parseFloat(document.getElementById('tax-pct').value) || 0;
    taxAmt = afterDiscount * tPct / 100;
  }

  const total = afterDiscount + taxAmt;

  return { subtotal, other, discountAmt, taxAmt, total };
}

// ── RENDER INVOICE ──
function renderInvoice() {
  const bizName = 'mcnsterjae';
  const bizTagline = 'Creative Works';
  const bizContact = 'WA/DANA: 0895-3069-8726\n@mcnsterjae · Kota Palembang';
  const invNumber = document.getElementById('inv-number').value || 'INV-';
  const invDate = document.getElementById('inv-date').value;
  const invDue = document.getElementById('inv-due').value;
  const clientName = document.getElementById('client-name').value || '—';
  const clientDetail = document.getElementById('client-detail').value;
  const invStatus = document.getElementById('inv-status').value;
  const invNotes = document.getElementById('inv-notes').value;

  // Header
  document.getElementById('d-inv-number').textContent = invNumber;
  document.getElementById('d-inv-date').textContent = formatDate(invDate);
  document.getElementById('d-inv-due').textContent = formatDate(invDue);
  document.getElementById('d-client-name').textContent = clientName;
  document.getElementById('d-client-detail').textContent = clientDetail;

  // Duration
  if (opts.duration) {
    const ds = document.getElementById('dur-start').value;
    const de = document.getElementById('dur-end').value;
    const block = document.getElementById('d-duration-block');
    block.classList.add('visible');
    document.getElementById('d-duration-text').textContent =
      `Periode Layanan: ${formatDate(ds)} — ${formatDate(de)}`;
  } else {
    document.getElementById('d-duration-block').classList.remove('visible');
  }

  // Items table
  const tbody = document.getElementById('d-items-tbody');
  tbody.innerHTML = '';
  if (items.length === 0 || items.every(it => !it.name && !it.price)) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#aaa;padding:24px;font-size:13px">Belum ada item</td></tr>`;
  } else {
    items.forEach((it, idx) => {
      if (!it.name && !it.price) return;
      const sub = (it.qty||1) * (it.price||0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="inv-item-name">${escHtml(it.name) || '—'}</div>
          ${it.note ? `<div class="inv-item-note">${escHtml(it.note)}</div>` : ''}
        </td>
        <td class="col-qty">${it.qty || 1}</td>
        <td class="col-price">${formatRp(it.price)}</td>
        <td>${formatRp(sub)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Calculations
  const { subtotal, other, discountAmt, taxAmt, total } = calcTotals();

  document.getElementById('d-subtotal').textContent = formatRp(subtotal);

  // Other
  const otherRow = document.getElementById('d-other-row');
  if (opts.other && other > 0) {
    otherRow.style.display = 'flex';
    document.getElementById('d-other-lbl').textContent = document.getElementById('other-label').value || 'Biaya Lainnya';
    document.getElementById('d-other-val').textContent = formatRp(other);
  } else { otherRow.style.display = 'none'; }

  // Discount
  const discRow = document.getElementById('d-discount-row');
  if (opts.discount && discountAmt > 0) {
    discRow.style.display = 'flex';
    const dType = document.getElementById('discount-type').value;
    const dVal = document.getElementById('discount-val').value;
    document.getElementById('d-discount-lbl').textContent = `Diskon${dType==='pct' ? ` (${dVal}%)` : ''}`;
    document.getElementById('d-discount-val').textContent = '- ' + formatRp(discountAmt);
  } else { discRow.style.display = 'none'; }

  // Tax
  const taxRow = document.getElementById('d-tax-row');
  if (opts.tax && taxAmt > 0) {
    taxRow.style.display = 'flex';
    const tPct = document.getElementById('tax-pct').value;
    document.getElementById('d-tax-lbl').textContent = `PPN (${tPct}%)`;
    document.getElementById('d-tax-val').textContent = formatRp(taxAmt);
  } else { taxRow.style.display = 'none'; }

  document.getElementById('d-total').textContent = formatRp(total);

  // Notes
  const notesBlock = document.getElementById('d-notes-block');
  if (opts.notes && invNotes) {
    notesBlock.classList.add('visible');
    notesBlock.textContent = invNotes;
  } else { notesBlock.classList.remove('visible'); }

  // QRIS — always visible, dynamic or static
  const qrisAmt = document.getElementById('d-qris-amount');
  const qrisLabel = document.getElementById('d-qris-label');
  if (opts['qris-dynamic'] && total > 0) {
    const dynPayload = buildDynamicQris(total);
    drawQrisToCanvas(dynPayload);
    qrisAmt.classList.add('visible');
    qrisAmt.textContent = formatRp(total);
    if (qrisLabel) qrisLabel.textContent = '@mcnsterjae · Dinamis';
  } else {
    drawQrisToCanvas(buildStaticQris());
    qrisAmt.classList.remove('visible');
    if (qrisLabel) qrisLabel.textContent = '@mcnsterjae';
  }

  // Status
  const statusMap = {
    unpaid: { text: 'Menunggu Pembayaran', dot: '', wm: false },
    paid: { text: 'LUNAS', dot: 'paid', wm: true },
    partial: { text: 'Dibayar Sebagian', dot: '', wm: false },
    overdue: { text: 'Jatuh Tempo', dot: '', wm: false },
  };
  const s = statusMap[invStatus] || statusMap.unpaid;
  document.getElementById('d-status-text').textContent = s.text;
  const dot = document.getElementById('d-status-dot');
  dot.className = 'status-dot' + (s.dot ? ' ' + s.dot : '');
  const wm = document.getElementById('inv-watermark');
  if (s.wm) wm.classList.add('visible'); else wm.classList.remove('visible');
}

// ── UTILS ──
function generateInvoiceNumber() {
  const d = new Date();
  const yr = d.getFullYear().toString().slice(2);
  const mo = String(d.getMonth()+1).padStart(2,'0');
  const rand = String(Math.floor(Math.random()*900)+100);
  const num = `INV-${yr}${mo}-${rand}`;
  document.getElementById('inv-number').value = num;
  renderInvoice();
  notify('Nomor invoice baru: ' + num);
}

function copyInvoiceNumber() {
  const num = document.getElementById('inv-number').value;
  if (!num) { notify('Nomor invoice kosong!'); return; }
  navigator.clipboard.writeText(num).then(() => notify('Nomor invoice disalin: ' + num));
}

function printInvoice() {
  document.getElementById('dl-modal').classList.add('show');
}

function closeDlModal(e) {
  if (e.target === document.getElementById('dl-modal')) {
    document.getElementById('dl-modal').classList.remove('show');
  }
}

async function exportAs(format) {
  document.getElementById('dl-modal').classList.remove('show');
  const loading = document.getElementById('export-loading');
  const loadingText = document.getElementById('export-loading-text');
  loading.classList.add('show');
  loadingText.textContent = format === 'pdf' ? 'Membuat PDF...' : 'Membuat gambar PNG...';
  await new Promise(r => setTimeout(r, 150));
  const el = document.getElementById('invoice-doc');
  const invNumber = document.getElementById('inv-number').value || 'invoice';
  try {
    const canvas = await html2canvas(el, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    if (format === 'png') {
      const link = document.createElement('a');
      link.download = invNumber + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      loading.classList.remove('show');
      notify('Invoice berhasil diunduh sebagai PNG!');
    } else {
      const { jsPDF } = window.jspdf;
      const imgData = canvas.toDataURL('image/jpeg', 0.97);
      const pdfW = 210;
      const pdfH = (canvas.height * pdfW) / canvas.width;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfW, pdfH] });
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH, '', 'FAST');
      pdf.save(invNumber + '.pdf');
      loading.classList.remove('show');
      notify('Invoice berhasil diunduh sebagai PDF!');
    }
  } catch (err) {
    loading.classList.remove('show');
    notify('Gagal mengekspor, coba lagi.');
    console.error(err);
  }
}

function resetAll() {
  if (!confirm('Reset semua data? Tindakan ini tidak dapat dibatalkan.')) return;
  items = [];
  qrisDataUrl = null;
  Object.keys(opts).forEach(k => {
    opts[k] = false;
    const tog = document.getElementById('tog-' + k);
    const field = document.getElementById('opt-' + k);
    if (tog) tog.classList.remove('active');
    if (field) field.classList.remove('visible');
  });
  document.querySelectorAll('.sidebar input, .sidebar textarea, .sidebar select').forEach(el => {
    if (el.type === 'date') return;
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });
  // QRIS is hardcoded — no reset needed
  const today = new Date();
  const due = new Date(); due.setDate(due.getDate() + 14);
  document.getElementById('inv-date').value = formatDateInput(today);
  document.getElementById('inv-due').value = formatDateInput(due);
  generateInvoiceNumber();
  addItem();
  renderInvoice();
  notify('Form berhasil direset');
}

function notify(msg) {
  const el = document.getElementById('notif');
  document.getElementById('notif-msg').textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}
