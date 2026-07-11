# Airtable Tabula

Local Airtable-like tables inside Obsidian — structured grids next to your notes, with optional Airtable.com sync.

Each table is a `.tabula` file (JSON) opened in a spreadsheet-style grid.

## Features

- **Import CSV / Excel** — turn a `.csv`, `.xlsx`, or `.xls` file into a table in one command
- **Field types** — text, long text, number, currency, percent, duration, rating, checkbox, date, date & time, URL, email, phone, single/multi select, attachments, auto number, created / last modified
- **Selects** — colored tags, searchable dropdowns, create-on-type, option manager
- **Views** — search, filter builder + query string, multi-sort, group by, hide fields, column resize/reorder, freeze primary column, row height
- **Optional Airtable sync** — link a base/table, then pull or push with a personal access token

## Install

### From a GitHub release

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/MehulG/airtable-tabula/releases/latest)
2. Put them in `.obsidian/plugins/airtable-tabula/` in your vault
3. Enable **Airtable Tabula** under Settings → Community plugins

### Development

```bash
npm install
npm run build
ln -s /absolute/path/to/airtable-tabula /path/to/vault/.obsidian/plugins/airtable-tabula
```

Then enable the plugin and use **Create new table** or **Import CSV / Excel as table** from the command palette.

## Import CSV / Excel

1. Command palette → **Import CSV / Excel as table**
2. Pick a `.csv`, `.xlsx`, or `.xls` file from your computer

What happens:

- The first row becomes column headers
- Column types are inferred (text, number, date, checkbox, or single select when a column has few distinct values)
- A new `.tabula` file is created in your vault and opened

Tip: In Excel or Google Sheets, “Save as CSV” also works if you don’t need a full workbook.

## Optional Airtable sync

1. Create a [personal access token](https://airtable.com/create/tokens) with:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`
   - Access to the bases you want to sync
2. Obsidian → Settings → Airtable Tabula → paste the token
3. Open a `.tabula` file → **Sync** → **Link Airtable table…**
4. Choose base + table (optionally replace local columns with the Airtable schema)
5. **Pull from Airtable** or **Push to Airtable**

Link metadata lives in the `.tabula` file. The token stays in plugin settings only. Sync is optional — the plugin works fully offline without it.

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

MIT · Maintainer [@MehulG](https://github.com/MehulG)

## Out of scope

Formulas, linked records, lookups/rollups, Kanban/Calendar/Gallery views. Sync does not auto-create Airtable fields or resolve edit conflicts beyond last pull/push.
