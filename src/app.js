import { basicSetup, EditorView } from 'codemirror';
import { Compartment } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import * as htmlToImage from 'html-to-image';

const lineWrap = new Compartment();
let wrapping = false;

const editor = new EditorView({
  parent: document.querySelector('#editor'),
  extensions: [
    basicSetup,
    html(),
    oneDark,
    lineWrap.of([]),
    EditorView.theme({
      '&': { height: '100%', fontSize: '13px' },
      '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: '1.65' },
      '.cm-gutters': { borderRight: '1px solid #282a30' }
    }),
    EditorView.contentAttributes.of({ 'aria-label': 'HTML source code', spellcheck: 'false' }),
    EditorView.updateListener.of(({ state, docChanged, selectionSet }) => {
      if (!docChanged && !selectionSet) return;
      const cursor = state.selection.main.head;
      const line = state.doc.lineAt(cursor);
      document.querySelector('#cursor-position').textContent = `Ln ${line.number}, Col ${cursor - line.from + 1}`;
    })
  ]
});

const button = document.querySelector('#render');
const wrapButton = document.querySelector('#wrap-lines');
const status = document.querySelector('#status');
const image = document.querySelector('#image');
const download = document.querySelector('#download');
const frame = document.querySelector('#render-frame');
let imageUrl;
let renderStage = 'idle';

const GA_MEASUREMENT_ID = 'G-RZM8PV32MF';
const consentKey = 'html-to-jpg-analytics-consent';

function loadAnalytics() {
  if (!GA_MEASUREMENT_ID || document.querySelector('#google-analytics')) return;
  const script = document.createElement('script');
  script.id = 'google-analytics';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.append(script);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID);
}

const consent = document.querySelector('#consent');
if (localStorage.getItem(consentKey) === 'accepted') loadAnalytics();
else if (!localStorage.getItem(consentKey)) consent.hidden = false;
document.querySelector('#consent-accept').addEventListener('click', () => {
  localStorage.setItem(consentKey, 'accepted');
  consent.hidden = true;
  loadAnalytics();
});
document.querySelector('#consent-decline').addEventListener('click', () => {
  localStorage.setItem(consentKey, 'declined');
  consent.hidden = true;
});

function logRender(event) {
  console[event.errorCode ? 'error' : 'info']('[render-debug]', event);
  return fetch('/api/render-log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
    keepalive: true
  }).then(response => {
    console.info('[render-debug-endpoint]', response.status);
  }).catch(() => {
    console.error('[render-debug-endpoint] unavailable');
  });
}

wrapButton.addEventListener('click', () => {
  wrapping = !wrapping;
  editor.dispatch({ effects: lineWrap.reconfigure(wrapping ? EditorView.lineWrapping : []) });
  wrapButton.setAttribute('aria-pressed', String(wrapping));
  wrapButton.textContent = `Wrap: ${wrapping ? 'On' : 'Off'}`;
});

button.addEventListener('click', async () => {
  const startedAt = performance.now();
  button.disabled = true;
  status.classList.remove('error');
  status.textContent = 'Rendering…';
  renderStage = 'validate';
  try {
    const width = Number(document.querySelector('#width').value);
    const height = Number(document.querySelector('#height').value);
    if (!Number.isInteger(width) || width < 1 || width > 4096 || !Number.isInteger(height) || height < 1 || height > 4096) throw new Error('Width and height must be between 1 and 4096 pixels.');
    logRender({ stage: 'validate', width, height, durationMs: 0 });
    frame.width = width;
    frame.height = height;
    renderStage = 'load-preview';
    logRender({ stage: 'load-preview', width, height, durationMs: Math.round(performance.now() - startedAt) });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Preview took too long to load.')), 15000);
      frame.onload = () => { clearTimeout(timeout); resolve(); };
      frame.onerror = () => { clearTimeout(timeout); reject(new Error('Could not load the preview.')); };
      frame.srcdoc = editor.state.doc.toString();
    });
    renderStage = 'capture';
    logRender({ stage: 'capture', width, height, durationMs: Math.round(performance.now() - startedAt) });
    let captureTimeout;
    let dataUrl;
    const blockedImageHosts = new Set();
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const requestUrl = args[0] instanceof Request ? args[0].url : args[0];
      let hostname;
      try {
        hostname = new URL(requestUrl, location.href).hostname;
      } catch {}
      try {
        const response = await originalFetch.apply(window, args);
        if (!response.ok && hostname) blockedImageHosts.add(hostname);
        return response;
      } catch (error) {
        if (hostname) blockedImageHosts.add(hostname);
        throw error;
      }
    };
    try {
      dataUrl = await Promise.race([
        htmlToImage.toJpeg(frame.contentDocument.documentElement, { quality: 0.92, pixelRatio: 1, backgroundColor: '#ffffff', skipFonts: true, imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', onImageErrorHandler: () => {} }),
        new Promise((_, reject) => { captureTimeout = setTimeout(() => reject(new Error('Image capture timed out. Try simpler HTML or fewer external resources.')), 30000); })
      ]);
    } finally {
      clearTimeout(captureTimeout);
      window.fetch = originalFetch;
    }
    const blob = new Blob([Uint8Array.from(atob(dataUrl.split(',')[1]), char => char.charCodeAt(0))], { type: 'image/jpeg' });
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(blob);
    image.src = imageUrl;
    image.hidden = false;
    document.querySelector('#empty').hidden = true;
    download.href = imageUrl;
    download.hidden = false;
    const blockedHosts = [...blockedImageHosts];
    status.textContent = blockedHosts.length
      ? `${(blob.size / 1024).toFixed(1)} KB · JPG · ${blockedHosts.length} remote image host${blockedHosts.length === 1 ? '' : 's'} could not be embedded: ${blockedHosts.join(', ')}. Use data URLs or a host that allows cross-origin access.`
      : `${(blob.size / 1024).toFixed(1)} KB · JPEG · rendered in your browser`;
    logRender({ stage: 'complete', width, height, durationMs: Math.round(performance.now() - startedAt), outputBytes: blob.size, blockedImageCount: blockedHosts.length });
  } catch (error) {
    status.textContent = error.message;
    status.classList.add('error');
    const errorMessage = String(error?.message || '');
    const errorCode = /timed out|too long/i.test(errorMessage) ? 'timeout'
      : /cors|failed to fetch|networkerror/i.test(errorMessage) ? 'resource-fetch'
        : /taint|securityerror|insecure/i.test(errorMessage) ? 'canvas-security'
          : /decode|invalid image|image.*load/i.test(errorMessage) ? 'image-decode'
            : renderStage === 'capture' ? 'capture' : 'other';
    logRender({ stage: renderStage, errorCode, width: Number(document.querySelector('#width').value), height: Number(document.querySelector('#height').value), durationMs: Math.round(performance.now() - startedAt) });
  } finally {
    renderStage = 'idle';
    button.disabled = false;
  }
});
