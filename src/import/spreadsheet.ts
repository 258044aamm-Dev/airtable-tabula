import * as XLSX from "xlsx";
import {
	CellValue,
	Field,
	FieldType,
	Row,
	TableDocument,
} from "../data/types";
import {
	createEmptyView,
	createId,
	createSelectOption,
} from "../data/store";

export function spreadsheetToTable(
	buffer: ArrayBuffer,
	fileName: string
): TableDocument {
	const workbook = XLSX.read(buffer, {
		type: "array",
		cellDates: true,
		raw: false,
	});
	const sheetName = workbook.SheetNames[0];
	if (!sheetName) {
		throw new Error("Spreadsheet has no sheets");
	}
	const sheet = workbook.Sheets[sheetName];
	const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(
		sheet,
		{
			header: 1,
			defval: "",
			blankrows: false,
			raw: false,
		}
	) as unknown[][];

	if (!matrix.length) {
		throw new Error("Spreadsheet is empty");
	}

	const headerRow = matrix[0].map((cell, i) => {
		const label = String(cell ?? "").trim();
		return label || `Column ${i + 1}`;
	});

	// Ensure unique header names
	const seen = new Map<string, number>();
	const headers = headerRow.map((name) => {
		const count = seen.get(name) ?? 0;
		seen.set(name, count + 1);
		return count === 0 ? name : `${name} ${count + 1}`;
	});

	const dataRows = matrix.slice(1).filter((row) =>
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
				options: unique.map((name, i) =>
					createSelectOption(name, undefined)
				),
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

	const baseName = fileName.replace(/\.(csv|xlsx|xls)$/i, "") || "Imported";

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

function inferFieldType(samples: unknown[]): FieldType {
	if (samples.length === 0) return "text";

	const asStrings = samples.map((s) => String(s).trim());
	if (asStrings.every(isCheckboxLiteral)) return "checkbox";
	if (samples.every((s) => isNumberLike(s))) return "number";
	if (samples.every((s) => isDateLike(s))) return "date";

	const unique = uniqueStrings(samples);
	// Low-cardinality text → single select (helpful for Status-like columns)
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
	// ISO or common date-only
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
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
		input.onchange = () => {
			const file = input.files?.[0] ?? null;
			resolve(file);
		};
		input.addEventListener("cancel", () => resolve(null));
		input.click();
	});
}

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
	return file.arrayBuffer();
}
