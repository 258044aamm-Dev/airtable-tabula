import { createRoot, Root } from "react-dom/client";
import { createElement } from "react";
import { TableApp } from "./TableApp";
import { TableDocument } from "../data/types";

interface TableAppProps {
	doc: TableDocument;
	onChange: (doc: TableDocument) => void;
	onCreateTableFromPaste: (doc: TableDocument) => Promise<void>;
	onRegisterClipboardPaste: (handler: (() => void) | null) => void;
	airtableToken?: string;
}

export function mountTableApp(container: HTMLElement, props: TableAppProps): Root {
	const root = createRoot(container);
	root.render(createElement(TableApp, props));
	return root;
}

export function updateTableApp(root: Root, props: TableAppProps): void {
	root.render(createElement(TableApp, props));
}
