// assets/app.js
import { store } from "./store_local.js";

function $(id) { return document.getElementById(id); }

function getQueryParam(name) {
  const url = new URL(location.href);
  return url.searchParams.get(name);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function normalizeUrl(u) {
  const s = String(u ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;       
  if (s.startsWith("//")) return "https:" + s; // //example.com
  return "https://" + s;                       // example.com/...
}
// ------------------- index.html -------------------
async function initIndexPage() {
  const wrap = $("mapWrap");
  if (wrap) {
    // SVG map
    const res = await fetch("assets/map.svg", { cache: "no-store" });
    wrap.innerHTML = await res.text();

    // Bind region click
    wrap.querySelectorAll("[data-region]").forEach(el => {
      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        const region = el.getAttribute("data-region");
        location.href = `region.html?region=${encodeURIComponent(region)}`;
      });
    });
  }

  const regionSelect = $("regionSelect");
  if (regionSelect) {
    const regions = await store.getRegions();
    regionSelect.innerHTML = regions.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
    $("btnGo")?.addEventListener("click", () => {
      const r = regionSelect.value;
      location.href = `region.html?region=${encodeURIComponent(r)}`;
    });
  }

  $("btnReset")?.addEventListener("click", async () => {
    if (!confirm("Confirm erasing modification and reset?")) return;
    await store.reset();
    alert("Reset Successful");
  });
}

// ------------------- region.html-------------------
let currentRegion = "";
let currentSites = [];
let selectedNumber = null;
let mode = "view"; // view | edit | add
let originalNumber = null;

function renderList(list) {
  const ul = $("siteList");
  ul.innerHTML = "";

  list.forEach(site => {
    const li = document.createElement("li");
    li.className = "list-item";
    li.dataset.number = site.number;

    li.innerHTML = `
      <div class="row space-between">
        <div>
          <div class="title">#${escapeHtml(site.number)} ${escapeHtml(site.name || "(no name)")}</div>
          <div class="muted small">${escapeHtml(site.city)} ${site.type ? "· " + escapeHtml(site.type) : ""}</div>
        </div>
        <div class="pill">${escapeHtml(currentRegion)}</div>
      </div>
    `;

    li.addEventListener("click", () => {
      selectedNumber = Number(site.number);
      showDetail(site);
      highlightSelected();
    });

    ul.appendChild(li);
  });
}

function highlightSelected() {
  document.querySelectorAll(".list-item").forEach(li => {
    const n = Number(li.dataset.number);
    li.classList.toggle("active", selectedNumber != null && n === selectedNumber);
  });
}

function showDetail(site) {
  $("emptyState").classList.add("hidden");
  $("editor").classList.add("hidden");
  $("detail").classList.remove("hidden");
  mode = "view";

  $("detailTitle").textContent = `#${site.number} ${site.name || ""}`;

  const kv = $("detailKv");
  const websites = Array.isArray(site.websites) ? site.websites : [];
  kv.innerHTML = `
    ${kvRow("type", site.type)}
    ${kvRow("address", site.address)}
    ${kvRow("city", site.city)}
    ${kvRow("state", site.state)}
    ${kvRow("zip", site.zip)}
    ${kvRow("phone", site.phone)}
    ${kvRow("hours", site.hours)}
    ${kvRow("description", site.description)}
    ${kvRow("notes", site.notes)}
    <div class="kv-row">
      <div class="kv-k">websites</div>
      <div class="kv-v">
       ${websites.length
  ? websites.map(u => {
      const href = normalizeUrl(u);
      return `<div><a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(u)}</a></div>`;
    }).join("")
  : "<span class='muted'>(Null)</span>"
}
    </div>
  `;

  $("btnEdit").onclick = () => openEditor("edit", site);
  $("btnDelete").onclick = async () => {
    if (!confirm(`Confirm deleting #${site.number}?`)) return;
    await store.deleteSite(currentRegion, site.number);
    await reloadRegion();
    selectedNumber = null;
    $("detail").classList.add("hidden");
    $("emptyState").classList.remove("hidden");
  };
  document.querySelector("main.container.grid-2 > section.card:nth-child(2)")?.scrollTo({ top: 0, behavior: "smooth" });

}

function kvRow(k, v) {
  const s = (v == null) ? "" : String(v).trim();
  const value = (v && String(v).trim().length) ? escapeHtml(v) : "<span class='muted'>(null)</span>";
  return `
    <div class="kv-row">
      <div class="kv-k">${escapeHtml(k)}</div>
      <div class="kv-v">${value}</div>
    </div>
  `;
}

function setEditorFields(site) {
  $("f_number").value = site.number ?? "";
  $("f_name").value = site.name ?? "";
  $("f_address").value = site.address ?? "";
  $("f_city").value = site.city ?? "";
  $("f_state").value = site.state ?? "";
  $("f_zip").value = site.zip ?? "";
  $("f_phone").value = site.phone ?? "";
  $("f_hours").value = site.hours ?? "";
  $("f_type").value = site.type ?? "";
  $("f_description").value = site.description ?? "";
  $("f_notes").value = site.notes ?? "";

  renderUrlInputs(Array.isArray(site.websites) ? site.websites : []);
}

function collectEditorFields() {
  const urls = [];
  document.querySelectorAll(".url-input").forEach(inp => {
    const v = inp.value.trim();
    if (v) urls.push(v);
  });

  return {
    number: Number($("f_number").value),
    name: $("f_name").value,
    address: $("f_address").value,
    city: $("f_city").value,
    state: $("f_state").value,
    zip: $("f_zip").value,
    phone: $("f_phone").value,
    hours: $("f_hours").value,
    type: $("f_type").value,
    description: $("f_description").value,
    notes: $("f_notes").value,
    websites: urls
  };
}

function renderUrlInputs(urls) {
  const box = $("urlList");
  box.innerHTML = "";
  const list = urls.length ? urls : [""];

  list.forEach(u => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <input class="input url-input" value="${escapeHtml(u)}" placeholder="https://..." />
      <button class="btn danger" type="button">Delete</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      row.remove();
    });
    box.appendChild(row);
  });
}

function openEditor(kind, site) {
  mode = kind; // edit | add
  $("detail").classList.add("hidden");
  $("emptyState").classList.add("hidden");
  $("editor").classList.remove("hidden");

  if (kind === "add") {
    $("editorTitle").textContent = "Add Site";
    originalNumber = null;
    setEditorFields({
      number: suggestNextNumber(),
      name: "",
      address: "",
      city: "",
      state: "IL",
      zip: "",
      phone: "",
      hours: "",
      type: "",
      description: "",
      notes: "",
      websites: []
    });
  } else {
    $("editorTitle").textContent = `Edit #${site.number}`;
    originalNumber = Number(site.number);
    setEditorFields(site);
  }
    const rightCard = document.querySelector("main.container.grid-2 > section.card:nth-child(2)");
  rightCard?.scrollTo({ top: 0, behavior: "smooth" });
  $("editor")?.scrollIntoView({ block: "start", behavior: "smooth" });
}

function suggestNextNumber() {
  const max = currentSites.reduce((m, s) => Math.max(m, Number(s.number || 0)), 0);
  return max + 1;
}

async function reloadRegion() {
  const regionObj = await store.getRegion(currentRegion);
  currentSites = regionObj?.sites ?? [];
  // ascending number
  currentSites.sort((a,b) => Number(a.number) - Number(b.number));
  applyFilterSort();
  $("regionMeta").textContent = `共 ${currentSites.length} 个 sites`;
}

function applyFilterSort() {
  const q = ($("search")?.value ?? "").trim().toLowerCase();
  const sort = $("sort")?.value ?? "number-asc";

  let list = [...currentSites];

  if (q) {
    list = list.filter(s => {
      const hay = [
        s.number, s.name, s.city, s.type, s.address, s.zip
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  if (sort === "number-asc") list.sort((a,b) => Number(a.number)-Number(b.number));
  if (sort === "number-desc") list.sort((a,b) => Number(b.number)-Number(a.number));
  if (sort === "name-asc") list.sort((a,b) => String(a.name||"").localeCompare(String(b.name||"")));

  renderList(list);

  // If number exists, refresh right
  if (selectedNumber != null) {
    const site = currentSites.find(s => Number(s.number) === Number(selectedNumber));
    if (site) showDetail(site);
    else {
      selectedNumber = null;
      $("detail").classList.add("hidden");
      $("emptyState").classList.remove("hidden");
    }
  }
  highlightSelected();
}

async function initRegionPage() {
  const r = getQueryParam("region");
  if (!r) {
    alert("Region parameters missing, back to main page");
    location.href = "index.html";
    return;
  }
  currentRegion = r;
  document.title = `Region - ${currentRegion}`;
  $("regionTitle").textContent = currentRegion;

  $("btnAdd").addEventListener("click", () => openEditor("add", null));

  $("search").addEventListener("input", applyFilterSort);
  $("sort").addEventListener("change", applyFilterSort);

  $("btnExport").addEventListener("click", async () => {
    const text = await store.exportJson();
    downloadText("places_data_export.json", text);
  });

  $("importFile").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await store.importJson(text);
    await reloadRegion();
    alert("Imported and saved");
    e.target.value = "";
  });

  $("btnAddUrl").addEventListener("click", () => {
    const box = $("urlList");
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <input class="input url-input" placeholder="https://..." />
      <button class="btn danger" type="button">Delete</button>
    `;
    row.querySelector("button").addEventListener("click", () => row.remove());
    box.appendChild(row);
  });

  $("btnCancel").addEventListener("click", () => {
    mode = "view";
    $("editor").classList.add("hidden");
    $("detail").classList.add("hidden");
    $("emptyState").classList.remove("hidden");
  });

  $("editor").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const payload = collectEditorFields();

      if (!payload.number || Number.isNaN(payload.number)) {
        alert("number is necessary and has to be a number");
        return;
      }

      if (mode === "add") {
        await store.addSite(currentRegion, payload);
        await reloadRegion();
        selectedNumber = payload.number;
        const site = currentSites.find(s => Number(s.number) === Number(selectedNumber));
        if (site) showDetail(site);
      } else if (mode === "edit") {
        await store.updateSite(currentRegion, originalNumber, payload);
        await reloadRegion();
        selectedNumber = payload.number;
        const site = currentSites.find(s => Number(s.number) === Number(selectedNumber));
        if (site) showDetail(site);
      }

      $("editor").classList.add("hidden");
    } catch (err) {
      alert(err?.message ?? String(err));
    }
  });

  await reloadRegion();
}

// ------------------- Init -------------------
(async function main() {
  const isIndex = !!$("mapWrap") || location.pathname.endsWith("/index.html") || location.pathname.endsWith("/");
  const isRegion = !!$("siteList");

  if (isIndex) await initIndexPage();
  if (isRegion) await initRegionPage();
})();
