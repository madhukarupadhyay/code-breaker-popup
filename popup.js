// ResearchMate popup: shows clips, calls the AI (or demo mode) and shows the note.

const MODEL = "claude-sonnet-5-5"; // change here if your API account uses another model name
const $ = (id) => document.getElementById(id);
let clips = [];
let lastNote = "";

async function load() {
  const d = await chrome.storage.local.get(["clips", "topic", "apikey", "level", "lang"]);
  clips = d.clips || [];
  $("topic").value = d.topic || "";
  $("apikey").value = d.apikey || "";
  if (d.level) $("level").value = d.level;
  if (d.lang) $("lang").value = d.lang;
  renderClips();
}

function renderClips() {
  $("count").textContent = clips.length;
  $("hint").hidden = clips.length > 0;
  const box = $("clips");
  box.innerHTML = "";
  clips.forEach((c) => {
    const el = document.createElement("div");
    el.className = "clip";
    if (c.type === "image") {
      const img = document.createElement("img");
      img.src = c.content;
      el.appendChild(img);
    } else {
      const t = document.createElement("div");
      t.className = "txt";
      t.textContent = c.content.length > 140 ? c.content.slice(0, 140) + "..." : c.content;
      el.appendChild(t);
    }
    const s = document.createElement("div");
    s.className = "src";
    s.textContent = (c.type === "image" ? "Image" : "Text") + "  |  " + c.source.title;
    el.appendChild(s);
    const x = document.createElement("button");
    x.className = "x"; x.textContent = "x"; x.title = "Remove";
    x.onclick = async () => {
      clips = clips.filter((k) => k.id !== c.id);
      await chrome.storage.local.set({ clips });
      renderClips();
    };
    el.appendChild(x);
    box.appendChild(el);
  });
}

function setStatus(msg, err) {
  $("status").textContent = msg;
  $("status").className = "status" + (err ? " err" : "");
}

async function callAI(key, topic, level, language) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: buildPrompt(topic, clips, level, language) }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && data.error.message) || "API error " + res.status);
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

async function generate() {
  if (!clips.length) { setStatus("Add at least one clip first.", true); return; }
  const topic = $("topic").value.trim(), key = $("apikey").value.trim();
  const level = $("level").value, language = $("lang").value;
  await chrome.storage.local.set({ topic, apikey: key, level, lang: language });
  $("generate").disabled = true;
  setStatus(key ? "AI is writing your note..." : "Demo mode: merging clips...");
  try {
    lastNote = key ? await callAI(key, topic, level, language) : localNote(topic, clips);
    $("note").innerHTML = renderMarkdown(lastNote);
    $("gallery").innerHTML = "";
    clips.filter((c) => c.type === "image").forEach((c) => {
      const img = document.createElement("img"); img.src = c.content; $("gallery").appendChild(img);
    });
    $("result").hidden = false;
    setStatus("Done.");
  } catch (e) {
    setStatus("Error: " + e.message + (key ? " (check the API key)" : ""), true);
  } finally {
    $("generate").disabled = false;
  }
}

$("generate").onclick = generate;
$("topic").onchange = () => chrome.storage.local.set({ topic: $("topic").value.trim() });
$("clear").onclick = async () => { clips = []; await chrome.storage.local.set({ clips }); $("result").hidden = true; renderClips(); };
$("copy").onclick = async () => { await navigator.clipboard.writeText(lastNote); setStatus("Note copied."); };
$("download").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lastNote], { type: "text/markdown" }));
  a.download = (($("topic").value || "research-note").replace(/\W+/g, "-")) + ".md";
  a.click();
};
load();
