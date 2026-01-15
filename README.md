# 📚 LibNav - Library Map Navigation System

![LibNav Banner](https://placehold.co/1000x300/0b1121/ffc4d6?text=LibNav+Project)

**LibNav** is a modern, static web application designed to help students and visitors locate books within a library. It is built as a **Single Page Application (SPA)** using pure Vanilla JavaScript, requiring no backend server.

The system is optimized for **Mobile Devices** (PWA support) and **Public Library Kiosks** (Auto-reset & Screensaver features).

## 🚀 Live Demo
[**Click here to view the Live Demo**](https://libnav.vercel.app/)

---

## ✨ Key Features

### 🔍 Smart Search & Navigation
- **Live Search:** Instant filtering by Title or Author.
- **Voice Search 🎤:** Integrated speech-to-text for hands-free searching.
- **Shelf Mapping:** Visual map display showing exactly where the book is located (e.g., Shelf A-12).
- **Shelf Neighbors:** Automatically suggests other books located on the same shelf.

### 👤 User Experience
- **My Favorites ❤️:** Users can bookmark books to a "Favorites" list (saved via LocalStorage).
- **Dark & Light Mode 🌙:** A custom "Cream Pink" & "Deep Navy" theme with smooth toggling.
- **Featured Book:** Randomly suggests a "Book of the Day" on the home screen.
- **Statistics Dashboard 📊:** Visual breakdown of library genres and total books.

### 🖥️ Kiosk Mode (Public Terminal Optimized)
- **Screensaver:** An attract screen ("Touch to Start") activates when the computer is idle.
- **Auto-Reset:** For privacy, the search history and opened modals automatically clear after 30 seconds of inactivity.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
* **Database:** JSON array (simulated database) with `localStorage` for persistence.
* **Icons:** SVG (Scalable Vector Graphics).
* **Deployment:** Static hosting (Vercel, GitHub Pages, Netlify).
* **No Frameworks:** 0% React, 0% Angular, 0% jQuery. Lightweight and fast.

---

## 📸 Screenshots

| Home Screen (Dark) | Search & Filters |
|:---:|:---:|
| ![Home Screen](LibNav/blob/main/Screenshot_20260116-004255.png) | ![Filters](path/to/your/screenshot2.png) |

| Book Details & Map | Statistics Modal |
|:---:|:---:|
| ![Book Details](path/to/your/screenshot3.png) | ![Stats](path/to/your/screenshot4.png) |


---

## 📂 Project Structure

```bash
/
├── index.html       # Main application structure (PWA & SVG definitions)
├── style.css        # Custom CSS variables, animations, and "Cream Pink" theme
├── app.js           # Core logic: Search, Voice, Favorites, Kiosk Timer
├── database.js      # Book data array and local storage handling
├── sw.js            # Service Worker for Offline PWA support
└── manifest.json    # PWA Configuration (Installable App settings)
