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

  // Watermark Elements
  const enableWatermark = document.getElementById('enableWatermark');
  const watermarkOptions = document.getElementById('watermarkOptions');
  const watermarkText = document.getElementById('watermarkText');
  const watermarkPos = document.getElementById('watermarkPos');
  const watermarkOpacity = document.getElementById('watermarkOpacity');

  // PDF Options Modal Elements
  const pdfOptionsModal = document.getElementById('pdfOptionsModal');
  const closePdfModalBtn = document.getElementById('closePdfModalBtn');
  const cancelPdfModalBtn = document.getElementById('cancelPdfModalBtn');
  const confirmBuildPdfBtn = document.getElementById('confirmBuildPdfBtn');
  const pdfOrientationSelect = document.getElementById('pdfOrientation');
  const pdfLayoutSelect = document.getElementById('pdfLayout');
  const pdfMarginSelect = document.getElementById('pdfMargin');
  const pdfPageNumbers = document.getElementById('pdfPageNumbers');

  // Crop Modal Elements
  const cropModal = document.getElementById('cropModal');
  const closeCropModalBtn = document.getElementById('closeCropModalBtn');
  const cancelCropBtn = document.getElementById('cancelCropBtn');
  const applyCropBtn = document.getElementById('applyCropBtn');
  const cropViewport = document.getElementById('cropViewport');
  const cropTargetImg = document.getElementById('cropTargetImg');
  const cropBox = document.getElementById('cropBox');
  const ratioBtns = document.querySelectorAll('.ratio-btn');

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
   *   rotation: number,
   *   flipH: boolean,
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
  let currentCropItem = null;
  let activeCropRatio = 'free';

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
    if (mime === 'image/avif') return 'avif';
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

  // ---- Mode Switcher & Watermark Toggle ----

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

  enableWatermark.addEventListener('change', () => {
    watermarkOptions.hidden = !enableWatermark.checked;
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
      if (file.size > LARGE_FILE_THRESHOLD) {
        showToast(`Large file: "${file.name}" is ${fmtBytes(file.size)}. Developing may take a moment.`, 'warning', 5000);
      }

      counter += 1;
      const itemId = `f${counter}`;

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
              rotation: 0,
              flipH: false,
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
              rotation: 0,
              flipH: false,
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
            rotation: 0,
            flipH: false,
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
          rotation: 0,
          flipH: false,
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

  // Open PDF Options Modal
  makePdfBtn.addEventListener('click', () => {
    const done = items.filter((it) => it.status === 'done');
    if (!done.length || typeof window.jspdf === 'undefined') return;
    pdfOptionsModal.hidden = false;
  });

  closePdfModalBtn.addEventListener('click', () => { pdfOptionsModal.hidden = true; });
  cancelPdfModalBtn.addEventListener('click', () => { pdfOptionsModal.hidden = true; });

  confirmBuildPdfBtn.addEventListener('click', async () => {
    pdfOptionsModal.hidden = true;
    await executePdfGeneration();
  });

  // ---- Advanced Multi-Layout PDF Generator ----

  async function executePdfGeneration() {
    const done = items.filter((it) => it.status === 'done');
    if (!done.length || typeof window.jspdf === 'undefined') return;

    makePdfBtn.disabled = true;
    makePdfBtn.textContent = 'Stacking PDF…';

    try {
      const { jsPDF } = window.jspdf;
      const orientationSetting = pdfOrientationSelect.value;
      const layoutSetting = pdfLayoutSelect.value;
      const margin = parseInt(pdfMarginSelect.value, 10);
      const showPageNum = pdfPageNumbers.checked;

      const pdf = new jsPDF({
        unit: 'pt',
        orientation: orientationSetting === 'auto' ? 'portrait' : orientationSetting
      });

      if (layoutSetting === 'grid-2x2' || layoutSetting === 'grid-3x3') {
        const cols = layoutSetting === 'grid-2x2' ? 2 : 3;
        const rows = cols;
        const perPage = cols * rows;
        const totalPages = Math.ceil(done.length / perPage);

        for (let p = 0; p < totalPages; p++) {
          if (p > 0) pdf.addPage();
          const pageW = pdf.internal.pageSize.getWidth();
          const pageH = pdf.internal.pageSize.getHeight();

          const availW = pageW - margin * 2;
          const availH = pageH - margin * 2 - (showPageNum ? 24 : 0);
          const cellW = (availW - (cols - 1) * 8) / cols;
          const cellH = (availH - (rows - 1) * 8) / rows;

          const slice = done.slice(p * perPage, (p + 1) * perPage);
          for (let i = 0; i < slice.length; i++) {
            const it = slice[i];
            const col = i % cols;
            const row = Math.floor(i / cols);

            const x0 = margin + col * (cellW + 8);
            const y0 = margin + row * (cellH + 8);

            const dataUrl = await blobToDataUrl(it.outputBlob);
            const dims = await imageDims(dataUrl);
            const ratio = Math.min(cellW / dims.w, cellH / dims.h);
            const w = dims.w * ratio;
            const h = dims.h * ratio;
            const x = x0 + (cellW - w) / 2;
            const y = y0 + (cellH - h) / 2;

            const format = it.outputBlob.type === 'image/png' ? 'PNG' : 'JPEG';
            pdf.addImage(dataUrl, format, x, y, w, h);
          }

          if (showPageNum) {
            pdf.setFontSize(9);
            pdf.setTextColor(120, 120, 120);
            pdf.text(`Page ${p + 1} of ${totalPages}`, pageW / 2, pageH - 12, { align: 'center' });
          }
        }
      } else {
        // 1 photo per page (Fit or Fill)
        let first = true;
        const totalPages = done.length;

        for (let idx = 0; idx < done.length; idx++) {
          const it = done[idx];
          const dataUrl = await blobToDataUrl(it.outputBlob);
          const dims = await imageDims(dataUrl);

          let pageOrient = orientationSetting;
          if (pageOrient === 'auto') {
            pageOrient = dims.w >= dims.h ? 'landscape' : 'portrait';
          }

          if (!first) {
            pdf.addPage('a4', pageOrient);
          } else {
            pdf.setPage(1);
            if (orientationSetting === 'auto' && pageOrient === 'landscape') {
              pdf.deletePage(1);
              pdf.addPage('a4', 'landscape');
            }
          }
          first = false;

          const pageW = pdf.internal.pageSize.getWidth();
          const pageH = pdf.internal.pageSize.getHeight();
          const availW = pageW - margin * 2;
          const availH = pageH - margin * 2 - (showPageNum ? 20 : 0);

          let w, h;
          if (layoutSetting === '1-fill') {
            w = availW;
            h = availH;
          } else {
            const ratio = Math.min(availW / dims.w, availH / dims.h);
            w = dims.w * ratio;
            h = dims.h * ratio;
          }
          const x = margin + (availW - w) / 2;
          const y = margin + (availH - h) / 2;

          const format = it.outputBlob.type === 'image/png' ? 'PNG' : 'JPEG';
          pdf.addImage(dataUrl, format, x, y, w, h);

          if (showPageNum) {
            pdf.setFontSize(8);
            pdf.setTextColor(140, 140, 140);
            pdf.text(`Frame ${idx + 1} of ${totalPages}`, pageW / 2, pageH - 10, { align: 'center' });
          }
        }
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
  }

  // ---- Compression Core with Rotation, Flip, Watermarking & Target Size Binary Search ----

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

            const rot = (item.rotation || 0) % 360;
            const isSwapped = rot === 90 || rot === 270;
            const canvasW = isSwapped ? height : width;
            const canvasH = isSwapped ? width : height;

            const canvas = document.createElement('canvas');
            canvas.width = canvasW;
            canvas.height = canvasH;
            const ctx = canvas.getContext('2d');

            const mime = formatSelect.value;
            if (mime === 'image/jpeg') {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvasW, canvasH);
            }

            // Apply rotation and flip transforms
            ctx.save();
            ctx.translate(canvasW / 2, canvasH / 2);
            if (rot) ctx.rotate((rot * Math.PI) / 180);
            if (item.flipH) ctx.scale(-1, 1);
            ctx.drawImage(img, -width / 2, -height / 2, width, height);
            ctx.restore();

            // Apply Watermark if enabled
            if (enableWatermark.checked && watermarkText.value.trim()) {
              const text = watermarkText.value.trim();
              const opacity = parseFloat(watermarkOpacity.value) || 0.6;
              const pos = watermarkPos.value;

              ctx.save();
              const fontSize = Math.max(14, Math.round(canvasW * 0.035));
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
              ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
              ctx.shadowBlur = 4;
              ctx.shadowOffsetX = 1;
              ctx.shadowOffsetY = 1;

              const textMetrics = ctx.measureText(text);
              const textW = textMetrics.width;
              const pad = Math.round(fontSize * 0.8);

              let wx = pad;
              let wy = canvasH - pad;

              if (pos === 'bottom-right') {
                wx = canvasW - textW - pad;
                wy = canvasH - pad;
              } else if (pos === 'bottom-left') {
                wx = pad;
                wy = canvasH - pad;
              } else if (pos === 'top-right') {
                wx = canvasW - textW - pad;
                wy = pad + fontSize;
              } else if (pos === 'center') {
                wx = (canvasW - textW) / 2;
                wy = (canvasH + fontSize) / 2;
              }

              ctx.fillText(text, wx, wy);
              ctx.restore();
            }

            let chosenBlob = null;

            if (currentMode === 'target' && mime !== 'image/png') {
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
                  high = mid;
                } else {
                  low = mid;
                }
              }
              chosenBlob = bestBlob;
            } else {
              const quality = parseInt(qualitySlider.value, 10) / 100;
              chosenBlob = await canvasToBlobAsync(canvas, mime, mime === 'image/png' ? undefined : quality);
            }

            // Fallback for AVIF if not supported by browser canvas
            if (!chosenBlob && mime === 'image/avif') {
              chosenBlob = await canvasToBlobAsync(canvas, 'image/webp', 0.7);
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

  // ---- Copy to Clipboard ----

  async function copyImageToClipboard(item) {
    if (!item.outputBlob) return;
    try {
      let blobToWrite = item.outputBlob;
      // Convert to PNG if not PNG (since ClipboardItem requires image/png in most browsers)
      if (item.outputBlob.type !== 'image/png') {
        const dataUrl = await blobToDataUrl(item.outputBlob);
        const img = new Image();
        await new Promise((res) => { img.onload = res; img.src = dataUrl; });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        blobToWrite = await canvasToBlobAsync(canvas, 'image/png');
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blobToWrite })
      ]);
      showToast('📋 Copied to clipboard! Ready to paste.', 'success');
    } catch (err) {
      console.warn('Clipboard write failed:', err);
      showToast('Could not copy image to clipboard in this browser.', 'warning');
    }
  }

  // ---- Crop Modal Logic ----

  function openCropModal(item) {
    currentCropItem = item;
    cropTargetImg.src = item.url;
    cropModal.hidden = false;

    // Reset ratio chips
    ratioBtns.forEach((b) => b.classList.remove('active'));
    document.querySelector('.ratio-btn[data-ratio="free"]')?.classList.add('active');
    activeCropRatio = 'free';

    setTimeout(() => {
      resetCropBox();
    }, 100);
  }

  function resetCropBox() {
    const rect = cropViewport.getBoundingClientRect();
    const boxW = Math.round(rect.width * 0.75);
    const boxH = Math.round(rect.height * 0.75);
    const top = Math.round((rect.height - boxH) / 2);
    const left = Math.round((rect.width - boxW) / 2);

    cropBox.style.width = `${boxW}px`;
    cropBox.style.height = `${boxH}px`;
    cropBox.style.top = `${top}px`;
    cropBox.style.left = `${left}px`;
  }

  closeCropModalBtn.addEventListener('click', () => { cropModal.hidden = true; });
  cancelCropBtn.addEventListener('click', () => { cropModal.hidden = true; });

  ratioBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      ratioBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeCropRatio = btn.dataset.ratio;

      const rect = cropViewport.getBoundingClientRect();
      let targetW = Math.round(rect.width * 0.7);
      let targetH = Math.round(rect.height * 0.7);

      if (activeCropRatio === '1:1') {
        const side = Math.min(targetW, targetH);
        targetW = side; targetH = side;
      } else if (activeCropRatio === '4:5') {
        targetH = Math.round(targetW * 1.25);
        if (targetH > rect.height * 0.85) {
          targetH = Math.round(rect.height * 0.85);
          targetW = Math.round(targetH * 0.8);
        }
      } else if (activeCropRatio === '16:9') {
        targetH = Math.round(targetW * (9 / 16));
      } else if (activeCropRatio === '4:3') {
        targetH = Math.round(targetW * 0.75);
      }

      cropBox.style.width = `${targetW}px`;
      cropBox.style.height = `${targetH}px`;
      cropBox.style.top = `${Math.round((rect.height - targetH) / 2)}px`;
      cropBox.style.left = `${Math.round((rect.width - targetW) / 2)}px`;
    });
  });

  applyCropBtn.addEventListener('click', async () => {
    if (!currentCropItem) return;
    try {
      const img = new Image();
      await new Promise((res) => { img.onload = res; img.src = currentCropItem.url; });

      const vpRect = cropViewport.getBoundingClientRect();
      const boxRect = cropBox.getBoundingClientRect();

      const imgAspect = img.width / img.height;
      const vpAspect = vpRect.width / vpRect.height;
      let displayedW, displayedH, imgLeft, imgTop;

      if (imgAspect > vpAspect) {
        displayedW = vpRect.width;
        displayedH = vpRect.width / imgAspect;
        imgLeft = 0;
        imgTop = (vpRect.height - displayedH) / 2;
      } else {
        displayedH = vpRect.height;
        displayedW = vpRect.height * imgAspect;
        imgTop = 0;
        imgLeft = (vpRect.width - displayedW) / 2;
      }

      const relX = boxRect.left - vpRect.left - imgLeft;
      const relY = boxRect.top - vpRect.top - imgTop;
      const scale = img.width / displayedW;

      const sx = Math.max(0, Math.round(relX * scale));
      const sy = Math.max(0, Math.round(relY * scale));
      const sw = Math.min(img.width - sx, Math.round(boxRect.width * scale));
      const sh = Math.min(img.height - sy, Math.round(boxRect.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const croppedBlob = await canvasToBlobAsync(canvas, 'image/jpeg', 0.95);
      if (currentCropItem.url) URL.revokeObjectURL(currentCropItem.url);
      currentCropItem.url = URL.createObjectURL(croppedBlob);
      currentCropItem.originalSize = croppedBlob.size;
      currentCropItem.status = 'pending';
      currentCropItem.outputBlob = null;
      currentCropItem.outputSize = 0;

      cropModal.hidden = true;
      renderFrames();
      showToast(`Cropped ${currentCropItem.name}. Click Develop to apply compression.`, 'success');
    } catch (e) {
      console.error('Crop failed:', e);
      showToast('Crop operation failed.', 'error');
    }
  });

  // Dragging crop box
  let isDraggingCrop = false;
  let cropDragStart = { x: 0, y: 0, boxLeft: 0, boxTop: 0 };

  cropBox.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('crop-handle')) return;
    isDraggingCrop = true;
    const boxRect = cropBox.getBoundingClientRect();
    const vpRect = cropViewport.getBoundingClientRect();
    cropDragStart = {
      x: e.clientX,
      y: e.clientY,
      boxLeft: boxRect.left - vpRect.left,
      boxTop: boxRect.top - vpRect.top
    };
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingCrop) return;
    const vpRect = cropViewport.getBoundingClientRect();
    const boxRect = cropBox.getBoundingClientRect();
    const dx = e.clientX - cropDragStart.x;
    const dy = e.clientY - cropDragStart.y;

    let newLeft = Math.max(0, Math.min(vpRect.width - boxRect.width, cropDragStart.boxLeft + dx));
    let newTop = Math.max(0, Math.min(vpRect.height - boxRect.height, cropDragStart.boxTop + dy));

    cropBox.style.left = `${newLeft}px`;
    cropBox.style.top = `${newTop}px`;
  });

  window.addEventListener('mouseup', () => { isDraggingCrop = false; });

  // ---- Before / After Compare Modal ----

  function openCompareModal(item) {
    if (!item || !item.outputUrl || !item.url) return;

    compareTitle.textContent = `Compare: ${item.name}`;
    const savedPct = Math.max(0, Math.round((1 - item.outputSize / item.originalSize) * 100));
    compareMeta.textContent = `Original: ${fmtBytes(item.originalSize)}  →  Developed: ${fmtBytes(item.outputSize)} (-${savedPct}%)`;

    compareBeforeImg.src = item.url;
    compareAfterImg.src = item.outputUrl;
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
    if (e.key === 'Escape') {
      if (!compareModal.hidden) closeCompare();
      if (!pdfOptionsModal.hidden) pdfOptionsModal.hidden = true;
      if (!cropModal.hidden) cropModal.hidden = true;
    }
  });

  function setCompareSplit(pct) {
    const clamped = Math.max(0, Math.min(100, pct));
    compareStage.style.setProperty('--compare-split', `${clamped}%`);
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
  window.addEventListener('mouseup', () => { isComparing = false; });

  compareStage.addEventListener('touchstart', (e) => {
    isComparing = true;
    updateSplitFromEvent(e);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (isComparing) updateSplitFromEvent(e);
  }, { passive: true });
  window.addEventListener('touchend', () => { isComparing = false; });

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

      const transformCss = `transform: rotate(${it.rotation || 0}deg) scaleX(${it.flipH ? -1 : 1});`;

      frame.innerHTML = `
        <div class="frame-thumb">
          <img src="${it.url || ''}" alt="${escapeHtml(it.name)}" loading="lazy" style="${transformCss}">
          <span class="frame-no">${String(idx + 1).padStart(2, '0')}</span>
          ${statusBadgeHtml}
          <div class="frame-tools-bar">
            <button type="button" class="frame-tool-btn btn-rot-left" title="Rotate Left 90°">⟲</button>
            <button type="button" class="frame-tool-btn btn-rot-right" title="Rotate Right 90°">⟳</button>
            <button type="button" class="frame-tool-btn btn-flip-h" title="Flip Horizontal">⇄</button>
            <button type="button" class="frame-tool-btn btn-crop" title="Crop Photo">✂️</button>
          </div>
        </div>
        <div class="frame-body">
          <p class="frame-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</p>
          <p class="frame-meta">${metaHtml}</p>
          <div class="frame-actions-grid">
            <button type="button" class="btn-develop-single" ${it.status === 'processing' ? 'disabled' : ''}>
              ${it.status === 'done' ? 'Re-develop' : 'Develop'}
            </button>
            <button type="button" class="compare" ${it.status !== 'done' ? 'disabled' : ''}>Compare</button>
            <button type="button" class="copy" ${it.status !== 'done' ? 'disabled' : ''}>Copy</button>
            <button type="button" class="dl" ${it.status !== 'done' ? 'disabled' : ''}>Download</button>
            <button type="button" class="remove" style="grid-column: 1 / -1;">Remove</button>
          </div>
        </div>
      `;

      // Quick Rotate / Flip / Crop Button Listeners
      frame.querySelector('.btn-rot-left').addEventListener('click', (e) => {
        e.stopPropagation();
        it.rotation = (it.rotation + 270) % 360;
        it.status = 'pending';
        renderFrames();
      });

      frame.querySelector('.btn-rot-right').addEventListener('click', (e) => {
        e.stopPropagation();
        it.rotation = (it.rotation + 90) % 360;
        it.status = 'pending';
        renderFrames();
      });

      frame.querySelector('.btn-flip-h').addEventListener('click', (e) => {
        e.stopPropagation();
        it.flipH = !it.flipH;
        it.status = 'pending';
        renderFrames();
      });

      frame.querySelector('.btn-crop').addEventListener('click', (e) => {
        e.stopPropagation();
        openCropModal(it);
      });

      // Drag and Drop Handlers
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

      frame.querySelector('.copy').addEventListener('click', () => {
        copyImageToClipboard(it);
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

  // ---- Hero Light Table Image & PDF Cycling ----
  function initHeroNegRotator() {
    const setupRotator = (containerId, intervalMs) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const mediaList = container.querySelectorAll('.neg-media');
      if (mediaList.length <= 1) return;
      let activeIndex = 0;

      setInterval(() => {
        mediaList[activeIndex].classList.remove('active');
        activeIndex = (activeIndex + 1) % mediaList.length;
        mediaList[activeIndex].classList.add('active');
      }, intervalMs);
    };

    setupRotator('heroNegA', 4200); // 35mm film negative
    setupRotator('heroNegB', 5000); // PDF document stack & contact sheet
    setupRotator('heroNegC', 3600); // Warm amber slide
  }

  initHeroNegRotator();

  // ---- Visual Proof Showcase Slider ----
  function initVisualProofSlider() {
    const proofStage = document.getElementById('proofStage');
    const proofAfterWrap = document.getElementById('proofAfterWrap');
    const proofSliderLine = document.getElementById('proofSliderLine');
    if (!proofStage || !proofAfterWrap || !proofSliderLine) return;

    function setProofSplit(pct) {
      const clamped = Math.max(0, Math.min(100, pct));
      proofStage.style.setProperty('--proof-split', `${clamped}%`);
    }

    let isProofComparing = false;
    const updateFromEvent = (e) => {
      const rect = proofStage.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const x = clientX - rect.left;
      const pct = (x / rect.width) * 100;
      setProofSplit(pct);
    };

    proofStage.addEventListener('mousedown', (e) => {
      isProofComparing = true;
      updateFromEvent(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (isProofComparing) updateFromEvent(e);
    });
    window.addEventListener('mouseup', () => { isProofComparing = false; });

    proofStage.addEventListener('touchstart', (e) => {
      isProofComparing = true;
      updateFromEvent(e);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (isProofComparing) updateFromEvent(e);
    }, { passive: true });
    window.addEventListener('touchend', () => { isProofComparing = false; });

    // Initial split
    setProofSplit(50);
  }

  initVisualProofSlider();

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
