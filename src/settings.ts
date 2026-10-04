export interface PluginSettings {
	airtableToken: string;
	showTopScrollbar: boolean;
	stackedTableGap: number;
	newTableFolder: string;
}

export const MIN_STACKED_TABLE_GAP = 0;
export const MAX_STACKED_TABLE_GAP = 500;
export const DEFAULT_STACKED_TABLE_GAP = 120;

export function clampStackedTableGap(value: number): number {
	return Math.min(MAX_STACKED_TABLE_GAP, Math.max(MIN_STACKED_TABLE_GAP, Math.round(value)));
}

export const DEFAULT_SETTINGS: PluginSettings = {
	airtableToken: "",
	showTopScrollbar: false,
	stackedTableGap: DEFAULT_STACKED_TABLE_GAP,
	newTableFolder: "",
};
