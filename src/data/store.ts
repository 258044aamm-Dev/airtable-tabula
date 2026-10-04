import {
	CellValue,
	Field,
	FieldType,
	FilterGroup,
	FilterOperator,
	Row,
	RowHeight,
	SELECT_COLORS,
	SelectColor,
	SelectOption,
	SyncConfig,
	TableDocument,
	TableEntry,
	TableFileDocument,
	ViewState,
	emptyCellValue,
	isSelectField,
} from "./types";

let counter = 0;

export function createId(prefix: string): string {
	counter += 1;
	return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function reorderById<T extends { id: string }>(
	items: T[],
	fromId: string,
	toId: string,
	side: "before" | "after"
): T[] {
	if (fromId === toId) return items;
	const fromIndex = items.findIndex((item) => item.id === fromId);
	if (fromIndex < 0 || !items.some((item) => item.id === toId)) return items;
	const next = [...items];
	const [moved] = next.splice(fromIndex, 1);
	const targetIndex = next.findIndex((item) => item.id === toId);
	if (targetIndex < 0) return items;
	const insertIndex = targetIndex + (side === "after" ? 1 : 0);
	if (insertIndex === fromIndex) return items;
	next.splice(insertIndex, 0, moved);
	return next;
}

export function nowIso(): string {
	return new Date().toISOString();
}

export function createEmptyView(): ViewState {
	return {
		sorts: [],
		filters: { logic: "and", conditions: [] },
		search: "",
		query: "",
		hiddenFieldIds: [],
		groupBy: { fieldId: null },
		columnWidths: {},
		rowHeight: "medium",
		frozenPrimary: false,
	};
}

export function createDefaultTable(name = "Untitled"): TableDocument {
	const nameFieldId = createId("f");
	const statusFieldId = createId("f");
	const tagsFieldId = createId("f");
	const todo = createSelectOption("Todo", "gray");
	const doing = createSelectOption("In progress", "blue");
	const done = createSelectOption("Done", "green");
	const urgent = createSelectOption("Urgent", "red");
	const design = createSelectOption("Design", "purple");

	return {
		version: 1,
		name,
		autoNumberNext: 3,
		fields: [
			{ id: nameFieldId, name: "Name", type: "text" },
			{
				id: statusFieldId,
				name: "Status",
				type: "singleSelect",
				options: [todo, doing, done],
			},
			{
				id: tagsFieldId,
				name: "Tags",
				type: "multiSelect",
				options: [urgent, design],
			},
		],
		rows: [
			{
				id: createId("r"),
				cells: {
					[nameFieldId]: "Ship plugin",
					[statusFieldId]: todo.id,
					[tagsFieldId]: [urgent.id],
				},
			},
			{
				id: createId("r"),
				cells: {
					[nameFieldId]: "Polish filters",
					[statusFieldId]: doing.id,
					[tagsFieldId]: [design.id],
				},
			},
		],
		view: createEmptyView(),
	};
}

export function createSelectOption(
	name: string,
	color?: SelectColor
): SelectOption {
	return {
		id: createId("o"),
		name,
		color: color ?? SELECT_COLORS[Math.floor(Math.random() * SELECT_COLORS.length)],
	};
}

export function createField(type: FieldType, name?: string): Field {
	const id = createId("f");
	const label = name ?? defaultFieldName(type);
	switch (type) {
		case "singleSelect":
			return {
				id,
				name: label,
				type,
				options: [
					createSelectOption("Option A", "blue"),
					createSelectOption("Option B", "green"),
				],
			};
		case "multiSelect":
			return {
				id,
				name: label,
				type,
				options: [
					createSelectOption("Tag A", "purple"),
					createSelectOption("Tag B", "orange"),
				],
			};
		case "currency":
			return { id, name: label, type, symbol: "$" };
		case "rating":
			return { id, name: label, type, max: 5 };
		case "text":
			return { id, name: label, type };
		case "longText":
			return { id, name: label, type };
		case "number":
			return { id, name: label, type };
		case "percent":
			return { id, name: label, type };
		case "duration":
			return { id, name: label, type };
		case "checkbox":
			return { id, name: label, type };
		case "date":
			return { id, name: label, type };
		case "datetime":
			return { id, name: label, type };
		case "url":
			return { id, name: label, type };
		case "email":
			return { id, name: label, type };
		case "phone":
			return { id, name: label, type };
		case "attachment":
			return { id, name: label, type };
		case "autoNumber":
			return { id, name: label, type };
		case "createdTime":
			return { id, name: label, type };
		case "lastModifiedTime":
			return { id, name: label, type };
	}
}

function defaultFieldName(type: FieldType): string {
	const map: Record<FieldType, string> = {
		text: "Name",
		longText: "Notes",
		number: "Number",
		currency: "Amount",
		percent: "Percent",
		duration: "Duration",
		rating: "Rating",
		checkbox: "Done",
		date: "Date",
		datetime: "Date & time",
		url: "URL",
		email: "Email",
		phone: "Phone",
		singleSelect: "Status",
		multiSelect: "Tags",
		attachment: "Attachments",
		autoNumber: "Auto number",
		createdTime: "Created",
		lastModifiedTime: "Last modified",
	};
	return map[type];
}

export function createRow(fields: Field[], autoNumberNext = 1): {
	row: Row;
	nextAuto: number;
} {
	const cells: Record<string, CellValue> = {};
	const created = nowIso();
	let nextAuto = autoNumberNext;
	for (const field of fields) {
		if (field.type === "autoNumber") {
			cells[field.id] = nextAuto;
			nextAuto += 1;
		} else if (field.type === "createdTime" || field.type === "lastModifiedTime") {
			cells[field.id] = created;
		} else {
			cells[field.id] = emptyCellValue(field.type);
		}
	}
	return { row: { id: createId("r"), cells }, nextAuto };
}

export function touchLastModified(row: Row, fields: Field[]): Row {
	const stamp = nowIso();
	const cells = { ...row.cells };
	for (const field of fields) {
		if (field.type === "lastModifiedTime") {
			cells[field.id] = stamp;
		}
	}
	return { ...row, cells };
}

export function parseTableDocument(raw: string): TableDocument {
	if (!raw.trim()) {
		return createDefaultTable();
	}
	const parsed = JSON.parse(raw) as Partial<TableDocument>;
	if (!parsed || typeof parsed !== "object") {
		throw new Error("Invalid table document");
	}

	const fields = Array.isArray(parsed.fields) ? parsed.fields.map(normalizeField) : [];
	const rows = Array.isArray(parsed.rows)
		? parsed.rows.map((row) => normalizeRow(row, fields))
		: [];

	return {
		version: 1,
		name: typeof parsed.name === "string" ? parsed.name : "Untitled",
		fields,
		rows,
		view: normalizeView(parsed.view),
		autoNumberNext:
			typeof parsed.autoNumberNext === "number" ? parsed.autoNumberNext : rows.length + 1,
		sync: normalizeSync(parsed.sync),
	};
}

export function serializeTableDocument(doc: TableDocument): string {
	return JSON.stringify(doc, null, "\t");
}

export function createTableEntry(table: TableDocument): TableEntry {
	return { id: createId("t"), table };
}

export function createTableFileDocument(table: TableDocument): TableFileDocument {
	return { tables: [createTableEntry(table)] };
}

/**
 * Read both legacy single-table files and the version-2 multi-table envelope.
 * Legacy documents are wrapped in memory and remain serialized in their old
 * shape until a second table is added.
 */
export function parseTableFileDocument(raw: string): TableFileDocument {
	if (!raw.trim()) return createTableFileDocument(createDefaultTable());

	const parsed: unknown = JSON.parse(raw);
	if (
		typeof parsed === "object" &&
		parsed !== null &&
		Reflect.get(parsed, "version") === 2 &&
		Array.isArray(Reflect.get(parsed, "tables"))
	) {
		const seenIds = new Set<string>();
		const tables = (Reflect.get(parsed, "tables") as unknown[]).map((entry): TableEntry => {
			const candidate =
				typeof entry === "object" && entry !== null ? Reflect.get(entry, "table") : undefined;
			const rawTable =
				typeof candidate === "object" && candidate !== null ? candidate : {};
			const table = parseTableDocument(JSON.stringify(rawTable));
			const candidateId =
				typeof entry === "object" && entry !== null ? Reflect.get(entry, "id") : undefined;
			let id = typeof candidateId === "string" && candidateId ? candidateId : createId("t");
			if (seenIds.has(id)) id = createId("t");
			seenIds.add(id);
			return { id, table };
		});
		return tables.length > 0
			? { tables }
			: createTableFileDocument(createDefaultTable());
	}

	return createTableFileDocument(parseTableDocument(raw));
}

export function serializeTableFileDocument(file: TableFileDocument): string {
	if (file.tables.length === 1) {
		return serializeTableDocument(file.tables[0].table);
	}
	return JSON.stringify(
		{
			version: 2,
			tables: file.tables.map(({ id, table }) => ({ id, table })),
		},
		null,
		"\t"
	);
}

function normalizeField(field: Partial<Field>): Field {
	const id = typeof field.id === "string" ? field.id : createId("f");
	const name = typeof field.name === "string" ? field.name : "Field";
	const type: FieldType = field.type ?? "text";
	if (type === "singleSelect" || type === "multiSelect") {
		const options = Array.isArray((field as { options?: SelectOption[] }).options)
			? (field as { options: SelectOption[] }).options.map(normalizeOption)
			: [];
		return { id, name, type, options };
	}
	if (type === "currency") {
		const symbol =
			typeof (field as CurrencyLike).symbol === "string"
				? (field as CurrencyLike).symbol
				: "$";
		return { id, name, type, symbol };
	}
	if (type === "rating") {
		const max =
			typeof (field as RatingLike).max === "number" ? (field as RatingLike).max : 5;
		return { id, name, type, max };
	}
	switch (type) {
		case "text":
			return { id, name, type };
		case "longText":
			return { id, name, type };
		case "number":
			return { id, name, type };
		case "percent":
			return { id, name, type };
		case "duration":
			return { id, name, type };
		case "checkbox":
			return { id, name, type };
		case "date":
			return { id, name, type };
		case "datetime":
			return { id, name, type };
		case "url":
			return { id, name, type };
		case "email":
			return { id, name, type };
		case "phone":
			return { id, name, type };
		case "attachment":
			return { id, name, type };
		case "autoNumber":
			return { id, name, type };
		case "createdTime":
			return { id, name, type };
		case "lastModifiedTime":
			return { id, name, type };
	}
}

interface CurrencyLike {
	symbol?: string;
}
interface RatingLike {
	max?: number;
}

function normalizeOption(option: Partial<SelectOption>): SelectOption {
	return {
		id: typeof option.id === "string" ? option.id : createId("o"),
		name: typeof option.name === "string" ? option.name : "Option",
		color: (SELECT_COLORS.includes(option.color as SelectColor)
			? option.color
			: "gray") as SelectColor,
	};
}

function normalizeRow(row: Partial<Row>, fields: Field[]): Row {
	const id = typeof row.id === "string" ? row.id : createId("r");
	const cells: Record<string, CellValue> = {};
	const incoming = row.cells && typeof row.cells === "object" ? row.cells : {};
	for (const field of fields) {
		cells[field.id] = sanitizeCellValue(field, incoming[field.id]);
	}
	return { id, cells };
}

function sanitizeCellValue(field: Field, value: unknown): CellValue {
	switch (field.type) {
		case "text":
		case "longText":
		case "date":
		case "datetime":
		case "url":
		case "email":
		case "phone":
		case "createdTime":
		case "lastModifiedTime":
			return typeof value === "string" ? value : "";
		case "number":
		case "currency":
		case "percent":
		case "duration":
		case "rating":
		case "autoNumber":
			return typeof value === "number" ? value : null;
		case "checkbox":
			return Boolean(value);
		case "singleSelect": {
			if (typeof value !== "string") return null;
			return field.options.some((o) => o.id === value) ? value : null;
		}
		case "multiSelect": {
			if (!Array.isArray(value)) return [];
			const valid = new Set(field.options.map((o) => o.id));
			return value.filter((v): v is string => typeof v === "string" && valid.has(v));
		}
		case "attachment": {
			if (!Array.isArray(value)) return [];
			return value.filter((v): v is string => typeof v === "string");
		}
	}
}

function normalizeView(view: Partial<ViewState> | undefined): ViewState {
	const base = createEmptyView();
	if (!view || typeof view !== "object") return base;
	const rowHeight: RowHeight =
		view.rowHeight === "short" || view.rowHeight === "tall" || view.rowHeight === "medium"
			? view.rowHeight
			: "medium";
	return {
		sorts: Array.isArray(view.sorts) ? view.sorts : [],
		filters: normalizeFilterGroup(view.filters),
		search: typeof view.search === "string" ? view.search : "",
		query: typeof view.query === "string" ? view.query : "",
		hiddenFieldIds: Array.isArray(view.hiddenFieldIds) ? view.hiddenFieldIds : [],
		groupBy: {
			fieldId:
				view.groupBy && typeof view.groupBy.fieldId === "string"
					? view.groupBy.fieldId
					: null,
		},
		columnWidths:
			view.columnWidths && typeof view.columnWidths === "object"
				? view.columnWidths
				: {},
		rowHeight,
		frozenPrimary:
			typeof view.frozenPrimary === "boolean" ? view.frozenPrimary : false,
	};
}

function normalizeFilterGroup(group: Partial<FilterGroup> | undefined): FilterGroup {
	if (!group || typeof group !== "object") {
		return { logic: "and", conditions: [] };
	}
	return {
		logic: group.logic === "or" ? "or" : "and",
		conditions: Array.isArray(group.conditions)
			? group.conditions.map((c) => {
					const operator: FilterOperator = c.operator ?? "equals";
					return {
						id: typeof c.id === "string" ? c.id : createId("c"),
						fieldId: typeof c.fieldId === "string" ? c.fieldId : "",
						operator,
						value: c.value,
					};
				})
			: [],
	};
}

function normalizeSync(sync: Partial<SyncConfig> | null | undefined): SyncConfig | null {
	if (!sync || typeof sync !== "object") return null;
	if (typeof sync.baseId !== "string" || typeof sync.tableId !== "string") return null;
	return {
		baseId: sync.baseId,
		baseName: typeof sync.baseName === "string" ? sync.baseName : undefined,
		tableId: sync.tableId,
		tableName: typeof sync.tableName === "string" ? sync.tableName : undefined,
		fieldMap:
			sync.fieldMap && typeof sync.fieldMap === "object" ? sync.fieldMap : {},
		recordMap:
			sync.recordMap && typeof sync.recordMap === "object" ? sync.recordMap : {},
		lastPulledAt: typeof sync.lastPulledAt === "string" ? sync.lastPulledAt : undefined,
		lastPushedAt: typeof sync.lastPushedAt === "string" ? sync.lastPushedAt : undefined,
	};
}

export function removeOptionFromDocument(
	doc: TableDocument,
	fieldId: string,
	optionId: string
): TableDocument {
	const fields = doc.fields.map((field) => {
		if (field.id !== fieldId || !isSelectField(field)) return field;
		return {
			...field,
			options: field.options.filter((o) => o.id !== optionId),
		};
	});
	const rows = doc.rows.map((row) => {
		const field = fields.find((f) => f.id === fieldId);
		if (!field || !isSelectField(field)) return row;
		const current = row.cells[fieldId];
		if (field.type === "singleSelect") {
			return {
				...row,
				cells: {
					...row.cells,
					[fieldId]: current === optionId ? null : current,
				},
			};
		}
		const list = Array.isArray(current) ? current : [];
		return {
			...row,
			cells: {
				...row.cells,
				[fieldId]: list.filter((id) => id !== optionId),
			},
		};
	});
	return { ...doc, fields, rows };
}

export function formatDuration(seconds: number | null): string {
	if (seconds == null || Number.isNaN(seconds)) return "";
	const s = Math.max(0, Math.floor(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
	return `${m}:${String(sec).padStart(2, "0")}`;
}

export function parseDuration(input: string): number | null {
	const t = input.trim();
	if (!t) return null;
	if (/^\d+$/.test(t)) return Number(t);
	const parts = t.split(":").map(Number);
	if (parts.some((n) => Number.isNaN(n))) return null;
	if (parts.length === 2) return parts[0] * 60 + parts[1];
	if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
	return null;
}
