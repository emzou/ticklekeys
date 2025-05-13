const totalStart = performance.now();
const prompts = [];
const passageFiles = ["passage1.txt", "passage2.txt", "passage3.txt"];
const passageMeta = [
  "Fyodor Dostoevsky, *White Nights* (1848)",
  "William Shakespeare, *Romeo and Juliet* (~1595)",
  "Karl Marx, *On the Jewish Question* (1843)"
];

let stage = 0;
const timings = [];
let keyTimes = [];
let typedText = "";
let totalChars = 0;

const intro = document.getElementById("intro");
const app = document.getElementById("app");
const title = document.getElementById("title");
const metaText = document.getElementById("meta");
const promptText = document.getElementById("prompt");
const overlay = document.getElementById("overlay");
const chart = document.getElementById("chart");
const results = document.getElementById("results");
const restartBtn = document.getElementById("restartBtn");
const downloadBtn = document.getElementById("downloadBtn");
const saveImgBtn = document.getElementById("saveImgBtn");
const startBtn = document.getElementById("startBtn");

startBtn.onclick = () => {
  intro.style.display = "none";
  app.style.display = "block";
  loadPassages();
};

restartBtn.onclick = () => window.location.reload();

async function loadPassages() {
  for (const file of passageFiles) {
    const res = await fetch(file);
    const text = await res.text();
    prompts.push(text.trim());
  }
  updatePrompt();
  document.addEventListener("keydown", handleTyping);
}

function updatePrompt() {
  const current = prompts[stage];
  title.textContent = `Passage ${stage + 1}`;
  metaText.textContent = passageMeta[stage];
  promptText.innerHTML = "";
  overlay.innerHTML = "";
  typedText = "";
  keyTimes = [];
  for (let i = 0; i < current.length; i++) {
    const span = document.createElement("span");
    span.textContent = current[i];
    promptText.appendChild(span);
  }
}

function handleTyping(e) {
  if (stage >= prompts.length) return;
  const now = performance.now();
  if (keyTimes.length > 0) {
    timings[stage].push(now - keyTimes[keyTimes.length - 1]);
  } else {
    timings[stage] = [];
  }
  keyTimes.push(now);

  if (e.key === "Backspace") {
    typedText = typedText.slice(0, -1);
  } else if (e.key.length === 1) {
    typedText += e.key;
  }

  const ref = prompts[stage];
  overlay.innerHTML = "";
  for (let i = 0; i < ref.length; i++) {
    const span = document.createElement("span");
    if (typedText[i] === undefined) {
      span.textContent = ref[i];
    } else if (typedText[i] === ref[i]) {
      span.textContent = ref[i];
      span.className = "active";
    } else {
      span.textContent = ref[i];
      span.style.color = "salmon";
    }
    overlay.appendChild(span);
  }

  if (typedText === ref) {
    totalChars += ref.length;
    if (++stage < prompts.length) {
      setTimeout(updatePrompt, 500);
    } else {
      document.removeEventListener("keydown", handleTyping);
      showResults();
    }
  }
}

function showResults() {
  const totalEnd = performance.now();
  const totalTimeMinutes = (totalEnd - totalStart) / 60000;
  const wpm = (totalChars / 5) / totalTimeMinutes;

  promptText.style.display = "none";
  overlay.style.display = "none";
  metaText.style.display = "none";
  title.textContent = "Results";
  chart.style.display = "block";
  restartBtn.style.display = "inline-block";
  downloadBtn.style.display = "inline-block";
  saveImgBtn.style.display = "inline-block";

  const all = timings.flat();
  const labels = all.map((_, i) => i);
  const data = {
    labels,
    datasets: timings.map((set, i) => ({
      label: `Passage ${i + 1}`,
      data: set,
      fill: false,
      tension: 0.3
    }))
  };

  new Chart(chart, {
    type: 'line',
    data,
    options: {
      scales: {
        y: { title: { display: true, text: 'Interval (ms)' } },
        x: { title: { display: true, text: 'Keystroke Index' } }
      }
    }
  });

  const logLik = (a, b) => {
    const mu = x => x.reduce((a,b)=>a+b,0)/x.length;
    const sigma2 = x => mu(x.map(y => (y - mu(x)) ** 2));
    const l = (x, y) => x.reduce((sum, xi, i) => sum - ((xi - y[i]) ** 2) / (2 * sigma2(x)), 0);
    return l(a, b);
  };

  const sim12 = logLik(timings[0], timings[1]);
  const sim13 = logLik(timings[0], timings[2]);
  const sim23 = logLik(timings[1], timings[2]);

  const suspicion = Math.min(sim12, sim13, sim23) < -3000 ? "👀 Hmmm... kind of sus." : "✅ Seems consistent! Probably the same person.";

  results.innerHTML = `
    <p><strong>Typing Speed:</strong> ${wpm.toFixed(1)} WPM</p>
    <p>Similarity (log-likelihood-ish):</p>
    <p>1 vs 2: ${sim12.toFixed(2)}</p>
    <p>1 vs 3: ${sim13.toFixed(2)}</p>
    <p>2 vs 3: ${sim23.toFixed(2)}</p>
    <p><strong>Verdict:</strong> ${suspicion}</p>
    <p style="color: gray; font-size: 0.8rem;">Note: This app runs entirely in your browser. Your data never leaves your device.</p>
  `;

  downloadBtn.onclick = () => {
    let csv = "passage,index,timing\n";
    timings.forEach((set, i) => {
      set.forEach((val, j) => {
        csv += `${i+1},${j},${val.toFixed(2)}\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'keystroke_timings.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  saveImgBtn.onclick = () => {
    const link = document.createElement('a');
    link.download = 'timing_chart.png';
    link.href = chart.toDataURL('image/png');
    link.click();
  };
}
