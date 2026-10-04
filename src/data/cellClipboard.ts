import {
	CellValue,
	Field,
	SelectOption,
	emptyCellValue,
	isReadOnlyField,
} from "./types";
import { createSelectOption, formatDuration, parseDuration } from "./store";

export type CellClipboardParseResult =
	| { ok: true; value: CellValue; field?: Field }
	| { ok: false; error: string };

export function cellClipboardText(field: Field, value: CellValue): string {
	if (value == null) return "";
	switch (field.type) {
		case "singleSelect":
			return field.options.find((option) => option.id === value)?.name ?? "";
		case "multiSelect":
			return Array.isArray(value)
				? value
						.map((id) => field.options.find((option) => option.id === id)?.name ?? "")
						.filter(Boolean)
						.join(", ")
				: "";
		case "checkbox":
			return value ? "TRUE" : "FALSE";
		case "duration":
			return typeof value === "number" ? formatDuration(value) : "";
		case "attachment":
			return Array.isArray(value) ? value.join("\n") : "";
		default:
			return Array.isArray(value) ? value.join(", ") : String(value);
	}
}

export function parseCellClipboardText(field: Field, text: string): CellClipboardParseResult {
	if (isReadOnlyField(field)) {
		return { ok: false, error: `${field.name} is read-only` };
	}

	const trimmed = text.trim();
	if (!trimmed) return { ok: true, value: emptyCellValue(field.type) };

	switch (field.type) {
		case "number":
		case "currency":
		case "percent":
		case "rating": {
			const normalized = trimmed.replace(/[$€£¥,\s]/g, "").replace(/%$/, "");
			const value = Number(normalized);
			return Number.isFinite(value)
				? { ok: true, value }
				: { ok: false, error: `“${text}” is not a valid number for ${field.name}` };
		}
		case "duration": {
			const value = parseDuration(trimmed);
			return value == null
				? { ok: false, error: `“${text}” is not a valid duration for ${field.name}` }
				: { ok: true, value };
		}
		case "checkbox": {
			const value = trimmed.toLocaleLowerCase();
			if (["true", "yes", "y", "1", "on", "checked"].includes(value)) {
				return { ok: true, value: true };
			}
			if (["false", "no", "n", "0", "off", "unchecked"].includes(value)) {
				return { ok: true, value: false };
			}
			return { ok: false, error: `“${text}” is not a valid checkbox value` };
		}
		case "date": {
			if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
				return isValidDate(trimmed)
					? { ok: true, value: trimmed }
					: { ok: false, error: `“${text}” is not a valid date for ${field.name}` };
			}
			const date = new Date(trimmed);
			return Number.isNaN(date.getTime())
				? { ok: false, error: `“${text}” is not a valid date for ${field.name}` }
				: { ok: true, value: date.toISOString().slice(0, 10) };
		}
		case "datetime": {
			const date = new Date(trimmed);
			return Number.isNaN(date.getTime())
				? { ok: false, error: `“${text}” is not a valid date and time for ${field.name}` }
				: { ok: true, value: date.toISOString() };
		}
		case "singleSelect": {
			const option = field.options.find(
				(candidate) =>
					candidate.id === trimmed ||
					candidate.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase()
			);
			if (option) return { ok: true, value: option.id };
			const added = createSelectOption(trimmed);
			const updatedField: Field = { ...field, options: [...field.options, added] };
			return { ok: true, value: added.id, field: updatedField };
		}
		case "multiSelect": {
			const names = text
				.split(/\r?\n|,\s*/)
				.map((name) => name.trim())
				.filter(Boolean);
			let options = [...field.options];
			const ids: string[] = [];
			for (const name of names) {
				let option: SelectOption | undefined = options.find(
					(candidate) =>
						candidate.id === name ||
						candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase()
				);
				if (!option) {
					option = createSelectOption(name);
					options = [...options, option];
				}
				if (!ids.includes(option.id)) ids.push(option.id);
			}
			const updatedField: Field =
				options.length === field.options.length ? field : { ...field, options };
			return {
				ok: true,
				value: ids,
				...(updatedField === field ? {} : { field: updatedField }),
			};
		}
		case "attachment": {
			const paths = text
				.split(/\r?\n/)
				.map((path) => path.trim())
				.filter(Boolean);
			return { ok: true, value: Array.from(new Set(paths)) };
		}
		case "text":
		case "longText":
		case "url":
		case "email":
		case "phone":
			return { ok: true, value: text };
		case "autoNumber":
		case "createdTime":
		case "lastModifiedTime":
			return { ok: false, error: `${field.name} is read-only` };
	}
}

function isValidDate(value: string): boolean {
	const date = new Date(`${value}T00:00:00.000Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
