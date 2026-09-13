const STORE_KEY = 'miaou-training-v2';
const OLD_STORE_KEY = 'miaou-training-v1';
const CATMEOWS_DB = 'miaou-audio-cache-v1';
const CATMEOWS_STORE = 'catmeows';
const CATMEOWS_META = 'meta';
const CATMEOWS_ZIP_URL = 'https://zenodo.org/records/4008297/files/dataset.zip?download=1';
const CATMEOWS_SOURCE_URL = 'https://zenodo.org/records/4008297';
const CATMEOWS_EXPECTED = 440;
const AUTO_RECORD_MS = 6000;

let mediaRecorder = null;
let chunks = [];
let latestTrainingBlob = null;
let latestTranslationBlob = null;
let personalStimulusUrl = null;
let personalStimulusName = '';
let selectedStimulus = null;
let bestSignal = null;
let autoRecordTimer = null;
let catMeowsLibrary = [];
let installInProgress = false;

const DESRA_LIBRARY = [
  { id: 'desra-catmeow', name: 'DESRA 01', source: 'DESRA / Zenodo', url: 'https://zenodo.org/records/2622626/files/CatMeow.wav?download=1', sourceUrl: 'https://zenodo.org/records/2622626' },
  { id: 'desra-cat', name: 'DESRA 02', source: 'DESRA / Zenodo', url: 'https://zenodo.org/records/2622626/files/Cat.wav?download=1', sourceUrl: 'https://zenodo.org/records/2622626' },
  { id: 'desra-cata', name: 'DESRA 03', source: 'DESRA / Zenodo', url: 'https://zenodo.org/records/2622626/files/CATA.WAV?download=1', sourceUrl: 'https://zenodo.org/records/2622626' },
  { id: 'desra-catx', name: 'DESRA 04', source: 'DESRA / Zenodo', url: 'https://zenodo.org/records/2622626/files/CATX.WAV?download=1', sourceUrl: 'https://zenodo.org/records/2622626' }
];

const BUILTIN_LIBRARY = [
  { id: 'builtin-short', name: 'Signal intégré court', source: 'Généré dans Miaou', synth: {start: 540, end: 760, duration: 0.48} },
  { id: 'builtin-rise', name: 'Signal intégré montant', source: 'Généré dans Miaou', synth: {start: 420, end: 880, duration: 0.72} },
  { id: 'builtin-long', name: 'Signal intégré long', source: 'Généré dans Miaou', synth: {start: 680, end: 500, duration: 1.05} }
];

const $ = id => document.getElementById(id);
const load = () => {
  const v2 = localStorage.getItem(STORE_KEY);
  if (v2) return JSON.parse(v2);
  const old = JSON.parse(localStorage.getItem(OLD_STORE_KEY) || '[]');
  if (old.length) localStorage.setItem(STORE_KEY, JSON.stringify(old));
  return old;
};
const save = rows => localStorage.setItem(STORE_KEY, JSON.stringify(rows));

function openAudioDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CATMEOWS_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CATMEOWS_STORE)) db.createObjectStore(CATMEOWS_STORE, { keyPath: 'name' });
      if (!db.objectStoreNames.contains(CATMEOWS_META)) db.createObjectStore(CATMEOWS_META, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName, value) {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function idbGet(storeName, key) {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function idbGetAll(storeName) {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

function parseCatMeowFilename(filename) {
  const base = filename.replace(/\.wav$/i, '');
  const parts = base.split('_');
  const contextCode = parts[0];
  const contextMap = { B: 'Brossage', F: 'Attente de nourriture', I: 'Isolement' };
  const context = contextMap[contextCode] || 'Contexte inconnu';
  const catId = parts[1] || 'chat';
  return { context, catId };
}

function stimulusFromCachedRow(row) {
  const meta = parseCatMeowFilename(row.name);
  return {
    id: `catmeows:${row.name}`,
    name: `${meta.context} · ${meta.catId} · ${row.name}`,
    shortName: row.name,
    source: 'CatMeows / Université de Milan',
    sourceUrl: CATMEOWS_SOURCE_URL,
    blobKey: row.name,
    context: meta.context
  };
}

async function refreshCatMeowsLibrary() {
  try {
    const rows = await idbGetAll(CATMEOWS_STORE);
    catMeowsLibrary = rows.map(stimulusFromCachedRow);
    updateLibraryInstallUi();
    renderStimulusLibrary(selectedStimulus?.id);
  } catch (err) {
    console.warn('Cache CatMeows indisponible', err);
  }
}

function updateLibraryInstallUi(message='') {
  const count = catMeowsLibrary.length;
  const status = $('libraryInstallStatus');
  if (!status) return;
  if (installInProgress) {
    if (message) status.textContent = message;
    return;
  }
  if (count >= CATMEOWS_EXPECTED) {
    status.innerHTML = `✅ <strong>${count} miaulements CatMeows</strong> sont installés sur cet appareil. Lecture locale quasi instantanée.`;
    $('installCatMeows').textContent = '↻ Réinstaller la bibliothèque';
  } else if (count > 0) {
    status.innerHTML = `⚠️ ${count}/${CATMEOWS_EXPECTED} sons sont installés. Tu peux relancer l’installation.`;
    $('installCatMeows').textContent = '⬇ Compléter la bibliothèque';
  } else {
    status.innerHTML = `La bibliothèque complète contient ${CATMEOWS_EXPECTED} miaulements. Installation unique : environ 9 Mo à télécharger.`;
    $('installCatMeows').textContent = `⬇ Installer les ${CATMEOWS_EXPECTED} miaulements`;
  }
}

async function installCatMeows() {
  if (installInProgress) return;
  if (!window.JSZip) return alert('Le module de décompression n’est pas chargé. Recharge la page puis réessaie.');
  installInProgress = true;
  $('installCatMeows').disabled = true;
  $('playStimulus').disabled = true;
  const status = $('libraryInstallStatus');
  try {
    status.textContent = '⬇ Téléchargement de CatMeows…';
    const response = await fetch(CATMEOWS_ZIP_URL, { mode: 'cors', cache: 'no-store' });
    if (!response.ok) throw new Error(`Téléchargement impossible (${response.status})`);

    let arrayBuffer;
    const total = Number(response.headers.get('content-length')) || 0;
    if (response.body && total) {
      const reader = response.body.getReader();
      const parts = [];
      let received = 0;
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        parts.push(value); received += value.length;
        status.textContent = `⬇ Téléchargement… ${Math.round(received / total * 100)} %`;
      }
      const merged = new Uint8Array(received);
      let offset = 0;
      for (const p of parts) { merged.set(p, offset); offset += p.length; }
      arrayBuffer = merged.buffer;
    } else {
      arrayBuffer = await response.arrayBuffer();
    }

    status.textContent = '📦 Décompression des miaulements…';
    const zip = await JSZip.loadAsync(arrayBuffer);
    const files = Object.values(zip.files).filter(f => !f.dir && /\.wav$/i.test(f.name));
    let done = 0;
    for (const file of files) {
      const blob = await file.async('blob');
      const name = file.name.split('/').pop();
      await idbPut(CATMEOWS_STORE, { name, blob, addedAt: Date.now() });
      done++;
      if (done % 10 === 0 || done === files.length) status.textContent = `💾 Installation locale… ${done}/${files.length}`;
    }
    await idbPut(CATMEOWS_META, { key: 'installation', count: files.length, installedAt: Date.now(), source: CATMEOWS_SOURCE_URL });
    await refreshCatMeowsLibrary();
    status.innerHTML = `✅ ${files.length} miaulements installés. À partir de maintenant, ils sont lus depuis l’iPad sans attendre Zenodo.`;
    $('librarySource').value = 'catmeows';
    renderStimulusLibrary();
  } catch (err) {
    console.error(err);
    status.innerHTML = `⚠️ Installation automatique impossible. <a href="${CATMEOWS_SOURCE_URL}" target="_blank" rel="noreferrer">Ouvrir CatMeows sur Zenodo</a>. Tu peux aussi importer le ZIP ci-dessous.`;
    $('manualZipWrap').open = true;
  } finally {
    installInProgress = false;
    $('installCatMeows').disabled = false;
    $('playStimulus').disabled = false;
    updateLibraryInstallUi(status.textContent);
  }
}

async function importCatMeowsZip(file) {
  if (!file || !window.JSZip) return;
  installInProgress = true;
  $('installCatMeows').disabled = true;
  const status = $('libraryInstallStatus');
  try {
    status.textContent = '📦 Lecture du ZIP sélectionné…';
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const files = Object.values(zip.files).filter(f => !f.dir && /\.wav$/i.test(f.name));
    let done = 0;
    for (const item of files) {
      const name = item.name.split('/').pop();
      const blob = await item.async('blob');
      await idbPut(CATMEOWS_STORE, { name, blob, addedAt: Date.now() });
      done++;
      if (done % 10 === 0 || done === files.length) status.textContent = `💾 Installation locale… ${done}/${files.length}`;
    }
    await refreshCatMeowsLibrary();
    $('librarySource').value = 'catmeows';
    renderStimulusLibrary();
  } catch (err) {
    console.error(err);
    alert('Ce ZIP ne semble pas être la bibliothèque CatMeows attendue.');
  } finally {
    installInProgress = false;
    $('installCatMeows').disabled = false;
    updateLibraryInstallUi();
  }
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === name));
  if (name === 'history') renderHistory();
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

function libraryForMode() {
  const mode = $('librarySource').value;
  if (mode === 'catmeows') return catMeowsLibrary.length ? catMeowsLibrary : DESRA_LIBRARY;
  if (mode === 'public') return [...catMeowsLibrary, ...DESRA_LIBRARY];
  if (mode === 'builtin') return BUILTIN_LIBRARY;
  return [...catMeowsLibrary, ...DESRA_LIBRARY, ...BUILTIN_LIBRARY];
}

function renderStimulusLibrary(preferredId) {
  const lib = libraryForMode();
  $('stimulusSelect').innerHTML = lib.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} — ${escapeHtml(s.source)}</option>`).join('');
  if (preferredId && lib.some(s => s.id === preferredId)) $('stimulusSelect').value = preferredId;
  selectCurrentStimulus();
  const countEl = $('libraryCount');
  if (countEl) countEl.textContent = `${lib.length} son${lib.length > 1 ? 's' : ''} disponibles dans cette source`;
}

function selectCurrentStimulus() {
  const id = $('stimulusSelect').value;
  selectedStimulus = libraryForMode().find(s => s.id === id) || null;
  updateStimulusInfo();
}

function updateStimulusInfo(extra='') {
  if (!selectedStimulus) { $('stimulusInfo').textContent = 'Aucun stimulus sélectionné.'; return; }
  const sourceLink = selectedStimulus.sourceUrl ? ` · <a href="${selectedStimulus.sourceUrl}" target="_blank" rel="noreferrer">source</a>` : '';
  const context = selectedStimulus.context ? ` · ${escapeHtml(selectedStimulus.context)}` : '';
  $('stimulusInfo').innerHTML = `<strong>${escapeHtml(selectedStimulus.name)}</strong><br><small class="muted">${escapeHtml(selectedStimulus.source)}${context}${sourceLink}${extra ? ' · ' + escapeHtml(extra) : ''}</small>`;
}

$('librarySource').addEventListener('change', () => renderStimulusLibrary());
$('stimulusSelect').addEventListener('change', selectCurrentStimulus);
$('installCatMeows').addEventListener('click', installCatMeows);
$('catMeowsZip').addEventListener('change', e => importCatMeowsZip(e.target.files?.[0]));

$('randomStimulus').addEventListener('click', () => {
  const lib = libraryForMode();
  if (!lib.length) return;
  const recent = load().slice(-12).map(r => r.stimulusId).filter(Boolean);
  const candidates = lib.filter(s => !recent.includes(s.id));
  const pool = candidates.length ? candidates : lib;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  $('stimulusSelect').value = pick.id; selectCurrentStimulus(); updateStimulusInfo('choisi automatiquement');
});

$('stimulusFile').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (personalStimulusUrl) URL.revokeObjectURL(personalStimulusUrl);
  personalStimulusUrl = URL.createObjectURL(file);
  personalStimulusName = file.name.replace(/\.[^.]+$/, '');
  selectedStimulus = { id: `personal-${Date.now()}`, name: personalStimulusName, source: 'Son personnel', url: personalStimulusUrl };
  updateStimulusInfo();
});

async function playSynth(spec) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(spec.start, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(spec.end, ctx.currentTime + spec.duration);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + spec.duration);
  osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + spec.duration);
  await new Promise(r => setTimeout(r, Math.ceil(spec.duration * 1000) + 50)); await ctx.close();
}

async function resolveStimulusUrl(stimulus) {
  if (stimulus.blobKey) {
    const row = await idbGet(CATMEOWS_STORE, stimulus.blobKey);
    if (!row?.blob) throw new Error('Son local introuvable');
    return { url: URL.createObjectURL(row.blob), revoke: true };
  }
  return { url: stimulus.url, revoke: false };
}

async function playStimulus(stimulus) {
  if (!stimulus) throw new Error('Aucun stimulus');
  if (stimulus.synth) return playSynth(stimulus.synth);
  const resolved = await resolveStimulusUrl(stimulus);
  if (!resolved.url) throw new Error('Audio indisponible');
  const audio = new Audio(resolved.url); audio.preload = 'auto'; audio.volume = 0.7;
  try {
    await new Promise((resolve, reject) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      const fail = () => { if (!settled) { settled = true; reject(new Error('Lecture audio impossible')); } };
      audio.addEventListener('ended', done, { once: true });
      audio.addEventListener('error', fail, { once: true });
      // Les miaulements CatMeows sont courts. 4 s est un filet de sécurité, pas une attente normale.
      setTimeout(done, stimulus.blobKey ? 4000 : 6000);
      audio.play().catch(fail);
    });
  } finally {
    audio.pause();
    if (resolved.revoke) URL.revokeObjectURL(resolved.url);
  }
}

function chooseNextStimulus() {
  const lib = libraryForMode(); if (!lib.length) return;
  const recent = load().slice(-15).map(r => r.stimulusId).filter(Boolean);
  let candidates = lib.filter(s => !recent.includes(s.id));
  if (!candidates.length) candidates = lib;
  const alternatives = candidates.filter(s => s.id !== selectedStimulus?.id);
  const pool = alternatives.length ? alternatives : candidates;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (pick) { $('stimulusSelect').value = pick.id; selectCurrentStimulus(); }
}

function setTrainingStatus(message, state='') { const el = $('trainingStatus'); if (el) { el.textContent = message; el.dataset.state = state; } }
function stopActiveRecording() { if (autoRecordTimer) { clearTimeout(autoRecordTimer); autoRecordTimer = null; } if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); }

$('playStimulus').addEventListener('click', async () => {
  let preparedStream = null;
  const playButton = $('playStimulus');
  try {
    if ($('librarySource').value !== 'builtin') chooseNextStimulus();
    playButton.disabled = true; $('randomStimulus').disabled = true; $('recordTrain').disabled = true; $('stopTrain').disabled = true;
    setTrainingStatus('🎙️ Préparation du micro…', 'preparing');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Micro non disponible');
    preparedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setTrainingStatus('🔊 Lecture du miaulement…', 'playing');
    await playStimulus(selectedStimulus);
    // Pas de délai artificiel : on enchaîne immédiatement pour les chats qui répondent vite.
    setTrainingStatus('🔴 J’écoute ton chat…', 'recording');
    await startRecording('train', preparedStream); preparedStream = null; $('stopTrain').disabled = false;
    autoRecordTimer = setTimeout(stopActiveRecording, AUTO_RECORD_MS);
  } catch (e) {
    if (preparedStream) preparedStream.getTracks().forEach(t => t.stop());
    console.error(e); setTrainingStatus('⚠️ Séance interrompue. Tu peux réessayer immédiatement.', 'error');
    alert(e?.name === 'NotAllowedError' ? 'Autorise le microphone pour ce site dans Safari.' : 'Impossible de lancer ce son. Essaie un autre stimulus.');
  } finally {
    playButton.disabled = false; $('randomStimulus').disabled = false;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') $('recordTrain').disabled = false;
  }
});

async function startRecording(kind, existingStream=null) {
  const stream = existingStream || await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = []; mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' }); const url = URL.createObjectURL(blob);
    if (kind === 'train') { latestTrainingBlob = blob; $('trainPlayback').src = url; }
    else { latestTranslationBlob = blob; $('translatePlayback').src = url; estimateTranslation(); }
    stream.getTracks().forEach(t => t.stop());
    if (kind === 'train') { if (autoRecordTimer) { clearTimeout(autoRecordTimer); autoRecordTimer = null; } $('stopTrain').disabled = true; $('recordTrain').disabled = false; setTrainingStatus('✅ Réponse enregistrée.', 'done'); }
  };
  mediaRecorder.start();
}

$('recordTrain').onclick = async () => { try { await startRecording('train'); $('recordTrain').disabled = true; $('stopTrain').disabled = false; setTrainingStatus('🔴 Enregistrement manuel en cours…', 'recording'); } catch { alert('Autorise le microphone dans Safari.'); } };
$('stopTrain').onclick = () => { stopActiveRecording(); $('recordTrain').disabled = false; $('stopTrain').disabled = true; };
$('recordTranslate').onclick = async () => { try { await startRecording('translate'); $('recordTranslate').disabled = true; $('stopTranslate').disabled = false; } catch { alert('Autorise le microphone dans Safari.'); } };
$('stopTranslate').onclick = () => { mediaRecorder?.stop(); $('recordTranslate').disabled = false; $('stopTranslate').disabled = true; };

$('saveTraining').onclick = () => {
  if (!selectedStimulus) return alert('Choisis d’abord un stimulus.');
  const intent = $('intent').value.trim().toLowerCase(); const rows = load();
  rows.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), createdAt: new Date().toISOString(), stimulus: selectedStimulus.name,
    stimulusId: selectedStimulus.id, stimulusSource: selectedStimulus.source,
    stimulusUrl: selectedStimulus.url && !selectedStimulus.url.startsWith('blob:') ? selectedStimulus.url : null,
    stimulusBlobKey: selectedStimulus.blobKey || null, synth: selectedStimulus.synth || null, context: selectedStimulus.context || null,
    intent, behavior: $('behavior').value, notes: $('notes').value.trim(), hadRecordedResponse: !!latestTrainingBlob
  });
  save(rows); $('notes').value = ''; latestTrainingBlob = null; $('trainPlayback').removeAttribute('src'); alert('Essai enregistré.');
};

function estimateTranslation() {
  const rows = load().filter(r => r.intent);
  if (!rows.length) { $('catTranslation').textContent = 'Pas encore assez de données. Utilise le mode entraînement.'; return; }
  const counts = {}; for (const r of rows) counts[r.intent] = (counts[r.intent] || 0) + 1;
  const ranked = Object.entries(counts).sort((a,b) => b[1]-a[1]); const total = ranked.reduce((s,[,n]) => s+n,0); const [intent,n] = ranked[0];
  $('catTranslation').innerHTML = `<strong>Hypothèse provisoire :</strong> “${escapeHtml(intent)}”<br><small class="muted">Confiance naïve : ${Math.round(n/total*100)} %. Le vrai modèle audio viendra ensuite.</small>`;
}

$('findSignal').onclick = () => {
  const text = $('humanText').value.trim().toLowerCase(); if (!text) return;
  const rows = load().filter(r => r.intent && (r.intent.includes(text) || text.includes(r.intent)));
  if (!rows.length) { $('signalResult').textContent = 'Aucun signal appris pour cette intention.'; $('playBestSignal').disabled = true; bestSignal = null; return; }
  const score = {};
  for (const r of rows) { score[r.stimulusId || r.stimulus] ||= {good:0,total:0,row:r}; score[r.stimulusId || r.stimulus].total++; if (['approche','nourriture','jeu','attention','repond'].includes(r.behavior)) score[r.stimulusId || r.stimulus].good++; }
  const best = Object.values(score).sort((a,b) => (b.good/b.total)-(a.good/a.total))[0]; const row = best.row;
  bestSignal = { id: row.stimulusId || row.stimulus, name: row.stimulus, source: row.stimulusSource || 'Historique', url: row.stimulusUrl || undefined, blobKey: row.stimulusBlobKey || undefined, synth: row.synth || undefined };
  $('signalResult').innerHTML = `<strong>Meilleur stimulus appris :</strong> ${escapeHtml(bestSignal.name)}<br><small class="muted">Réactions positives : ${best.good}/${best.total}</small>`;
  $('playBestSignal').disabled = !(bestSignal.url || bestSignal.blobKey || bestSignal.synth);
};
$('playBestSignal').onclick = async () => { try { await playStimulus(bestSignal); } catch { alert('Ce signal ne peut pas être rejoué.'); } };

function renderHistory() {
  const rows = load().slice().reverse();
  $('historyList').innerHTML = rows.length ? rows.map(r => `<div class="history-item"><strong>${escapeHtml(r.stimulus)}</strong> → ${escapeHtml(r.intent || 'intention inconnue')}<br><small class="muted">${new Date(r.createdAt).toLocaleString()} · ${escapeHtml(r.behavior)}${r.context ? ' · ' + escapeHtml(r.context) : ''}${r.notes ? ' · ' + escapeHtml(r.notes) : ''}</small></div>`).join('') : '<p>Aucun essai enregistré.</p>';
}

$('exportData').onclick = () => { const blob = new Blob([JSON.stringify(load(), null, 2)], {type:'application/json'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'miaou-training.json'; a.click(); URL.revokeObjectURL(a.href); };
$('clearData').onclick = () => { if (confirm('Effacer tout l’historique local ?')) { localStorage.removeItem(STORE_KEY); localStorage.removeItem(OLD_STORE_KEY); renderHistory(); } };
function escapeHtml(s='') { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

renderStimulusLibrary();
updateLibraryInstallUi();
refreshCatMeowsLibrary();
