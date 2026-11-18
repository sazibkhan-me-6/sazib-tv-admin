# 📺 Sazib TV - Admin Control Center & Customer Streaming Platform

A complete IPTV management suite featuring **Channel Management**, **Live Stream Testing**, **Customer & Subscription Control (কাস্টমার কন্ট্রোল)**, and **Customer Streaming Portal with M3U Playlist Integration**.

Designed for [Sazib TV](https://sazib-tv.vercel.app/).

---

## 🚀 Live Access & URLs

- **Admin Control Center:** `http://localhost:3000`
- **Customer Streaming Portal:** `http://localhost:3000/customer.html`
- **Customer M3U Playlist API:** `http://localhost:3000/playlist.m3u?token=CUSTOMER_TOKEN`
- **GitHub Repository:** [sazibkhan-me-6/sazib-tv-admin](https://github.com/sazibkhan-me-6/sazib-tv-admin)

---

## ⚡ How to Run Locally

### With Node.js Server (Recommended)
```bash
npm start
```
Starts server on **`http://localhost:3000`** with real-time API persistence, 1-click Sazib TV sync, and live M3U streaming.

---

## ✨ Key Capabilities

### 1. 🎛️ Admin Control Center
- **Preloaded 153 Sazib TV Channels**: Bangladesh (63), Indian TV (69), Sports (17), Movies (2), News (2).
- **Embedded HLS Live Stream Player**: Test any `.m3u8` or video stream live directly from the table.
- **1-Click Sync to Sazib TV**: Automatically updates `StreamBoxTV/streambox-android-tv/src/defaultChannels.json`.
- **Channel Operations**: Add, edit, delete, toggle active/inactive status with instant search and category filtering.
- **JSON Export & Import**: Export production-ready `defaultChannels.json` or import external playlists.

### 2. 👥 Customer & User Management (কাস্টমার কন্ট্রোল)
- **Customer Directory**: Manage customer names, phone numbers, email, activation codes, and tokens.
- **Subscription Plans**: VIP (All channels), Premium, Sports Special, Free Trial.
- **Instant Renewal**: One-click subscription extension (+30 days, +90 days, +180 days, +1 year).
- **Access Control & Blocking**: Block (🔒) or activate (🟢) any customer instantly.
- **Content Permissions**: Limit customer access to specific categories based on their plan.

### 3. 📱 Customer Streaming Portal (`/customer.html`)
- **Customer Web Player**: Customers can log in using their phone/email and secret activation code to watch live channels.
- **Category Tabs & Search**: Filter channels by categories or search by channel name.
- **Smart TV / IPTV Integration (M3U)**: Every customer gets their personal M3U playlist link for apps like **TiviMate**, **IPTV Smarters**, **Android TV**, and **VLC**.
- **Auto Expiration Protection**: Expired or blocked customers are automatically restricted with renewal prompts.

---

## 🧪 Demo Credentials (For Testing)

| Role | Phone | Activation Code | Plan |
|---|---|---|---|
| **VIP Customer** | `01711223344` | `SZB-8821` | VIP (All 153 Channels) |
| **Premium Customer** | `01812345678` | `SZB-4412` | Premium (Bangladesh, Indian TV, News) |
| **Expired Customer** | `01998765432` | `SZB-1190` | Sports Special (Expired) |
| **Free Trial** | `01655443322` | `SZB-7733` | Free Trial (Bangladesh) |

---

## 🌐 Deploy to Vercel

```bash
vercel --prod
```
The project includes `vercel.json` for seamless zero-config deployment.
