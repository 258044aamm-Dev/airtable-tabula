import { TextFileView, WorkspaceLeaf } from "obsidian";
import type { Root } from "react-dom/client";
import { TableDocument } from "../data/types";
import {
	parseTableDocument,
	serializeTableDocument,
} from "../data/store";
import { mountTableApp, updateTableApp } from "../ui/mount";
import type TabulaPlugin from "../main";

export const VIEW_TYPE_TABULA = "tabula-view";
export const TABULA_EXTENSION = "tabula";

export class TableView extends TextFileView {
	plugin: TabulaPlugin;
	private reactRoot: Root | null = null;
	private doc: TableDocument | null = null;
	private mountEl: HTMLElement | null = null;
	private saveTimer: number | null = null;
	private applyingExternal = false;

	constructor(leaf: WorkspaceLeaf, plugin: TabulaPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_TABULA;
	}

	getDisplayText(): string {
		return this.doc?.name ?? this.file?.basename ?? "Table";
	}

	getViewData(): string {
		if (!this.doc) return this.data ?? "";
		return serializeTableDocument(this.doc);
	}

	setViewData(data: string, clear: boolean): void {
		this.data = data;
		try {
			this.doc = parseTableDocument(data);
		} catch (e) {
			console.error("Failed to parse .tabula file", e);
			this.doc = parseTableDocument("");
		}
		if (clear) {
			this.remount();
		} else {
			this.render();
		}
	}

	clear(): void {
		this.doc = null;
		this.data = "";
		this.unmount();
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass("tabula-view");
		this.mountEl = this.contentEl.createDiv({ cls: "tabula-mount" });
		this.remount();
	}

	async onClose(): Promise<void> {
		if (this.saveTimer != null) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
			this.requestSave();
		}
		this.unmount();
	}

	private appProps() {
		return {
			doc: this.doc!,
			onChange: (doc: TableDocument) => this.handleChange(doc),
			airtableToken: this.plugin.settings.airtableToken,
		};
	}

	private remount(): void {
		this.unmount();
		if (!this.mountEl || !this.doc) return;
		this.reactRoot = mountTableApp(this.mountEl, this.appProps());
	}

	private render(): void {
		if (!this.reactRoot || !this.doc) {
			this.remount();
			return;
		}
		updateTableApp(this.reactRoot, this.appProps());
	}

	private handleChange(doc: TableDocument): void {
		if (this.applyingExternal) return;
		this.doc = doc;
		this.data = serializeTableDocument(doc);
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
