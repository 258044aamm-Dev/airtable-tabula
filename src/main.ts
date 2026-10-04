import { Menu, Notice, Plugin, TFile } from "obsidian";
import {
	TABULA_EXTENSION,
	TableView,
	VIEW_TYPE_TABULA,
} from "./views/TableView";
import {
	createDefaultTable,
	serializeTableDocument,
} from "./data/store";
import {
	clampStackedTableGap,
	DEFAULT_SETTINGS,
	normalizeAppearanceSettings,
	PluginSettings,
} from "./settings";
import type { TableDocument } from "./data/types";
import { TabulaSettingTab } from "./ui/SettingsTab";
import {
	pickSpreadsheetFile,
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
			id: "create-table",
			name: "Create new table",
			callback: () => void this.createNewTable(),
		});

		this.addCommand({
			id: "import-spreadsheet",
			name: "Import CSV / Excel as table",
			callback: () => void this.importSpreadsheet(),
		});

		this.addCommand({
			id: "paste-spreadsheet",
			name: "Paste spreadsheet from clipboard",
			callback: () => this.requestClipboardPaste(),
		});

		const ribbonIcon = this.addRibbonIcon("table", "Airtable Tabula actions", (event) => {
			const menu = new Menu();
			menu.addItem((item) =>
				item
					.setTitle("Create new table")
					.onClick(() => void this.createNewTable())
			);
			menu.addItem((item) =>
				item
					.setTitle("Paste spreadsheet from clipboard")
					.onClick(() => this.requestClipboardPaste())
			);
			menu.addItem((item) =>
				item
					.setTitle("Import CSV / Excel file")
					.onClick(() => void this.importSpreadsheet())
			);
			menu.showAtMouseEvent(event);
		});
		ribbonIcon.addClass("tabula-ribbon-action");
		ribbonIcon.setAttribute("aria-label", "Airtable Tabula actions");
		const applyRibbonPurple = () => {
			const setPurple = (element: HTMLElement | SVGElement) => {
				element.style.setProperty("color", "#8B5CF6", "important");
				element.style.setProperty("--icon-color", "#8B5CF6", "important");
			};
			setPurple(ribbonIcon);
			for (const svgElement of Array.from(ribbonIcon.querySelectorAll<SVGElement>("svg, svg *"))) {
				setPurple(svgElement);
				svgElement.style.setProperty("stroke", "#8B5CF6", "important");
			}
		};
		applyRibbonPurple();
		const ribbonColorObserver = new MutationObserver(applyRibbonPurple);
		ribbonColorObserver.observe(ribbonIcon, { childList: true, subtree: true });
		this.register(() => ribbonColorObserver.disconnect());
	}

	async loadSettings(): Promise<void> {
		const data: unknown = await this.loadData();
		let token = DEFAULT_SETTINGS.airtableToken;
		let showTopScrollbar = DEFAULT_SETTINGS.showTopScrollbar;
		let stackedTableGap = DEFAULT_SETTINGS.stackedTableGap;
		let appearance: unknown = DEFAULT_SETTINGS.appearance;
		if (typeof data === "object" && data !== null) {
			const rawToken = Reflect.get(data, "airtableToken");
			const rawScrollbarSetting = Reflect.get(data, "showTopScrollbar");
			const rawStackedTableGap = Reflect.get(data, "stackedTableGap");
			appearance = Reflect.get(data, "appearance");
			if (typeof rawToken === "string") token = rawToken;
			if (typeof rawScrollbarSetting === "boolean") showTopScrollbar = rawScrollbarSetting;
			if (typeof rawStackedTableGap === "number" && Number.isFinite(rawStackedTableGap)) {
				stackedTableGap = clampStackedTableGap(rawStackedTableGap);
			}
		}
		this.settings = {
			airtableToken: token,
			showTopScrollbar,
			stackedTableGap,
			appearance: normalizeAppearanceSettings(appearance),
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	refreshOpenViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_TABULA)) {
			if (leaf.view instanceof TableView) leaf.view.refreshSettings();
		}
	}

	private async importSpreadsheet(): Promise<void> {
		const file = await pickSpreadsheetFile();
		if (!file) return;

		try {
			const doc = await spreadsheetToTable(file);
			const created = await this.writeTableFile(doc.name, serializeTableDocument(doc));
			await this.app.workspace.getLeaf(true).openFile(created);
			new Notice(`Imported ${doc.rows.length} rows from ${file.name}`);
		} catch (e) {
			console.error(e);
			new Notice(e instanceof Error ? e.message : "Import failed");
		}
	}

	private requestClipboardPaste(): void {
		const tableView = this.app.workspace.getActiveViewOfType(TableView);
		if (!tableView?.requestClipboardPaste()) {
			new Notice("Open a Tabula table before pasting spreadsheet data from the ribbon");
		}
	}

	async createTableFromPaste(doc: TableDocument): Promise<void> {
		const file = await this.writeTableFile(doc.name, serializeTableDocument(doc));
		await this.app.workspace.getLeaf(true).openFile(file);
		new Notice(`Created ${file.basename} from pasted data`);
	}

	async createStandaloneTable(): Promise<void> {
		await this.createNewTable();
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
