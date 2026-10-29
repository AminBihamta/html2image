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

wrapButton.addEventListener('click', () => {
  wrapping = !wrapping;
  editor.dispatch({ effects: lineWrap.reconfigure(wrapping ? EditorView.lineWrapping : []) });
  wrapButton.setAttribute('aria-pressed', String(wrapping));
  wrapButton.textContent = `Wrap: ${wrapping ? 'On' : 'Off'}`;
});

button.addEventListener('click', async () => {
  button.disabled = true;
  status.classList.remove('error');
  status.textContent = 'Rendering…';
  try {
    const width = Number(document.querySelector('#width').value);
    if (!Number.isInteger(width) || width < 1 || width > 4096) throw new Error('Width must be between 1 and 4096 pixels.');
    frame.width = width;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Preview took too long to load.')), 15000);
      frame.onload = () => { clearTimeout(timeout); resolve(); };
      frame.onerror = () => { clearTimeout(timeout); reject(new Error('Could not load the preview.')); };
      frame.srcdoc = editor.state.doc.toString();
    });
    await frame.contentDocument.fonts.ready;
    const blob = await htmlToImage.toJpeg(frame.contentDocument.documentElement, { quality: 0.92, pixelRatio: 1, backgroundColor: '#ffffff' }).then(async dataUrl => await (await fetch(dataUrl)).blob());
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(blob);
    image.src = imageUrl;
    image.hidden = false;
    document.querySelector('#empty').hidden = true;
    download.href = imageUrl;
    download.hidden = false;
    status.textContent = `${(blob.size / 1024).toFixed(1)} KB · JPEG · rendered in your browser`;
  } catch (error) {
    status.textContent = error.message;
    status.classList.add('error');
  } finally {
    button.disabled = false;
  }
});
