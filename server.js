const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const CHANNELS_FILE = path.join(ROOT_DIR, 'channels.json');
const DEFAULT_CHANNELS_FILE = path.join(ROOT_DIR, 'defaultChannels.json');
const CUSTOMERS_FILE = path.join(ROOT_DIR, 'customers.json');

// Path to actual Sazib TV frontend app
const SAZIB_TV_PATH = path.resolve(ROOT_DIR, '../StreamBoxTV/streambox-android-tv/src/defaultChannels.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.m3u': 'application/vnd.apple.mpegurl; charset=utf-8',
  '.m3u8': 'application/vnd.apple.mpegurl; charset=utf-8'
};

function readChannels() {
  if (fs.existsSync(CHANNELS_FILE)) {
    try {
      const raw = fs.readFileSync(CHANNELS_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) return data;
    } catch (e) {
      console.warn('Error reading channels.json, using defaultChannels.json', e.message);
    }
  }

  if (fs.existsSync(DEFAULT_CHANNELS_FILE)) {
    try {
      const raw = fs.readFileSync(DEFAULT_CHANNELS_FILE, 'utf8');
      const data = JSON.parse(raw);
      const normalized = data.map((c, idx) => ({
        id: c.id || `ch-${idx}`,
        name: c.name || 'Unnamed Channel',
        url: c.url || '',
        category: c.group || c.category || 'General',
        group: c.group || c.category || 'General',
        logo: c.logo || '',
        webUrl: c.webUrl || '',
        active: c.active !== undefined ? c.active : true
      }));
      fs.writeFileSync(CHANNELS_FILE, JSON.stringify(normalized, null, 2), 'utf8');
      return normalized;
    } catch (e) {
      console.error('Error reading defaultChannels.json:', e.message);
    }
  }
  return [];
}

function readCustomers() {
  if (fs.existsSync(CUSTOMERS_FILE)) {
    try {
      const raw = fs.readFileSync(CUSTOMERS_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    } catch (e) {
      console.warn('Error reading customers.json:', e.message);
    }
  }
  return [];
}

function writeCustomers(data) {
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(reqUrl.pathname);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Route alias: /customer -> /customer.html
  if (pathname === '/customer') {
    res.writeHead(302, { Location: '/customer.html' });
    return res.end();
  }

  // ==========================================
  // CUSTOMER APIS
  // ==========================================

  // 1. Get All Customers (Admin)
  if (pathname === '/api/customers' && req.method === 'GET') {
    const customers = readCustomers();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(customers));
  }

  // 2. Add / Update Customer (Admin)
  if (pathname === '/api/customers' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const customers = readCustomers();

      if (!body.name || !body.phone) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Name and Phone are required' }));
      }

      if (body.id) {
        // Update
        const idx = customers.findIndex(c => c.id === body.id);
        if (idx !== -1) {
          customers[idx] = { ...customers[idx], ...body, updatedAt: new Date().toISOString() };
        } else {
          customers.unshift(body);
        }
      } else {
        // Create new
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
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 3. Toggle Customer Status (Admin Block / Activate)
  if (pathname === '/api/customers/toggle-status' && req.method === 'POST') {
    try {
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
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 4. Renew Customer Subscription (+Days)
  if (pathname === '/api/customers/renew' && req.method === 'POST') {
    try {
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
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 5. Delete Customer (Admin)
  if (pathname === '/api/customers/delete' && req.method === 'POST') {
    try {
      const { id } = await parseJsonBody(req);
      let customers = readCustomers();
      customers = customers.filter(c => c.id !== id);
      writeCustomers(customers);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 6. Customer Login (Portal)
  if (pathname === '/api/customer/login' && req.method === 'POST') {
    try {
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

      // Check Expiration
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
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // 7. Customer Channels List (Filtered by Customer Plan & Allowed Categories)
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
      customer: {
        name: customer.name,
        plan: customer.plan,
        expiresAt: customer.expiresAt
      },
      count: permitted.length,
      channels: permitted
    }));
  }

  // 8. Dynamic M3U Playlist for Customer IPTV Player (TiviMate, Smarters, VLC)
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

  // ==========================================
  // CHANNEL APIS (ADMIN)
  // ==========================================

  if (pathname === '/api/channels' && req.method === 'GET') {
    const channels = readChannels();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(channels));
  }

  if (pathname === '/api/channels' && req.method === 'POST') {
    try {
      const channels = await parseJsonBody(req);
      if (!Array.isArray(channels)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Expected an array of channels' }));
      }
      fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, count: channels.length }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  if (pathname === '/api/sync-tv' && req.method === 'POST') {
    try {
      let channels = await parseJsonBody(req);
      if (!Array.isArray(channels)) channels = readChannels();

      fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channels, null, 2), 'utf8');

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

      let syncStatus = 'Saved in admin.';
      let targetExists = fs.existsSync(SAZIB_TV_PATH);

      if (targetExists) {
        fs.writeFileSync(SAZIB_TV_PATH, JSON.stringify(formatted, null, 2), 'utf8');
        syncStatus = `Successfully synced ${formatted.length} active channels to Sazib TV app (${SAZIB_TV_PATH})!`;
      } else {
        syncStatus = `Channels saved locally. Note: Target TV path not found at ${SAZIB_TV_PATH}.`;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, message: syncStatus, count: formatted.length }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  if (pathname === '/api/reset-channels' && req.method === 'POST') {
    try {
      if (fs.existsSync(DEFAULT_CHANNELS_FILE)) {
        const raw = fs.readFileSync(DEFAULT_CHANNELS_FILE, 'utf8');
        const data = JSON.parse(raw);
        const normalized = data.map((c, idx) => ({
          id: c.id || `ch-${idx}`,
          name: c.name || 'Unnamed Channel',
          url: c.url || '',
          category: c.group || c.category || 'General',
          group: c.group || c.category || 'General',
          logo: c.logo || '',
          webUrl: c.webUrl || '',
          active: true
        }));
        fs.writeFileSync(CHANNELS_FILE, JSON.stringify(normalized, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, channels: normalized }));
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Default channels file not found' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // ==========================================
  // STATIC FILE SERVING
  // ==========================================
  let filePath = path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallbackPath = path.join(ROOT_DIR, 'sazib-tv-admin', pathname === '/' ? 'index.html' : pathname);
      if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) {
        filePath = fallbackPath;
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 Not Found');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

function startServer(port) {
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n==============================================`);
    console.log(`🚀 Sazib TV Admin Panel & Customer Platform`);
    console.log(`👉 Admin Panel:     ${url}`);
    console.log(`👉 Customer Portal:  ${url}/customer.html`);
    console.log(`==============================================\n`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(PORT);
