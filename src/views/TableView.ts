import { TextFileView, WorkspaceLeaf } from "obsidian";
import type { Root } from "react-dom/client";
import type { TableDocument, TableFileDocument } from "../data/types";
import {
	createDefaultTable,
	createTableEntry,
	createTableFileDocument,
	parseTableFileDocument,
	serializeTableFileDocument,
} from "../data/store";
import { mountTableFileApp, updateTableFileApp } from "../ui/mount";
import { installDebugOverlay } from "../ui/DebugOverlay";
import type { TableFileAppProps } from "../ui/mount";
import type TabulaPlugin from "../main";

export const VIEW_TYPE_TABULA = "airtable-tabula-view";
export const TABULA_EXTENSION = "tabula";

export class TableView extends TextFileView {
	plugin: TabulaPlugin;
	private reactRoot: Root | null = null;
	private fileDoc: TableFileDocument | null = null;
	private mountEl: HTMLElement | null = null;
	private saveTimer: number | null = null;
	private applyingExternal = false;
	private clipboardPasteHandler: (() => void) | null = null;
	private disposeDebugOverlay: (() => void) | null = null;
	private mountSizeObserver: ResizeObserver | null = null;

	private registerClipboardPaste = (handler: (() => void) | null): void => {
		this.clipboardPasteHandler = handler;
	};

	requestClipboardPaste(): boolean {
		if (!this.clipboardPasteHandler) return false;
		this.clipboardPasteHandler();
		return true;
	}

	constructor(leaf: WorkspaceLeaf, plugin: TabulaPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_TABULA;
	}

	getDisplayText(): string {
		return this.fileDoc?.tables[0]?.table.name ?? this.file?.basename ?? "Table";
	}

	getViewData(): string {
		if (!this.fileDoc) return this.data ?? "";
		return serializeTableFileDocument(this.fileDoc);
	}

	setViewData(data: string, clear: boolean): void {
		this.data = data;
		try {
			this.fileDoc = parseTableFileDocument(data);
		} catch (e) {
			console.error("Failed to parse .tabula file", e);
			this.fileDoc = createTableFileDocument(createDefaultTable());
		}
		if (clear) {
			this.remount();
		} else {
			this.render();
		}
	}

	clear(): void {
		this.fileDoc = null;
		this.data = "";
		this.unmount();
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("tabula-view");
		this.mountEl = this.contentEl.createDiv({ cls: "tabula-mount" });
		// Height contract, hop 1: the mount is anchored to the view's own
		// measured height, written as --tabula-mount-h. Obsidian's mobile shell
		// compresses its own containers when the keyboard opens and every
		// percentage/flex layer between the view and the scroller collapsed
		// along with them (mount measured 0px; measured on a real phone).
		// Reading the view's clientHeight directly is the only anchor that
		// cannot be lost in that chain. The CSS falls back to height: 100%
		// so behaviour is identical wherever the percentage already resolved.
		this.mountSizeObserver = new ResizeObserver(() => this.syncMountHeight());
		this.mountSizeObserver.observe(this.contentEl);
		this.syncMountHeight();
		this.remount();
		// TEMPORARY DIAGNOSTIC -- see src/ui/DebugOverlay.ts
		this.disposeDebugOverlay = installDebugOverlay(this.contentEl);
	}

	private syncMountHeight(): void {
		if (!this.mountEl) return;
		const style = getComputedStyle(this.contentEl);
		const padTB =
			(parseFloat(style.paddingTop) || 0) +
			(parseFloat(style.paddingBottom) || 0);
		const h = Math.max(0, Math.round(this.contentEl.clientHeight - padTB));
		this.mountEl.style.setProperty("--tabula-mount-h", h + "px");
	}

	async onClose(): Promise<void> {
		this.mountSizeObserver?.disconnect();
		this.mountSizeObserver = null;
		this.disposeDebugOverlay?.();
		this.disposeDebugOverlay = null;
		if (this.saveTimer != null) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
			this.requestSave();
		}
		this.unmount();
	}

	refreshSettings(): void {
		this.render();
	}

	private appProps(): TableFileAppProps {
		return {
			file: this.fileDoc!,
			onTableChange: (tableId, doc) => this.handleTableChange(tableId, doc),
			onAddTable: (doc) => this.addTable(doc),
			onRemoveTable: (tableId) => this.removeTable(tableId),
			onCreateTableFromPaste: (doc: TableDocument) => this.plugin.createTableFromPaste(doc),
			onCreateStandaloneTable: () => this.plugin.createStandaloneTable(),
			onRegisterClipboardPaste: this.registerClipboardPaste,
			airtableToken: this.plugin.settings.airtableToken,
			showTopScrollbar: this.plugin.settings.showTopScrollbar,
			stackedTableGap: this.plugin.settings.stackedTableGap,
		};
	}

	private remount(): void {
		this.unmount();
		if (!this.mountEl || !this.fileDoc) return;
		this.reactRoot = mountTableFileApp(this.mountEl, this.appProps());
	}

	private render(): void {
		if (!this.reactRoot || !this.fileDoc) {
			this.remount();
			return;
		}
		updateTableFileApp(this.reactRoot, this.appProps());
	}

	private handleTableChange(tableId: string, doc: TableDocument): void {
		if (this.applyingExternal || !this.fileDoc) return;
		const tables = this.fileDoc.tables.map((entry) =>
			entry.id === tableId ? { ...entry, table: doc } : entry
		);
		if (tables.every((entry, index) => entry === this.fileDoc!.tables[index])) return;
		this.commitFileChange({ ...this.fileDoc, tables });
	}

	private addTable(table?: TableDocument): string {
		if (!this.fileDoc) return "";
		const fallbackName = `Untitled Table ${this.fileDoc.tables.length + 1}`;
		const tableToAdd = table
			? { ...table, name: table.name.trim() || fallbackName }
			: createDefaultTable(fallbackName);
		const entry = createTableEntry(tableToAdd);
		this.commitFileChange({ ...this.fileDoc, tables: [...this.fileDoc.tables, entry] });
		return entry.id;
	}

	private removeTable(tableId: string): void {
		if (!this.fileDoc || this.fileDoc.tables.length <= 1) return;
		const tables = this.fileDoc.tables.filter((entry) => entry.id !== tableId);
		if (tables.length === this.fileDoc.tables.length) return;
		this.commitFileChange({ ...this.fileDoc, tables });
	}

	private commitFileChange(next: TableFileDocument): void {
		this.fileDoc = next;
		this.data = serializeTableFileDocument(next);
		this.app.workspace.requestSaveLayout();
		this.debounceSave();
		this.render();
	}

	private debounceSave(): void {
		if (this.saveTimer != null) {
			window.clearTimeout(this.saveTimer);
		}
		this.saveTimer = window.setTimeout(() => {
			this.saveTimer = null;
			this.requestSave();
		}, 300);
	}

	private unmount(): void {
		if (this.reactRoot) {
			this.reactRoot.unmount();
			this.reactRoot = null;
		}
		if (this.mountEl) {
			this.mountEl.empty();
		}
	}
}
