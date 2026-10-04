# Airtable Tabula

Local Airtable-like tables inside Obsidian — structured grids next to your notes, with optional Airtable.com sync.

A `.tabula` file stores one or more independent tables, shown stacked vertically in the spreadsheet-style view. Existing single-table files continue to open unchanged.

## Features

- **Multiple tables per file** — add independent starter tables to one `.tabula` file, or remove a table when it is no longer needed
- **Optional top horizontal scrollbar** — enable a synchronized scrollbar above each grid from Settings → Airtable Tabula; disabled by default
- **Import and paste spreadsheets** — import `.csv` / `.xlsx` files, or paste spreadsheet cells/files directly into an open table and choose Replace, Create new, or Append
- **Reorder rows and columns** — drag row and column handles on desktop or touch devices
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

Then enable the plugin. The left ribbon table icon opens actions for creating a table, pasting spreadsheet data, or importing a CSV/XLSX file. Create and import commands also remain available from the command palette.

## Import CSV / Excel

1. Command palette → **Import CSV / Excel as table**
2. Pick a `.csv` or `.xlsx` file from your computer

What happens:

- The first row becomes column headers
- Column types are inferred (text, number, date, checkbox, or single select when a column has few distinct values)
- A new `.tabula` file is created in your vault and opened

Tip: In Excel or Google Sheets, “Save as CSV” also works if you don’t need a full workbook.

## Paste spreadsheet data directly

Open a `.tabula` table, focus the grid, and paste a spreadsheet range or a `.csv` / `.xlsx` file from the clipboard. The plugin previews the data and offers three destinations:

- **Replace current table** — replace its fields and rows while keeping the current file and table name. View settings reset. Replacing an Airtable-linked table also unlinks it.
- **Create new table** — create and open a new `.tabula` file.
- **Append to current table** — match incoming columns by header name, append the rows, and add any new columns without changing existing data.

The preview treats the first row as headers by default; turn that off when the copied range has no header row. Spreadsheet cell ranges copied from Excel or Google Sheets are supported as clipboard text. Pasting actual files depends on whether the operating system exposes the file to Obsidian’s clipboard; if it does not, use **Import CSV / Excel as table** from the ribbon or command palette.

The left ribbon table icon opens the create, paste, and import actions. The command **Paste spreadsheet from clipboard** is also available in the command palette when a Tabula table is active.

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
