// assets/store_local.js
const MANIFEST_URL = new URL("./data/regions/regions_manifest.json", import.meta.url);

let _manifest = null;
const _regionCache = new Map();

function normalizeSite(site) {
  const s = { ...site };
  if (!Array.isArray(s.websites)) s.websites = s.websites ? [String(s.websites)] : [];
  for (const k of ["name","address","city","state","zip","phone","hours","description","notes","type"]) {
    if (s[k] == null) s[k] = "";
    else s[k] = String(s[k]);
  }
  if (s.number != null) s.number = Number(s.number);
  return s;
}

function normalizeRegionData(data) {
  return {
    metadata: data.metadata ?? {},
    region: String(data.region ?? ""),
    sites: Array.isArray(data.sites) ? data.sites.map(normalizeSite) : []
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Cannot load: ${url}`);
  return res.json();
}

async function loadManifest() {
  if (_manifest) return _manifest;
  _manifest = await fetchJson(MANIFEST_URL);
  if (!Array.isArray(_manifest.regions)) _manifest.regions = [];
  return _manifest;
}

async function loadRegion(regionName) {
  if (_regionCache.has(regionName)) return _regionCache.get(regionName);

  const manifest = await loadManifest();
  const entry = manifest.regions.find(r => r.region === regionName);
  if (!entry) return null;
  if (!entry.file) return _regionCache.get(regionName) ?? null;

  const data = normalizeRegionData(await fetchJson(entry.file));
  _regionCache.set(regionName, data);
  return data;
}

function nextNumber(regionObj) {
  const max = regionObj.sites.reduce((m, s) => Math.max(m, Number(s.number || 0)), 0);
  return max + 1;
}

export const store = {
  async loadAll() {
    const manifest = await loadManifest();
    const regions = [];
    for (const item of manifest.regions) {
      const region = await loadRegion(item.region);
      if (region) regions.push({ region: region.region, sites: region.sites.map(s => ({ ...s })) });
    }
    return { metadata: manifest.metadata ?? {}, regions };
  },

  async reset() {
    _manifest = null;
    _regionCache.clear();
    return this.loadAll();
  },

  async exportJson() {
    const data = await this.loadAll();
    return JSON.stringify(data, null, 2);
  },

  async importJson(jsonText) {
    const parsed = JSON.parse(jsonText);
    _manifest = {
      metadata: parsed.metadata ?? {},
      regions: (parsed.regions ?? []).map(r => ({ region: String(r.region ?? ""), file: null }))
    };
    _regionCache.clear();
    for (const r of parsed.regions ?? []) {
      _regionCache.set(String(r.region ?? ""), {
        metadata: parsed.metadata ?? {},
        region: String(r.region ?? ""),
        sites: Array.isArray(r.sites) ? r.sites.map(normalizeSite) : []
      });
    }
    return this.loadAll();
  },

  async getRegions() {
    const manifest = await loadManifest();
    return manifest.regions.map(r => r.region);
  },

  async getRegion(regionName) {
    const r = await loadRegion(regionName);
    if (!r) return null;
    return { region: r.region, sites: r.sites.map(s => ({ ...s })) };
  },

  async addSite(regionName, site) {
    const r = await loadRegion(regionName);
    if (!r) throw new Error(`Cannot find region: ${regionName}`);

    const s = normalizeSite(site);
    if (!s.number || Number.isNaN(s.number)) s.number = nextNumber(r);
    if (r.sites.some(x => Number(x.number) === Number(s.number))) {
      throw new Error(`Number ${s.number} already exists`);
    }

    r.sites.push(s);
    return s;
  },

  async updateSite(regionName, number, patch) {
    const r = await loadRegion(regionName);
    if (!r) throw new Error(`Cannot find region: ${regionName}`);

    const idx = r.sites.findIndex(s => Number(s.number) === Number(number));
    if (idx < 0) throw new Error(`Cannot find site number=${number}`);

    const updated = normalizeSite({ ...r.sites[idx], ...patch });

    const oldNum = Number(r.sites[idx].number);
    const newNum = Number(updated.number);
    if (newNum !== oldNum && r.sites.some(s => Number(s.number) === newNum)) {
      throw new Error(`Number ${newNum} exists, modification failed`);
    }

    r.sites[idx] = updated;
    return updated;
  },

  async deleteSite(regionName, number) {
    const r = await loadRegion(regionName);
    if (!r) throw new Error(`Cannot find region: ${regionName}`);

    const before = r.sites.length;
    r.sites = r.sites.filter(s => Number(s.number) !== Number(number));
    if (r.sites.length === before) throw new Error(`Cannot find site number=${number}`);

    return true;
  }
};
