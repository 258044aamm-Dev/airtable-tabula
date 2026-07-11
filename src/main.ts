import { Notice, Plugin, TFile } from "obsidian";
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
import {
	pickSpreadsheetFile,
	readFileAsArrayBuffer,
	spreadsheetToTable,
} from "./import/spreadsheet";

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

		this.addCommand({
			id: "import-spreadsheet",
			name: "Import CSV / Excel as table",
			callback: () => void this.importSpreadsheet(),
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

	private async importSpreadsheet(): Promise<void> {
		const file = await pickSpreadsheetFile();
		if (!file) return;

		try {
			const buffer = await readFileAsArrayBuffer(file);
			const doc = spreadsheetToTable(buffer, file.name);
			const created = await this.writeTableFile(doc.name, serializeTableDocument(doc));
			await this.app.workspace.getLeaf(true).openFile(created);
			new Notice(`Imported ${doc.rows.length} rows from ${file.name}`);
		} catch (e) {
			console.error(e);
			new Notice(e instanceof Error ? e.message : "Import failed");
		}
	}

	private async createNewTable(): Promise<void> {
		const doc = createDefaultTable("Untitled Table");
		try {
			const file = await this.writeTableFile(doc.name, serializeTableDocument(doc));
			await this.app.workspace.getLeaf(true).openFile(file);
			new Notice(`Created ${file.basename}`);
		} catch (e) {
			console.error(e);
			new Notice("Failed to create table");
		}
	}

	private async writeTableFile(baseName: string, content: string): Promise<TFile> {
		const folder = this.app.fileManager.getNewFileParent("");
		const folderPath = folder.path === "/" || folder.path === "" ? "" : folder.path;
		const safeBase = baseName.replace(/[\\/:*?"<>|]/g, "-").trim() || "Untitled Table";

		const makePath = (name: string) =>
			folderPath ? `${folderPath}/${name}.${TABULA_EXTENSION}` : `${name}.${TABULA_EXTENSION}`;

		let fullPath = makePath(safeBase);
		let i = 1;
		while (this.app.vault.getAbstractFileByPath(fullPath)) {
			fullPath = makePath(`${safeBase} ${i}`);
			i += 1;
		}

		return this.app.vault.create(fullPath, content);
	}
}
