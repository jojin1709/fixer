(() => {
  'use strict';

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const controls = document.getElementById('controls');
  const qualitySlider = document.getElementById('quality');
  const qualityValue = document.getElementById('qualityValue');
  const maxWidthSelect = document.getElementById('maxWidth');
  const formatSelect = document.getElementById('format');
  const compressAllBtn = document.getElementById('compressAllBtn');
  const downloadZipBtn = document.getElementById('downloadZipBtn');
  const makePdfBtn = document.getElementById('makePdfBtn');
  const clearBtn = document.getElementById('clearBtn');
  const contactSheet = document.getElementById('contactSheet');
  const framesEl = document.getElementById('frames');
  const sheetSummary = document.getElementById('sheetSummary');

  /** @type {Array<{id:string, file:File, url:string, name:string, originalSize:number, status:'pending'|'done', outputBlob:Blob|null, outputSize:number, outputName:string}>} */
  let items = [];
  let counter = 0;

  const fmtBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const extForMime = (mime) => {
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/png') return 'png';
    return 'img';
  };

  // ---- File intake ----

  browseBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    addFiles(e.target.files);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });
  dropzone.addEventListener('click', (e) => {
    if (e.target === browseBtn) return;
    fileInput.click();
  });

  function addFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;

    files.forEach((file) => {
      counter += 1;
      items.push({
        id: `f${counter}`,
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        originalSize: file.size,
        status: 'pending',
        outputBlob: null,
        outputSize: 0,
        outputName: '',
      });
    });

    controls.hidden = false;
    contactSheet.hidden = false;
    renderFrames();
  }

  // ---- Controls ----

  qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = `${qualitySlider.value}%`;
  });

  clearBtn.addEventListener('click', () => {
    items.forEach((it) => URL.revokeObjectURL(it.url));
    items = [];
    controls.hidden = true;
    contactSheet.hidden = true;
    downloadZipBtn.disabled = true;
    makePdfBtn.disabled = true;
    framesEl.innerHTML = '';
  });

  compressAllBtn.addEventListener('click', async () => {
    compressAllBtn.disabled = true;
    compressAllBtn.textContent = 'Developing…';
    for (const it of items) {
      await compressItem(it);
      renderFrames();
    }
    compressAllBtn.disabled = false;
    compressAllBtn.textContent = 'Develop all';
    const anyDone = items.some((it) => it.status === 'done');
    downloadZipBtn.disabled = !anyDone;
    makePdfBtn.disabled = !anyDone;
  });

  downloadZipBtn.addEventListener('click', async () => {
    const done = items.filter((it) => it.status === 'done');
    if (!done.length || typeof JSZip === 'undefined') return;
    downloadZipBtn.disabled = true;
    downloadZipBtn.textContent = 'Zipping…';
    const zip = new JSZip();
    done.forEach((it) => zip.file(it.outputName, it.outputBlob));
    const blob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(blob, 'fixer-photos.zip');
    downloadZipBtn.disabled = false;
    downloadZipBtn.textContent = 'Download .zip';
  });

  makePdfBtn.addEventListener('click', async () => {
    const done = items.filter((it) => it.status === 'done');
    if (!done.length || typeof window.jspdf === 'undefined') return;
    makePdfBtn.disabled = true;
    makePdfBtn.textContent = 'Stacking…';

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'pt' });
    let first = true;

    for (const it of done) {
      const dataUrl = await blobToDataUrl(it.outputBlob);
      const dims = await imageDims(dataUrl);
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW / dims.w, pageH / dims.h);
      const w = dims.w * ratio;
      const h = dims.h * ratio;
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;

      if (!first) pdf.addPage();
      first = false;

      const format = it.outputBlob.type === 'image/png' ? 'PNG' : 'JPEG';
      pdf.addImage(dataUrl, format, x, y, w, h);
    }

    pdf.save('fixer-contact-sheet.pdf');
    makePdfBtn.disabled = false;
    makePdfBtn.textContent = 'Stack into PDF';
  });

  // ---- Compression core ----

  function compressItem(item) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxW = parseInt(maxWidthSelect.value, 10);
        let { width, height } = img;
        if (maxW && width > maxW) {
          height = Math.round((height * maxW) / width);
          width = maxW;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const mime = formatSelect.value;
        if (mime === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);

        const quality = parseInt(qualitySlider.value, 10) / 100;

        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(); return; }
            item.outputBlob = blob;
            item.outputSize = blob.size;
            const base = item.name.replace(/\.[^.]+$/, '');
            item.outputName = `${base}-fixed.${extForMime(mime)}`;
            item.status = 'done';
            resolve();
          },
          mime,
          mime === 'image/png' ? undefined : quality
        );
      };
      img.onerror = () => resolve();
      img.src = item.url;
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  function imageDims(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.src = src;
    });
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ---- Rendering ----

  function renderFrames() {
    framesEl.innerHTML = '';
    items.forEach((it, idx) => {
      const frame = document.createElement('div');
      frame.className = 'frame';

      const savedPct = it.status === 'done'
        ? Math.max(0, Math.round((1 - it.outputSize / it.originalSize) * 100))
        : null;

      frame.innerHTML = `
        <div class="frame-thumb">
          <img src="${it.url}" alt="${escapeHtml(it.name)}">
          <span class="frame-no">${String(idx + 1).padStart(2, '0')}</span>
          <span class="frame-status ${it.status}">${it.status === 'done' ? 'fixed' : 'pending'}</span>
        </div>
        <div class="frame-body">
          <p class="frame-name">${escapeHtml(it.name)}</p>
          <p class="frame-meta">
            ${fmtBytes(it.originalSize)}${it.status === 'done' ? ` → ${fmtBytes(it.outputSize)} <span class="saved">(-${savedPct}%)</span>` : ''}
          </p>
          <div class="frame-actions">
            <button type="button" class="dl" ${it.status !== 'done' ? 'disabled' : ''}>Download</button>
            <button type="button" class="remove">Remove</button>
          </div>
        </div>
      `;

      frame.querySelector('.dl').addEventListener('click', () => {
        if (it.outputBlob) triggerDownload(it.outputBlob, it.outputName);
      });
      frame.querySelector('.remove').addEventListener('click', () => {
        URL.revokeObjectURL(it.url);
        items = items.filter((x) => x.id !== it.id);
        if (!items.length) {
          controls.hidden = true;
          contactSheet.hidden = true;
        }
        renderFrames();
      });

      framesEl.appendChild(frame);
    });

    const doneCount = items.filter((it) => it.status === 'done').length;
    sheetSummary.textContent = `${items.length} frame${items.length === 1 ? '' : 's'} loaded · ${doneCount} developed`;
    downloadZipBtn.disabled = doneCount === 0;
    makePdfBtn.disabled = doneCount === 0;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
