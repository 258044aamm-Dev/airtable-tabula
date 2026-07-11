# Airtable Tabula

Local Airtable-like tables inside Obsidian. Structured grids with typed fields, selects, search, filters, and optional Airtable.com sync.

Each table is a `.tabula` file (JSON) opened in a spreadsheet-style grid.

## Features

- **Field types:** single line text, long text, number, currency, percent, duration, rating, checkbox, date, date & time, URL, email, phone, single/multi select, attachment (vault paths), auto number, created time, last modified time
- **Selects:** colored tags, searchable dropdowns, create-on-type, option manager
- **Views:** search, filter builder + query string, multi-sort, group by, hide fields, column resize/reorder, freeze primary, row height
- **Optional Airtable sync:** link a table, pull/push records with a personal access token

## Install (development)

1. `npm install`
2. `npm run build`
3. Symlink into your vault (folder name must match plugin id `airtable-tabula`):

```bash
ln -s /absolute/path/to/airtable-tabula /path/to/vault/.obsidian/plugins/airtable-tabula
```

4. Settings → Community plugins → enable **Airtable Tabula**
5. Command palette → **Create new table**

Required files: `main.js`, `manifest.json`, `styles.css`.

## Optional Airtable sync

1. Create a [personal access token](https://airtable.com/create/tokens) with:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`
   - Access to the bases you want to sync
2. Obsidian → Settings → Airtable Tabula → paste the token
3. Open a `.tabula` file → **Sync** → **Link Airtable table…**
4. Choose base + table (optionally replace local schema)
5. **Pull from Airtable** / **Push to Airtable**

Link metadata (`baseId`, `tableId`, field/record maps) is stored in the `.tabula` file. The token stays in plugin settings only.

## Query syntax

```text
status:Done tags:urgent,design name:~ship
```

| Pattern | Meaning |
|---------|---------|
| `field:value` | equals / is / contains (multi) |
| `field:~value` | text contains |
| `field:>n` / `field:<n` | number (or date before/after) |
| `field:!value` | is not (single select) |
| `field:a,b` | is any of / contains any |
| `field:empty` | is empty |

Field names are case-insensitive. Quote names with spaces: `"My Field":Done`.

## Attachments

Attachment cells store vault-relative paths (e.g. `Assets/photo.png`). Type a path and press Enter.

## License

MIT

## Out of scope

Formulas, linked records, lookups/rollups, Kanban/Calendar/Gallery views. Sync does not auto-create Airtable fields or resolve conflicts beyond last pull/push.
