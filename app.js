const STORE_KEY = 'miaou-training-v1';
let mediaRecorder = null;
let chunks = [];
let latestTrainingBlob = null;
let latestTranslationBlob = null;
let stimulusUrl = null;

const $ = id => document.getElementById(id);
const load = () => JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
const save = rows => localStorage.setItem(STORE_KEY, JSON.stringify(rows));

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === name));
  if (name === 'history') renderHistory();
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

$('stimulusFile').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (stimulusUrl) URL.revokeObjectURL(stimulusUrl);
  stimulusUrl = URL.createObjectURL(file);
  if (!$('stimulusName').value) $('stimulusName').value = file.name.replace(/\.[^.]+$/, '');
});
$('playStimulus').addEventListener('click', async () => {
  if (!stimulusUrl) return alert('Choisis d’abord un fichier audio.');
  const audio = new Audio(stimulusUrl);
  await audio.play();
});

async function startRecording(kind) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
  };
  mediaRecorder.start();
}

$('recordTrain').onclick = async () => {
  await startRecording('train');
  $('recordTrain').disabled = true; $('stopTrain').disabled = false;
};
$('stopTrain').onclick = () => {
  mediaRecorder?.stop(); $('recordTrain').disabled = false; $('stopTrain').disabled = true;
};
$('recordTranslate').onclick = async () => {
  await startRecording('translate');
  $('recordTranslate').disabled = true; $('stopTranslate').disabled = false;
};
$('stopTranslate').onclick = () => {
  mediaRecorder?.stop(); $('recordTranslate').disabled = false; $('stopTranslate').disabled = true;
};

$('saveTraining').onclick = () => {
  const stimulus = $('stimulusName').value.trim();
  const intent = $('intent').value.trim().toLowerCase();
  if (!stimulus) return alert('Donne un nom au stimulus.');
  const rows = load();
  rows.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    stimulus,
    intent,
    behavior: $('behavior').value,
    notes: $('notes').value.trim(),
    hadRecordedResponse: !!latestTrainingBlob
  });
  save(rows);
  $('notes').value = '';
  latestTrainingBlob = null;
  $('trainPlayback').removeAttribute('src');
  alert('Essai enregistré.');
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
    return;
  }
  const score = {};
  for (const r of rows) {
    score[r.stimulus] ||= {good:0,total:0};
    score[r.stimulus].total++;
    if (['approche','nourriture','jeu','attention','repond'].includes(r.behavior)) score[r.stimulus].good++;
  }
  const best = Object.entries(score).sort((a,b) => (b[1].good/b[1].total)-(a[1].good/a[1].total))[0];
  $('signalResult').innerHTML = `<strong>Meilleur stimulus appris :</strong> ${escapeHtml(best[0])}<br><small class="muted">Réactions positives : ${best[1].good}/${best[1].total}</small>`;
};

function renderHistory() {
  const rows = load().slice().reverse();
  $('historyList').innerHTML = rows.length ? rows.map(r => `
    <div class="history-item">
      <strong>${escapeHtml(r.stimulus)}</strong> → ${escapeHtml(r.intent || 'intention inconnue')}<br>
      <small class="muted">${new Date(r.createdAt).toLocaleString()} · ${escapeHtml(r.behavior)}${r.notes ? ' · ' + escapeHtml(r.notes) : ''}</small>
    </div>`).join('') : '<p>Aucun essai enregistré.</p>';
}

$('exportData').onclick = () => {
  const blob = new Blob([JSON.stringify(load(), null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'miaou-training.json'; a.click(); URL.revokeObjectURL(a.href);
};
$('clearData').onclick = () => {
  if (confirm('Effacer tout l’historique local ?')) { localStorage.removeItem(STORE_KEY); renderHistory(); }
};

function escapeHtml(s='') { return s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
