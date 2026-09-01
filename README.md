# Fixer — image compressor & image-to-PDF

Fully static, fully client-side. No backend, no build step, no signup. Images never leave the browser.

## What it does
- Drag/drop or pick multiple JPG / PNG / WebP images
- Compress with adjustable quality, max width, and output format
- Download each image, download all as a `.zip`, or stack every image into one `.pdf`

## Run locally
Just open `index.html` in a browser — or serve it:
```
npx serve .
```

## Deploy to Vercel (free)
**Option A — Vercel dashboard (no CLI, easiest):**
1. Go to vercel.com → New Project → "Deploy without Git" / drag-and-drop this whole folder.
2. It auto-detects a static site. Click Deploy. Done — you get a live URL in ~30 seconds.

**Option B — Vercel CLI:**
```
npm i -g vercel
cd fixer
vercel --prod
```

**Option C — GitHub:**
1. Push this folder to a new GitHub repo.
2. On vercel.com → New Project → Import that repo → Deploy (no config needed, it's static).

## Files
```
index.html       structure
css/style.css    styling
js/app.js        compression, zip, and PDF logic
```

## Notes
- Uses the browser's Canvas API for compression — no server, so it scales to unlimited users at $0 cost.
- Uses jsPDF and JSZip from a public CDN (cdnjs) for the PDF/zip features — loaded at runtime, no install needed.
- PNG output is lossless (quality slider only affects JPEG/WebP).
