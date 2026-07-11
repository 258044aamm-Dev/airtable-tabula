import { createRoot, Root } from "react-dom/client";
import { createElement } from "react";
import { TableApp } from "./TableApp";
import { TableDocument } from "../data/types";

export function mountTableApp(
	container: HTMLElement,
	props: {
		doc: TableDocument;
		onChange: (doc: TableDocument) => void;
		airtableToken?: string;
	}
): Root {
	const root = createRoot(container);
	root.render(createElement(TableApp, props));
	return root;
}

export function updateTableApp(
	root: Root,
	props: {
		doc: TableDocument;
		onChange: (doc: TableDocument) => void;
		airtableToken?: string;
	}
): void {
	root.render(createElement(TableApp, props));
}
