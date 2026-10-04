export interface PluginSettings {
	airtableToken: string;
	showTopScrollbar: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	airtableToken: "",
	showTopScrollbar: false,
};
