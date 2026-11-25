/**
 * Sazib TV Admin Control Center
 * Complete Channel & Customer Control Suite
 */

const STORAGE_KEY = 'sazibtv_admin_channels_v3';
const CUST_STORAGE_KEY = 'sazibtv_admin_customers_v2';
const API_URL = '/api/channels';
const API_CUST_URL = '/api/customers';

// Application State
let channels = [];
let filteredChannels = [];
let customers = [];
let filteredCustomers = [];
let isServerMode = false;

// Channel UI State
let currentPage = 1;
let pageSize = 15;
let currentSort = 'default';
let currentCategoryFilter = 'all';
let currentStatusFilter = 'all';
let searchQuery = '';

// Customer UI State
let customerSearchQuery = '';
let customerPlanFilter = 'all';
let customerStatusFilter = 'all';
let selectedCustomerForRenew = null;

// Video Player Instance
let hlsInstance = null;

// DOM Helper
const $ = (id) => document.getElementById(id);

// Safe String Escaping
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = $('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> <span>${esc(message)}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Initialize Application
async function initApp() {
  $('backend-status-text').textContent = 'Connecting...';
  
  // Try loading channels & customers from API
  try {
    const [chRes, custRes] = await Promise.all([
      fetch(API_URL),
      fetch(API_CUST_URL)
    ]);

    if (chRes.ok) {
      const data = await chRes.json();
      if (Array.isArray(data) && data.length > 0) {
        channels = data;
        isServerMode = true;
        setServerStatus(true);
        saveToLocalStorage(STORAGE_KEY, channels);
      }
    }

    if (custRes.ok) {
      const custData = await custRes.json();
      if (Array.isArray(custData)) {
        customers = custData;
        saveToLocalStorage(CUST_STORAGE_KEY, customers);
      }
    }
  } catch (err) {
    console.log('Backend API unreachable, running in Local / Offline Mode.');
  }

  // Fallback to local storage or bundled files if API failed
  if (!channels || channels.length === 0) {
    const localChannels = loadFromLocalStorage(STORAGE_KEY);
    if (localChannels && localChannels.length > 0) {
      channels = localChannels;
    } else if (window.INITIAL_CHANNELS && window.INITIAL_CHANNELS.length > 0) {
      channels = window.INITIAL_CHANNELS;
      saveToLocalStorage(STORAGE_KEY, channels);
    } else {
      try {
        const res = await fetch('defaultChannels.json');
        if (res.ok) {
          const data = await res.json();
          channels = data.map((c, idx) => ({
            id: c.id || `ch-${idx}`,
            name: c.name || 'Unnamed Channel',
            url: c.url || '',
            category: c.group || c.category || 'General',
            group: c.group || c.category || 'General',
            logo: c.logo || '',
            webUrl: c.webUrl || '',
            active: c.active !== undefined ? c.active : true
          }));
          saveToLocalStorage(STORAGE_KEY, channels);
        }
      } catch (e) {
        channels = [];
      }
    }
  }

  if (!customers || customers.length === 0) {
    const localCust = loadFromLocalStorage(CUST_STORAGE_KEY);
    if (localCust && localCust.length > 0) {
      customers = localCust;
    } else if (window.INITIAL_CUSTOMERS && window.INITIAL_CUSTOMERS.length > 0) {
      customers = window.INITIAL_CUSTOMERS;
      saveToLocalStorage(CUST_STORAGE_KEY, customers);
    } else {
      try {
        const res = await fetch('customers.json');
        if (res.ok) {
          customers = await res.json();
          saveToLocalStorage(CUST_STORAGE_KEY, customers);
        }
      } catch (e) {
        customers = [];
      }
    }
  }

  if (!isServerMode) setServerStatus(false);

  setupCategoriesDatalist();
  render();
  renderCustomers();
}

function setServerStatus(online) {
  const dot = document.querySelector('.status-dot');
  const text = $('backend-status-text');
  const label = $('app-mode-label');

  if (online) {
    if (dot) dot.style.background = '#10b981';
    if (text) text.textContent = 'Server Online (Port 3000)';
    if (label) {
      label.textContent = 'Node Server API Connected';
      label.className = 'badge badge-server';
    }
  } else {
    if (dot) dot.style.background = '#f59e0b';
    if (text) text.textContent = 'Browser Standalone Mode';
    if (label) {
      label.textContent = 'Standalone Browser Mode';
      label.className = 'badge badge-local';
    }
  }
}

function loadFromLocalStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}

// Persist Channels
async function persistChannels(silent = false) {
  saveToLocalStorage(STORAGE_KEY, channels);

  if (isServerMode) {
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channels)
      });
      if (!silent) showToast('Channels saved to server!', 'success');
    } catch (err) {
      if (!silent) showToast('Saved locally in browser', 'info');
    }
  } else {
    if (!silent) showToast('Saved to browser storage', 'success');
  }

  setupCategoriesDatalist();
  render();
}

// Persist Customers
async function persistCustomers(silent = false) {
  saveToLocalStorage(CUST_STORAGE_KEY, customers);

  if (isServerMode) {
    try {
      await fetch(API_CUST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customers)
      });
      if (!silent) showToast('Customers saved to server!', 'success');
    } catch (err) {
      if (!silent) showToast('Saved locally in browser', 'info');
    }
  } else {
    if (!silent) showToast('Saved to browser storage', 'success');
  }

  renderCustomers();
}

// ==========================================
// CUSTOMER MANAGEMENT LOGIC
// ==========================================

function renderCustomers() {
  const today = new Date().toISOString().split('T')[0];

  // 1. Filter
  filteredCustomers = customers.filter(c => {
    const q = customerSearchQuery;
    const nameMatch = (c.name || '').toLowerCase().includes(q);
    const phoneMatch = (c.phone || '').toLowerCase().includes(q);
    const emailMatch = (c.email || '').toLowerCase().includes(q);
    const codeMatch = (c.code || '').toLowerCase().includes(q);
    const matched = nameMatch || phoneMatch || emailMatch || codeMatch;

    const planMatched = customerPlanFilter === 'all' || c.plan === customerPlanFilter;

    let statusMatched = true;
    const isExpired = c.expiresAt && c.expiresAt < today;
    if (customerStatusFilter === 'active') statusMatched = c.status === 'active' && !isExpired;
    if (customerStatusFilter === 'expired') statusMatched = isExpired || c.status === 'expired';
    if (customerStatusFilter === 'blocked') statusMatched = c.status === 'blocked';

    return matched && planMatched && statusMatched;
  });

  // 2. Stats
  $('cust-total').textContent = customers.length;
  $('cust-active').textContent = customers.filter(c => c.status === 'active' && (!c.expiresAt || c.expiresAt >= today)).length;

  const rows = $('cust-rows');
  const empty = $('cust-empty');

  if (filteredCustomers.length === 0) {
    rows.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  rows.innerHTML = filteredCustomers.map(c => {
    const isExpired = c.expiresAt && c.expiresAt < today;
    const isBlocked = c.status === 'blocked';
    
    // Status text & badge
    let statusBadge = '<span class="status">🟢 Active</span>';
    if (isBlocked) {
      statusBadge = '<span class="status off" style="color:#ef4444; background:#fef2f2;">⚪ Blocked</span>';
    } else if (isExpired) {
      statusBadge = '<span class="status off" style="color:#b91c1c; background:#fee2e2;">🔴 Expired</span>';
    }

    // Days calculation
    let daysHtml = '';
    if (c.expiresAt) {
      const diffTime = new Date(c.expiresAt) - new Date(today);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        daysHtml = `<span class="days-left days-expired">Expired ${Math.abs(diffDays)}d ago</span>`;
      } else if (diffDays <= 7) {
        daysHtml = `<span class="days-left days-warning">${diffDays} days left</span>`;
      } else {
        daysHtml = `<span class="days-left days-active">${diffDays} days left</span>`;
      }
    }

    const planClass = `plan-${c.plan?.replace(/\s+/g, '') || 'Premium'}`;
    const initial = (c.name || 'U').charAt(0).toUpperCase();
    const origin = window.location.origin;
    const m3uUrl = `${origin}/playlist.m3u?token=${c.token || 'tok_' + c.id}`;

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="cust-avatar">${initial}</div>
            <div>
              <strong style="display:block; color:#0f172a;">${esc(c.name)}</strong>
              <small style="color:#64748b;">${c.email ? esc(c.email) : 'No email'}</small>
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight:600; color:#334155;">${esc(c.phone)}</div>
          <div style="margin-top:2px;">
            <span class="cust-code-badge" title="Customer Activation Code">${esc(c.code || 'N/A')}</span>
          </div>
        </td>
        <td>
          <span class="plan-badge ${planClass}">${esc(c.plan || 'Standard')}</span>
        </td>
        <td>
          <span style="font-size:12px; color:#475569; font-weight:500;">
            ${(c.allowedCategories || ['all']).includes('all') ? `All Channels (${channels.length})` : (c.allowedCategories || []).join(', ')}
          </span>
        </td>
        <td>
          <span style="font-weight:600; font-size:13px;">${c.expiresAt || 'Lifetime'}</span>
          ${daysHtml}
        </td>
        <td>
          <div onclick="toggleCustomerStatus('${c.id}')" style="cursor:pointer;" title="Click to Toggle Block/Active">
            ${statusBadge}
          </div>
        </td>
        <td>
          <div class="actions">
            <button onclick="openRenewModal('${c.id}')" title="Renew Subscription" style="background:#ecfdf5; color:#047857; border-color:#a7f3d0;">
              🔄 Renew
            </button>
            <button onclick="copyCustomerM3u('${m3uUrl}')" title="Copy IPTV M3U URL">
              📋 M3U
            </button>
            <button onclick="editCustomer('${c.id}')" title="Edit Customer Details">
              ✏️
            </button>
            <button onclick="toggleCustomerStatus('${c.id}')" title="${isBlocked ? 'Unblock' : 'Block'} Customer">
              ${isBlocked ? '🔓' : '🔒'}
            </button>
            <button class="btn-del" onclick="deleteCustomer('${c.id}')" title="Delete Customer">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function handleCustomerSearch() {
  customerSearchQuery = $('cust-search').value.trim().toLowerCase();
  $('clear-cust-search').hidden = customerSearchQuery.length === 0;
  renderCustomers();
}

function clearCustomerSearch() {
  $('cust-search').value = '';
  handleCustomerSearch();
}

function handleCustomerFilters() {
  customerPlanFilter = $('cust-filter-plan').value;
  customerStatusFilter = $('cust-filter-status').value;
  renderCustomers();
}

// Customer Modal (Add / Edit)
function openCustomerModal(c = null) {
  $('custForm').reset();
  $('cust-id').value = c?.id || '';
  $('cust-name').value = c?.name || '';
  $('cust-phone').value = c?.phone || '';
  $('cust-email').value = c?.email || '';
  $('cust-plan').value = c?.plan || 'VIP';
  $('cust-devices').value = c?.deviceLimit || 2;
  $('cust-status').value = c?.status || 'active';
  $('cust-notes').value = c?.notes || '';

  if (c?.expiresAt) {
    $('cust-expiry').value = c.expiresAt;
  } else {
    setExpiryQuick(30);
  }

  $('cust-code').value = c?.code || `SZB-${Math.floor(1000 + Math.random() * 9000)}`;
  $('custModalTitle').textContent = c ? 'Edit Customer' : 'Add New Customer';
  $('customerModal').classList.add('show');
}

function closeCustomerModal() {
  $('customerModal').classList.remove('show');
}

function setExpiryQuick(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  $('cust-expiry').value = d.toISOString().split('T')[0];
}

function editCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (c) openCustomerModal(c);
}

function copyCustomerM3u(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast('Customer IPTV M3U URL copied!', 'success');
  });
}

async function toggleCustomerStatus(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;

  c.status = c.status === 'active' ? 'blocked' : 'active';
  persistCustomers(true);
  showToast(`Customer "${c.name}" is now ${c.status === 'active' ? 'Active' : 'Blocked'}`, 'info');
}

async function deleteCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;

  if (confirm(`Are you sure you want to remove customer "${c.name}"?`)) {
    customers = customers.filter(x => x.id !== id);
    persistCustomers();
    showToast(`Removed customer "${c.name}"`, 'info');
  }
}

// Renew Modal Handlers
function openRenewModal(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  selectedCustomerForRenew = c;
  $('renew-cust-name').textContent = c.name;
  $('renew-current-expiry').textContent = `Current Expiry: ${c.expiresAt || 'N/A'}`;
  $('renewModal').classList.add('show');
}

function closeRenewModal() {
  selectedCustomerForRenew = null;
  $('renewModal').classList.remove('show');
}

function executeRenew(days) {
  if (!selectedCustomerForRenew) return;
  const c = selectedCustomerForRenew;

  let baseDate = new Date();
  if (c.expiresAt && new Date(c.expiresAt) > baseDate) {
    baseDate = new Date(c.expiresAt);
  }
  baseDate.setDate(baseDate.getDate() + days);
  c.expiresAt = baseDate.toISOString().split('T')[0];
  c.status = 'active';

  persistCustomers();
  showToast(`Renewed "${c.name}" until ${c.expiresAt}!`, 'success');
  closeRenewModal();
}

// Save Customer Form Submission
$('custForm').onsubmit = e => {
  e.preventDefault();

  const id = $('cust-id').value.trim();
  const name = $('cust-name').value.trim();
  const phone = $('cust-phone').value.trim();
  const email = $('cust-email').value.trim();
  const plan = $('cust-plan').value;
  const deviceLimit = parseInt($('cust-devices').value, 10);
  const expiresAt = $('cust-expiry').value;
  const code = $('cust-code').value.trim() || `SZB-${Math.floor(1000 + Math.random() * 9000)}`;
  const status = $('cust-status').value;
  const notes = $('cust-notes').value.trim();

  let allowedCategories = ['all'];
  if (plan === 'Free') allowedCategories = ['Bangladesh'];
  if (plan === 'Sports Special') allowedCategories = ['Sports', 'Bangladesh'];
  if (plan === 'Premium') allowedCategories = ['Bangladesh', 'Indian TV', 'News'];

  const custObj = {
    id: id || `cust-${Date.now()}`,
    name,
    phone,
    email,
    plan,
    allowedCategories,
    status,
    expiresAt,
    deviceLimit,
    activeDevices: 0,
    code,
    token: id ? (customers.find(x => x.id === id)?.token || `tok_${Date.now()}`) : `tok_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    createdAt: new Date().toISOString().split('T')[0],
    notes
  };

  if (id) {
    const idx = customers.findIndex(x => x.id === id);
    if (idx !== -1) {
      customers[idx] = { ...customers[idx], ...custObj };
      showToast(`Updated customer "${name}"`, 'success');
    }
  } else {
    customers.unshift(custObj);
    showToast(`Added customer "${name}"`, 'success');
  }

  persistCustomers();
  closeCustomerModal();
};

// ==========================================
// CHANNELS LOGIC
// ==========================================

function render() {
  filteredChannels = channels.filter(c => {
    const nameMatch = (c.name || '').toLowerCase().includes(searchQuery);
    const catMatch = (c.category || c.group || '').toLowerCase().includes(searchQuery);
    const urlMatch = (c.url || '').toLowerCase().includes(searchQuery);
    const queryMatched = nameMatch || catMatch || urlMatch;

    const cat = c.category || c.group || 'General';
    const categoryMatched = currentCategoryFilter === 'all' || cat === currentCategoryFilter;

    let statusMatched = true;
    if (currentStatusFilter === 'on') statusMatched = !!c.active;
    if (currentStatusFilter === 'off') statusMatched = !c.active;

    return queryMatched && categoryMatched && statusMatched;
  });

  if (currentSort === 'name-asc') {
    filteredChannels.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (currentSort === 'name-desc') {
    filteredChannels.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  } else if (currentSort === 'cat-asc') {
    filteredChannels.sort((a, b) => (a.category || a.group || '').localeCompare(b.category || b.group || ''));
  }

  $('total').textContent = channels.length;
  $('enabled').textContent = channels.filter(c => c.active !== false).length;

  const allCategories = [...new Set(channels.map(c => c.category || c.group || 'General'))].filter(Boolean);

  renderCategoryFilterOptions(allCategories);
  renderCategoriesGrid(allCategories);

  const totalItems = filteredChannels.length;
  const isAll = pageSize === 'all';
  const effectivePageSize = isAll ? Math.max(1, totalItems) : parseInt(pageSize, 10);
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = isAll ? 0 : (currentPage - 1) * effectivePageSize;
  const endIndex = isAll ? totalItems : Math.min(startIndex + effectivePageSize, totalItems);
  const pageItems = filteredChannels.slice(startIndex, endIndex);

  const rowsEl = $('rows');
  const emptyEl = $('empty');

  if (totalItems === 0) {
    rowsEl.innerHTML = '';
    emptyEl.hidden = false;
    $('pagination').style.display = 'none';
  } else {
    emptyEl.hidden = true;
    $('pagination').style.display = 'flex';

    rowsEl.innerHTML = pageItems.map(c => {
      const cat = c.category || c.group || 'General';
      const isActive = c.active !== false;
      const logoHtml = c.logo
        ? `<img src="${esc(c.logo)}" alt="${esc(c.name)}" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'placeholder\\'>▶</div>'">`
        : `<div class="placeholder">▶</div>`;

      return `
        <tr>
          <td>
            <div class="channel">
              ${logoHtml}
              <div>
                <span>${esc(c.name)}</span>
                ${c.webUrl ? `<small style="display:block"><a href="${esc(c.webUrl)}" target="_blank" style="color:#64748b;font-size:11px;text-decoration:none">Web link ↗</a></small>` : ''}
              </div>
            </div>
          </td>
          <td>
            <span class="cat-badge" onclick="filterByCategory('${esc(cat)}')">${esc(cat)}</span>
          </td>
          <td class="url" title="${esc(c.url)}">
            ${esc(c.url)}
          </td>
          <td>
            <span class="status ${isActive ? '' : 'off'}" onclick="toggleStatus('${c.id}')" title="Click to toggle status">
              ${isActive ? '🟢 Active' : '⚪ Hidden'}
            </span>
          </td>
          <td>
            <div class="actions">
              <button class="btn-play" onclick="playChannelStream('${c.id}')" title="Test & Watch Stream">
                ▶ Test
              </button>
              <button onclick="editChannel('${c.id}')" title="Edit details">
                ✏️ Edit
              </button>
              <button onclick="toggleStatus('${c.id}')" title="Toggle visibility">
                ${isActive ? 'Hide' : 'Show'}
              </button>
              <button class="btn-del" onclick="deleteChannel('${c.id}')" title="Delete channel">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    $('page-info').textContent = `Showing ${totalItems === 0 ? 0 : startIndex + 1}-${endIndex} of ${totalItems} channels`;
    $('current-page-tag').textContent = `Page ${currentPage} of ${totalPages}`;
    $('btn-prev').disabled = currentPage <= 1;
    $('btn-next').disabled = currentPage >= totalPages;
  }
}

function renderCategoryFilterOptions(cats) {
  const select = $('filter-cat');
  let html = `<option value="all">All Categories (${channels.length})</option>`;
  cats.sort().forEach(c => {
    const count = channels.filter(x => (x.category || x.group) === c).length;
    html += `<option value="${esc(c)}" ${c === currentCategoryFilter ? 'selected' : ''}>${esc(c)} (${count})</option>`;
  });
  select.innerHTML = html;
}

function renderCategoriesGrid(cats) {
  const container = $('categorylist');
  if (!container) return;

  if (cats.length === 0) {
    container.innerHTML = '<p class="note">No categories found.</p>';
    return;
  }

  container.innerHTML = cats.sort().map(c => {
    const count = channels.filter(x => (x.category || x.group) === c).length;
    return `
      <div class="catcard" onclick="filterByCategory('${esc(c)}')">
        <strong>${esc(c)}</strong>
        <span class="catcount">${count} channels</span>
      </div>
    `;
  }).join('');
}

function setupCategoriesDatalist() {
  const datalist = $('category-datalist');
  if (!datalist) return;
  const cats = [...new Set(channels.map(c => c.category || c.group || 'General'))].filter(Boolean);
  datalist.innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
}

function handleSearch() {
  searchQuery = $('search').value.trim().toLowerCase();
  $('clear-search').hidden = searchQuery.length === 0;
  currentPage = 1;
  render();
}

function clearSearch() {
  $('search').value = '';
  handleSearch();
}

function handleCategoryFilter() {
  currentCategoryFilter = $('filter-cat').value;
  currentPage = 1;
  render();
}

function filterByCategory(cat) {
  currentCategoryFilter = cat;
  $('filter-cat').value = cat;
  window.location.hash = '#channels';
  currentPage = 1;
  render();
  showToast(`Filtered by: ${cat}`, 'info');
}

function handleFilter() {
  currentStatusFilter = $('filter').value;
  currentPage = 1;
  render();
}

function handleSort() {
  currentSort = $('sort-by').value;
  currentPage = 1;
  render();
}

function handlePageSize() {
  pageSize = $('page-size').value;
  currentPage = 1;
  render();
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    render();
    window.scrollTo({ top: $('channels').offsetTop - 30, behavior: 'smooth' });
  }
}

function nextPage() {
  currentPage++;
  render();
  window.scrollTo({ top: $('channels').offsetTop - 30, behavior: 'smooth' });
}

function openModal(channel = null) {
  $('form').reset();
  $('id').value = channel?.id || '';
  $('name').value = channel?.name || '';
  $('category').value = channel?.category || channel?.group || 'Bangladesh';
  $('url').value = channel?.url || '';
  $('logo').value = channel?.logo || '';
  $('webUrl').value = channel?.webUrl || '';
  $('active').checked = channel?.active !== undefined ? channel.active : true;

  previewModalLogo();
  $('modalTitle').textContent = channel ? 'Edit Channel' : 'Add New Channel';
  $('modal').classList.add('show');
}

function closeModal() {
  $('modal').classList.remove('show');
}

function previewModalLogo() {
  const url = $('logo').value.trim();
  const img = $('logo-preview-img');
  if (url) {
    img.src = url;
    img.style.display = 'block';
    img.onerror = () => { img.style.display = 'none'; };
  } else {
    img.style.display = 'none';
  }
}

function editChannel(id) {
  const c = channels.find(x => x.id === id);
  if (c) openModal(c);
}

function toggleStatus(id) {
  const c = channels.find(x => x.id === id);
  if (c) {
    c.active = c.active === false ? true : false;
    persistChannels(true);
    showToast(`"${c.name}" is now ${c.active ? 'Active' : 'Hidden'}`, 'info');
  }
}

function deleteChannel(id) {
  const c = channels.find(x => x.id === id);
  if (!c) return;

  if (confirm(`Are you sure you want to delete "${c.name}"?`)) {
    channels = channels.filter(x => x.id !== id);
    persistChannels();
    showToast(`Deleted "${c.name}"`, 'info');
  }
}

$('form').onsubmit = e => {
  e.preventDefault();

  const id = $('id').value.trim();
  const name = $('name').value.trim();
  const category = $('category').value.trim();
  const url = $('url').value.trim();
  const logo = $('logo').value.trim();
  const webUrl = $('webUrl').value.trim();
  const active = $('active').checked;

  if (!name || !url || !category) {
    showToast('Name, Category, and Stream URL are required', 'error');
    return;
  }

  const channelObj = {
    id: id || `ch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    name,
    category,
    group: category,
    url,
    logo,
    webUrl,
    active
  };

  if (id) {
    const idx = channels.findIndex(x => x.id === id);
    if (idx !== -1) {
      channels[idx] = channelObj;
      showToast(`Updated "${name}"`, 'success');
    }
  } else {
    channels.unshift(channelObj);
    showToast(`Added channel "${name}"`, 'success');
  }

  persistChannels();
  closeModal();
};

function playChannelStream(id) {
  const c = channels.find(x => x.id === id);
  if (!c) return;

  $('playerTitle').textContent = c.name;
  $('playerCategory').textContent = `${c.category || c.group} • Live Stream Test`;
  $('playerUrlDisplay').value = c.url;

  const logoImg = $('playerLogo');
  if (c.logo) {
    logoImg.src = c.logo;
    logoImg.style.display = 'block';
  } else {
    logoImg.style.display = 'none';
  }

  loadStream(c.url);
  $('playerModal').classList.add('show');
}

function testCurrentModalStream() {
  const url = $('url').value.trim();
  const name = $('name').value.trim() || 'Stream Test';
  if (!url) {
    showToast('Please enter a Stream URL first', 'error');
    return;
  }
  $('playerTitle').textContent = name;
  $('playerCategory').textContent = 'Testing Stream URL';
  $('playerUrlDisplay').value = url;
  $('playerLogo').style.display = 'none';

  loadStream(url);
  $('playerModal').classList.add('show');
}

function loadStream(url) {
  const video = $('videoPlayer');
  const overlay = $('playerStatus');
  const statusText = $('playerStatusText');

  overlay.style.display = 'flex';
  statusText.textContent = 'Connecting to stream...';

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  video.pause();
  video.removeAttribute('src');
  video.load();

  if (window.Hls && Hls.isSupported()) {
    hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 10 });
    hlsInstance.loadSource(url);
    hlsInstance.attachMedia(video);

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      overlay.style.display = 'none';
      video.play().catch(() => {
        statusText.textContent = 'Autoplay prevented. Click Play on video.';
        overlay.style.display = 'flex';
      });
    });

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        statusText.textContent = 'Stream unavailable or CORS blocked.';
        overlay.style.display = 'flex';
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
      overlay.style.display = 'none';
      video.play();
    });
  }
}

function closePlayerModal() {
  const video = $('videoPlayer');
  if (video) {
    video.pause();
    video.removeAttribute('src');
  }
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  $('playerModal').classList.remove('show');
}

function copyPlayerUrl() {
  const input = $('playerUrlDisplay');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => {
    showToast('Stream URL copied to clipboard!', 'success');
  });
}

async function syncWithTvApp() {
  showToast('Syncing with Sazib TV...', 'info');

  if (isServerMode) {
    try {
      const res = await fetch('/api/sync-tv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(channels)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Synced with Sazib TV successfully!', 'success');
      } else {
        showToast(`Sync failed: ${data.error}`, 'error');
      }
    } catch (err) {
      downloadSazibTvJson();
    }
  } else {
    downloadSazibTvJson();
  }
}

function downloadSazibTvJson() {
  const formatted = channels
    .filter(c => c.active !== false)
    .map(c => ({
      id: c.id,
      name: c.name,
      url: c.url,
      group: c.category || c.group || 'General',
      logo: c.logo || '',
      ...(c.webUrl ? { webUrl: c.webUrl } : {})
    }));

  const blob = new Blob([JSON.stringify(formatted, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'defaultChannels.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Exported ${formatted.length} channels as defaultChannels.json`, 'success');
}

function openExportModal() {
  downloadSazibTvJson();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) {
        showToast('Invalid file: Expected array of channels', 'error');
        return;
      }
      const imported = data.map((c, idx) => ({
        id: c.id || `imp-${idx}-${Date.now()}`,
        name: c.name || 'Unnamed Channel',
        url: c.url || '',
        category: c.group || c.category || 'General',
        group: c.group || c.category || 'General',
        logo: c.logo || '',
        webUrl: c.webUrl || '',
        active: c.active !== undefined ? c.active : true
      }));

      const existingIds = new Set(channels.map(x => x.id));
      let added = 0;
      imported.forEach(ch => {
        if (!existingIds.has(ch.id)) {
          channels.push(ch);
          added++;
        }
      });
      persistChannels();
      showToast(`Imported ${added} new channels!`, 'success');
    } catch (err) {
      showToast('Error parsing file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

async function resetToDefaults() {
  if (!confirm('Reset all channels to original Sazib TV defaults (153 channels)?')) return;

  if (isServerMode) {
    try {
      const res = await fetch('/api/reset-channels', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.channels) {
        channels = data.channels;
        persistChannels(true);
        showToast('Reset to official 153 Sazib TV channels!', 'success');
        return;
      }
    } catch (e) {}
  }

  try {
    const res = await fetch('defaultChannels.json');
    if (res.ok) {
      const data = await res.json();
      channels = data.map((c, idx) => ({
        id: c.id || `ch-${idx}`,
        name: c.name || 'Unnamed Channel',
        url: c.url || '',
        category: c.group || c.category || 'General',
        group: c.group || c.category || 'General',
        logo: c.logo || '',
        webUrl: c.webUrl || '',
        active: true
      }));
      persistChannels(true);
      showToast('Reset to original default channels!', 'success');
    }
  } catch (err) {
    showToast('Could not reload defaultChannels.json', 'error');
  }
}

// Global Nav Links
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
  });
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal();
    closePlayerModal();
    closeCustomerModal();
    closeRenewModal();
    if (typeof closeAddAdminModal === 'function') closeAddAdminModal();
  }
});

// ==========================================
// ADMIN CONTROL SYSTEM (AUTH, ROLES, MASTER SWITCHES, AUDIT LOGS)
// ==========================================
const ADMIN_USERS_KEY = 'sazibtv_admin_users_v1';
const ADMIN_SESSION_KEY = 'sazibtv_admin_session_v1';
const ADMIN_SETTINGS_KEY = 'sazibtv_admin_settings_v1';
const ADMIN_LOGS_KEY = 'sazibtv_admin_logs_v1';

const DEFAULT_ADMINS = [
  {
    id: 'adm-super-1',
    name: 'Sazib Khan',
    username: 'admin',
    password: 'sazib2026',
    role: 'Super Admin',
    status: 'active',
    isPrimary: true
  }
];

const DEFAULT_ADMIN_SETTINGS = {
  maintenanceMode: false,
  maintenanceMessage: 'System is under scheduled maintenance. We will be back shortly!',
  masterStreaming: true,
  showDemoAccounts: true,
  announcementEnabled: false,
  announcementText: '',
  supportContact: 'WhatsApp: +8801711-000000'
};

let adminUsers = [];
let currentAdmin = null;
let adminSettings = { ...DEFAULT_ADMIN_SETTINGS };
let auditLogs = [];

function loadAdminUsers() {
  try {
    const raw = localStorage.getItem(ADMIN_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(DEFAULT_ADMINS));
  return JSON.parse(JSON.stringify(DEFAULT_ADMINS));
}

function saveAdminUsers() {
  localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(adminUsers));
  renderAdminUsers();
}

function loadAdminSettings() {
  try {
    const raw = localStorage.getItem(ADMIN_SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_ADMIN_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {}
  return { ...DEFAULT_ADMIN_SETTINGS };
}

function loadAuditLogs() {
  try {
    const raw = localStorage.getItem(ADMIN_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function logAdminAction(action, details) {
  const entry = {
    time: new Date().toLocaleString(),
    admin: currentAdmin ? currentAdmin.username : 'system',
    action,
    details
  };
  auditLogs.unshift(entry);
  if (auditLogs.length > 100) auditLogs = auditLogs.slice(0, 100);
  localStorage.setItem(ADMIN_LOGS_KEY, JSON.stringify(auditLogs));
  renderAuditLogs();
}

function fillDefaultAdminLogin() {
  const u = $('admin-login-user');
  const p = $('admin-login-pass');
  if (u) u.value = 'admin';
  if (p) p.value = 'sazib2026';
}

function showAdminGate() {
  const screen = $('admin-login-screen');
  if (screen) screen.classList.remove('hidden');
}

function hideAdminGate() {
  const screen = $('admin-login-screen');
  if (screen) screen.classList.add('hidden');
}

function updateSidebarAdminProfile() {
  if (!currentAdmin) return;
  const nameEl = $('current-admin-name');
  const roleEl = $('current-admin-role');
  if (nameEl) nameEl.textContent = currentAdmin.name;
  if (roleEl) roleEl.textContent = currentAdmin.role;
}

function adminLogout() {
  logAdminAction('LOGOUT', `Admin "${currentAdmin?.username || 'admin'}" signed out`);
  currentAdmin = null;
  localStorage.removeItem(ADMIN_SESSION_KEY);
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  showAdminGate();
  showToast('Admin Panel locked safely', 'info');
}

function applySettingsToUI() {
  if ($('ctrl-maintenance')) $('ctrl-maintenance').checked = !!adminSettings.maintenanceMode;
  if ($('ctrl-streaming')) $('ctrl-streaming').checked = adminSettings.masterStreaming !== false;
  if ($('ctrl-demo-mode')) $('ctrl-demo-mode').checked = adminSettings.showDemoAccounts !== false;
  if ($('ctrl-maintenance-msg')) $('ctrl-maintenance-msg').value = adminSettings.maintenanceMessage || '';
  if ($('ctrl-announce-on')) $('ctrl-announce-on').checked = !!adminSettings.announcementEnabled;
  if ($('ctrl-announce-text')) $('ctrl-announce-text').value = adminSettings.announcementText || '';
  if ($('ctrl-support-contact')) $('ctrl-support-contact').value = adminSettings.supportContact || '';
}

async function saveAdminSettings(showSuccessToast = false) {
  adminSettings = {
    maintenanceMode: $('ctrl-maintenance') ? $('ctrl-maintenance').checked : false,
    masterStreaming: $('ctrl-streaming') ? $('ctrl-streaming').checked : true,
    showDemoAccounts: $('ctrl-demo-mode') ? $('ctrl-demo-mode').checked : true,
    maintenanceMessage: $('ctrl-maintenance-msg') ? $('ctrl-maintenance-msg').value.trim() : '',
    announcementEnabled: $('ctrl-announce-on') ? $('ctrl-announce-on').checked : false,
    announcementText: $('ctrl-announce-text') ? $('ctrl-announce-text').value.trim() : '',
    supportContact: $('ctrl-support-contact') ? $('ctrl-support-contact').value.trim() : '',
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(adminSettings));

  if (isServerMode) {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminSettings)
      });
    } catch (e) {}
  }

  logAdminAction(
    'SETTINGS_UPDATED',
    `Maintenance: ${adminSettings.maintenanceMode ? 'ON' : 'OFF'}, Streaming: ${adminSettings.masterStreaming ? 'ON' : 'OFF'}, Announcement: ${adminSettings.announcementEnabled ? 'ON' : 'OFF'}`
  );
  showToast(showSuccessToast ? 'Settings saved & broadcast to Customer Portal!' : 'Platform control updated!', 'success');
}

function bulkSetChannelsStatus(active) {
  const label = active ? 'enable' : 'disable';
  if (!confirm(`Are you sure you want to ${label} ALL ${channels.length} channels?`)) return;
  channels.forEach(c => { c.active = active; });
  persistChannels(true);
  logAdminAction('BULK_CHANNELS', `${active ? 'Enabled' : 'Disabled'} all ${channels.length} channels`);
  showToast(`All ${channels.length} channels ${active ? 'enabled' : 'disabled'}!`, 'success');
}

function renderAdminUsers() {
  const tbody = $('admin-users-rows');
  if (!tbody) return;
  tbody.innerHTML = adminUsers.map(u => {
    const roleClass = u.role === 'Super Admin' ? 'role-super' : u.role === 'Channel Manager' ? 'role-manager' : 'role-support';
    const isActive = u.status !== 'suspended';
    const isSelf = currentAdmin && currentAdmin.id === u.id;
    return `
      <tr>
        <td><strong>${esc(u.name)}</strong> ${isSelf ? '<small style="color:#2563eb;">(You)</small>' : ''}</td>
        <td><span class="cust-code-badge">${esc(u.username)}</span></td>
        <td><span class="role-badge ${roleClass}">${esc(u.role)}</span></td>
        <td>
          <span class="status ${isActive ? '' : 'off'}" ${u.isPrimary ? '' : `onclick="toggleAdminUserStatus('${u.id}')"`}>
            ${isActive ? '🟢 Active' : '⚪ Suspended'}
          </span>
        </td>
        <td>
          <div class="actions">
            ${u.isPrimary
              ? '<span style="font-size:12px; color:#64748b;">Primary Protected</span>'
              : `<button onclick="toggleAdminUserStatus('${u.id}')">${isActive ? '🔒 Suspend' : '🔓 Activate'}</button>
                 <button class="btn-del" onclick="deleteAdminUser('${u.id}')">🗑️</button>`
            }
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openAddAdminModal() {
  const form = $('addAdminForm');
  if (form) form.reset();
  if ($('addAdminModal')) $('addAdminModal').classList.add('show');
}

function closeAddAdminModal() {
  if ($('addAdminModal')) $('addAdminModal').classList.remove('show');
}

function toggleAdminUserStatus(id) {
  const u = adminUsers.find(x => x.id === id);
  if (!u || u.isPrimary) return;
  u.status = u.status === 'suspended' ? 'active' : 'suspended';
  saveAdminUsers();
  logAdminAction('ADMIN_STATUS', `${u.username} set to ${u.status}`);
  showToast(`Admin "${u.username}" is now ${u.status}`, 'info');
}

function deleteAdminUser(id) {
  const u = adminUsers.find(x => x.id === id);
  if (!u || u.isPrimary) return;
  if (!confirm(`Delete admin account "${u.name}" (${u.username})?`)) return;
  adminUsers = adminUsers.filter(x => x.id !== id);
  saveAdminUsers();
  logAdminAction('ADMIN_DELETED', `Deleted staff admin "${u.username}"`);
  showToast(`Removed admin "${u.username}"`, 'info');
}

function renderAuditLogs() {
  const tbody = $('audit-log-rows');
  if (!tbody) return;
  if (auditLogs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#64748b; padding:18px;">No activity logs recorded yet.</td></tr>';
    return;
  }
  tbody.innerHTML = auditLogs.map(l => `
    <tr>
      <td style="font-size:12px; color:#64748b;">${esc(l.time)}</td>
      <td><strong>${esc(l.admin)}</strong></td>
      <td><span class="log-action-badge">${esc(l.action)}</span></td>
      <td style="font-size:13px; color:#334155;">${esc(l.details)}</td>
    </tr>
  `).join('');
}

function clearAuditLogs() {
  if (!confirm('Clear all admin activity audit logs?')) return;
  auditLogs = [];
  localStorage.setItem(ADMIN_LOGS_KEY, '[]');
  renderAuditLogs();
  showToast('Audit logs cleared', 'info');
}

function exportAuditLogs() {
  const blob = new Blob([JSON.stringify(auditLogs, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sazibtv-audit-logs-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Exported admin audit logs!', 'success');
}

function initAdminControl() {
  adminUsers = loadAdminUsers();
  adminSettings = loadAdminSettings();
  auditLogs = loadAuditLogs();

  // Check existing session
  const savedSession = localStorage.getItem(ADMIN_SESSION_KEY) || sessionStorage.getItem(ADMIN_SESSION_KEY);
  if (savedSession) {
    try {
      const parsed = JSON.parse(savedSession);
      const valid = adminUsers.find(u => u.id === parsed.id && u.status !== 'suspended');
      if (valid) {
        currentAdmin = valid;
        hideAdminGate();
        updateSidebarAdminProfile();
      } else {
        showAdminGate();
      }
    } catch (e) {
      showAdminGate();
    }
  } else {
    showAdminGate();
  }

  // Bind Admin Login Form
  const loginForm = $('admin-login-form');
  if (loginForm) {
    loginForm.onsubmit = e => {
      e.preventDefault();
      const username = $('admin-login-user').value.trim().toLowerCase();
      const password = $('admin-login-pass').value;
      const remember = $('admin-login-remember').checked;
      const errBox = $('admin-login-error');

      const matched = adminUsers.find(u => u.username.toLowerCase() === username && u.password === password);
      if (!matched) {
        errBox.textContent = 'Invalid username or password. Please try again.';
        errBox.hidden = false;
        return;
      }
      if (matched.status === 'suspended') {
        errBox.textContent = 'This admin account is suspended by Super Admin.';
        errBox.hidden = false;
        return;
      }

      errBox.hidden = true;
      currentAdmin = matched;
      const payload = JSON.stringify({ id: matched.id, username: matched.username });
      if (remember) localStorage.setItem(ADMIN_SESSION_KEY, payload);
      else sessionStorage.setItem(ADMIN_SESSION_KEY, payload);

      hideAdminGate();
      updateSidebarAdminProfile();
      logAdminAction('LOGIN', `Signed in as ${matched.username} (${matched.role})`);
      showToast(`Welcome back, ${matched.name}!`, 'success');
    };
  }

  // Bind Change Password Form
  const pwForm = $('change-password-form');
  if (pwForm) {
    pwForm.onsubmit = e => {
      e.preventDefault();
      if (!currentAdmin) return;
      const oldPw = $('sec-old-pass').value;
      const newPw = $('sec-new-pass').value;
      const confirmPw = $('sec-confirm-pass').value;

      if (oldPw !== currentAdmin.password) {
        showToast('Current password is incorrect!', 'error');
        return;
      }
      if (newPw !== confirmPw) {
        showToast('New passwords do not match!', 'error');
        return;
      }

      const idx = adminUsers.findIndex(u => u.id === currentAdmin.id);
      if (idx !== -1) {
        adminUsers[idx].password = newPw;
        currentAdmin.password = newPw;
        saveAdminUsers();
        pwForm.reset();
        logAdminAction('PASSWORD_CHANGED', `Updated password for ${currentAdmin.username}`);
        showToast('Admin password updated successfully!', 'success');
      }
    };
  }

  // Bind Add Sub-Admin Form
  const addAdminForm = $('addAdminForm');
  if (addAdminForm) {
    addAdminForm.onsubmit = e => {
      e.preventDefault();
      const name = $('new-admin-name').value.trim();
      const username = $('new-admin-username').value.trim().toLowerCase();
      const password = $('new-admin-password').value;
      const role = $('new-admin-role').value;

      if (adminUsers.some(u => u.username.toLowerCase() === username)) {
        showToast('Username already exists!', 'error');
        return;
      }

      adminUsers.push({
        id: `adm-${Date.now()}`,
        name,
        username,
        password,
        role,
        status: 'active',
        isPrimary: false
      });
      saveAdminUsers();
      closeAddAdminModal();
      logAdminAction('ADMIN_CREATED', `Created ${role} account "${username}"`);
      showToast(`Added ${role}: ${name}`, 'success');
    };
  }

  applySettingsToUI();
  renderAdminUsers();
  renderAuditLogs();
}

// Boot Application
window.addEventListener('DOMContentLoaded', () => {
  initAdminControl();
  initApp();
});
