/**
 * TEMPORARY DIAGNOSTIC BUILD -- remove before shipping anything user-facing.
 *
 * The desktop ancestor chain measures as healthy, but the phone collapses and
 * no desktop harness can reproduce it. This paints the live measurements of
 * both chains directly on the phone screen so a single screenshot carries the
 * evidence, and re-measures on focus/resize so it shows the state *after* a
 * cell is tapped rather than before.
 */

const OUTSIDE = [
	".tabula-view",
	".workspace-leaf-content",
	".workspace-leaf",
	".workspace-tab-container",
	".workspace-tabs",
	".workspace-split",
	".workspace",
	".horizontal-main-container",
	".app-container",
];

const INSIDE = [
	".tabula-mount",
	".tabula-file-root",
	".tabula-file-table",
	".tabula-root",
	".tabula-toolbar",
	".tabula-grid-area",
	".tabula-grid-wrap",
	".tabula-grid",
];

const pad = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + "~" : s).padEnd(n);
const num = (n: number): string => String(Math.round(n)).padStart(5) + " ";

function name(el: Element): string {
	const cls =
		typeof el.className === "string" && el.className.trim()
			? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
			: "";
	return el.tagName.toLowerCase() + cls;
}

function row(el: Element): string {
	const c = getComputedStyle(el);
	const r = el.getBoundingClientRect();
	const scroll =
		c.overflowY === "auto" || c.overflowY === "scroll"
			? " +" + (el.scrollHeight - el.clientHeight)
			: "";
	return [
		pad(name(el), 20),
		num(r.height),
		num(r.top),
		pad(c.height, 10),
		pad(c.minHeight, 6),
		pad(c.flex || "-", 10),
		pad(c.overflowY, 6),
	].join(" ") + scroll;
}

const HEAD = pad("element", 20) + "     h    top   css-height  min-h  flex        ovf-y";

export function installDebugOverlay(host: HTMLElement): () => void {
	const pre = document.createElement("pre");
	pre.style.cssText = [
		"position:fixed",
		"left:0",
		"right:0",
		"top:0",
		"z-index:2147483647",
		"background:#000",
		"color:#3f6",
		"font:9px/1.25 ui-monospace,monospace",
		"padding:4px",
		"margin:0",
		"max-height:78vh",
		"overflow:auto",
		"white-space:pre",
		"border-bottom:2px solid #0f0",
	].join(";");
	host.appendChild(pre);

	const refresh = (): void => {
		const lines: string[] = [];
		const page = document.querySelector(".tabula-file-root");
		const pageH = page ? Math.round(page.getBoundingClientRect().height) : 0;
		const viewH = Math.round(host.getBoundingClientRect().height);
		lines.push(
			"vh=" + window.innerHeight +
			" vv=" + (window.visualViewport ? Math.round(window.visualViewport.height) : "?") +
			"  rows=" + document.querySelectorAll(".tabula-grid tbody tr").length,
		);
		lines.push(
			"VIEW " + viewH + "px   PAGE " + pageH + "px   FILL " +
			(viewH ? Math.round((pageH / viewH) * 100) : 0) + "%",
		);
		lines.push("");
		lines.push("-- outside --");
		for (const sel of OUTSIDE) {
			const el = sel === ".tabula-view" ? host : document.querySelector(sel);
			lines.push(el ? row(el) : pad(sel, 30) + "  (none)");
		}
		lines.push("");
		lines.push("-- inside --");
		for (const sel of INSIDE) {
			const el = document.querySelector(sel);
			lines.push(el ? row(el) : pad(sel, 30) + "  (none)");
		}
		// Sibling overlays are invisible to a parent/child walk, so list every
		// element in the view that paints something large and on top.
		lines.push("");
		lines.push("-- possible overlays in .tabula-view --");
		const view = host;
		let found = 0;
		view.querySelectorAll("*").forEach((el) => {
			if (el === pre) return;
			const c = getComputedStyle(el);
			const r = el.getBoundingClientRect();
			const big = r.height > 60 && r.width > 60;
			if (!big) return;
			if (c.position !== "fixed" && c.position !== "absolute" && c.position !== "sticky") return;
			found++;
			lines.push([pad(name(el), 30), num(r.height), num(r.top), pad(c.position, 9), "z=" + c.zIndex].join(" "));
		});
		if (!found) lines.push("(none)");
		pre.textContent = lines.join("\n");
	};

	const events = ["focusin", "focusout", "resize", "scroll", "touchstart"] as const;
	events.forEach((e) => document.addEventListener(e, refresh, true));
	const timer = window.setInterval(refresh, 400);
	refresh();

	return () => {
		window.clearInterval(timer);
		events.forEach((e) => document.removeEventListener(e, refresh, true));
		pre.remove();
	};
}
