> [!NOTE]
> **[Fixer is live on GitHub Pages](https://jojin1709.github.io/fixer/)** — Compress images & compile PDFs right in your browser with zero data uploads.

<div align="center">

# ◐ Fixer

### In-Browser Image Compressor, HEIC Converter & PDF Stack Builder

**Shrink the file. Keep the shot. 100% private, client-side photo processing powered by HTML5 Canvas.**

[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-24292e?style=for-the-badge&logo=github)](https://jojin1709.github.io/fixer/)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-JOJIN%20JOHN-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/jojin-john/)
[![License: MIT](https://img.shields.io/badge/License-MIT-dc9138?style=for-the-badge)](LICENSE)
[![Zero Backend](https://img.shields.io/badge/Backend-None%20(100%25%20Local)-3c665e?style=for-the-badge)](#privacy--zero-upload-guarantee)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable%20%26%20Offline-f0aa52?style=for-the-badge)](#pwa--offline-mode)

---

<a href="https://jojin1709.github.io/fixer/"><img src="https://img.shields.io/badge/Open%20Live%20App-Fixer-dc9138?style=for-the-badge&logo=googlechrome&logoColor=white" height="38"></a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://www.linkedin.com/in/jojin-john/"><img src="https://img.shields.io/badge/Connect%20on-LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" height="38"></a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a href="https://github.com/jojin1709/fixer"><img src="https://img.shields.io/badge/GitHub-Repository-1c1d22?style=for-the-badge&logo=github&logoColor=white" height="38"></a>

---

</div>

> [!TIP]
> **Privacy First:** Fixer executes re-encoding, ZIP compression, and PDF generation entirely inside your browser's local memory sandbox. Your photos never leave your device.

## Table of Contents

- [What is Fixer?](#what-is-fixer)
- [Why Fixer Exists](#why-fixer-exists)
- [Key Features](#key-features)
- [Architecture & Workflow](#architecture--workflow)
- [Use Fixer Live](#use-fixer-live)
- [PWA & Offline Mode](#pwa--offline-mode)
- [Privacy & Zero-Upload Guarantee](#privacy--zero-upload-guarantee)
- [Common Questions](#common-questions)
- [Developer](#developer)
- [License](#license)

---

## What is Fixer?

**Fixer** is a client-side web application designed to compress high-resolution images, convert iPhone HEIC/HEIF files, and compile photo contact sheets into multi-page PDF documents without requiring a backend server or subscriptions.

Built with a vintage darkroom visual theme, Fixer uses the browser's native **HTML5 Canvas 2D API** for image re-encoding, **jsPDF** for PDF document compilation, and **JSZip** for bulk archive downloads.

### Why Fixer Exists

Most online image compressors upload your sensitive personal photos, documents, and receipts to third-party cloud servers. This exposes users to privacy risks, bandwidth bottlenecks, and arbitrary upload size caps.

Fixer solves this by doing all the heavy lifting directly on your computer or phone CPU:
- **Zero latency uploads**: Instant local processing.
- **Zero cloud storage costs**: Runs indefinitely for free on static hosting.
- **Total privacy**: Nothing is sent over the network.

---

## Key Features

| Feature | Description |
|---|---|
| 🎚️ **Dual Compression Modes** | Choose between standard **Quality Percentage (10% - 95%)** or **Target File Size Mode** (binary searches optimal quality to match target KB/MB). |
| 🔄 **Image Rotate & Flip** | Rotate 90° left/right and flip horizontally directly on each frame before developing or exporting to PDF. |
| ✂️ **Aspect Ratio Cropper** | Built-in photo cropper with Freeform, 1:1 Square, 4:5 Instagram, 16:9 Banner, and 4:3 Photo presets. |
| 🏷️ **Custom Text Watermarking** | Stamp customizable text watermarks (position, opacity, font size) directly onto photos during compression. |
| 📋 **One-Click Copy to Clipboard** | Copy developed photos straight to your system clipboard to paste directly into WhatsApp, Discord, or Slack. |
| 📑 **Advanced PDF Stack Builder** | Configure page orientation (Auto/Portrait/Landscape), custom layouts (1-fit, 1-fill, 2×2 grid, 3×3 grid), margins, and page numbers. |
| 📱 **iPhone HEIC/HEIF Decoding** | Automatic in-browser decoding and conversion of iOS `.heic` and `.heif` photos to standard web formats via `heic2any`. |
| 🚀 **AVIF Format Support** | Next-generation AVIF export for superior compression ratios alongside WebP, JPEG, and lossless PNG. |
| 🔒 **100% EXIF Privacy Shield** | In-browser canvas sandbox automatically purges all embedded GPS coordinates, camera serials, and device metadata. |
| 🔍 **Interactive Before/After Slider** | Split-view comparison modal to inspect visual compression loss and verify exact file savings in real time. |
| 📦 **Batch Development & ZIP Export** | Process up to 50 images in a single roll, with individual or bulk `.zip` download support. |
| 📶 **PWA & 100% Offline Capability** | Service Worker precaches all core assets and CDN libraries for complete offline functionality. |
| ⚡ **Local Lifetime Savings Tracker** | Client-side `localStorage` counter tracking cumulative megabytes saved across sessions. |

---

## Architecture & Workflow

```text
  ┌──────────────────────────────────────────────────────────┐
  │                    User File Drop                        │
  │     (JPG / PNG / WebP / iPhone HEIC up to 50 files)      │
  └────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
  ┌──────────────────────────────────────────────────────────┐
  │           Client-Side Preprocessing & Safety             │
  │   - >20MB memory warning toast                           │
  │   - HEIC -> JPEG blob conversion (heic2any)              │
  └────────────────────────────┬─────────────────────────────┘
                               │
                               ▼
  ┌──────────────────────────────────────────────────────────┐
  │              Canvas 2D Engine Re-encoding                │
  │  - Max width proportional downscaling                    │
  │  - Quality % mode OR Target Size binary search           │
  │  - Try/catch isolation per frame (fault tolerant)        │
  └────────────────────────────┬─────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
     │ Single File │    │   JSZip     │    │   jsPDF     │
     │  Download   │    │ Bulk .ZIP   │    │ Stacked PDF │
     └─────────────┘    └─────────────┘    └─────────────┘
```

---

## Use Fixer Live

Fixer is fully deployed and accessible in any modern desktop or mobile browser. No installation, signup, or command-line setup is required:

👉 **[Launch Fixer at jojin1709.github.io/fixer](https://jojin1709.github.io/fixer/)**

1. Open the URL above.
2. Drag and drop your photos (JPG, PNG, WebP, or iPhone HEIC).
3. Adjust quality or set your target size in KB.
4. Download compressed files, bulk ZIP, or stack everything into a single PDF.

---

## PWA & Offline Mode

Fixer is configured as a standalone **Progressive Web App**:
- Click the **Install** icon in Chrome/Edge/Safari address bar to install Fixer as a native desktop or mobile application.
- The included [sw.js](sw.js) caches all application code, fonts, and external libraries (`jspdf`, `jszip`, `heic2any`) so Fixer works seamlessly even without an internet connection.

---

## Privacy & Zero-Upload Guarantee

> [!IMPORTANT]
> **No Analytics · No Tracking · No Server Uploads**
> 
> All file reading is performed via the browser's native `FileReader` and `URL.createObjectURL()`. All recompression is computed on an off-screen HTML5 `<canvas>`. At no point in time are image bytes transmitted across a network socket.

---

## Common Questions

### How does Target Size Mode work?
When you set a target size (e.g. `200 KB`), Fixer performs an automated binary search over the Canvas compression quality parameter (from `0.05` to `0.98` across ~7 iterations) until it produces an output blob closest to your specified byte limit.

### Are my images compressed losslessly or lossily?
- **JPEG & WebP**: Lossy compression with user-defined quality factor and optional max width downscaling.
- **PNG**: Lossless re-encoding (preserves full alpha transparency; dimension resizing can still reduce file size).

### Why does Fixer warn on files larger than 20MB?
Browsers allocate uncompressed RGBA pixel buffers in RAM for each Canvas operation (a 24-megapixel photo requires ~96MB of raw RAM). The 20MB warning is a safeguard to prevent browser tabs from freezing on mobile or lower-spec devices.

## Developer

Developed with ◐ by **[JOJIN JOHN](https://www.linkedin.com/in/jojin-john/)**

- 💼 **LinkedIn**: [linkedin.com/in/jojin-john](https://www.linkedin.com/in/jojin-john/)
- 🐙 **GitHub**: [@jojin1709](https://github.com/jojin1709)

---

## License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for more information.

<p align="center">
  <b>Fixer — Developed by <a href="https://www.linkedin.com/in/jojin-john/">JOJIN JOHN</a></b>
</p>
