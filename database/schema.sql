CREATE TABLE regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    region_id INTEGER NOT NULL,
    number INTEGER NOT NULL,

    name TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,

    phone TEXT,
    hours TEXT,

    description TEXT,
    notes TEXT,
    type TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(region_id)
        REFERENCES regions(id),

    UNIQUE(region_id, number)
);

CREATE TABLE site_websites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    site_id INTEGER NOT NULL,

    url TEXT NOT NULL,

    FOREIGN KEY(site_id)
        REFERENCES sites(id)
);