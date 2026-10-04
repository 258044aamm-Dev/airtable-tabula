import { readSheet } from "read-excel-file/browser";
import {
	CellValue,
	Field,
	FieldType,
	Row,
	SelectOption,
	TableDocument,
	emptyCellValue,
	isReadOnlyField,
} from "../data/types";
import {
	createEmptyView,
	createId,
	createRow,
	createSelectOption,
} from "../data/store";

const CSV_MIME = "text/csv";
const TSV_MIME = "text/tab-separated-values";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function spreadsheetToTable(
	file: File,
	firstRowIsHeader = true
): Promise<TableDocument> {
	const matrix = await spreadsheetToMatrix(file);
	return matrixToTable(matrix, file.name, firstRowIsHeader);
}

export async function spreadsheetToMatrix(file: File): Promise<unknown[][]> {
	const name = file.name.toLowerCase();
	if (name.endsWith(".csv") || file.type === CSV_MIME) {
		return parseCsv(await file.text());
	}
	if (name.endsWith(".xlsx") || file.type === XLSX_MIME) {
		return await readSheet(file);
	}
	throw new Error("Unsupported file type. Use .csv or .xlsx");
}

/**
 * Convert a parsed spreadsheet matrix into the same document shape used by the
 * existing import flow. The default header behavior intentionally matches the
 * importer: the first row supplies field names.
 */
export function matrixToTable(
	matrix: unknown[][],
	fileName: string,
	firstRowIsHeader = true
): TableDocument {
	if (!matrix.length) {
		throw new Error("Spreadsheet is empty");
	}

	const maxColumns = matrix.reduce((max, row) => Math.max(max, row.length), 0);
	if (maxColumns === 0) {
		throw new Error("Spreadsheet has no columns");
	}

	const headerRow = firstRowIsHeader
		? matrix[0].map((cell, i) => {
				const label = String(cell ?? "").trim();
				return label || `Column ${i + 1}`;
			})
		: Array.from({ length: maxColumns }, (_, i) => `Column ${i + 1}`);

	const seen = new Map<string, number>();
	const headers = headerRow.map((name) => {
		const count = seen.get(name) ?? 0;
		seen.set(name, count + 1);
		return count === 0 ? name : `${name} ${count + 1}`;
	});

	const dataRows = (firstRowIsHeader ? matrix.slice(1) : matrix).filter((row) =>
		row.some((cell) => String(cell ?? "").trim() !== "")
	);

	const columns = headers.map((name, colIndex) => {
		const samples = dataRows
			.map((row) => row[colIndex])
			.filter((v) => v != null && String(v).trim() !== "");
		return { name, type: inferFieldType(samples), samples };
	});

	const fields: Field[] = columns.map((col) => {
		const id = createId("f");
		if (col.type === "singleSelect") {
			const unique = uniqueStrings(col.samples).slice(0, 50);
			return {
				id,
				name: col.name,
				type: "singleSelect" as const,
				options: unique.map((name) => createSelectOption(name, undefined)),
			};
		}
		if (col.type === "checkbox") {
			return { id, name: col.name, type: "checkbox" };
		}
		if (col.type === "number") {
			return { id, name: col.name, type: "number" };
		}
		if (col.type === "date") {
			return { id, name: col.name, type: "date" };
		}
		return { id, name: col.name, type: "text" };
	});

	const rows: Row[] = dataRows.map((raw) => {
		const cells: Record<string, CellValue> = {};
		fields.forEach((field, colIndex) => {
			cells[field.id] = coerceCell(field, raw[colIndex]);
		});
		return { id: createId("r"), cells };
	});

	const baseName = fileName.replace(/\.(csv|xlsx)$/i, "") || "Imported";

	return {
		version: 1,
		name: baseName,
		fields,
		rows,
		view: createEmptyView(),
		autoNumberNext: rows.length + 1,
		sync: null,
	};
}

/**
 * Parse clipboard text only when it looks like a spreadsheet range. Plain text
 * without a tabular delimiter is left to the focused cell editor.
 */
export function clipboardTextToMatrix(
	text: string,
	types: readonly string[] = []
): unknown[][] | null {
	if (!text.trim()) return null;
	const normalizedTypes = types.map((type) => type.toLowerCase());
	const isCsv = normalizedTypes.includes(CSV_MIME);
	const isTsv = normalizedTypes.includes(TSV_MIME);

	if (text.includes("\t") || isTsv) {
		const matrix = parseDelimited(text, "\t");
		return matrix.some((row) => row.length > 1) || matrix.length > 1 ? matrix : null;
	}

	if (isCsv || text.includes("\n") || text.includes("\r")) {
		const matrix = parseCsv(text);
		return matrix.some((row) => row.length > 1) || matrix.length > 1 ? matrix : null;
	}

	// A one-line CSV payload is ambiguous with ordinary cell text. Only treat
	// it as a spreadsheet when the clipboard explicitly labels it as CSV.
	if (isCsv) return parseCsv(text);
	return null;
}

/** Extract plain-text cells from an HTML clipboard table when available. */
export function clipboardHtmlToMatrix(html: string): unknown[][] | null {
	if (!/<table[\s>]/i.test(html) || typeof DOMParser === "undefined") return null;
	const parsed = new DOMParser().parseFromString(html, "text/html");
	const table = parsed.querySelector("table");
	if (!table) return null;
	const rows = Array.from(table.rows).map((row) =>
		Array.from(row.cells).map((cell) => cell.textContent ?? "")
	);
	return rows.length ? rows : null;
}

export interface ClipboardSpreadsheet {
	matrix: unknown[][];
	sourceName: string;
}

function singleLineCsvToMatrix(text: string): unknown[][] | null {
	if (/[\r\n\t]/.test(text)) return null;
	const matrix = parseCsv(text);
	return matrix[0]?.length > 1 ? matrix : null;
}

/** Read spreadsheet text or an actual CSV/XLSX clipboard item when permitted. */
export async function readSpreadsheetClipboard(): Promise<ClipboardSpreadsheet | null> {
	if (typeof navigator === "undefined" || !navigator.clipboard) return null;
	const clipboard = navigator.clipboard;
	let readError: unknown;

	if (clipboard.read) {
		try {
			const items = await clipboard.read();
			for (const item of items) {
				const fileType = item.types.find((type) => type === CSV_MIME || type === XLSX_MIME);
				if (fileType) {
					const blob = await item.getType(fileType);
					const fileName = fileType === XLSX_MIME ? "Clipboard.xlsx" : "Clipboard.csv";
					const file = new File([blob], fileName, { type: fileType });
					return { matrix: await spreadsheetToMatrix(file), sourceName: fileName };
				}

				if (item.types.includes("text/html")) {
					const html = await (await item.getType("text/html")).text();
					const matrix = clipboardHtmlToMatrix(html);
					if (matrix) return { matrix, sourceName: "Clipboard Data" };
				}

				if (item.types.includes("text/plain")) {
					const text = await (await item.getType("text/plain")).text();
					const matrix =
						clipboardTextToMatrix(text, item.types) ?? singleLineCsvToMatrix(text);
					if (matrix) return { matrix, sourceName: "Clipboard Data" };
				}
			}
		} catch (error) {
			readError = error;
		}
	}

	if (clipboard.readText) {
		try {
			const text = await clipboard.readText();
			const matrix = clipboardTextToMatrix(text) ?? singleLineCsvToMatrix(text);
			if (matrix) return { matrix, sourceName: "Clipboard Data" };
		} catch (error) {
			readError ??= error;
		}
	}

	if (readError) throw readError;
	return null;
}

/**
 * Append rows from an imported/pasted document without replacing existing
 * schema or data. Incoming fields match current fields by normalized name;
 * unmatched columns are added using the inferred incoming field type.
 */
export function appendSpreadsheetToTable(
	current: TableDocument,
	incoming: TableDocument
): { doc: TableDocument; addedFields: number; addedRows: number } {
	const fields = [...current.fields];
	const fieldByName = new Map<string, number>();
	fields.forEach((field, index) => {
		const key = normalizeHeader(field.name);
		if (!fieldByName.has(key)) fieldByName.set(key, index);
	});

	const sourceToTarget = new Map<string, number>();
	let addedFields = 0;
	for (const sourceField of incoming.fields) {
		const key = normalizeHeader(sourceField.name);
		let targetIndex = fieldByName.get(key);
		if (targetIndex == null) {
			const added = cloneFieldWithNewIds(sourceField);
			targetIndex = fields.length;
			fields.push(added);
			fieldByName.set(key, targetIndex);
			addedFields += 1;
		}
		sourceToTarget.set(sourceField.id, targetIndex);
	}

	const existingRows = current.rows.map((row) => {
		const cells = { ...row.cells };
		for (const field of fields.slice(current.fields.length)) {
			cells[field.id] = emptyCellValue(field.type);
		}
		return { ...row, cells };
	});

	let nextAuto = Math.max(current.autoNumberNext ?? 1, nextAutoNumber(fields, current.rows));
	const appendedRows: Row[] = [];
	for (const sourceRow of incoming.rows) {
		const generated = createRow(fields, nextAuto);
		nextAuto = generated.nextAuto;
		const cells = { ...generated.row.cells };

		for (const sourceField of incoming.fields) {
			const targetIndex = sourceToTarget.get(sourceField.id);
			if (targetIndex == null) continue;
			const targetField = fields[targetIndex];
			if (isReadOnlyField(targetField)) continue;
			const raw = sourceCellAsRaw(sourceField, sourceRow.cells[sourceField.id]);
			cells[targetField.id] = coerceForTargetField(
				fields,
				targetIndex,
				raw
			);
		}
		appendedRows.push({ ...generated.row, cells });
	}

	return {
		doc: {
			...current,
			fields,
			rows: [...existingRows, ...appendedRows],
			autoNumberNext: nextAuto,
		},
		addedFields,
		addedRows: appendedRows.length,
	};
}

function cloneFieldWithNewIds(field: Field): Field {
	const id = createId("f");
	if (field.type === "singleSelect" || field.type === "multiSelect") {
		return {
			...field,
			id,
			options: field.options.map((option) => ({
				...option,
				id: createId("o"),
			})),
		};
	}
	return { ...field, id };
}

function nextAutoNumber(fields: Field[], rows: Row[]): number {
	let next = 1;
	for (const field of fields) {
		if (field.type !== "autoNumber") continue;
		for (const row of rows) {
			const value = row.cells[field.id];
			if (typeof value === "number") next = Math.max(next, value + 1);
		}
	}
	return next;
}

function normalizeHeader(name: string): string {
	return name.trim().toLocaleLowerCase();
}

function sourceCellAsRaw(field: Field, value: CellValue): unknown {
	if (field.type === "singleSelect") {
		return field.options.find((option) => option.id === value)?.name ?? "";
	}
	if (field.type === "multiSelect" && Array.isArray(value)) {
		return value.map(
			(id) => field.options.find((option) => option.id === id)?.name ?? ""
		);
	}
	return value;
}

function coerceForTargetField(
	fields: Field[],
	fieldIndex: number,
	raw: unknown
): CellValue {
	let field = fields[fieldIndex];
	if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
		return emptyCellValue(field.type);
	}

	switch (field.type) {
		case "checkbox": {
			if (typeof raw === "boolean") return raw;
			const text = String(raw).trim().toLowerCase();
			return ["true", "yes", "y", "1", "checked"].includes(text);
		}
		case "number":
		case "currency":
		case "percent":
		case "duration":
		case "rating": {
			if (typeof raw === "number" && Number.isFinite(raw)) return raw;
			const text = String(raw).trim().replace(/,/g, "").replace(/%$/, "");
			const number = Number(text);
			return Number.isFinite(number) ? number : null;
		}
		case "date": {
			if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
				return raw.toISOString().slice(0, 10);
			}
			const text = String(raw).trim();
			const date = new Date(text);
			return Number.isNaN(date.getTime()) ? text.slice(0, 10) : date.toISOString().slice(0, 10);
		}
		case "datetime": {
			if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString();
			const text = String(raw).trim();
			const date = new Date(text);
			return Number.isNaN(date.getTime()) ? text : date.toISOString();
		}
		case "singleSelect": {
			const name = String(raw).trim();
			let option = field.options.find(
				(candidate) => candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase()
			);
			if (!option) {
				option = createSelectOption(name);
				field = { ...field, options: [...field.options, option] };
				fields[fieldIndex] = field;
			}
			return option.id;
		}
		case "multiSelect": {
			const values = Array.isArray(raw) ? raw : [raw];
			const ids: string[] = [];
			for (const value of values) {
				const name = String(value).trim();
				if (!name) continue;
				let option: SelectOption | undefined = field.options.find(
					(candidate) => candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase()
				);
				if (!option) {
					option = createSelectOption(name);
					field = { ...field, options: [...field.options, option] };
					fields[fieldIndex] = field;
				}
				ids.push(option.id);
			}
			return ids;
		}
		case "attachment":
			return Array.isArray(raw) ? raw.map(String) : [String(raw)];
		default:
			return String(raw);
	}
}

/** Minimal RFC 4180-ish parser (quoted fields, escaped quotes). */
export function parseCsv(text: string): string[][] {
	return parseDelimited(text, ",");
}

export function parseTsv(text: string): string[][] {
	return parseDelimited(text, "\t");
}

function parseDelimited(text: string, delimiter: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let i = 0;
	let inQuotes = false;
	const s = text.replace(/^\uFEFF/, "");

	while (i < s.length) {
		const c = s[i];
		if (inQuotes) {
			if (c === '"') {
				if (s[i + 1] === '"') {
					cell += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i += 1;
				continue;
			}
			cell += c;
			i += 1;
			continue;
		}
		if (c === '"') {
			inQuotes = true;
			i += 1;
			continue;
		}
		if (c === delimiter) {
			row.push(cell);
			cell = "";
			i += 1;
			continue;
		}
		if (c === "\r") {
			i += 1;
			continue;
		}
		if (c === "\n") {
			row.push(cell);
			rows.push(row);
			row = [];
			cell = "";
			i += 1;
			continue;
		}
		cell += c;
		i += 1;
	}
	if (cell.length > 0 || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}
	return rows;
}

function inferFieldType(samples: unknown[]): FieldType {
	if (samples.length === 0) return "text";

	const asStrings = samples.map((s) => String(s).trim());
	if (asStrings.every(isCheckboxLiteral)) return "checkbox";
	if (samples.every((s) => isNumberLike(s))) return "number";
	if (samples.every((s) => isDateLike(s))) return "date";

	const unique = uniqueStrings(samples);
	if (
		unique.length >= 2 &&
		unique.length <= 20 &&
		unique.length <= Math.max(3, Math.floor(samples.length * 0.5))
	) {
		return "singleSelect";
	}

	return "text";
}

function uniqueStrings(samples: unknown[]): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const s of samples) {
		const v = String(s).trim();
		if (!v || seen.has(v.toLowerCase())) continue;
		seen.add(v.toLowerCase());
		out.push(v);
	}
	return out;
}

function isCheckboxLiteral(v: string): boolean {
	const s = v.toLowerCase();
	return ["true", "false", "yes", "no", "y", "n", "1", "0", "checked", "unchecked"].includes(
		s
	);
}

function isNumberLike(v: unknown): boolean {
	if (typeof v === "number" && !Number.isNaN(v)) return true;
	if (v instanceof Date) return false;
	const s = String(v).trim().replace(/,/g, "");
	if (!s) return false;
	return /^-?\d+(\.\d+)?%?$/.test(s);
}

function isDateLike(v: unknown): boolean {
	if (v instanceof Date && !Number.isNaN(v.getTime())) return true;
	const s = String(v).trim();
	if (!s) return false;
	if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
	if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
		const t = Date.parse(s);
		return !Number.isNaN(t);
	}
	return false;
}

function coerceCell(field: Field, raw: unknown): CellValue {
	if (raw == null || String(raw).trim() === "") {
		if (field.type === "checkbox") return false;
		if (field.type === "number") return null;
		if (field.type === "singleSelect") return null;
		return "";
	}

	switch (field.type) {
		case "checkbox": {
			const s = String(raw).trim().toLowerCase();
			return ["true", "yes", "y", "1", "checked"].includes(s);
		}
		case "number": {
			if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
			const s = String(raw).trim().replace(/,/g, "").replace(/%$/, "");
			const n = Number(s);
			return Number.isNaN(n) ? null : n;
		}
		case "date": {
			if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
				return raw.toISOString().slice(0, 10);
			}
			const s = String(raw).trim();
			const d = new Date(s);
			if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
			return s.slice(0, 10);
		}
		case "singleSelect": {
			if (field.type !== "singleSelect") return null;
			const name = String(raw).trim();
			const opt = field.options.find(
				(o) => o.name.toLowerCase() === name.toLowerCase()
			);
			return opt?.id ?? null;
		}
		default:
			return String(raw);
	}
}

export function pickSpreadsheetFile(): Promise<File | null> {
	return new Promise((resolve) => {
		const input = activeDocument.createElement("input");
		input.type = "file";
		input.accept =
			".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
		input.onchange = () => {
			const file = input.files?.[0] ?? null;
			resolve(file);
		};
		input.addEventListener("cancel", () => resolve(null));
		input.click();
	});
}
