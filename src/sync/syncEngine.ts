import {
	CellValue,
	Field,
	FieldType,
	Row,
	SELECT_COLORS,
	SelectColor,
	SyncConfig,
	TableDocument,
	emptyCellValue,
	isReadOnlyField,
	isSelectField,
} from "../data/types";
import { createId, createSelectOption, nowIso } from "../data/store";
import {
	AirtableClient,
	AirtableField,
	AirtableRecord,
	AirtableTable,
} from "./airtableClient";

const AIRTABLE_TO_LOCAL: Record<string, FieldType> = {
	singleLineText: "text",
	multilineText: "longText",
	richText: "longText",
	number: "number",
	currency: "currency",
	percent: "percent",
	duration: "duration",
	rating: "rating",
	checkbox: "checkbox",
	date: "date",
	dateTime: "datetime",
	url: "url",
	email: "email",
	phoneNumber: "phone",
	singleSelect: "singleSelect",
	multipleSelects: "multiSelect",
	multipleAttachments: "attachment",
	autoNumber: "autoNumber",
	createdTime: "createdTime",
	lastModifiedTime: "lastModifiedTime",
};

const LOCAL_WRITABLE: FieldType[] = [
	"text",
	"longText",
	"number",
	"currency",
	"percent",
	"duration",
	"rating",
	"checkbox",
	"date",
	"datetime",
	"url",
	"email",
	"phone",
	"singleSelect",
	"multiSelect",
	"attachment",
];

export function mapAirtableType(type: string): FieldType {
	return AIRTABLE_TO_LOCAL[type] ?? "text";
}

export function buildFieldMap(
	localFields: Field[],
	remoteFields: AirtableField[]
): Record<string, string> {
	const map: Record<string, string> = {};
	const used = new Set<string>();
	for (const local of localFields) {
		const match = remoteFields.find(
			(r) =>
				!used.has(r.id) &&
				r.name.toLowerCase() === local.name.toLowerCase()
		);
		if (match) {
			map[local.id] = match.id;
			used.add(match.id);
		}
	}
	return map;
}

export function fieldsFromAirtableTable(table: AirtableTable): Field[] {
	return table.fields.map((rf) => airtableFieldToLocal(rf));
}

function airtableFieldToLocal(rf: AirtableField): Field {
	const type = mapAirtableType(rf.type);
	const id = createId("f");
	const name = rf.name;
	if (type === "singleSelect" || type === "multiSelect") {
		const choices = rf.options?.choices ?? [];
		return {
			id,
			name,
			type,
			options: choices.map((c, i) => ({
				id: createId("o"),
				name: c.name,
				color: (SELECT_COLORS[i % SELECT_COLORS.length] ?? "gray") as SelectColor,
			})),
		};
	}
	if (type === "currency") {
		return { id, name, type, symbol: rf.options?.symbol ?? "$" };
	}
	if (type === "rating") {
		return { id, name, type, max: rf.options?.max ?? 5 };
	}
	return { id, name, type } as Field;
}

export function createLinkConfig(
	baseId: string,
	baseName: string,
	table: AirtableTable,
	doc: TableDocument,
	replaceSchema: boolean
): { doc: TableDocument; sync: SyncConfig } {
	let fields = doc.fields;
	let rows = doc.rows;
	if (replaceSchema) {
		fields = fieldsFromAirtableTable(table);
		rows = [];
	}
	const fieldMap = buildFieldMap(fields, table.fields);
	// Also map any unmatched by creating fieldMap entries when replaceSchema
	if (replaceSchema) {
		fields.forEach((f, i) => {
			const rf = table.fields[i];
			if (rf) fieldMap[f.id] = rf.id;
		});
	}
	const sync: SyncConfig = {
		baseId,
		baseName,
		tableId: table.id,
		tableName: table.name,
		fieldMap,
		recordMap: {},
	};
	return {
		doc: {
			...doc,
			name: replaceSchema ? table.name : doc.name,
			fields,
			rows,
			sync,
		},
		sync,
	};
}

export async function pullFromAirtable(
	client: AirtableClient,
	doc: TableDocument
): Promise<TableDocument> {
	const sync = doc.sync;
	if (!sync) throw new Error("Table is not linked to Airtable");

	const tables = await client.getTables(sync.baseId);
	const table = tables.find((t) => t.id === sync.tableId);
	if (!table) throw new Error("Linked Airtable table not found");

	const records = await client.listRecords(sync.baseId, sync.tableId);
	const remoteById = new Map(records.map((r) => [r.id, r]));

	// Ensure select options exist for mapped select fields
	let fields = doc.fields.map((f) => ensureSelectOptionsFromRemote(f, table, sync));

	const reverseRecord = new Map(
		Object.entries(sync.recordMap).map(([localId, remoteId]) => [remoteId, localId])
	);

	const nextRecordMap = { ...sync.recordMap };
	const rowsById = new Map(doc.rows.map((r) => [r.id, r]));
	const nextRows: Row[] = [];
	const seenLocal = new Set<string>();

	for (const record of records) {
		const existingLocalId = reverseRecord.get(record.id);
		const localId = existingLocalId ?? createId("r");
		seenLocal.add(localId);
		nextRecordMap[localId] = record.id;

		const prev = rowsById.get(localId);
		const cells: Record<string, CellValue> = {};
		for (const field of fields) {
			const airFieldId = sync.fieldMap[field.id];
			if (!airFieldId) {
				cells[field.id] = prev?.cells[field.id] ?? emptyCellValue(field.type);
				continue;
			}
			const airField = table.fields.find((f) => f.id === airFieldId);
			const raw = record.fields[airField?.name ?? ""];
			cells[field.id] = fromAirtableValue(field, raw);
		}
		nextRows.push({ id: localId, cells });
	}

	// Keep local-only rows (not yet pushed)
	for (const row of doc.rows) {
		if (!seenLocal.has(row.id) && !sync.recordMap[row.id]) {
			nextRows.push(row);
		}
	}

	return {
		...doc,
		fields,
		rows: nextRows,
		sync: {
			...sync,
			recordMap: nextRecordMap,
			lastPulledAt: nowIso(),
		},
	};
}

function ensureSelectOptionsFromRemote(
	field: Field,
	table: AirtableTable,
	sync: SyncConfig
): Field {
	if (!isSelectField(field)) return field;
	const airFieldId = sync.fieldMap[field.id];
	if (!airFieldId) return field;
	const airField = table.fields.find((f) => f.id === airFieldId);
	const choices = airField?.options?.choices ?? [];
	if (choices.length === 0) return field;
	const options = [...field.options];
	for (const choice of choices) {
		if (!options.some((o) => o.name.toLowerCase() === choice.name.toLowerCase())) {
			options.push(createSelectOption(choice.name));
		}
	}
	return { ...field, options };
}

export async function pushToAirtable(
	client: AirtableClient,
	doc: TableDocument
): Promise<TableDocument> {
	const sync = doc.sync;
	if (!sync) throw new Error("Table is not linked to Airtable");

	const tables = await client.getTables(sync.baseId);
	const table = tables.find((t) => t.id === sync.tableId);
	if (!table) throw new Error("Linked Airtable table not found");

	const toCreate: { localId: string; fields: Record<string, unknown> }[] = [];
	const toUpdate: { id: string; fields: Record<string, unknown> }[] = [];

	for (const row of doc.rows) {
		const fields = rowToAirtableFields(row, doc.fields, sync, table);
		const remoteId = sync.recordMap[row.id];
		if (remoteId) toUpdate.push({ id: remoteId, fields });
		else toCreate.push({ localId: row.id, fields });
	}

	const nextRecordMap = { ...sync.recordMap };

	if (toUpdate.length) {
		await client.updateRecords(sync.baseId, sync.tableId, toUpdate);
	}
	if (toCreate.length) {
		const created = await client.createRecords(
			sync.baseId,
			sync.tableId,
			toCreate.map((c) => ({ fields: c.fields }))
		);
		created.forEach((rec, i) => {
			nextRecordMap[toCreate[i].localId] = rec.id;
		});
	}

	return {
		...doc,
		sync: {
			...sync,
			recordMap: nextRecordMap,
			lastPushedAt: nowIso(),
		},
	};
}

function rowToAirtableFields(
	row: Row,
	fields: Field[],
	sync: SyncConfig,
	table: AirtableTable
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const field of fields) {
		if (isReadOnlyField(field)) continue;
		if (!LOCAL_WRITABLE.includes(field.type)) continue;
		const airFieldId = sync.fieldMap[field.id];
		if (!airFieldId) continue;
		const airField = table.fields.find((f) => f.id === airFieldId);
		if (!airField) continue;
		// Skip computed / read-only Airtable types
		if (
			["formula", "rollup", "lookup", "count", "autoNumber", "createdTime", "lastModifiedTime", "button"].includes(
				airField.type
			)
		) {
			continue;
		}
		const value = toAirtableValue(field, row.cells[field.id]);
		if (value !== undefined) {
			out[airField.name] = value;
		}
	}
	return out;
}

function fromAirtableValue(field: Field, raw: unknown): CellValue {
	if (raw == null) return emptyCellValue(field.type);

	switch (field.type) {
		case "text":
		case "longText":
		case "url":
		case "email":
		case "phone":
		case "date":
			return String(raw);
		case "datetime":
		case "createdTime":
		case "lastModifiedTime":
			return String(raw);
		case "number":
		case "currency":
		case "percent":
		case "duration":
		case "rating":
		case "autoNumber":
			return typeof raw === "number" ? raw : Number(raw);
		case "checkbox":
			return Boolean(raw);
		case "singleSelect": {
			if (!isSelectField(field)) return null;
			const name = String(raw);
			const opt = field.options.find(
				(o) => o.name.toLowerCase() === name.toLowerCase()
			);
			return opt?.id ?? null;
		}
		case "multiSelect": {
			if (!isSelectField(field)) return [];
			const names = Array.isArray(raw) ? raw.map(String) : [];
			return names
				.map(
					(n) =>
						field.options.find((o) => o.name.toLowerCase() === n.toLowerCase())?.id
				)
				.filter((id): id is string => Boolean(id));
		}
		case "attachment": {
			if (!Array.isArray(raw)) return [];
			return raw
				.map((item) => {
					if (typeof item === "string") return item;
					if (item && typeof item === "object" && "url" in item) {
						return String((item as { url: string }).url);
					}
					return null;
				})
				.filter((u): u is string => Boolean(u));
		}
	}
}

function toAirtableValue(field: Field, value: CellValue): unknown {
	switch (field.type) {
		case "text":
		case "longText":
		case "url":
		case "email":
		case "phone":
		case "date":
			return value == null || value === "" ? null : String(value);
		case "datetime":
			return value == null || value === "" ? null : String(value);
		case "number":
		case "currency":
		case "percent":
		case "duration":
		case "rating":
			return typeof value === "number" ? value : null;
		case "checkbox":
			return Boolean(value);
		case "singleSelect": {
			if (!isSelectField(field) || typeof value !== "string") return null;
			return field.options.find((o) => o.id === value)?.name ?? null;
		}
		case "multiSelect": {
			if (!isSelectField(field) || !Array.isArray(value)) return [];
			return value
				.map((id) => field.options.find((o) => o.id === id)?.name)
				.filter((n): n is string => Boolean(n));
		}
		case "attachment": {
			// Airtable expects attachment objects for write; URLs alone need typecast
			// With typecast:true, string URLs often fail — send empty / skip unsupported
			if (!Array.isArray(value) || value.length === 0) return [];
			return value.map((url) => ({ url }));
		}
		default:
			return undefined;
	}
}
