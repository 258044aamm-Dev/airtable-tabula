import { createRoot, Root } from "react-dom/client";
import { createElement } from "react";
import { TableFileApp } from "./TableFileApp";
import { TableDocument, TableFileDocument } from "../data/types";

export interface TableFileAppProps {
	file: TableFileDocument;
	onTableChange: (tableId: string, doc: TableDocument) => void;
	onAddTable: (doc?: TableDocument) => string;
	onRemoveTable: (tableId: string) => void;
	onCreateTableFromPaste: (doc: TableDocument) => Promise<void>;
	onCreateStandaloneTable: () => Promise<void>;
	onRegisterClipboardPaste: (handler: (() => void) | null) => void;
	airtableToken?: string;
	showTopScrollbar: boolean;
	stackedTableGap: number;
}

export function mountTableFileApp(container: HTMLElement, props: TableFileAppProps): Root {
	const root = createRoot(container);
	root.render(createElement(TableFileApp, props));
	return root;
}

export function updateTableFileApp(root: Root, props: TableFileAppProps): void {
	root.render(createElement(TableFileApp, props));
}
