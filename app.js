const STORE_KEY = 'miaou-training-v2';
const OLD_STORE_KEY = 'miaou-training-v1';
let mediaRecorder = null;
let chunks = [];
let latestTrainingBlob = null;
let latestTranslationBlob = null;
let personalStimulusUrl = null;
let personalStimulusName = '';
let selectedStimulus = null;
let bestSignal = null;
let autoRecordTimer = null;
const AUTO_RECORD_MS = 6000;

const PUBLIC_LIBRARY = [
  {
    id: 'desra-catmeow',
    name: 'Miaulement public 01',
    source: 'DESRA / Zenodo',
    url: 'https://zenodo.org/records/2622626/files/CatMeow.wav?download=1',
    sourceUrl: 'https://zenodo.org/records/2622626'
  },
  {
    id: 'desra-cat',
    name: 'Miaulement public 02',
    source: 'DESRA / Zenodo',
    url: 'https://zenodo.org/records/2622626/files/Cat.wav?download=1',
    sourceUrl: 'https://zenodo.org/records/2622626'
  },
  {
    id: 'desra-cata',
    name: 'Miaulement public 03',
    source: 'DESRA / Zenodo',
    url: 'https://zenodo.org/records/2622626/files/CATA.WAV?download=1',
    sourceUrl: 'https://zenodo.org/records/2622626'
  },
  {
    id: 'desra-catx',
    name: 'Miaulement public 04',
    source: 'DESRA / Zenodo',
    url: 'https://zenodo.org/records/2622626/files/CATX.WAV?download=1',
    sourceUrl: 'https://zenodo.org/records/2622626'
  }
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

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === name));
  if (name === 'history') renderHistory();
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

function libraryForMode() {
  const mode = $('librarySource').value;
  if (mode === 'public') return PUBLIC_LIBRARY;
  if (mode === 'builtin') return BUILTIN_LIBRARY;
  return [...PUBLIC_LIBRARY, ...BUILTIN_LIBRARY];
}

function renderStimulusLibrary(preferredId) {
  const lib = libraryForMode();
  $('stimulusSelect').innerHTML = lib.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} — ${escapeHtml(s.source)}</option>`).join('');
  if (preferredId && lib.some(s => s.id === preferredId)) $('stimulusSelect').value = preferredId;
  selectCurrentStimulus();
}

function selectCurrentStimulus() {
  const id = $('stimulusSelect').value;
  selectedStimulus = libraryForMode().find(s => s.id === id) || null;
  updateStimulusInfo();
}

function updateStimulusInfo(extra='') {
  if (!selectedStimulus) {
    $('stimulusInfo').textContent = 'Aucun stimulus sélectionné.';
    return;
  }
  const sourceLink = selectedStimulus.sourceUrl ? ` · <a href="${selectedStimulus.sourceUrl}" target="_blank" rel="noreferrer">source</a>` : '';
  $('stimulusInfo').innerHTML = `<strong>${escapeHtml(selectedStimulus.name)}</strong><br><small class="muted">${escapeHtml(selectedStimulus.source)}${sourceLink}${extra ? ' · ' + escapeHtml(extra) : ''}</small>`;
}

$('librarySource').addEventListener('change', () => renderStimulusLibrary());
$('stimulusSelect').addEventListener('change', selectCurrentStimulus);
$('randomStimulus').addEventListener('click', () => {
  const lib = libraryForMode();
  const recent = load().slice(-5).map(r => r.stimulusId).filter(Boolean);
  const candidates = lib.filter(s => !recent.includes(s.id));
  const pool = candidates.length ? candidates : lib;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  $('stimulusSelect').value = pick.id;
  selectCurrentStimulus();
  updateStimulusInfo('choisi automatiquement');
});

$('stimulusFile').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (personalStimulusUrl) URL.revokeObjectURL(personalStimulusUrl);
  personalStimulusUrl = URL.createObjectURL(file);
  personalStimulusName = file.name.replace(/\.[^.]+$/, '');
  selectedStimulus = { id: `personal-${Date.now()}`, name: personalStimulusName, source: 'Son personnel', url: personalStimulusUrl };
  $('stimulusInfo').innerHTML = `<strong>${escapeHtml(personalStimulusName)}</strong><br><small class="muted">Son personnel depuis cet appareil</small>`;
});

async function playSynth(spec) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(spec.start, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(spec.end, ctx.currentTime + spec.duration);
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + spec.duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + spec.duration);
  await new Promise(r => setTimeout(r, Math.ceil(spec.duration * 1000) + 80));
  await ctx.close();
}

async function playStimulus(stimulus) {
  if (!stimulus) throw new Error('Aucun stimulus');
  if (stimulus.synth) return playSynth(stimulus.synth);
  const audio = new Audio(stimulus.url);
  audio.volume = 0.7;
  try {
    await audio.play();
    await new Promise((resolve, reject) => {
      audio.onended = resolve;
      audio.onerror = () => reject(new Error('Lecture audio impossible'));
    });
  } catch (err) {
    if (stimulus.source === 'DESRA / Zenodo') {
      const fallback = BUILTIN_LIBRARY[Math.floor(Math.random() * BUILTIN_LIBRARY.length)];
      updateStimulusInfo('source distante indisponible, signal de secours joué');
      await playSynth(fallback.synth);
      return;
    }
    throw err;
  }
}

function setTrainingStatus(message, state='') {
  const el = $('trainingStatus');
  if (!el) return;
  el.textContent = message;
  el.dataset.state = state;
}

function stopActiveRecording() {
  if (autoRecordTimer) {
    clearTimeout(autoRecordTimer);
    autoRecordTimer = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
}

$('playStimulus').addEventListener('click', async () => {
  let preparedStream = null;
  try {
    $('playStimulus').disabled = true;
    $('randomStimulus').disabled = true;
    $('recordTrain').disabled = true;
    $('stopTrain').disabled = true;
    setTrainingStatus('🎙️ Préparation du micro…', 'preparing');

    // On ouvre le micro AVANT de jouer le stimulus : ainsi, dès que le son finit,
    // l'enregistrement peut démarrer sans perdre la réponse rapide du chat.
    preparedStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    setTrainingStatus('🔊 Lecture du stimulus… prépare-toi, l’écoute démarrera toute seule.', 'playing');
    await playStimulus(selectedStimulus);

    setTrainingStatus('🔴 J’écoute ton chat… enregistrement automatique en cours.', 'recording');
    await startRecording('train', preparedStream);
    preparedStream = null; // startRecording gère désormais la fermeture du flux.
    $('stopTrain').disabled = false;

    autoRecordTimer = setTimeout(() => {
      stopActiveRecording();
      $('stopTrain').disabled = true;
      $('recordTrain').disabled = false;
      setTrainingStatus('✅ Réponse enregistrée automatiquement. Tu peux l’écouter ci-dessous.', 'done');
    }, AUTO_RECORD_MS);
  } catch (e) {
    if (preparedStream) preparedStream.getTracks().forEach(t => t.stop());
    setTrainingStatus('⚠️ Impossible de lancer la séquence automatique.', 'error');
    alert(e?.name === 'NotAllowedError'
      ? 'Autorise le microphone dans Safari. Ensuite réessaie : le micro sera préparé avant le miaulement.'
      : 'Impossible de jouer le son ou de démarrer le micro. Essaie un autre stimulus.');
  } finally {
    $('playStimulus').disabled = false;
    $('randomStimulus').disabled = false;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') $('recordTrain').disabled = false;
  }
});

async function startRecording(kind, existingStream=null) {
  const stream = existingStream || await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
    const url = URL.createObjectURL(blob);
    if (kind === 'train') {
      latestTrainingBlob = blob;
      $('trainPlayback').src = url;
    } else {
      latestTranslationBlob = blob;
      $('translatePlayback').src = url;
      estimateTranslation();
    }
    stream.getTracks().forEach(t => t.stop());
    if (kind === 'train') {
      if (autoRecordTimer) {
        clearTimeout(autoRecordTimer);
        autoRecordTimer = null;
      }
      $('stopTrain').disabled = true;
      $('recordTrain').disabled = false;
      setTrainingStatus('✅ Réponse enregistrée. Tu peux l’écouter ci-dessous.', 'done');
    }
  };
  mediaRecorder.start();
}

$('recordTrain').onclick = async () => {
  try {
    await startRecording('train');
    $('recordTrain').disabled = true; $('stopTrain').disabled = false;
    setTrainingStatus('🔴 Enregistrement manuel en cours…', 'recording');
  } catch (e) {
    alert('Autorise le microphone dans Safari pour enregistrer la réponse de ton chat.');
  }
};
$('stopTrain').onclick = () => {
  stopActiveRecording();
  $('recordTrain').disabled = false;
  $('stopTrain').disabled = true;
};
$('recordTranslate').onclick = async () => {
  try {
    await startRecording('translate');
    $('recordTranslate').disabled = true; $('stopTranslate').disabled = false;
  } catch (e) {
    alert('Autorise le microphone dans Safari.');
  }
};
$('stopTranslate').onclick = () => {
  mediaRecorder?.stop(); $('recordTranslate').disabled = false; $('stopTranslate').disabled = true;
};

$('saveTraining').onclick = () => {
  if (!selectedStimulus) return alert('Choisis d’abord un stimulus.');
  const intent = $('intent').value.trim().toLowerCase();
  const rows = load();
  rows.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    createdAt: new Date().toISOString(),
    stimulus: selectedStimulus.name,
    stimulusId: selectedStimulus.id,
    stimulusSource: selectedStimulus.source,
    stimulusUrl: selectedStimulus.url && !selectedStimulus.url.startsWith('blob:') ? selectedStimulus.url : null,
    synth: selectedStimulus.synth || null,
    intent,
    behavior: $('behavior').value,
    notes: $('notes').value.trim(),
    hadRecordedResponse: !!latestTrainingBlob
  });
  save(rows);
  $('notes').value = '';
  latestTrainingBlob = null;
  $('trainPlayback').removeAttribute('src');
  alert('Essai enregistré. Miaou tiendra compte de ce résultat pour les prochains choix.');
};

function estimateTranslation() {
  const rows = load().filter(r => r.intent);
  if (!rows.length) {
    $('catTranslation').textContent = 'Pas encore assez de données. Utilise le mode entraînement.';
    return;
  }
  const counts = {};
  for (const r of rows) counts[r.intent] = (counts[r.intent] || 0) + 1;
  const ranked = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  const total = ranked.reduce((s,[,n]) => s+n,0);
  const [intent, n] = ranked[0];
  $('catTranslation').innerHTML = `<strong>Hypothèse provisoire :</strong> “${escapeHtml(intent)}”<br><small class="muted">Confiance naïve basée sur l’historique : ${Math.round(n/total*100)} %. Le vrai modèle audio viendra ensuite.</small>`;
}

$('findSignal').onclick = () => {
  const text = $('humanText').value.trim().toLowerCase();
  if (!text) return;
  const rows = load().filter(r => r.intent && (r.intent.includes(text) || text.includes(r.intent)));
  if (!rows.length) {
    $('signalResult').textContent = 'Aucun signal appris pour cette intention. Lance un entraînement.';
    $('playBestSignal').disabled = true;
    bestSignal = null;
    return;
  }
  const score = {};
  for (const r of rows) {
    score[r.stimulusId || r.stimulus] ||= {good:0,total:0,row:r};
    score[r.stimulusId || r.stimulus].total++;
    if (['approche','nourriture','jeu','attention','repond'].includes(r.behavior)) score[r.stimulusId || r.stimulus].good++;
  }
  const best = Object.values(score).sort((a,b) => (b.good/b.total)-(a.good/a.total))[0];
  const row = best.row;
  bestSignal = {
    id: row.stimulusId || row.stimulus,
    name: row.stimulus,
    source: row.stimulusSource || 'Historique',
    url: row.stimulusUrl || undefined,
    synth: row.synth || undefined
  };
  $('signalResult').innerHTML = `<strong>Meilleur stimulus appris :</strong> ${escapeHtml(bestSignal.name)}<br><small class="muted">Réactions positives : ${best.good}/${best.total}</small>`;
  $('playBestSignal').disabled = !(bestSignal.url || bestSignal.synth);
};

$('playBestSignal').onclick = async () => {
  try { await playStimulus(bestSignal); }
  catch { alert('Ce signal ancien ne peut pas être rejoué. Refais un entraînement avec un son de la bibliothèque.'); }
};

function renderHistory() {
  const rows = load().slice().reverse();
  $('historyList').innerHTML = rows.length ? rows.map(r => `
    <div class="history-item">
      <strong>${escapeHtml(r.stimulus)}</strong> → ${escapeHtml(r.intent || 'intention inconnue')}<br>
      <small class="muted">${new Date(r.createdAt).toLocaleString()} · ${escapeHtml(r.behavior)}${r.stimulusSource ? ' · ' + escapeHtml(r.stimulusSource) : ''}${r.notes ? ' · ' + escapeHtml(r.notes) : ''}</small>
    </div>`).join('') : '<p>Aucun essai enregistré.</p>';
}

$('exportData').onclick = () => {
  const blob = new Blob([JSON.stringify(load(), null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'miaou-training.json'; a.click(); URL.revokeObjectURL(a.href);
};
$('clearData').onclick = () => {
  if (confirm('Effacer tout l’historique local ?')) { localStorage.removeItem(STORE_KEY); localStorage.removeItem(OLD_STORE_KEY); renderHistory(); }
};

function escapeHtml(s='') { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

renderStimulusLibrary();
