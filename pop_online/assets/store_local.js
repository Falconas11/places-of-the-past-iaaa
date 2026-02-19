// assets/store_local.js  
const DEFAULT_DATA_URL = "assets/data/places_data_export.json";

let _data = null;

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

function normalizeData(data) {
  const d = { ...data };
  if (!Array.isArray(d.regions)) d.regions = [];
  d.regions = d.regions.map(r => ({
    ...r,
    region: String(r.region ?? ""),
    sites: Array.isArray(r.sites) ? r.sites.map(normalizeSite) : []
  }));
  return d;
}

async function fetchDefault() {
  const res = await fetch(DEFAULT_DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Cannot load default data: ${DEFAULT_DATA_URL}`);
  const json = await res.json();
  return normalizeData(json);
}

function getRegionObj(data, regionName) {
  return data.regions.find(r => r.region === regionName) || null;
}

function nextNumber(regionObj) {
  const max = regionObj.sites.reduce((m, s) => Math.max(m, Number(s.number || 0)), 0);
  return max + 1;
}

function ensureLoaded() {
  if (!_data) throw new Error("Data not loaded yet. Call loadAll() first.");
  return _data;
}

export const store = {
  async loadAll() {
    if (_data) return _data;
    _data = await fetchDefault();
    return _data;
  },

  // reset = 丢弃内存改动，重新从 JSON 文件拉
  async reset() {
    _data = await fetchDefault();
    return _data;
  },

  // 导出当前内存中的数据（如果你改了数据，就能导出）
  async exportJson() {
    const data = await this.loadAll();
    return JSON.stringify(data, null, 2);
  },

  // 导入：替换内存数据（不会写回文件）
  async importJson(jsonText) {
    _data = normalizeData(JSON.parse(jsonText));
    return _data;
  },

  async getRegions() {
    const data = await this.loadAll();
    return data.regions.map(r => r.region);
  },

  async getRegion(regionName) {
    const data = await this.loadAll();
    const r = getRegionObj(data, regionName);
    if (!r) return null;
    return { region: r.region, sites: r.sites.map(s => ({ ...s })) };
  },

  async addSite(regionName, site) {
    const data = ensureLoaded();
    const r = getRegionObj(data, regionName);
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
    const data = ensureLoaded();
    const r = getRegionObj(data, regionName);
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
    const data = ensureLoaded();
    const r = getRegionObj(data, regionName);
    if (!r) throw new Error(`Cannot find region: ${regionName}`);

    const before = r.sites.length;
    r.sites = r.sites.filter(s => Number(s.number) !== Number(number));
    if (r.sites.length === before) throw new Error(`Cannot find site number=${number}`);

    return true;
  }
};
