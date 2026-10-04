export type TablePalette = "airtable" | "teal" | "violet" | "green" | "amber" | "slate";
export type TableDensity = "compact" | "comfortable" | "spacious";
export type HorizontalAlignment = "auto" | "left" | "center" | "right";
export type VerticalAlignment = "top" | "middle" | "bottom";
export type TextColorMode = "theme" | "custom";

export interface TableAppearanceSettings {
	palette: TablePalette;
	density: TableDensity;
	rowStripes: boolean;
	tableRadius: number;
	controlRadius: number;
	defaultColumnWidth: number;
	horizontalAlignment: HorizontalAlignment;
	verticalAlignment: VerticalAlignment;
	textColorMode: TextColorMode;
	customTextColor: string;
}

export interface PluginSettings {
	airtableToken: string;
	showTopScrollbar: boolean;
	stackedTableGap: number;
	appearance: TableAppearanceSettings;
}

export const MIN_STACKED_TABLE_GAP = 0;
export const MAX_STACKED_TABLE_GAP = 500;
export const DEFAULT_STACKED_TABLE_GAP = 100;

export const MIN_TABLE_RADIUS = 0;
export const MAX_TABLE_RADIUS = 24;
export const MIN_CONTROL_RADIUS = 0;
export const MAX_CONTROL_RADIUS = 16;
export const MIN_DEFAULT_COLUMN_WIDTH = 100;
export const MAX_DEFAULT_COLUMN_WIDTH = 360;

export const DEFAULT_APPEARANCE_SETTINGS: TableAppearanceSettings = {
	palette: "airtable",
	density: "comfortable",
	rowStripes: true,
	tableRadius: 8,
	controlRadius: 5,
	defaultColumnWidth: 160,
	horizontalAlignment: "auto",
	verticalAlignment: "middle",
	textColorMode: "theme",
	customTextColor: "#202124",
};

export function clampStackedTableGap(value: number): number {
	return Math.min(MAX_STACKED_TABLE_GAP, Math.max(MIN_STACKED_TABLE_GAP, Math.round(value)));
}

function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
	return typeof value === "string" && options.includes(value);
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeHexColor(value: unknown, fallback: string): string {
	if (typeof value !== "string" || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) {
		return fallback;
	}
	if (value.length === 4) {
		return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase();
	}
	return value.toLowerCase();
}

/** Validate stored plugin appearance preferences without touching table or view data. */
export function normalizeAppearanceSettings(value: unknown): TableAppearanceSettings {
	const raw = typeof value === "object" && value !== null ? value : {};
	const read = (key: keyof TableAppearanceSettings): unknown => Reflect.get(raw, key);
	const fallback = DEFAULT_APPEARANCE_SETTINGS;
	const palette = read("palette");
	const density = read("density");
	const rowStripes = read("rowStripes");
	const horizontalAlignment = read("horizontalAlignment");
	const verticalAlignment = read("verticalAlignment");
	const textColorMode = read("textColorMode");

	return {
		palette: isOneOf(palette, ["airtable", "teal", "violet", "green", "amber", "slate"] as const)
			? palette
			: fallback.palette,
		density: isOneOf(density, ["compact", "comfortable", "spacious"] as const)
			? density
			: fallback.density,
		rowStripes: typeof rowStripes === "boolean" ? rowStripes : fallback.rowStripes,
		tableRadius: clampInteger(read("tableRadius"), fallback.tableRadius, MIN_TABLE_RADIUS, MAX_TABLE_RADIUS),
		controlRadius: clampInteger(read("controlRadius"), fallback.controlRadius, MIN_CONTROL_RADIUS, MAX_CONTROL_RADIUS),
		defaultColumnWidth: clampInteger(
			read("defaultColumnWidth"),
			fallback.defaultColumnWidth,
			MIN_DEFAULT_COLUMN_WIDTH,
			MAX_DEFAULT_COLUMN_WIDTH
		),
		horizontalAlignment: isOneOf(horizontalAlignment, ["auto", "left", "center", "right"] as const)
			? horizontalAlignment
			: fallback.horizontalAlignment,
		verticalAlignment: isOneOf(verticalAlignment, ["top", "middle", "bottom"] as const)
			? verticalAlignment
			: fallback.verticalAlignment,
		textColorMode: isOneOf(textColorMode, ["theme", "custom"] as const)
			? textColorMode
			: fallback.textColorMode,
		customTextColor: normalizeHexColor(read("customTextColor"), fallback.customTextColor),
	};
}

export const DEFAULT_SETTINGS: PluginSettings = {
	airtableToken: "",
	showTopScrollbar: false,
	stackedTableGap: DEFAULT_STACKED_TABLE_GAP,
	appearance: { ...DEFAULT_APPEARANCE_SETTINGS },
};
