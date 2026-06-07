const API_BASE = "http://127.0.0.1:5000/api";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export const store = {
  async getRegions() {
    const regions = await fetchJson(`${API_BASE}/regions`);
    return regions.map(r => r.name);
  },

  async getRegion(regionName) {
    const region = await fetchJson(
      `${API_BASE}/regions/by-name/${encodeURIComponent(regionName)}`
    );

    const data = await fetchJson(
      `${API_BASE}/regions/${region.id}/sites`
    );

    return {
      region: data.region.name,
      sites: data.sites
    };
  },

  async reset() {
    alert("Reset is disabled in API mode.");
  },

  async exportJson() {
    const regions = await this.getRegions();
    const all = [];

    for (const regionName of regions) {
      const region = await this.getRegion(regionName);
      all.push(region);
    }

    return JSON.stringify({ regions: all }, null, 2);
  },

  async importJson() {
    alert("Import is disabled in API mode.");
  },

  async addSite() {
    alert("Add is not connected to database yet.");
  },

  async updateSite() {
    alert("Edit is not connected to database yet.");
  },

  async deleteSite() {
    alert("Delete is not connected to database yet.");
  }
};