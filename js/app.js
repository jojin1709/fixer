(() => {
  'use strict';

  // ---- Service Worker Registration (PWA & Offline) ----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('ServiceWorker registration failed:', err);
      });
    });
  }

  // ---- DOM Elements ----
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const controls = document.getElementById('controls');
  const modeQualityBtn = document.getElementById('modeQualityBtn');
  const modeTargetBtn = document.getElementById('modeTargetBtn');
  const groupQuality = document.getElementById('groupQuality');
  const groupTarget = document.getElementById('groupTarget');
  const qualitySlider = document.getElementById('quality');
  const qualityValue = document.getElementById('qualityValue');
  const targetSizeInput = document.getElementById('targetSize');
  const targetUnitSelect = document.getElementById('targetUnit');
  const maxWidthSelect = document.getElementById('maxWidth');
  const formatSelect = document.getElementById('format');
  const compressAllBtn = document.getElementById('compressAllBtn');
  const downloadZipBtn = document.getElementById('downloadZipBtn');
  const makePdfBtn = document.getElementById('makePdfBtn');
  const clearBtn = document.getElementById('clearBtn');
  const batchProgress = document.getElementById('batchProgress');
  const batchProgressFill = document.getElementById('batchProgressFill');
  const batchProgressText = document.getElementById('batchProgressText');
  const batchProgressPct = document.getElementById('batchProgressPct');
  const contactSheet = document.getElementById('contactSheet');
  const framesEl = document.getElementById('frames');
  const sheetSummary = document.getElementById('sheetSummary');
  const toastContainer = document.getElementById('toastContainer');
  const liveAnnouncer = document.getElementById('liveAnnouncer');
  const savingsBadge = document.getElementById('savingsBadge');

  // Compare Modal Elements
  const compareModal = document.getElementById('compareModal');
  const compareTitle = document.getElementById('compareTitle');
  const compareMeta = document.getElementById('compareMeta');
  const compareBeforeImg = document.getElementById('compareBeforeImg');
  const compareAfterImg = document.getElementById('compareAfterImg');
  const compareAfterWrap = document.getElementById('compareAfterWrap');
  const compareSliderLine = document.getElementById('compareSliderLine');
  const compareStage = document.getElementById('compareStage');
  const closeCompareBtn = document.getElementById('closeCompareBtn');
  const compareDoneBtn = document.getElementById('compareDoneBtn');

  // ---- State ----
  /**
   * @type {Array<{
   *   id: string,
   *   file: File|Blob,
   *   url: string,
   *   name: string,
   *   originalSize: number,
   *   status: 'pending'|'processing'|'done'|'failed',
   *   outputBlob: Blob|null,
   *   outputUrl: string|null,
   *   outputSize: number,
   *   outputName: string,
   *   errorReason?: string
   * }>}
   */
  let items = [];
  let counter = 0;
  let currentMode = 'quality'; // 'quality' | 'target'
  let draggedItemIndex = null;

  const MAX_BATCH_FILES = 50;
  const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024; // 20MB
  const LIFETIME_SAVINGS_KEY = 'fixer_lifetime_saved_bytes';

  // ---- Format & Storage Helpers ----

  const fmtBytes = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0 B';
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

  const getLifetimeSavings = () => {
    try {
      return parseInt(localStorage.getItem(LIFETIME_SAVINGS_KEY) || '0', 10);
    } catch {
      return 0;
    }
  };

  const addLifetimeSavings = (savedDelta) => {
    if (savedDelta <= 0) return;
    try {
      const current = getLifetimeSavings();
      const next = current + savedDelta;
      localStorage.setItem(LIFETIME_SAVINGS_KEY, String(next));
      updateSavingsBadge();
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  };

  const updateSavingsBadge = () => {
    if (!savingsBadge) return;
    const total = getLifetimeSavings();
    savingsBadge.textContent = `⚡ ${fmtBytes(total)} saved locally`;
  };

  updateSavingsBadge();

  // ---- Accessibility & Toast Notifications ----

  const announce = (message) => {
    if (liveAnnouncer) {
      liveAnnouncer.textContent = '';
      setTimeout(() => {
        liveAnnouncer.textContent = message;
      }, 50);
    }
  };

  const showToast = (message, type = 'info', duration = 4000) => {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';
    if (type === 'success') icon = '✓';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-msg">${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  };

  // ---- Mode Switcher ----

  modeQualityBtn.addEventListener('click', () => {
    currentMode = 'quality';
    modeQualityBtn.classList.add('active');
    modeTargetBtn.classList.remove('active');
    groupQuality.hidden = false;
    groupTarget.hidden = true;
  });

  modeTargetBtn.addEventListener('click', () => {
    currentMode = 'target';
    modeTargetBtn.classList.add('active');
    modeQualityBtn.classList.remove('active');
    groupQuality.hidden = true;
    groupTarget.hidden = false;
  });

  // ---- File Intake & HEIC Conversion ----

  browseBtn.addEventListener('click', () => fileInput.click());

  // Keyboard accessibility for Dropzone
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files) addFiles(e.target.files);
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
    if (e.dataTransfer && e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  });

  dropzone.addEventListener('click', (e) => {
    if (e.target === browseBtn) return;
    fileInput.click();
  });

  const isHeic = (file) => {
    const name = (file.name || '').toLowerCase();
    const type = (file.type || '').toLowerCase();
    return name.endsWith('.heic') || name.endsWith('.heif') || type.includes('heic') || type.includes('heif');
  };

  async function addFiles(fileList) {
    let files = Array.from(fileList).filter((f) => f.type.startsWith('image/') || isHeic(f));
    if (!files.length) {
      showToast('No supported image files found in selection.', 'warning');
      return;
    }

    // Safety guard 1: Cap batch at MAX_BATCH_FILES
    if (items.length + files.length > MAX_BATCH_FILES) {
      const allowed = Math.max(0, MAX_BATCH_FILES - items.length);
      if (allowed === 0) {
        showToast(`Roll limit reached (${MAX_BATCH_FILES} photos max). Clear roll first.`, 'warning');
        return;
      }
      showToast(`Batch cap is ${MAX_BATCH_FILES} photos. Only adding next ${allowed} file(s).`, 'warning');
      files = files.slice(0, allowed);
    }

    for (const file of files) {
      // Safety guard 2: Warn for files > 20MB
      if (file.size > LARGE_FILE_THRESHOLD) {
        showToast(`Large file: "${file.name}" is ${fmtBytes(file.size)}. Developing may take a moment.`, 'warning', 5000);
      }

      counter += 1;
      const itemId = `f${counter}`;

      // Check HEIC / HEIF
      if (isHeic(file)) {
        if (typeof window.heic2any === 'function') {
          showToast(`Converting iPhone HEIC photo "${file.name}" to JPG...`, 'info', 3000);
          try {
            const convertedBlob = await window.heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.95
            });
            const actualBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
            
            items.push({
              id: itemId,
              file: actualBlob,
              url: URL.createObjectURL(actualBlob),
              name: newName,
              originalSize: file.size,
              status: 'pending',
              outputBlob: null,
              outputUrl: null,
              outputSize: 0,
              outputName: '',
            });
          } catch (heicErr) {
            console.error('HEIC decode failed:', heicErr);
            showToast(`iPhone HEIC photo "${file.name}" couldn't be decoded. Please convert to JPG first.`, 'error', 6000);
            items.push({
              id: itemId,
              file,
              url: '',
              name: file.name,
              originalSize: file.size,
              status: 'failed',
              outputBlob: null,
              outputUrl: null,
              outputSize: 0,
              outputName: '',
              errorReason: "HEIC format couldn't be decoded in browser"
            });
          }
        } else {
          showToast("iPhone HEIC photos aren't supported in-browser — convert to JPG first.", 'warning', 6000);
          items.push({
            id: itemId,
            file,
            url: '',
            name: file.name,
            originalSize: file.size,
            status: 'failed',
            outputBlob: null,
            outputUrl: null,
            outputSize: 0,
            outputName: '',
            errorReason: "HEIC decoder unavailable"
          });
        }
      } else {
        items.push({
          id: itemId,
          file,
          url: URL.createObjectURL(file),
          name: file.name,
          originalSize: file.size,
          status: 'pending',
          outputBlob: null,
          outputUrl: null,
          outputSize: 0,
          outputName: '',
        });
      }
    }

    controls.hidden = false;
    contactSheet.hidden = false;
    renderFrames();
    announce(`${files.length} photo${files.length === 1 ? '' : 's'} added to contact sheet.`);
  }

  // ---- Controls ----

  qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = `${qualitySlider.value}%`;
  });

  clearBtn.addEventListener('click', () => {
    items.forEach((it) => {
      if (it.url) URL.revokeObjectURL(it.url);
      if (it.outputUrl) URL.revokeObjectURL(it.outputUrl);
    });
    items = [];
    controls.hidden = true;
    contactSheet.hidden = true;
    batchProgress.hidden = true;
    downloadZipBtn.disabled = true;
    makePdfBtn.disabled = true;
    framesEl.innerHTML = '';
    announce('Contact sheet cleared.');
  });

  compressAllBtn.addEventListener('click', async () => {
    const pendingItems = items.filter((it) => it.status !== 'failed');
    if (!pendingItems.length) return;

    compressAllBtn.disabled = true;
    compressAllBtn.textContent = 'Developing…';
    batchProgress.hidden = false;

    let processedCount = 0;
    let totalSavedInBatch = 0;
    const totalToProcess = items.length;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.status === 'failed') continue;

      it.status = 'processing';
      renderFrames();

      const pct = Math.round((processedCount / totalToProcess) * 100);
      batchProgressFill.style.width = `${pct}%`;
      batchProgressPct.textContent = `${pct}%`;
      batchProgressText.textContent = `Developing ${i + 1} of ${totalToProcess}: ${it.name}`;

      const saved = await compressItem(it);
      totalSavedInBatch += saved;
      processedCount++;

      renderFrames();
    }

    batchProgressFill.style.width = '100%';
    batchProgressPct.textContent = '100%';
    batchProgressText.textContent = `Completed ${processedCount} photos`;

    setTimeout(() => {
      batchProgress.hidden = true;
    }, 1500);

    compressAllBtn.disabled = false;
    compressAllBtn.textContent = 'Develop all';
    
    const anyDone = items.some((it) => it.status === 'done');
    downloadZipBtn.disabled = !anyDone;
    makePdfBtn.disabled = !anyDone;

    if (totalSavedInBatch > 0) {
      addLifetimeSavings(totalSavedInBatch);
      showToast(`Batch developed! Saved ${fmtBytes(totalSavedInBatch)} on this run.`, 'success');
    }

    announce(`Batch complete. ${items.filter((x) => x.status === 'done').length} photos developed.`);
  });

  downloadZipBtn.addEventListener('click', async () => {
    const done = items.filter((it) => it.status === 'done');
    if (!done.length || typeof window.JSZip === 'undefined') return;
    downloadZipBtn.disabled = true;
    downloadZipBtn.textContent = 'Zipping…';
    try {
      const zip = new window.JSZip();
      done.forEach((it) => zip.file(it.outputName, it.outputBlob));
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerDownload(blob, 'fixer-photos.zip');
      showToast('Zip archive downloaded.', 'success');
    } catch (err) {
      console.error('Zip creation failed:', err);
      showToast('Failed to create zip archive.', 'error');
    } finally {
      downloadZipBtn.disabled = false;
      downloadZipBtn.textContent = 'Download .zip';
    }
  });

  makePdfBtn.addEventListener('click', async () => {
    const done = items.filter((it) => it.status === 'done');
    if (!done.length || typeof window.jspdf === 'undefined') return;
    makePdfBtn.disabled = true;
    makePdfBtn.textContent = 'Stacking…';

    try {
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
      showToast('PDF created and downloaded.', 'success');
      announce('PDF stacked and downloaded.');
    } catch (err) {
      console.error('PDF generation error:', err);
      showToast('Failed to build PDF.', 'error');
    } finally {
      makePdfBtn.disabled = false;
      makePdfBtn.textContent = 'Stack into PDF';
    }
  });

  // ---- Compression Core with Target Size Binary Search & Safety Guards ----

  /**
   * Compresses a single item based on active settings.
   * Returns saved byte delta (positive if saved, 0 otherwise).
   */
  async function compressItem(item) {
    if (!item.url) {
      item.status = 'failed';
      item.errorReason = 'Missing image source';
      return 0;
    }

    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = async () => {
          try {
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

            let chosenBlob = null;

            if (currentMode === 'target' && mime !== 'image/png') {
              // Mode 2: Target File Size via Binary Search on quality
              const unitMultiplier = targetUnitSelect.value === 'MB' ? 1024 * 1024 : 1024;
              const targetBytes = Math.max(1024, (parseFloat(targetSizeInput.value) || 300) * unitMultiplier);

              let low = 0.05;
              let high = 0.98;
              let bestBlob = null;

              for (let step = 0; step < 7; step++) {
                const mid = (low + high) / 2;
                const blob = await canvasToBlobAsync(canvas, mime, mid);
                if (!blob) break;

                bestBlob = blob;
                if (blob.size > targetBytes) {
                  high = mid; // Too large, reduce quality
                } else {
                  low = mid;  // Can try higher quality
                }
              }
              chosenBlob = bestBlob;
            } else {
              // Mode 1: Quality %
              const quality = parseInt(qualitySlider.value, 10) / 100;
              chosenBlob = await canvasToBlobAsync(canvas, mime, mime === 'image/png' ? undefined : quality);
            }

            if (!chosenBlob) {
              item.status = 'failed';
              item.errorReason = 'Canvas encoding failed';
              resolve(0);
              return;
            }

            if (item.outputUrl) URL.revokeObjectURL(item.outputUrl);
            item.outputBlob = chosenBlob;
            item.outputUrl = URL.createObjectURL(chosenBlob);
            item.outputSize = chosenBlob.size;
            const base = item.name.replace(/\.[^.]+$/, '');
            item.outputName = `${base}-fixed.${extForMime(mime)}`;
            item.status = 'done';

            const savedBytes = Math.max(0, item.originalSize - item.outputSize);
            resolve(savedBytes);
          } catch (canvasErr) {
            console.error(`Error processing image ${item.name}:`, canvasErr);
            item.status = 'failed';
            item.errorReason = canvasErr.message || 'Image processing error';
            resolve(0);
          }
        };

        img.onerror = (err) => {
          console.error(`Image load failed for ${item.name}:`, err);
          item.status = 'failed';
          item.errorReason = 'Corrupt or unreadable image';
          resolve(0);
        };

        img.src = item.url;
      } catch (err) {
        console.error(`Unhandled error during compression of ${item.name}:`, err);
        item.status = 'failed';
        item.errorReason = 'Unexpected failure';
        resolve(0);
      }
    });
  }

  function canvasToBlobAsync(canvas, mime, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), mime, quality);
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

  // ---- Before / After Compare Modal ----

  function openCompareModal(item) {
    if (!item || !item.outputUrl || !item.url) return;

    compareTitle.textContent = `Compare: ${item.name}`;
    const savedPct = Math.max(0, Math.round((1 - item.outputSize / item.originalSize) * 100));
    compareMeta.textContent = `Original: ${fmtBytes(item.originalSize)}  →  Developed: ${fmtBytes(item.outputSize)} (-${savedPct}%)`;

    compareBeforeImg.src = item.url;
    compareAfterImg.src = item.outputUrl;

    // Reset slider to 50%
    setCompareSplit(50);

    compareModal.hidden = false;
  }

  function closeCompare() {
    compareModal.hidden = true;
  }

  closeCompareBtn.addEventListener('click', closeCompare);
  compareDoneBtn.addEventListener('click', closeCompare);

  compareModal.addEventListener('click', (e) => {
    if (e.target === compareModal) closeCompare();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !compareModal.hidden) {
      closeCompare();
    }
  });

  function setCompareSplit(pct) {
    const clamped = Math.max(0, Math.min(100, pct));
    compareAfterWrap.style.width = `${clamped}%`;
    compareSliderLine.style.left = `${clamped}%`;
  }

  let isComparing = false;
  const updateSplitFromEvent = (e) => {
    const rect = compareStage.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const pct = (x / rect.width) * 100;
    setCompareSplit(pct);
  };

  compareStage.addEventListener('mousedown', (e) => {
    isComparing = true;
    updateSplitFromEvent(e);
  });
  window.addEventListener('mousemove', (e) => {
    if (isComparing) updateSplitFromEvent(e);
  });
  window.addEventListener('mouseup', () => {
    isComparing = false;
  });

  compareStage.addEventListener('touchstart', (e) => {
    isComparing = true;
    updateSplitFromEvent(e);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (isComparing) updateSplitFromEvent(e);
  }, { passive: true });
  window.addEventListener('touchend', () => {
    isComparing = false;
  });

  // ---- Rendering & Drag/Drop Reordering ----

  function renderFrames() {
    framesEl.innerHTML = '';

    items.forEach((it, idx) => {
      const frame = document.createElement('div');
      frame.className = 'frame';
      frame.draggable = true;
      frame.dataset.index = String(idx);
      frame.setAttribute('tabindex', '0');
      frame.setAttribute('aria-label', `Frame ${idx + 1}: ${it.name}`);

      const savedPct = it.status === 'done'
        ? Math.max(0, Math.round((1 - it.outputSize / it.originalSize) * 100))
        : null;

      let statusBadgeHtml = '';
      if (it.status === 'pending') {
        statusBadgeHtml = `<span class="frame-status pending">pending</span>`;
      } else if (it.status === 'processing') {
        statusBadgeHtml = `<span class="frame-status processing"><span class="spinner" aria-hidden="true"></span> developing</span>`;
      } else if (it.status === 'done') {
        statusBadgeHtml = `<span class="frame-status done">fixed</span>`;
      } else if (it.status === 'failed') {
        statusBadgeHtml = `<span class="frame-status failed">failed</span>`;
      }

      let metaHtml = '';
      if (it.status === 'failed') {
        metaHtml = `<span class="failed-text">⚠️ ${escapeHtml(it.errorReason || 'Failed to process')}</span>`;
      } else if (it.status === 'done') {
        metaHtml = `${fmtBytes(it.originalSize)} → ${fmtBytes(it.outputSize)} <span class="saved">(-${savedPct}%)</span>`;
      } else {
        metaHtml = `${fmtBytes(it.originalSize)} · ready`;
      }

      frame.innerHTML = `
        <div class="frame-thumb">
          <img src="${it.url || ''}" alt="${escapeHtml(it.name)}" loading="lazy">
          <span class="frame-no">${String(idx + 1).padStart(2, '0')}</span>
          ${statusBadgeHtml}
        </div>
        <div class="frame-body">
          <p class="frame-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</p>
          <p class="frame-meta">${metaHtml}</p>
          <div class="frame-actions-grid">
            <button type="button" class="btn-develop-single" ${it.status === 'processing' ? 'disabled' : ''}>
              ${it.status === 'done' ? 'Re-develop' : 'Develop'}
            </button>
            <button type="button" class="compare" ${it.status !== 'done' ? 'disabled' : ''}>Compare</button>
            <button type="button" class="dl" ${it.status !== 'done' ? 'disabled' : ''}>Download</button>
            <button type="button" class="remove">Remove</button>
          </div>
        </div>
      `;

      // Drag and Drop Event Handlers for Frame Reordering
      frame.addEventListener('dragstart', (e) => {
        draggedItemIndex = idx;
        frame.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      });

      frame.addEventListener('dragend', () => {
        frame.classList.remove('is-dragging');
        draggedItemIndex = null;
        document.querySelectorAll('.frame').forEach((f) => f.classList.remove('drag-over-item'));
      });

      frame.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        frame.classList.add('drag-over-item');
      });

      frame.addEventListener('dragleave', () => {
        frame.classList.remove('drag-over-item');
      });

      frame.addEventListener('drop', (e) => {
        e.preventDefault();
        frame.classList.remove('drag-over-item');
        const fromIdx = draggedItemIndex !== null ? draggedItemIndex : parseInt(e.dataTransfer.getData('text/plain'), 10);
        const toIdx = idx;

        if (!isNaN(fromIdx) && fromIdx !== toIdx) {
          const [movedItem] = items.splice(fromIdx, 1);
          items.splice(toIdx, 0, movedItem);
          renderFrames();
          announce(`Moved ${movedItem.name} to position ${toIdx + 1}`);
        }
      });

      // Frame button listeners
      frame.querySelector('.btn-develop-single').addEventListener('click', async () => {
        it.status = 'processing';
        renderFrames();
        const saved = await compressItem(it);
        renderFrames();
        if (saved > 0) {
          addLifetimeSavings(saved);
          showToast(`Developed ${it.name}! Saved ${fmtBytes(saved)}.`, 'success');
        } else if (it.status === 'done') {
          showToast(`Developed ${it.name}.`, 'success');
        }
        const anyDone = items.some((x) => x.status === 'done');
        downloadZipBtn.disabled = !anyDone;
        makePdfBtn.disabled = !anyDone;
      });

      frame.querySelector('.compare').addEventListener('click', () => {
        openCompareModal(it);
      });

      frame.querySelector('.dl').addEventListener('click', () => {
        if (it.outputBlob) triggerDownload(it.outputBlob, it.outputName);
      });

      frame.querySelector('.remove').addEventListener('click', () => {
        if (it.url) URL.revokeObjectURL(it.url);
        if (it.outputUrl) URL.revokeObjectURL(it.outputUrl);
        items = items.filter((x) => x.id !== it.id);
        if (!items.length) {
          controls.hidden = true;
          contactSheet.hidden = true;
          batchProgress.hidden = true;
        }
        renderFrames();
        announce(`Removed ${it.name}`);
      });

      framesEl.appendChild(frame);
    });

    const doneCount = items.filter((it) => it.status === 'done').length;
    const failedCount = items.filter((it) => it.status === 'failed').length;
    let summaryText = `${items.length} frame${items.length === 1 ? '' : 's'} loaded · ${doneCount} developed`;
    if (failedCount > 0) {
      summaryText += ` · ${failedCount} failed`;
    }
    sheetSummary.textContent = summaryText;

    downloadZipBtn.disabled = doneCount === 0;
    makePdfBtn.disabled = doneCount === 0;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
