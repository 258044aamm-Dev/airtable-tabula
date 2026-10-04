import {
	App,
	ColorComponent,
	PluginSettingTab,
	Setting,
	SliderComponent,
	TextComponent,
} from "obsidian";
import {
	clampStackedTableGap,
	MAX_CONTROL_RADIUS,
	MAX_DEFAULT_COLUMN_WIDTH,
	MAX_STACKED_TABLE_GAP,
	MAX_TABLE_RADIUS,
	MIN_CONTROL_RADIUS,
	MIN_DEFAULT_COLUMN_WIDTH,
	MIN_STACKED_TABLE_GAP,
	MIN_TABLE_RADIUS,
	normalizeAppearanceSettings,
} from "../settings";
import type { TableAppearanceSettings, TextColorMode } from "../settings";
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

		new Setting(containerEl).setName("Table appearance").setHeading();
		new Setting(containerEl).setDesc("These preferences are global across tables. Per-table row heights and saved column widths remain intact.");

		const persistAppearance = async (patch: Partial<TableAppearanceSettings>) => {
			this.plugin.settings.appearance = normalizeAppearanceSettings({
				...this.plugin.settings.appearance,
				...patch,
			});
			await this.plugin.saveSettings();
			this.plugin.refreshOpenViews();
		};

		new Setting(containerEl)
			.setName("Table color palette")
			.setDesc("Choose the accent and subtle header/selection tint used by every table.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("airtable", "Airtable blue")
					.addOption("teal", "Teal")
					.addOption("violet", "Violet")
					.addOption("green", "Green")
					.addOption("amber", "Amber")
					.addOption("slate", "Slate")
					.setValue(this.plugin.settings.appearance.palette)
					.onChange((value) => void persistAppearance({
						palette: value as TableAppearanceSettings["palette"],
					}));
			});

		new Setting(containerEl)
			.setName("Row striping")
			.setDesc("Use a light alternating row tint to make wide tables easier to scan.")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.appearance.rowStripes)
					.onChange((value) => void persistAppearance({ rowStripes: value }));
			});

		new Setting(containerEl)
			.setName("Table density")
			.setDesc("Preset for row height and cell padding. It does not change each table’s saved Short, Medium, or Tall choice.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("compact", "Compact")
					.addOption("comfortable", "Comfortable")
					.addOption("spacious", "Spacious")
					.setValue(this.plugin.settings.appearance.density)
					.onChange((value) => void persistAppearance({
						density: value as TableAppearanceSettings["density"],
					}));
			});

		new Setting(containerEl)
			.setName("Table corner radius")
			.setDesc(`Round the outside edge of the grid (${MIN_TABLE_RADIUS}–${MAX_TABLE_RADIUS} px).`)
			.addSlider((slider: SliderComponent) => {
				slider
					.setLimits(MIN_TABLE_RADIUS, MAX_TABLE_RADIUS, 1)
					.setValue(this.plugin.settings.appearance.tableRadius)
					.setDynamicTooltip()
					.setInstant(false)
					.onChange((value) => void persistAppearance({ tableRadius: value }));
			});

		new Setting(containerEl)
			.setName("Cell and control radius")
			.setDesc(`Round cell editors, buttons, and menus (${MIN_CONTROL_RADIUS}–${MAX_CONTROL_RADIUS} px).`)
			.addSlider((slider: SliderComponent) => {
				slider
					.setLimits(MIN_CONTROL_RADIUS, MAX_CONTROL_RADIUS, 1)
					.setValue(this.plugin.settings.appearance.controlRadius)
					.setDynamicTooltip()
					.setInstant(false)
					.onChange((value) => void persistAppearance({ controlRadius: value }));
			});

		new Setting(containerEl)
			.setName("Default column width")
			.setDesc(`Width for columns that have not been resized (${MIN_DEFAULT_COLUMN_WIDTH}–${MAX_DEFAULT_COLUMN_WIDTH} px). Saved per-column widths are left unchanged.`)
			.addSlider((slider: SliderComponent) => {
				slider
					.setLimits(MIN_DEFAULT_COLUMN_WIDTH, MAX_DEFAULT_COLUMN_WIDTH, 4)
					.setValue(this.plugin.settings.appearance.defaultColumnWidth)
					.setDynamicTooltip()
					.setInstant(false)
					.onChange((value) => void persistAppearance({ defaultColumnWidth: value }));
			});

		new Setting(containerEl)
			.setName("Horizontal cell alignment")
			.setDesc("Choose how cell content is positioned left to right. Auto keeps the current field default.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("auto", "Auto (field default)")
					.addOption("left", "Left")
					.addOption("center", "Center")
					.addOption("right", "Right")
					.setValue(this.plugin.settings.appearance.horizontalAlignment)
					.onChange((value) => void persistAppearance({
						horizontalAlignment: value as TableAppearanceSettings["horizontalAlignment"],
					}));
			});

		new Setting(containerEl)
			.setName("Vertical cell alignment")
			.setDesc("Align content to the top, middle, or bottom of each row.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("top", "Top")
					.addOption("middle", "Middle")
					.addOption("bottom", "Bottom")
					.setValue(this.plugin.settings.appearance.verticalAlignment)
					.onChange((value) => void persistAppearance({
						verticalAlignment: value as TableAppearanceSettings["verticalAlignment"],
					}));
			});

		let customColorPicker: ColorComponent | null = null;
		new Setting(containerEl)
			.setName("Table text color")
			.setDesc("Use the Obsidian theme or choose a custom foreground for the table and its cells. Pick a color that contrasts with your background; select-chip labels keep their own colors.")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("theme", "Use theme color")
					.addOption("custom", "Custom color")
					.setValue(this.plugin.settings.appearance.textColorMode)
					.onChange((value) => {
						const mode: TextColorMode = value === "custom" ? "custom" : "theme";
						customColorPicker?.setDisabled(mode !== "custom");
						void persistAppearance({ textColorMode: mode });
					});
			})
			.addColorPicker((color) => {
				customColorPicker = color;
				color
					.setValue(this.plugin.settings.appearance.customTextColor)
					.setDisabled(this.plugin.settings.appearance.textColorMode !== "custom")
					.onChange((value) => void persistAppearance({ customTextColor: value }));
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
			.setDesc("Set the vertical gap between tables in the same file (0–500 px). Default: 100 px.")
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
