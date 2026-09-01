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

  // Preset & Filter Elements
  const presetBtns = document.querySelectorAll('.preset-btn');
  const filmFilterSelect = document.getElementById('filmFilter');
  const smartSharpenCheckbox = document.getElementById('smartSharpen');
  const filenameTemplateInput = document.getElementById('filenameTemplate');

  // Watermark Elements
  const enableWatermark = document.getElementById('enableWatermark');
  const watermarkOptions = document.getElementById('watermarkOptions');
  const wmTypeTextBtn = document.getElementById('wmTypeTextBtn');
  const wmTypeLogoBtn = document.getElementById('wmTypeLogoBtn');
  const wmTextWrap = document.getElementById('wmTextWrap');
  const wmLogoWrap = document.getElementById('wmLogoWrap');
  const watermarkText = document.getElementById('watermarkText');
  const wmLogoInput = document.getElementById('wmLogoInput');
  const wmLogoPreviewWrap = document.getElementById('wmLogoPreviewWrap');
  const wmLogoImg = document.getElementById('wmLogoImg');
  const removeWmLogoBtn = document.getElementById('removeWmLogoBtn');
  const watermarkPos = document.getElementById('watermarkPos');
  const watermarkOpacity = document.getElementById('watermarkOpacity');

  // PDF Options Modal Elements
  const pdfOptionsModal = document.getElementById('pdfOptionsModal');
  const pdfDocTitleInput = document.getElementById('pdfDocTitle');
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
  let activeWmType = 'text'; // 'text' | 'image'
  let loadedLogoImage = null;

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
    savingsBadge.innerHTML = `<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> ${fmtBytes(total)} saved locally`;
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
    
    let iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    if (type === 'warning') {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else if (type === 'success') {
      iconSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
    }

    toast.innerHTML = `
      <span class="toast-icon">${iconSvg}</span>
      <span class="toast-msg">${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  };

  // ---- Mode Switcher & Presets ----

  const setCompressionMode = (mode) => {
    currentMode = mode;
    if (mode === 'quality') {
      modeQualityBtn.classList.add('active');
      modeTargetBtn.classList.remove('active');
      groupQuality.hidden = false;
      groupTarget.hidden = true;
    } else {
      modeTargetBtn.classList.add('active');
      modeQualityBtn.classList.remove('active');
      groupQuality.hidden = true;
      groupTarget.hidden = false;
    }
  };

  modeQualityBtn.addEventListener('click', () => setCompressionMode('quality'));
  modeTargetBtn.addEventListener('click', () => setCompressionMode('target'));

  // 1-Click Platform Presets
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      presetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const preset = btn.dataset.preset;
      applyPlatformPreset(preset);
    });
  });

  function applyPlatformPreset(preset) {
    if (preset === 'whatsapp') {
      setCompressionMode('target');
      targetSizeInput.value = '950';
      targetUnitSelect.value = 'KB';
      formatSelect.value = 'image/webp';
      maxWidthSelect.value = '1920';
      showToast('Applied WhatsApp Preset (<1MB, WebP)', 'info');
    } else if (preset === 'instagram') {
      setCompressionMode('quality');
      qualitySlider.value = '90';
      qualityValue.textContent = '90%';
      formatSelect.value = 'image/jpeg';
      maxWidthSelect.value = '1920';
      showToast('Applied Instagram Post Preset (HQ JPEG)', 'info');
    } else if (preset === 'discord') {
      setCompressionMode('target');
      targetSizeInput.value = '480';
      targetUnitSelect.value = 'KB';
      formatSelect.value = 'image/webp';
      maxWidthSelect.value = '800';
      showToast('Applied Discord/Slack Preset (<500KB)', 'info');
    } else if (preset === 'email') {
      setCompressionMode('target');
      targetSizeInput.value = '250';
      targetUnitSelect.value = 'KB';
      formatSelect.value = 'image/jpeg';
      maxWidthSelect.value = '1280';
      showToast('Applied Email Ready Preset (<250KB JPEG)', 'info');
    }
  }

  // Watermark Settings & Type Switcher
  enableWatermark.addEventListener('change', () => {
    watermarkOptions.hidden = !enableWatermark.checked;
  });

  if (wmTypeTextBtn && wmTypeLogoBtn) {
    wmTypeTextBtn.addEventListener('click', () => {
      activeWmType = 'text';
      wmTypeTextBtn.classList.add('active');
      wmTypeLogoBtn.classList.remove('active');
      wmTextWrap.hidden = false;
      wmLogoWrap.hidden = true;
    });

    wmTypeLogoBtn.addEventListener('click', () => {
      activeWmType = 'image';
      wmTypeLogoBtn.classList.add('active');
      wmTypeTextBtn.classList.remove('active');
      wmTextWrap.hidden = true;
      wmLogoWrap.hidden = false;
    });
  }

  if (wmLogoInput) {
    wmLogoInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          loadedLogoImage = img;
          wmLogoImg.src = url;
          wmLogoPreviewWrap.hidden = false;
          showToast('Logo watermark loaded successfully.', 'success');
        };
        img.src = url;
      }
    });
  }

  if (removeWmLogoBtn) {
    removeWmLogoBtn.addEventListener('click', () => {
      loadedLogoImage = null;
      if (wmLogoImg) wmLogoImg.src = '';
      if (wmLogoInput) wmLogoInput.value = '';
      if (wmLogoPreviewWrap) wmLogoPreviewWrap.hidden = true;
      showToast('Logo watermark removed.', 'info');
    });
  }

  // Global Clipboard Paste Handler (Ctrl + V)
  window.addEventListener('paste', async (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const itemsList = e.clipboardData?.items;
    if (!itemsList) return;

    const imageFiles = [];
    for (const item of itemsList) {
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const ext = file.type.split('/')[1] || 'png';
          const renamed = new File([file], `clipboard-${timestamp}.${ext}`, { type: file.type });
          imageFiles.push(renamed);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      showToast(`Pasted ${imageFiles.length} image${imageFiles.length > 1 ? 's' : ''} from clipboard!`, 'info');
      await addFiles(imageFiles);
    }
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

    playShutterSound();
    showRollReport();
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

      const docTitle = (pdfDocTitleInput ? pdfDocTitleInput.value : '').trim() || 'Fixer Photo Stack';
      pdf.setProperties({
        title: docTitle,
        creator: 'Fixer by JOJIN JOHN'
      });

      pdf.save(`${docTitle.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'fixer-contact-sheet'}.pdf`);
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

  // ---- Sharpening Convolution Filter ----
  function applySharpenConvolution(ctx, width, height) {
    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const src = imgData.data;
      const output = ctx.createImageData(width, height);
      const dst = output.data;
      const weights = [0, -0.4, 0, -0.4, 2.6, -0.4, 0, -0.4, 0];
      const side = 3;
      const half = 1;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dstIdx = (y * width + x) * 4;
          let r = 0, g = 0, b = 0;
          for (let cy = 0; cy < side; cy++) {
            for (let cx = 0; cx < side; cx++) {
              const scy = Math.min(height - 1, Math.max(0, y + cy - half));
              const scx = Math.min(width - 1, Math.max(0, x + cx - half));
              const srcIdx = (scy * width + scx) * 4;
              const wt = weights[cy * side + cx];
              r += src[srcIdx] * wt;
              g += src[srcIdx + 1] * wt;
              b += src[srcIdx + 2] * wt;
            }
          }
          dst[dstIdx] = Math.min(255, Math.max(0, r));
          dst[dstIdx + 1] = Math.min(255, Math.max(0, g));
          dst[dstIdx + 2] = Math.min(255, Math.max(0, b));
          dst[dstIdx + 3] = src[dstIdx + 3];
        }
      }
      ctx.putImageData(output, 0, 0);
    } catch (e) {
      console.warn('Sharpening filter error:', e);
    }
  }

  // Custom Output Filename Pattern Generator
  function generateOutputFilename(originalName, index, targetMime) {
    const template = (filenameTemplateInput ? filenameTemplateInput.value : '').trim() || '{name}-fixed';
    const base = originalName.replace(/\.[^.]+$/, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const numStr = String(index + 1).padStart(2, '0');
    const ext = extForMime(targetMime);

    let out = template
      .replace(/\{name\}/g, base)
      .replace(/\{num\}/g, numStr)
      .replace(/\{date\}/g, dateStr);

    if (!out.toLowerCase().endsWith(`.${ext}`)) {
      out += `.${ext}`;
    }
    return out;
  }

  // ---- Compression Core with Rotation, Flip, Film Presets, Sharpening & Watermarking ----

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

            // Apply Darkroom Film Filter
            const filterVal = filmFilterSelect ? filmFilterSelect.value : 'none';
            if (filterVal === 'bw-noir') {
              ctx.filter = 'grayscale(100%) contrast(140%) brightness(95%)';
            } else if (filterVal === 'kodachrome') {
              ctx.filter = 'sepia(20%) saturate(140%) contrast(110%) brightness(102%)';
            } else if (filterVal === 'fuji-chrome') {
              ctx.filter = 'saturate(115%) hue-rotate(5deg) contrast(115%) brightness(100%)';
            } else if (filterVal === 'sepia') {
              ctx.filter = 'sepia(75%) contrast(110%) brightness(95%)';
            } else {
              ctx.filter = 'none';
            }

            // Apply rotation and flip transforms
            ctx.save();
            ctx.translate(canvasW / 2, canvasH / 2);
            if (rot) ctx.rotate((rot * Math.PI) / 180);
            if (item.flipH) ctx.scale(-1, 1);
            ctx.drawImage(img, -width / 2, -height / 2, width, height);
            ctx.restore();
            ctx.filter = 'none'; // Reset filter

            // Apply Smart Edge Sharpening if checked
            if (smartSharpenCheckbox && smartSharpenCheckbox.checked) {
              applySharpenConvolution(ctx, canvasW, canvasH);
            }

            // Apply Watermark if enabled (Text or Logo Image)
            if (enableWatermark.checked) {
              const opacity = parseFloat(watermarkOpacity.value) || 0.6;
              const pos = watermarkPos.value;

              if (activeWmType === 'image' && loadedLogoImage) {
                // Logo Image Watermark
                const logoMaxW = Math.max(40, Math.round(canvasW * 0.18));
                const logoRatio = logoMaxW / loadedLogoImage.width;
                const logoW = logoMaxW;
                const logoH = loadedLogoImage.height * logoRatio;
                const pad = Math.round(canvasW * 0.03);

                let lx = pad;
                let ly = canvasH - logoH - pad;

                if (pos === 'bottom-right') {
                  lx = canvasW - logoW - pad;
                  ly = canvasH - logoH - pad;
                } else if (pos === 'bottom-left') {
                  lx = pad;
                  ly = canvasH - logoH - pad;
                } else if (pos === 'top-right') {
                  lx = canvasW - logoW - pad;
                  ly = pad;
                } else if (pos === 'center') {
                  lx = (canvasW - logoW) / 2;
                  ly = (canvasH - logoH) / 2;
                }

                ctx.save();
                ctx.globalAlpha = opacity;
                ctx.drawImage(loadedLogoImage, lx, ly, logoW, logoH);
                ctx.restore();
              } else if (watermarkText.value.trim()) {
                // Text Watermark
                const text = watermarkText.value.trim();
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

            const itemIdx = items.indexOf(item);
            item.outputName = generateOutputFilename(item.name, itemIdx >= 0 ? itemIdx : 0, mime);
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
      showToast('Copied to clipboard. Ready to paste.', 'success');
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
    const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
    const x = clientX - rect.left;
    const pct = (x / rect.width) * 100;
    setCompareSplit(pct);
  };

  compareStage.addEventListener('dragstart', (e) => e.preventDefault());
  compareStage.addEventListener('selectstart', (e) => e.preventDefault());

  compareStage.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isComparing = true;
    try { compareStage.setPointerCapture(e.pointerId); } catch (_) {}
    updateSplitFromEvent(e);
  });
  compareStage.addEventListener('pointermove', (e) => {
    if (isComparing) {
      e.preventDefault();
      updateSplitFromEvent(e);
    }
  });
  const stopModalComparing = (e) => {
    if (isComparing) {
      isComparing = false;
      try { compareStage.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  };
  compareStage.addEventListener('pointerup', stopModalComparing);
  compareStage.addEventListener('pointercancel', stopModalComparing);

  // Live Film Filter Change Handler
  if (filmFilterSelect) {
    filmFilterSelect.addEventListener('change', () => {
      renderFrames();
      const filterName = filmFilterSelect.options[filmFilterSelect.selectedIndex].text;
      showToast(`Filter preview: ${filterName}`, 'info', 2500);
    });
  }

  // Audio Synthesizer (Web Audio API)
  let isAudioMuted = false;
  let audioCtx = null;

  function playShutterSound() {
    if (isAudioMuted) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const now = audioCtx.currentTime;

      // Click 1 (Curtain open)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(1400, now);
      osc1.frequency.exponentialRampToValueAtTime(120, now + 0.04);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.04);

      // Click 2 (Curtain close)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(800, now + 0.06);
      osc2.frequency.exponentialRampToValueAtTime(60, now + 0.12);
      gain2.gain.setValueAtTime(0.25, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.12);
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  }

  // Safe-Light Darkroom Theme Toggle
  const safelightToggleBtn = document.getElementById('safelightToggleBtn');
  if (safelightToggleBtn) {
    const savedTheme = localStorage.getItem('fixer_theme');
    if (savedTheme === 'safelight') {
      document.documentElement.setAttribute('data-theme', 'safelight');
      safelightToggleBtn.classList.add('active');
    }

    safelightToggleBtn.addEventListener('click', () => {
      const isSafe = document.documentElement.getAttribute('data-theme') === 'safelight';
      if (isSafe) {
        document.documentElement.removeAttribute('data-theme');
        safelightToggleBtn.classList.remove('active');
        localStorage.setItem('fixer_theme', 'default');
        showToast('Safe-Light mode deactivated', 'info');
      } else {
        document.documentElement.setAttribute('data-theme', 'safelight');
        safelightToggleBtn.classList.add('active');
        localStorage.setItem('fixer_theme', 'safelight');
        showToast('🔴 Analog Red Safe-Light activated', 'info');
      }
    });
  }

  // Shutter Sound Toggle
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundLabel = document.getElementById('soundLabel');
  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      isAudioMuted = !isAudioMuted;
      if (isAudioMuted) {
        if (soundLabel) soundLabel.textContent = 'Audio Off';
        soundToggleBtn.classList.remove('active');
        showToast('Shutter audio muted', 'info');
      } else {
        if (soundLabel) soundLabel.textContent = 'Audio On';
        soundToggleBtn.classList.add('active');
        playShutterSound();
        showToast('🔊 Shutter audio enabled', 'info');
      }
    });
  }

  // URL Image Import Modal
  const urlImportModal = document.getElementById('urlImportModal');
  const openUrlImportBtn = document.getElementById('openUrlImportBtn');
  const closeUrlModalBtn = document.getElementById('closeUrlModalBtn');
  const cancelUrlModalBtn = document.getElementById('cancelUrlModalBtn');
  const confirmFetchUrlBtn = document.getElementById('confirmFetchUrlBtn');
  const imageUrlInput = document.getElementById('imageUrlInput');

  if (openUrlImportBtn) {
    openUrlImportBtn.addEventListener('click', () => {
      urlImportModal.hidden = false;
      if (imageUrlInput) imageUrlInput.focus();
    });
  }
  if (closeUrlModalBtn) closeUrlModalBtn.addEventListener('click', () => { urlImportModal.hidden = true; });
  if (cancelUrlModalBtn) cancelUrlModalBtn.addEventListener('click', () => { urlImportModal.hidden = true; });

  if (confirmFetchUrlBtn) {
    confirmFetchUrlBtn.addEventListener('click', async () => {
      const url = imageUrlInput.value.trim();
      if (!url) return;
      confirmFetchUrlBtn.disabled = true;
      confirmFetchUrlBtn.textContent = 'Fetching…';
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const filename = url.split('/').pop().split('?')[0] || 'web-photo.jpg';
        const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
        urlImportModal.hidden = true;
        imageUrlInput.value = '';
        showToast(`Loaded image from web: ${filename}`, 'success');
        await addFiles([file]);
      } catch (err) {
        console.error('URL Fetch failed:', err);
        showToast('Could not fetch image directly. The server may block direct access (CORS).', 'error', 6000);
      } finally {
        confirmFetchUrlBtn.disabled = false;
        confirmFetchUrlBtn.textContent = 'Load Image';
      }
    });
  }

  // Roll Report Summary Receipt Modal
  const reportModal = document.getElementById('reportModal');
  const closeReportModalBtn = document.getElementById('closeReportModalBtn');
  const reportCloseBtn = document.getElementById('reportCloseBtn');
  const reportZipBtn = document.getElementById('reportZipBtn');
  const reportCount = document.getElementById('reportCount');
  const reportOrigSize = document.getElementById('reportOrigSize');
  const reportOutSize = document.getElementById('reportOutSize');
  const reportSaved = document.getElementById('reportSaved');

  if (closeReportModalBtn) closeReportModalBtn.addEventListener('click', () => { reportModal.hidden = true; });
  if (reportCloseBtn) reportCloseBtn.addEventListener('click', () => { reportModal.hidden = true; });
  if (reportZipBtn) {
    reportZipBtn.addEventListener('click', () => {
      reportModal.hidden = true;
      downloadZipBtn.click();
    });
  }

  function showRollReport() {
    const done = items.filter((it) => it.status === 'done');
    if (!done.length || !reportModal) return;

    const totalOrig = done.reduce((acc, it) => acc + it.originalSize, 0);
    const totalOut = done.reduce((acc, it) => acc + it.outputSize, 0);
    const savedBytes = Math.max(0, totalOrig - totalOut);
    const savedPct = totalOrig > 0 ? Math.round((savedBytes / totalOrig) * 100) : 0;

    reportCount.textContent = `${done.length} photo${done.length === 1 ? '' : 's'}`;
    reportOrigSize.textContent = fmtBytes(totalOrig);
    reportOutSize.textContent = fmtBytes(totalOut);
    reportSaved.textContent = `${fmtBytes(savedBytes)} (-${savedPct}% lighter)`;

    reportModal.hidden = false;
  }

  // Lightbox Preview Modal
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxMeta = document.getElementById('lightboxMeta');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxToggleVerBtn = document.getElementById('lightboxToggleVerBtn');
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');
  const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
  const lightboxDlBtn = document.getElementById('lightboxDlBtn');
  const lightboxFilterBadge = document.getElementById('lightboxFilterBadge');

  let currentLightboxItem = null;
  let showingOriginalInLightbox = false;

  function openLightboxModal(item) {
    if (!item) return;
    currentLightboxItem = item;
    showingOriginalInLightbox = false;
    lightboxModal.hidden = false;

    lightboxTitle.textContent = item.name;
    const currentSrc = item.outputUrl || item.url;
    lightboxImg.src = currentSrc;

    const activeFilter = filmFilterSelect ? filmFilterSelect.value : 'none';
    lightboxImg.className = activeFilter !== 'none' ? `preview-${activeFilter}` : '';

    if (activeFilter !== 'none') {
      lightboxFilterBadge.hidden = false;
      lightboxFilterBadge.textContent = `Filter: ${filmFilterSelect.options[filmFilterSelect.selectedIndex].text}`;
    } else {
      lightboxFilterBadge.hidden = true;
    }

    const sizeStr = fmtBytes(item.outputSize || item.originalSize);
    const statusStr = item.status === 'done' ? 'Developed' : 'Original Ready';
    lightboxMeta.textContent = `${statusStr} · ${sizeStr}`;

    if (item.outputUrl) {
      lightboxToggleVerBtn.hidden = false;
      lightboxToggleVerBtn.textContent = 'Show Original';
    } else {
      lightboxToggleVerBtn.hidden = true;
    }
  }

  function closeLightboxModal() {
    if (lightboxModal) lightboxModal.hidden = true;
  }

  if (closeLightboxBtn) closeLightboxBtn.addEventListener('click', closeLightboxModal);
  if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightboxModal);
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) closeLightboxModal();
    });
  }

  if (lightboxToggleVerBtn) {
    lightboxToggleVerBtn.addEventListener('click', () => {
      if (!currentLightboxItem) return;
      showingOriginalInLightbox = !showingOriginalInLightbox;
      if (showingOriginalInLightbox) {
        lightboxImg.src = currentLightboxItem.url;
        lightboxImg.className = '';
        lightboxToggleVerBtn.textContent = 'Show Developed';
        lightboxMeta.textContent = `Original · ${fmtBytes(currentLightboxItem.originalSize)}`;
      } else {
        lightboxImg.src = currentLightboxItem.outputUrl || currentLightboxItem.url;
        const activeFilter = filmFilterSelect ? filmFilterSelect.value : 'none';
        lightboxImg.className = activeFilter !== 'none' ? `preview-${activeFilter}` : '';
        lightboxToggleVerBtn.textContent = 'Show Original';
        lightboxMeta.textContent = `Developed · ${fmtBytes(currentLightboxItem.outputSize || currentLightboxItem.originalSize)}`;
      }
    });
  }

  if (lightboxDlBtn) {
    lightboxDlBtn.addEventListener('click', () => {
      if (!currentLightboxItem) return;
      if (currentLightboxItem.outputBlob) {
        triggerDownload(currentLightboxItem.outputBlob, currentLightboxItem.outputName || 'fixed-photo.jpg');
      } else {
        showToast('Develop this photo first to download optimized version', 'info');
      }
    });
  }

  // Rendering with Live Film Filter Previews, Reset Button, and Preview Lightbox
  function renderFrames() {
    framesEl.innerHTML = '';

    const activeFilter = filmFilterSelect ? filmFilterSelect.value : 'none';
    const filterClass = activeFilter !== 'none' ? `preview-${activeFilter}` : '';

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
        metaHtml = `<span class="failed-text">${escapeHtml(it.errorReason || 'Failed to process')}</span>`;
      } else if (it.status === 'done') {
        metaHtml = `${fmtBytes(it.originalSize)} → ${fmtBytes(it.outputSize)} <span class="saved">(-${savedPct}%)</span>`;
      } else {
        metaHtml = `${fmtBytes(it.originalSize)} · ready`;
      }

      const transformCss = `transform: rotate(${it.rotation || 0}deg) scaleX(${it.flipH ? -1 : 1});`;

      frame.innerHTML = `
        <div class="frame-thumb ${filterClass}" title="Click to preview full-size photo">
          <img src="${it.url || ''}" alt="${escapeHtml(it.name)}" loading="lazy" style="${transformCss}">
          <span class="frame-no">${String(idx + 1).padStart(2, '0')}</span>
          ${statusBadgeHtml}
          <div class="frame-tools-bar">
            <button type="button" class="frame-tool-btn btn-preview" title="Preview Photo Full Screen">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button type="button" class="frame-tool-btn btn-rot-left" title="Rotate Left 90°">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38l-2.73 2.81"/></svg>
            </button>
            <button type="button" class="frame-tool-btn btn-rot-right" title="Rotate Right 90°">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l2.73 2.81"/></svg>
            </button>
            <button type="button" class="frame-tool-btn btn-flip-h" title="Flip Horizontal">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 2v20"/></svg>
            </button>
            <button type="button" class="frame-tool-btn btn-crop" title="Crop Photo">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"/><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"/></svg>
            </button>
            <button type="button" class="frame-tool-btn btn-reset-frame" title="Reset Edits to Original">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            </button>
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

      // Click thumbnail to preview
      frame.querySelector('.frame-thumb').addEventListener('click', (e) => {
        if (e.target.closest('.frame-tools-bar')) return;
        openLightboxModal(it);
      });

      frame.querySelector('.btn-preview').addEventListener('click', (e) => {
        e.stopPropagation();
        openLightboxModal(it);
      });

      // Quick Rotate / Flip / Crop / Reset Button Listeners
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

      frame.querySelector('.btn-reset-frame').addEventListener('click', (e) => {
        e.stopPropagation();
        it.rotation = 0;
        it.flipH = false;
        it.status = 'pending';
        if (it.outputUrl) URL.revokeObjectURL(it.outputUrl);
        it.outputUrl = null;
        it.outputBlob = null;
        it.outputSize = 0;
        showToast(`Reset edits for "${it.name}"`, 'info');
        renderFrames();
      });

      // Frame button listeners
      frame.querySelector('.btn-develop-single').addEventListener('click', async () => {
        it.status = 'processing';
        renderFrames();
        playShutterSound();
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
        if (it.outputBlob) {
          playShutterSound();
          triggerDownload(it.outputBlob, it.outputName);
        }
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

  // ---- Visual Proof Showcase Slider ----
  function initVisualProofSlider() {
    const proofCard = document.querySelector('.proof-card');
    const proofStage = document.getElementById('proofStage');
    const proofBar = document.getElementById('proofBar');
    if (!proofStage || !proofCard) return;

    proofStage.addEventListener('dragstart', (e) => e.preventDefault());
    proofStage.addEventListener('selectstart', (e) => e.preventDefault());
    if (proofBar) {
      proofBar.addEventListener('dragstart', (e) => e.preventDefault());
      proofBar.addEventListener('selectstart', (e) => e.preventDefault());
    }

    const statAfter = document.getElementById('proofStatAfter');
    const statSaved = document.getElementById('proofStatSaved');

    function setProofSplit(pct) {
      const clamped = Math.max(0, Math.min(100, pct));
      proofCard.style.setProperty('--proof-split', `${clamped}%`);

      // Dynamically calculate live compressed size & savings percentage based on slider position
      const qualityFactor = Math.max(0.08, clamped / 100);
      const estSize = Math.round(95 + qualityFactor * 480);
      const savedPct = Math.max(5, Math.round((1 - estSize / 700) * 100));

      if (statAfter) statAfter.textContent = `${estSize} KB`;
      if (statSaved) statSaved.textContent = `(-${savedPct}% lighter)`;
    }

    let isProofComparing = false;
    let activePointerTarget = null;

    const updateFromEvent = (e) => {
      const rect = proofStage.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
      const x = clientX - rect.left;
      const pct = (x / rect.width) * 100;
      setProofSplit(pct);
    };

    const startDrag = (e, el) => {
      e.preventDefault();
      isProofComparing = true;
      activePointerTarget = el;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      updateFromEvent(e);
    };

    proofStage.addEventListener('pointerdown', (e) => startDrag(e, proofStage));
    proofStage.addEventListener('pointermove', (e) => {
      if (isProofComparing) {
        e.preventDefault();
        updateFromEvent(e);
      }
    });

    if (proofBar) {
      proofBar.addEventListener('pointerdown', (e) => startDrag(e, proofBar));
      proofBar.addEventListener('pointermove', (e) => {
        if (isProofComparing) {
          e.preventDefault();
          updateFromEvent(e);
        }
      });
    }

    const stopComparing = (e) => {
      if (isProofComparing) {
        isProofComparing = false;
        if (activePointerTarget) {
          try { activePointerTarget.releasePointerCapture(e.pointerId); } catch (_) {}
          activePointerTarget = null;
        }
      }
    };

    proofStage.addEventListener('pointerup', stopComparing);
    proofStage.addEventListener('pointercancel', stopComparing);
    if (proofBar) {
      proofBar.addEventListener('pointerup', stopComparing);
      proofBar.addEventListener('pointercancel', stopComparing);
    }

    // Initial split at 50%
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
