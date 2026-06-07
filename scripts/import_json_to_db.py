import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

DB_PATH = ROOT / "database" / "places_of_the_past.db"
SCHEMA_PATH = ROOT / "database" / "schema.sql"
MANIFEST_PATH = ROOT / "assets" / "data" / "regions" / "regions_manifest.json"


def connect_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def reset_database(conn):
    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    conn.executescript(schema)


def insert_region(conn, name):
    cur = conn.execute(
        "INSERT INTO regions (name) VALUES (?)",
        (name,)
    )
    return cur.lastrowid


def insert_site(conn, region_id, site):
    cur = conn.execute(
        """
        INSERT INTO sites (
            region_id, number, name, address, city, state, zip,
            phone, hours, description, notes, type
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            region_id,
            site.get("number"),
            site.get("name", ""),
            site.get("address", ""),
            site.get("city", ""),
            site.get("state", ""),
            site.get("zip", ""),
            site.get("phone", ""),
            site.get("hours", ""),
            site.get("description", ""),
            site.get("notes", ""),
            site.get("type", ""),
        )
    )
    return cur.lastrowid


def insert_websites(conn, site_id, websites):
    if not isinstance(websites, list):
        websites = [websites] if websites else []

    count = 0

    for url in websites:
        if not url:
            continue

        conn.execute(
            "INSERT INTO site_websites (site_id, url) VALUES (?, ?)",
            (site_id, str(url))
        )
        count += 1

    return count


def main():
    print("Starting import...")

    if not SCHEMA_PATH.exists():
        raise FileNotFoundError(f"Missing schema file: {SCHEMA_PATH}")

    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(f"Missing manifest file: {MANIFEST_PATH}")

    if DB_PATH.exists():
        print("Removing old database...")
        DB_PATH.unlink()

    conn = connect_db()

    try:
        print("Creating tables...")
        reset_database(conn)

        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

        region_count = 0
        site_count = 0
        website_count = 0

        print("Importing JSON files...")

        for item in manifest["regions"]:
            region_name = item["region"]
            region_file = ROOT / item["file"]

            print(f"Importing region: {region_name}")

            region_data = json.loads(region_file.read_text(encoding="utf-8"))

            region_id = insert_region(conn, region_name)
            region_count += 1

            for site in region_data.get("sites", []):
                site_id = insert_site(conn, region_id, site)
                site_count += 1
                website_count += insert_websites(conn, site_id, site.get("websites", []))

        conn.commit()

        print()
        print("Import complete.")
        print(f"Database: {DB_PATH}")
        print(f"Regions: {region_count}")
        print(f"Sites: {site_count}")
        print(f"Websites: {website_count}")

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()


if __name__ == "__main__":
    main()