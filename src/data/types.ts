export type FieldType =
	| "text"
	| "longText"
	| "number"
	| "currency"
	| "percent"
	| "duration"
	| "rating"
	| "checkbox"
	| "date"
	| "datetime"
	| "url"
	| "email"
	| "phone"
	| "singleSelect"
	| "multiSelect"
	| "attachment"
	| "autoNumber"
	| "createdTime"
	| "lastModifiedTime";

export type SelectColor =
	| "gray"
	| "blue"
	| "green"
	| "yellow"
	| "orange"
	| "red"
	| "pink"
	| "purple"
	| "cyan";

export type RowHeight = "short" | "medium" | "tall";

export interface SelectOption {
	id: string;
	name: string;
	color: SelectColor;
}

export interface FieldBase {
	id: string;
	name: string;
	type: FieldType;
}

export interface TextField extends FieldBase {
	type: "text";
}
export interface LongTextField extends FieldBase {
	type: "longText";
}
export interface NumberField extends FieldBase {
	type: "number";
}
export interface CurrencyField extends FieldBase {
	type: "currency";
	symbol?: string;
}
export interface PercentField extends FieldBase {
	type: "percent";
}
export interface DurationField extends FieldBase {
	type: "duration";
}
export interface RatingField extends FieldBase {
	type: "rating";
	max?: number;
}
export interface CheckboxField extends FieldBase {
	type: "checkbox";
}
export interface DateField extends FieldBase {
	type: "date";
}
export interface DateTimeField extends FieldBase {
	type: "datetime";
}
export interface UrlField extends FieldBase {
	type: "url";
}
export interface EmailField extends FieldBase {
	type: "email";
}
export interface PhoneField extends FieldBase {
	type: "phone";
}
export interface SingleSelectField extends FieldBase {
	type: "singleSelect";
	options: SelectOption[];
}
export interface MultiSelectField extends FieldBase {
	type: "multiSelect";
	options: SelectOption[];
}
export interface AttachmentField extends FieldBase {
	type: "attachment";
}
export interface AutoNumberField extends FieldBase {
	type: "autoNumber";
}
export interface CreatedTimeField extends FieldBase {
	type: "createdTime";
}
export interface LastModifiedTimeField extends FieldBase {
	type: "lastModifiedTime";
}

export type Field =
	| TextField
	| LongTextField
	| NumberField
	| CurrencyField
	| PercentField
	| DurationField
	| RatingField
	| CheckboxField
	| DateField
	| DateTimeField
	| UrlField
	| EmailField
	| PhoneField
	| SingleSelectField
	| MultiSelectField
	| AttachmentField
	| AutoNumberField
	| CreatedTimeField
	| LastModifiedTimeField;

export type CellValue = string | number | boolean | string[] | null;

export interface Row {
	id: string;
	cells: Record<string, CellValue>;
}

export type FilterLogic = "and" | "or";

export type FilterOperator =
	| "contains"
	| "equals"
	| "isEmpty"
	| "isNotEmpty"
	| "gt"
	| "lt"
	| "isTrue"
	| "isFalse"
	| "before"
	| "after"
	| "is"
	| "isNot"
	| "isAnyOf"
	| "containsAll"
	| "containsAny";

export interface FilterCondition {
	id: string;
	fieldId: string;
	operator: FilterOperator;
	value?: CellValue;
}

export interface FilterGroup {
	logic: FilterLogic;
	conditions: FilterCondition[];
}

export interface SortSpec {
	fieldId: string;
	direction: "asc" | "desc";
}

export interface ViewState {
	sorts: SortSpec[];
	filters: FilterGroup;
	search: string;
	query: string;
	hiddenFieldIds: string[];
	groupBy: { fieldId: string | null };
	columnWidths: Record<string, number>;
	rowHeight: RowHeight;
	frozenPrimary: boolean;
}

export interface TableDocument {
	version: 1;
	name: string;
	fields: Field[];
	rows: Row[];
	view: ViewState;
	/** Next value for autoNumber fields */
	autoNumberNext?: number;
	/** Optional Airtable sync link (token lives in plugin settings) */
	sync?: SyncConfig | null;
}

/** One independently editable table inside a multi-table .tabula file. */
export interface TableEntry {
	id: string;
	table: TableDocument;
}

/** In-memory representation of a .tabula file, whether legacy or multi-table. */
export interface TableFileDocument {
	tables: TableEntry[];
}

export interface SyncConfig {
	baseId: string;
	baseName?: string;
	tableId: string;
	tableName?: string;
	/** local fieldId -> Airtable field id */
	fieldMap: Record<string, string>;
	/** local row id -> Airtable record id */
	recordMap: Record<string, string>;
	lastPulledAt?: string;
	lastPushedAt?: string;
}

export const SELECT_COLORS: SelectColor[] = [
	"gray",
	"blue",
	"green",
	"yellow",
	"orange",
	"red",
	"pink",
	"purple",
	"cyan",
];

export const ALL_FIELD_TYPES: { type: FieldType; label: string }[] = [
	{ type: "text", label: "Single line text" },
	{ type: "longText", label: "Long text" },
	{ type: "number", label: "Number" },
	{ type: "currency", label: "Currency" },
	{ type: "percent", label: "Percent" },
	{ type: "duration", label: "Duration" },
	{ type: "rating", label: "Rating" },
	{ type: "checkbox", label: "Checkbox" },
	{ type: "date", label: "Date" },
	{ type: "datetime", label: "Date & time" },
	{ type: "url", label: "URL" },
	{ type: "email", label: "Email" },
	{ type: "phone", label: "Phone" },
	{ type: "singleSelect", label: "Single select" },
	{ type: "multiSelect", label: "Multiple select" },
	{ type: "attachment", label: "Attachment" },
	{ type: "autoNumber", label: "Auto number" },
	{ type: "createdTime", label: "Created time" },
	{ type: "lastModifiedTime", label: "Last modified time" },
];

export function isSelectField(
	field: Field
): field is SingleSelectField | MultiSelectField {
	return field.type === "singleSelect" || field.type === "multiSelect";
}

export function isReadOnlyField(field: Field): boolean {
	return (
		field.type === "autoNumber" ||
		field.type === "createdTime" ||
		field.type === "lastModifiedTime"
	);
}

export function isNumericField(field: Field): boolean {
	return (
		field.type === "number" ||
		field.type === "currency" ||
		field.type === "percent" ||
		field.type === "duration" ||
		field.type === "rating" ||
		field.type === "autoNumber"
	);
}

export function isTextLikeField(field: Field): boolean {
	return (
		field.type === "text" ||
		field.type === "longText" ||
		field.type === "url" ||
		field.type === "email" ||
		field.type === "phone" ||
		field.type === "date" ||
		field.type === "datetime" ||
		field.type === "createdTime" ||
		field.type === "lastModifiedTime"
	);
}

export function emptyCellValue(type: FieldType): CellValue {
	switch (type) {
		case "text":
		case "longText":
		case "date":
		case "datetime":
		case "url":
		case "email":
		case "phone":
		case "createdTime":
		case "lastModifiedTime":
			return "";
		case "number":
		case "currency":
		case "percent":
		case "duration":
		case "rating":
		case "autoNumber":
			return null;
		case "checkbox":
			return false;
		case "singleSelect":
			return null;
		case "multiSelect":
		case "attachment":
			return [];
	}
}

export function visibleFields(doc: TableDocument): Field[] {
	const hidden = new Set(doc.view.hiddenFieldIds);
	return doc.fields.filter((f) => !hidden.has(f.id));
}
