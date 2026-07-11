import {
	CellValue,
	Field,
	FilterCondition,
	FilterGroup,
	FilterOperator,
	Row,
	SortSpec,
	TableDocument,
	isNumericField,
	isSelectField,
	isTextLikeField,
} from "./types";
import { createId } from "./store";

export interface QueryParseResult {
	ok: boolean;
	group: FilterGroup;
	error?: string;
	query: string;
}

export interface RowGroup {
	key: string;
	label: string;
	rows: Row[];
}

const TEXT_OPS: FilterOperator[] = ["contains", "equals", "isEmpty", "isNotEmpty"];
const NUMBER_OPS: FilterOperator[] = ["equals", "gt", "lt", "isEmpty"];
const CHECKBOX_OPS: FilterOperator[] = ["isTrue", "isFalse"];
const DATE_OPS: FilterOperator[] = ["equals", "before", "after", "isEmpty"];
const SINGLE_OPS: FilterOperator[] = ["is", "isNot", "isAnyOf", "isEmpty"];
const MULTI_OPS: FilterOperator[] = [
	"contains",
	"containsAll",
	"containsAny",
	"isEmpty",
];
const ATTACH_OPS: FilterOperator[] = ["isEmpty", "isNotEmpty", "contains"];

export function operatorsForField(field: Field): FilterOperator[] {
	switch (field.type) {
		case "text":
		case "longText":
		case "url":
		case "email":
		case "phone":
			return TEXT_OPS;
		case "number":
		case "currency":
		case "percent":
		case "duration":
		case "rating":
		case "autoNumber":
			return NUMBER_OPS;
		case "checkbox":
			return CHECKBOX_OPS;
		case "date":
		case "datetime":
		case "createdTime":
		case "lastModifiedTime":
			return DATE_OPS;
		case "singleSelect":
			return SINGLE_OPS;
		case "multiSelect":
			return MULTI_OPS;
		case "attachment":
			return ATTACH_OPS;
	}
}

export function operatorLabel(op: FilterOperator): string {
	const labels: Record<FilterOperator, string> = {
		contains: "contains",
		equals: "equals",
		isEmpty: "is empty",
		isNotEmpty: "is not empty",
		gt: ">",
		lt: "<",
		isTrue: "is checked",
		isFalse: "is unchecked",
		before: "is before",
		after: "is after",
		is: "is",
		isNot: "is not",
		isAnyOf: "is any of",
		containsAll: "contains all of",
		containsAny: "contains any of",
	};
	return labels[op];
}

export function getVisibleRows(doc: TableDocument): Row[] {
	const { search, filters, sorts } = doc.view;
	let rows = doc.rows.filter((row) => matchesSearch(doc, row, search));
	rows = rows.filter((row) => matchesFilterGroup(doc, row, filters));
	if (sorts.length > 0) {
		rows = [...rows].sort((a, b) => compareRows(doc, a, b, sorts));
	}
	return rows;
}

export function getGroupedRows(doc: TableDocument): RowGroup[] {
	const rows = getVisibleRows(doc);
	const fieldId = doc.view.groupBy.fieldId;
	if (!fieldId) {
		return [{ key: "all", label: "", rows }];
	}
	const field = doc.fields.find((f) => f.id === fieldId);
	if (!field) {
		return [{ key: "all", label: "", rows }];
	}

	const map = new Map<string, RowGroup>();
	for (const row of rows) {
		const { key, label } = groupKeyForCell(field, row.cells[field.id]);
		const existing = map.get(key);
		if (existing) existing.rows.push(row);
		else map.set(key, { key, label, rows: [row] });
	}
	return Array.from(map.values());
}

function groupKeyForCell(
	field: Field,
	value: CellValue
): { key: string; label: string } {
	if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) {
		return { key: "__empty__", label: "(Empty)" };
	}
	if (isSelectField(field)) {
		if (field.type === "singleSelect") {
			const opt = field.options.find((o) => o.id === value);
			return { key: String(value), label: opt?.name ?? String(value) };
		}
		const ids = Array.isArray(value) ? value : [];
		const labels = ids.map(
			(id) => field.options.find((o) => o.id === id)?.name ?? id
		);
		return { key: ids.slice().sort().join(","), label: labels.join(", ") || "(Empty)" };
	}
	if (field.type === "checkbox") {
		return {
			key: value ? "true" : "false",
			label: value ? "Checked" : "Unchecked",
		};
	}
	if (field.type === "rating") {
		return { key: String(value), label: `${value} ★` };
	}
	return { key: String(value), label: String(value) };
}

export function matchesSearch(
	doc: TableDocument,
	row: Row,
	search: string
): boolean {
	const q = search.trim().toLowerCase();
	if (!q) return true;
	for (const field of doc.fields) {
		const value = row.cells[field.id];
		if (isTextLikeField(field)) {
			if (String(value ?? "").toLowerCase().includes(q)) return true;
		} else if (isNumericField(field)) {
			if (value != null && String(value).toLowerCase().includes(q)) return true;
		} else if (field.type === "attachment") {
			const paths = Array.isArray(value) ? value : [];
			if (paths.some((p) => p.toLowerCase().includes(q))) return true;
		} else if (isSelectField(field)) {
			const ids =
				field.type === "singleSelect"
					? typeof value === "string"
						? [value]
						: []
					: Array.isArray(value)
						? value
						: [];
			for (const id of ids) {
				const opt = field.options.find((o) => o.id === id);
				if (opt && opt.name.toLowerCase().includes(q)) return true;
			}
		}
	}
	return false;
}

export function matchesFilterGroup(
	doc: TableDocument,
	row: Row,
	group: FilterGroup
): boolean {
	const active = group.conditions.filter((c) => c.fieldId);
	if (active.length === 0) return true;
	if (group.logic === "and") {
		return active.every((c) => matchesCondition(doc, row, c));
	}
	return active.some((c) => matchesCondition(doc, row, c));
}

export function matchesCondition(
	doc: TableDocument,
	row: Row,
	condition: FilterCondition
): boolean {
	const field = doc.fields.find((f) => f.id === condition.fieldId);
	if (!field) return true;
	const value = row.cells[field.id];
	const op = condition.operator;
	const target = condition.value;

	if (isTextLikeField(field)) {
		const text = String(value ?? "");
		if (op === "isEmpty") return text.trim() === "";
		if (op === "isNotEmpty") return text.trim() !== "";
		if (op === "equals") return text.toLowerCase() === String(target ?? "").toLowerCase();
		if (op === "contains") {
			return text.toLowerCase().includes(String(target ?? "").toLowerCase());
		}
		if (op === "before") return text !== "" && text < String(target ?? "");
		if (op === "after") return text !== "" && text > String(target ?? "");
		return true;
	}

	if (isNumericField(field)) {
		const num = typeof value === "number" ? value : null;
		if (op === "isEmpty") return num == null;
		if (num == null) return false;
		const t = typeof target === "number" ? target : Number(target);
		if (Number.isNaN(t)) return false;
		if (op === "equals") return num === t;
		if (op === "gt") return num > t;
		if (op === "lt") return num < t;
		return true;
	}

	if (field.type === "checkbox") {
		const checked = Boolean(value);
		if (op === "isTrue") return checked;
		if (op === "isFalse") return !checked;
		return true;
	}

	if (field.type === "singleSelect") {
		const id = typeof value === "string" ? value : null;
		if (op === "isEmpty") return id == null;
		if (op === "is") return id === target;
		if (op === "isNot") return id !== target;
		if (op === "isAnyOf") {
			const list = Array.isArray(target) ? target : [];
			return id != null && list.includes(id);
		}
		return true;
	}

	if (field.type === "multiSelect" || field.type === "attachment") {
		const ids = Array.isArray(value) ? value : [];
		if (op === "isEmpty") return ids.length === 0;
		if (op === "isNotEmpty") return ids.length > 0;
		if (op === "contains") {
			return typeof target === "string" && ids.some((x) => x.includes(String(target)));
		}
		const list = Array.isArray(target)
			? target
			: typeof target === "string"
				? target.split(",").map((s) => s.trim()).filter(Boolean)
				: [];
		if (op === "containsAny") return list.some((id) => ids.includes(id));
		if (op === "containsAll") return list.every((id) => ids.includes(id));
		return true;
	}

	return true;
}

function compareRows(
	doc: TableDocument,
	a: Row,
	b: Row,
	sorts: SortSpec[]
): number {
	for (const sort of sorts) {
		const field = doc.fields.find((f) => f.id === sort.fieldId);
		if (!field) continue;
		const av = a.cells[field.id];
		const bv = b.cells[field.id];
		const cmp = compareValues(field, av, bv);
		if (cmp !== 0) return sort.direction === "asc" ? cmp : -cmp;
	}
	return 0;
}

function compareValues(field: Field, a: CellValue, b: CellValue): number {
	if (isNumericField(field)) {
		const an = typeof a === "number" ? a : Number.NEGATIVE_INFINITY;
		const bn = typeof b === "number" ? b : Number.NEGATIVE_INFINITY;
		return an - bn;
	}
	if (field.type === "checkbox") {
		return Number(Boolean(a)) - Number(Boolean(b));
	}
	if (isSelectField(field)) {
		const nameOf = (v: CellValue) => {
			if (field.type === "singleSelect") {
				const opt = field.options.find((o) => o.id === v);
				return opt?.name ?? "";
			}
			const ids = Array.isArray(v) ? v : [];
			return ids
				.map((id) => field.options.find((o) => o.id === id)?.name ?? "")
				.join(", ");
		};
		return nameOf(a).localeCompare(nameOf(b));
	}
	if (field.type === "attachment") {
		const as = Array.isArray(a) ? a.join(", ") : "";
		const bs = Array.isArray(b) ? b.join(", ") : "";
		return as.localeCompare(bs);
	}
	return String(a ?? "").localeCompare(String(b ?? ""));
}

export function parseQueryString(
	query: string,
	fields: Field[]
): QueryParseResult {
	const trimmed = query.trim();
	if (!trimmed) {
		return {
			ok: true,
			query: "",
			group: { logic: "and", conditions: [] },
		};
	}

	const tokens = tokenizeQuery(trimmed);
	const conditions: FilterCondition[] = [];

	for (const token of tokens) {
		const match = token.match(/^([^:]+):(.*)$/);
		if (!match) {
			return {
				ok: false,
				query,
				group: { logic: "and", conditions: [] },
				error: `Invalid token "${token}". Use field:value`,
			};
		}
		const fieldName = match[1].trim();
		let rawValue = match[2];
		const field = fields.find(
			(f) => f.name.toLowerCase() === fieldName.toLowerCase()
		);
		if (!field) {
			return {
				ok: false,
				query,
				group: { logic: "and", conditions: [] },
				error: `Unknown field "${fieldName}"`,
			};
		}

		let operator: FilterOperator = "equals";
		if (rawValue.startsWith("~")) {
			operator = "contains";
			rawValue = rawValue.slice(1);
		} else if (rawValue.startsWith(">")) {
			operator = "gt";
			rawValue = rawValue.slice(1);
		} else if (rawValue.startsWith("<")) {
			operator = "lt";
			rawValue = rawValue.slice(1);
		} else if (rawValue.startsWith("!")) {
			operator = "isNot";
			rawValue = rawValue.slice(1);
		}

		if (rawValue === "" || rawValue.toLowerCase() === "empty") {
			conditions.push({
				id: createId("c"),
				fieldId: field.id,
				operator: "isEmpty",
			});
			continue;
		}

		const condition = buildConditionFromQuery(field, operator, rawValue);
		if (!condition) {
			return {
				ok: false,
				query,
				group: { logic: "and", conditions: [] },
				error: `Unsupported query for field "${field.name}"`,
			};
		}
		conditions.push(condition);
	}

	return {
		ok: true,
		query,
		group: { logic: "and", conditions },
	};
}

function tokenizeQuery(input: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let inQuotes = false;
	for (let i = 0; i < input.length; i++) {
		const ch = input[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
			continue;
		}
		if (ch === " " && !inQuotes) {
			if (current) tokens.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	if (current) tokens.push(current);
	return tokens;
}

function buildConditionFromQuery(
	field: Field,
	requestedOp: FilterOperator,
	rawValue: string
): FilterCondition | null {
	const id = createId("c");
	const parts = rawValue.split(",").map((s) => s.trim()).filter(Boolean);

	if (isTextLikeField(field)) {
		let finalOp: FilterOperator = "equals";
		if (requestedOp === "contains") finalOp = "contains";
		else if (
			requestedOp === "gt" &&
			(field.type === "date" ||
				field.type === "datetime" ||
				field.type === "createdTime" ||
				field.type === "lastModifiedTime")
		) {
			finalOp = "after";
		} else if (
			requestedOp === "lt" &&
			(field.type === "date" ||
				field.type === "datetime" ||
				field.type === "createdTime" ||
				field.type === "lastModifiedTime")
		) {
			finalOp = "before";
		}
		return { id, fieldId: field.id, operator: finalOp, value: rawValue };
	}

	if (isNumericField(field)) {
		const num = Number(rawValue);
		if (Number.isNaN(num)) return null;
		const op: FilterOperator =
			requestedOp === "gt" || requestedOp === "lt" ? requestedOp : "equals";
		return { id, fieldId: field.id, operator: op, value: num };
	}

	if (field.type === "checkbox") {
		const truthy = ["true", "1", "yes", "checked"].includes(rawValue.toLowerCase());
		return {
			id,
			fieldId: field.id,
			operator: truthy ? "isTrue" : "isFalse",
		};
	}

	if (field.type === "singleSelect") {
		if (parts.length > 1 || requestedOp === "isAnyOf") {
			const ids = resolveOptionIds(field.options, parts);
			return { id, fieldId: field.id, operator: "isAnyOf", value: ids };
		}
		const optId = resolveOptionId(field.options, rawValue);
		if (!optId) return null;
		return {
			id,
			fieldId: field.id,
			operator: requestedOp === "isNot" ? "isNot" : "is",
			value: optId,
		};
	}

	if (field.type === "multiSelect") {
		const ids = resolveOptionIds(field.options, parts.length ? parts : [rawValue]);
		if (ids.length === 0) return null;
		if (
			ids.length === 1 &&
			requestedOp !== "containsAny" &&
			requestedOp !== "containsAll"
		) {
			return { id, fieldId: field.id, operator: "contains", value: ids[0] };
		}
		return {
			id,
			fieldId: field.id,
			operator: requestedOp === "containsAll" ? "containsAll" : "containsAny",
			value: ids,
		};
	}

	if (field.type === "attachment") {
		return { id, fieldId: field.id, operator: "contains", value: rawValue };
	}

	return null;
}

function resolveOptionId(
	options: { id: string; name: string }[],
	name: string
): string | null {
	const found = options.find(
		(o) => o.name.toLowerCase() === name.toLowerCase() || o.id === name
	);
	return found?.id ?? null;
}

function resolveOptionIds(
	options: { id: string; name: string }[],
	names: string[]
): string[] {
	return names
		.map((n) => resolveOptionId(options, n))
		.filter((id): id is string => id != null);
}

export function filtersToQueryString(
	group: FilterGroup,
	fields: Field[]
): string {
	const parts: string[] = [];
	for (const condition of group.conditions) {
		const field = fields.find((f) => f.id === condition.fieldId);
		if (!field) continue;
		const name = field.name.includes(" ") ? `"${field.name}"` : field.name;
		if (condition.operator === "isEmpty") {
			parts.push(`${name}:empty`);
			continue;
		}
		if (condition.operator === "isNotEmpty") continue;
		if (
			condition.operator === "contains" &&
			(field.type === "text" ||
				field.type === "longText" ||
				field.type === "url" ||
				field.type === "email" ||
				field.type === "phone")
		) {
			parts.push(`${name}:~${String(condition.value ?? "")}`);
			continue;
		}
		if (condition.operator === "gt") {
			parts.push(`${name}:>${String(condition.value ?? "")}`);
			continue;
		}
		if (condition.operator === "lt") {
			parts.push(`${name}:<${String(condition.value ?? "")}`);
			continue;
		}
		if (condition.operator === "isNot") {
			const label = optionLabel(field, condition.value ?? null);
			parts.push(`${name}:!${label}`);
			continue;
		}
		if (
			condition.operator === "isAnyOf" ||
			condition.operator === "containsAny" ||
			condition.operator === "containsAll"
		) {
			const ids = Array.isArray(condition.value) ? condition.value : [];
			const labels = ids.map((id) => optionLabel(field, id));
			parts.push(`${name}:${labels.join(",")}`);
			continue;
		}
		if (field.type === "checkbox") {
			parts.push(
				`${name}:${condition.operator === "isTrue" ? "true" : "false"}`
			);
			continue;
		}
		if (isSelectField(field)) {
			parts.push(`${name}:${optionLabel(field, condition.value ?? null)}`);
			continue;
		}
		parts.push(`${name}:${String(condition.value ?? "")}`);
	}
	return parts.join(" ");
}

function optionLabel(field: Field, value: CellValue): string {
	if (!isSelectField(field)) return String(value ?? "");
	if (typeof value === "string") {
		return field.options.find((o) => o.id === value)?.name ?? value;
	}
	return String(value ?? "");
}
