# Reelix

[![Download APK](https://img.shields.io/badge/Download-APK-brightgreen?style=for-the-badge&logo=android)](https://github.com/wooskinner/reelix/releases/latest/download/app.apk)
[![GitHub release](https://img.shields.io/github/v/release/wooskinner/reelix?style=for-the-badge)](https://github.com/wooskinner/reelix/releases)
[![Website](https://img.shields.io/badge/Website-reelix.2bd.net-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white)](https://www.reelix.2bd.net/index.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **Your all-in-one entertainment platform** - Stream, discover, and organize your favorite content seamlessly

---

## 🌐 Official Website
**[www.reelix.2bd.net](https://www.reelix.2bd.net/index.html)** - Visit our website for more information, updates, and web access.

---

## 📱 About The App

**Reelix** is a **modern entertainment web platform** designed to **help you discover, organize, and enjoy digital content** with a clean, intuitive interface. This repository contains the Android APK wrapper for the Reelix web app.

### Key Highlights:
- 🚀 **100% Free** - No ads, no in-app purchases, no hidden costs
- 🔒 **Privacy-First** - All data stays on your device
- 📱 **Lightweight** - Minimal download size
- 🌙 **Modern UI** - Clean design with dark mode support
- ⚡ **Fast & Responsive** - Optimized for all devices

---

## 📸 Screenshots

| Home Screen | Browse | Watch |
|-------------|--------|-------|
| ![Home](screenshots/home.png) | ![Browse](screenshots/browse.png) | ![Watch](screenshots/watch.png) |

*[Replace with your actual screenshots. Create a `screenshots/` folder in your repo and add images]*

---

## ✨ Features

### Core Features
- ✅ **Content Discovery** - Browse and find your favorite content easily
- ✅ **Watchlist** - Save content to watch later
- ✅ **Search** - Find exactly what you're looking for
- ✅ **User Accounts** - Sign up and personalize your experience
- ✅ **Responsive Design** - Works on all screen sizes

### Technical Features
- 📱 **APK Wrapper** - Android app version of the web platform
- 🌐 **PWA Support** - Install as a Progressive Web App
- 🔐 **Secure** - HTTPS with proper security headers
- 📊 **Analytics** - Performance monitoring and optimization
- 🔄 **Auto-Update** - Check for updates on launch

---

## 📥 Download APK

### Option 1: Latest Release (Recommended)
[![Download APK](https://img.shields.io/badge/⬇️_Download_Latest_APK-View_Releases-blue?style=for-the-badge)](https://github.com/wooskinner/reelix/releases/latest)

### Option 2: All Releases
Browse all versions on the [Releases Page](https://github.com/wooskinner/reelix/releases)

### 📋 Download Steps:
1. Go to the [Releases Page](https://github.com/wooskinner/reelix/releases)
2. Find the latest release (tagged with version number)
3. Download the `app.apk` file from the Assets section
4. Open the APK on your Android device
5. Allow installation from unknown sources if prompted
6. Install and enjoy!

---

## 📖 Installation Instructions

### Prerequisites
- Android device running **Android 5.0 (API 21)** or higher
- Enable **"Install from unknown sources"** in your device settings

### Step-by-Step Guide

<details>
<summary><b>📱 Standard Installation</b></summary>

1. **Download the APK** from the [Releases Page](https://github.com/wooskinner/reelix/releases)
2. **Open the file** - Tap on the downloaded APK file
3. **Allow installation** - If prompted, tap "Settings" → enable "Allow from this source"
4. **Install** - Tap "Install" and wait for the process to complete
5. **Open** - Tap "Open" to launch the app
</details>

<details>
<summary><b>⚡ ADB Installation (Developers)</b></summary>

```bash
# Connect your device via USB debugging
adb devices

# Install the APK
adb install app.apk

# Reinstall (if app already exists)
adb install -r app.apk
