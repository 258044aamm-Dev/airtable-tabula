import { App, PluginSettingTab, Setting, TextComponent } from "obsidian";
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
	}
}
