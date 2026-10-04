import {
	App,
	PluginSettingTab,
	Setting,
	SliderComponent,
	TextComponent,
} from "obsidian";
import {
	clampStackedTableGap,
	MAX_STACKED_TABLE_GAP,
	MIN_STACKED_TABLE_GAP,
} from "../settings";
import type TabulaPlugin from "../main";

export class TabulaSettingTab extends PluginSettingTab {
	plugin: TabulaPlugin;

	constructor(app: App, plugin: TabulaPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Airtable sync").setHeading();

		new Setting(containerEl)
			.setDesc(
				"Optional sync with Airtable.com. Create a personal access token at airtable.com/create/tokens with scopes: data.records:read, data.records:write, schema.bases:read — and access to your bases."
			);

		new Setting(containerEl)
			.setName("Airtable personal access token")
			.setDesc("Stored in this vault’s plugin data. Leave empty to disable sync.")
			.addText((text: TextComponent) => {
				text.inputEl.type = "password";
				text.inputEl.autocomplete = "off";
				text.setPlaceholder("pat…");
				text.setValue(this.plugin.settings.airtableToken);
				text.onChange(async (value) => {
					this.plugin.settings.airtableToken = value.trim();
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl).setName("Table files").setHeading();

		new Setting(containerEl)
			.setName("Default folder for new tables")
			.setDesc(
				"Vault-relative folder for new standalone tables, spreadsheet imports, and pasted tables. Leave blank to use Obsidian’s current folder. Stacked tables stay in their existing file."
			)
			.addText((text: TextComponent) => {
				text.setPlaceholder("e.g. Tables")
					.setValue(this.plugin.settings.newTableFolder)
					.onChange(async (value) => {
						this.plugin.settings.newTableFolder = value.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl).setName("Table display").setHeading();

		new Setting(containerEl)
			.setName("Top horizontal scrollbar")
			.setDesc(
				"Show a synchronized scrollbar above wide tables. This setting applies to all tables and is off by default."
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showTopScrollbar)
					.onChange(async (value) => {
						this.plugin.settings.showTopScrollbar = value;
						await this.plugin.saveSettings();
						this.plugin.refreshOpenViews();
					});
			});

		let gapSlider: SliderComponent | null = null;
		let gapInput: TextComponent | null = null;
		const persistGap = async (rawValue: number, source: "slider" | "number") => {
			const value = clampStackedTableGap(rawValue);
			this.plugin.settings.stackedTableGap = value;
			gapSlider?.setValue(value);
			if (source === "slider") gapInput?.setValue(String(value));
			await this.plugin.saveSettings();
			this.plugin.refreshOpenViews();
		};

		new Setting(containerEl)
			.setName("Gap between stacked tables")
			.setDesc("Set the vertical gap between tables in the same file and after the last table (0–500 px). Default: 120 px.")
			.addSlider((slider) => {
				gapSlider = slider;
				slider
					.setLimits(MIN_STACKED_TABLE_GAP, MAX_STACKED_TABLE_GAP, 1)
					.setValue(this.plugin.settings.stackedTableGap)
					.setInstant(false)
					.onChange((value) => void persistGap(value, "slider"));
			})
			.addText((text) => {
				gapInput = text;
				text.inputEl.type = "number";
				text.inputEl.min = String(MIN_STACKED_TABLE_GAP);
				text.inputEl.max = String(MAX_STACKED_TABLE_GAP);
				text.inputEl.step = "1";
				text.inputEl.setAttribute("aria-label", "Gap between stacked tables in pixels");
				text.setValue(String(this.plugin.settings.stackedTableGap));
				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						text.inputEl.blur();
					}
				});
				text.inputEl.addEventListener("blur", () => {
					const rawValue = text.getValue().trim();
					if (!rawValue) {
						text.setValue(String(this.plugin.settings.stackedTableGap));
						return;
					}
					const parsed = Number(rawValue);
					if (!Number.isFinite(parsed)) {
						text.setValue(String(this.plugin.settings.stackedTableGap));
						return;
					}
					const value = clampStackedTableGap(parsed);
					text.setValue(String(value));
					void persistGap(value, "number");
				});
			});
	}
}
