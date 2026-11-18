const fs = require('fs');
const path = require('path');

// On Vercel, root repo is read-only, /tmp is writable
const ROOT_DIR = path.resolve(__dirname, '..');
const TMP_DIR = process.env.VERCEL ? '/tmp' : ROOT_DIR;

const CHANNELS_FILE = path.join(TMP_DIR, 'channels.json');
const DEFAULT_CHANNELS_FILE = path.join(ROOT_DIR, 'defaultChannels.json');
const BUNDLED_CHANNELS_FILE = path.join(ROOT_DIR, 'channels.json');

const CUSTOMERS_FILE = path.join(TMP_DIR, 'customers.json');
const BUNDLED_CUSTOMERS_FILE = path.join(ROOT_DIR, 'customers.json');

function readChannels() {
  if (fs.existsSync(CHANNELS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    } catch (e) {}
  }
  if (fs.existsSync(BUNDLED_CHANNELS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(BUNDLED_CHANNELS_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    } catch (e) {}
  }
  if (fs.existsSync(DEFAULT_CHANNELS_FILE)) {
    try {
      const raw = fs.readFileSync(DEFAULT_CHANNELS_FILE, 'utf8');
      const data = JSON.parse(raw);
      return data.map((c, idx) => ({
        id: c.id || `ch-${idx}`,
        name: c.name || 'Unnamed Channel',
        url: c.url || '',
        category: c.group || c.category || 'General',
        group: c.group || c.category || 'General',
        logo: c.logo || '',
        webUrl: c.webUrl || '',
        active: c.active !== undefined ? c.active : true
      }));
    } catch (e) {}
  }
  return [];
}

function writeChannels(data) {
  try {
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('Could not write channels.json:', e.message);
  }
}

function readCustomers() {
  if (fs.existsSync(CUSTOMERS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8'));
      if (Array.isArray(data)) return data;
    } catch (e) {}
  }
  if (fs.existsSync(BUNDLED_CUSTOMERS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(BUNDLED_CUSTOMERS_FILE, 'utf8'));
      if (Array.isArray(data)) return data;
    } catch (e) {}
  }
  return [];
}

function writeCustomers(data) {
  try {
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('Could not write customers.json:', e.message);
  }
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
  });
}

module.exports = async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(reqUrl.pathname);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // 1. Get All Customers
  if (pathname === '/api/customers' && req.method === 'GET') {
    const customers = readCustomers();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(customers));
  }

  // 2. Add / Update Customer
  if (pathname === '/api/customers' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const customers = readCustomers();

    if (!body.name || !body.phone) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Name and Phone are required' }));
    }

    if (body.id) {
      const idx = customers.findIndex(c => c.id === body.id);
      if (idx !== -1) {
        customers[idx] = { ...customers[idx], ...body, updatedAt: new Date().toISOString() };
      } else {
        customers.unshift(body);
      }
    } else {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const newCustomer = {
        id: `cust-${Date.now()}`,
        name: body.name.trim(),
        phone: body.phone.trim(),
        email: (body.email || '').trim(),
        code: body.code || `SZB-${randomNum}`,
        token: body.token || `tok_${Math.random().toString(36).substr(2, 9)}`,
        plan: body.plan || 'Premium',
        allowedCategories: body.allowedCategories || ['all'],
        status: body.status || 'active',
        expiresAt: body.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        deviceLimit: body.deviceLimit || 2,
        activeDevices: 0,
        createdAt: new Date().toISOString().split('T')[0],
        notes: body.notes || ''
      };
      customers.unshift(newCustomer);
    }

    writeCustomers(customers);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, count: customers.length, customers }));
  }

  // 3. Toggle Customer Status
  if (pathname === '/api/customers/toggle-status' && req.method === 'POST') {
    const { id } = await parseJsonBody(req);
    const customers = readCustomers();
    const c = customers.find(x => x.id === id);
    if (!c) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Customer not found' }));
    }
    c.status = c.status === 'active' ? 'blocked' : 'active';
    writeCustomers(customers);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, status: c.status }));
  }

  // 4. Renew Customer
  if (pathname === '/api/customers/renew' && req.method === 'POST') {
    const { id, days } = await parseJsonBody(req);
    const customers = readCustomers();
    const c = customers.find(x => x.id === id);
    if (!c) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Customer not found' }));
    }
    
    const addDays = parseInt(days, 10) || 30;
    let baseDate = new Date();
    if (c.expiresAt && new Date(c.expiresAt) > baseDate) {
      baseDate = new Date(c.expiresAt);
    }
    baseDate.setDate(baseDate.getDate() + addDays);
    c.expiresAt = baseDate.toISOString().split('T')[0];
    c.status = 'active';

    writeCustomers(customers);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, expiresAt: c.expiresAt }));
  }

  // 5. Delete Customer
  if (pathname === '/api/customers/delete' && req.method === 'POST') {
    const { id } = await parseJsonBody(req);
    let customers = readCustomers();
    customers = customers.filter(c => c.id !== id);
    writeCustomers(customers);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  // 6. Customer Login
  if (pathname === '/api/customer/login' && req.method === 'POST') {
    const { identifier, code } = await parseJsonBody(req);
    const cleanIdent = (identifier || '').trim().toLowerCase();
    const cleanCode = (code || '').trim().toUpperCase();

    const customers = readCustomers();
    const customer = customers.find(c => 
      (c.phone.toLowerCase() === cleanIdent || (c.email && c.email.toLowerCase() === cleanIdent)) &&
      c.code.toUpperCase() === cleanCode
    );

    if (!customer) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Invalid phone/email or activation code.' }));
    }

    const today = new Date().toISOString().split('T')[0];
    const isExpired = customer.expiresAt && customer.expiresAt < today;
    const isBlocked = customer.status === 'blocked';

    if (isBlocked) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        error: 'Your account has been suspended by admin. Please contact support.',
        customer: { name: customer.name, status: 'blocked' }
      }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      isExpired,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        plan: customer.plan,
        expiresAt: customer.expiresAt,
        status: isExpired ? 'expired' : customer.status,
        token: customer.token,
        code: customer.code,
        allowedCategories: customer.allowedCategories || ['all']
      }
    }));
  }

  // 7. Customer Channels
  if (pathname === '/api/customer/channels' && req.method === 'GET') {
    const token = reqUrl.searchParams.get('token');
    const customers = readCustomers();
    const customer = customers.find(c => c.token === token);

    if (!customer) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized: Invalid token' }));
    }

    const today = new Date().toISOString().split('T')[0];
    if (customer.status === 'blocked' || (customer.expiresAt && customer.expiresAt < today)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Subscription expired or inactive', isExpired: true }));
    }

    const allChannels = readChannels().filter(c => c.active !== false);
    const allowed = customer.allowedCategories || ['all'];

    let permitted = allChannels;
    if (!allowed.includes('all')) {
      permitted = allChannels.filter(c => allowed.includes(c.category) || allowed.includes(c.group));
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      customer: { name: customer.name, plan: customer.plan, expiresAt: customer.expiresAt },
      count: permitted.length,
      channels: permitted
    }));
  }

  // 8. Dynamic M3U Playlist
  if ((pathname === '/playlist.m3u' || pathname === '/api/playlist.m3u') && req.method === 'GET') {
    const token = reqUrl.searchParams.get('token');
    const customers = readCustomers();
    const customer = customers.find(c => c.token === token);

    const today = new Date().toISOString().split('T')[0];
    const isInvalid = !customer || customer.status === 'blocked' || (customer.expiresAt && customer.expiresAt < today);

    let m3uContent = '#EXTM3U url-tvg="https://sazib-tv.vercel.app/"\n';

    if (isInvalid) {
      m3uContent += `#EXTINF:-1 tvg-id="expired" tvg-name="Subscription Expired" group-title="Alert",⚠️ Subscription Expired - Contact Admin\nhttps://sazib-tv.vercel.app/\n`;
    } else {
      const allChannels = readChannels().filter(c => c.active !== false);
      const allowed = customer.allowedCategories || ['all'];
      const permitted = allowed.includes('all') 
        ? allChannels 
        : allChannels.filter(c => allowed.includes(c.category) || allowed.includes(c.group));

      for (const ch of permitted) {
        const group = ch.category || ch.group || 'General';
        const logo = ch.logo || '';
        m3uContent += `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}" tvg-logo="${logo}" group-title="${group}",${ch.name}\n${ch.url}\n`;
      }
    }

    res.writeHead(200, {
      'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
      'Content-Disposition': 'inline; filename="sazibtv.m3u"'
    });
    return res.end(m3uContent);
  }

  // 9. Channels API
  if (pathname === '/api/channels' && req.method === 'GET') {
    const channels = readChannels();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(channels));
  }

  if (pathname === '/api/channels' && req.method === 'POST') {
    const channels = await parseJsonBody(req);
    if (!Array.isArray(channels)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Expected an array of channels' }));
    }
    writeChannels(channels);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, count: channels.length }));
  }

  // Fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'API route not found' }));
};
