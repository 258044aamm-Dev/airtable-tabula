import { Notice, Plugin } from "obsidian";
import {
	TABULA_EXTENSION,
	TableView,
	VIEW_TYPE_TABULA,
} from "./views/TableView";
import {
	createDefaultTable,
	serializeTableDocument,
} from "./data/store";
import { DEFAULT_SETTINGS, PluginSettings } from "./settings";
import { TabulaSettingTab } from "./ui/SettingsTab";

export default class TabulaPlugin extends Plugin {
	settings: PluginSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_TABULA,
			(leaf) => new TableView(leaf, this)
		);
		this.registerExtensions([TABULA_EXTENSION], VIEW_TYPE_TABULA);

		this.addSettingTab(new TabulaSettingTab(this.app, this));

		this.addCommand({
			id: "create-airtable-tabula-table",
			name: "Create new table",
			callback: () => this.createNewTable(),
		});

		this.addRibbonIcon("table", "Create Airtable Tabula table", () => {
			void this.createNewTable();
		});
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TABULA);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async createNewTable(): Promise<void> {
		const folder = this.app.fileManager.getNewFileParent("");
		const folderPath = folder.path === "/" || folder.path === "" ? "" : folder.path;
		const baseName = "Untitled Table";

		const makePath = (name: string) =>
			folderPath ? `${folderPath}/${name}.${TABULA_EXTENSION}` : `${name}.${TABULA_EXTENSION}`;

		let fullPath = makePath(baseName);
		let i = 1;
		while (this.app.vault.getAbstractFileByPath(fullPath)) {
			fullPath = makePath(`${baseName} ${i}`);
			i += 1;
		}

		const title =
			fullPath
				.replace(new RegExp(`\\.${TABULA_EXTENSION}$`), "")
				.split("/")
				.pop() ?? "Untitled";
		const doc = createDefaultTable(title);
		const content = serializeTableDocument(doc);

		try {
			const file = await this.app.vault.create(fullPath, content);
			await this.app.workspace.getLeaf(true).openFile(file);
			new Notice(`Created ${file.basename}`);
		} catch (e) {
			console.error(e);
			new Notice("Failed to create table");
		}
	}
}
