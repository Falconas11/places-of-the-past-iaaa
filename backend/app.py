from flask import Flask, jsonify
from flask_cors import CORS
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "database" / "places_of_the_past.db"

app = Flask(__name__)
CORS(app)


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@app.route("/api/regions")
def get_regions():
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT id, name FROM regions ORDER BY id"
    ).fetchall()
    conn.close()

    return jsonify([dict(row) for row in rows])

@app.route("/api/regions/by-name/<path:region_name>")
def get_region_by_name(region_name):
    conn = get_db_connection()

    region = conn.execute(
        """
        SELECT id, name
        FROM regions
        WHERE name = ?
        """,
        (region_name,)
    ).fetchone()

    conn.close()

    if region is None:
        return jsonify({"error": "Region not found"}), 404

    return jsonify(dict(region))

@app.route("/api/regions/<int:region_id>/sites")
def get_sites_by_region(region_id):
    conn = get_db_connection()

    region = conn.execute(
        "SELECT id, name FROM regions WHERE id = ?",
        (region_id,)
    ).fetchone()

    if region is None:
        conn.close()
        return jsonify({"error": "Region not found"}), 404

    site_rows = conn.execute(
        """
        SELECT *
        FROM sites
        WHERE region_id = ?
        ORDER BY number
        """,
        (region_id,)
    ).fetchall()

    sites = []

    for site in site_rows:
        site_dict = dict(site)

        website_rows = conn.execute(
            """
            SELECT url
            FROM site_websites
            WHERE site_id = ?
            ORDER BY id
            """,
            (site["id"],)
        ).fetchall()

        site_dict["websites"] = [row["url"] for row in website_rows]
        sites.append(site_dict)

    conn.close()

    return jsonify({
        "region": dict(region),
        "sites": sites
    })


@app.route("/api/sites/<int:site_id>")
def get_site(site_id):
    conn = get_db_connection()

    site = conn.execute(
        "SELECT * FROM sites WHERE id = ?",
        (site_id,)
    ).fetchone()

    if site is None:
        conn.close()
        return jsonify({"error": "Site not found"}), 404

    site_dict = dict(site)

    website_rows = conn.execute(
        "SELECT url FROM site_websites WHERE site_id = ? ORDER BY id",
        (site_id,)
    ).fetchall()

    site_dict["websites"] = [row["url"] for row in website_rows]

    conn.close()

    return jsonify(site_dict)


if __name__ == "__main__":
    app.run(debug=True)