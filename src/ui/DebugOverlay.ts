/**
 * TEMPORARY DIAGNOSTIC BUILD -- remove before shipping anything user-facing.
 *
 * v0.1.27 answered two questions and missed the third:
 *   - outside chain, inside chain, big positioned elements INSIDE the view.
 * The user then reported the real event precisely: before tapping an input
 * everything is visible; the tap opens the keyboard AND a second surface that
 * slides up from below and covers the middle of the screen. The old scan
 * could never see that surface because it only searched *inside the view*.
 *
 * This build fixes both blind spots:
 *   1. INVENTORY of the WHOLE document (not just the view) before the tap,
 *      and a DIFF after the tap: what APPEARED, what GREW, what SHRANK, what
 *      MOVED. Whatever slides up from below is one of those by definition.
 *   2. A full-app positioned-element inventory instead of a view-only one.
 *   3. The app container's computed padding and safe-area inset, in case the
 *      "covering screen" is really Obsidian's keyboard padding painting the
 *      background -- in which case there is no element to find.
 *   4. device/UA/body-class lines so the next screenshot also answers which
 *      phone, OS and Obsidian classes are active without asking.
 *
 * Method note: measurements are taken twice -- a baseline refreshed whenever
 * nothing is focused (keyboard closed), and a live capture after any tap.
 * The verdict ("what did the tap change") is rendered first so a single
 * screenshot of the top of the screen carries it.
 */

type Box = {
	label: string;
	w: number;
	h: number;
	top: number;
	left: number;
	pos: string;
	z: string;
	disp: string;
	vis: string;
};

const OUTSIDE = [
	".tabula-view",
	".workspace-leaf-content",
	".workspace-leaf",
	".workspace-tab-container",
	".workspace-tab-header-container",
	".workspace-tabs",
	".workspace-split",
	".workspace",
	".horizontal-main-container",
	".app-container",
	"body",
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

const pad = (s: string, n: number): string =>
	(s.length > n ? s.slice(0, n - 1) + "~" : s).padEnd(n);
const num = (n: number): string => String(Math.round(n)).padStart(5) + " ";

function labelOf(el: Element): string {
	const id = el.id ? "#" + el.id : "";
	const cls = (el.getAttribute("class") || "")
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 3)
		.join(".");
	return el.tagName.toLowerCase() + (cls ? "." + cls : "") + id;
}

function keyOf(el: Element): string {
	const parts: string[] = [];
	let cur: Element | null = el;
	while (cur && cur !== document.documentElement) {
		let part = labelOf(cur);
		const parent = cur.parentElement;
		if (parent) {
			const same = Array.from(parent.children).filter(
				(c) => labelOf(c) === part,
			);
			if (same.length > 1) part += "[" + same.indexOf(cur) + "]";
		}
		parts.unshift(part);
		cur = cur.parentElement;
	}
	return parts.join(">");
}

function boxOf(el: Element): Box {
	const c = getComputedStyle(el);
	const r = el.getBoundingClientRect();
	return {
		label: labelOf(el),
		w: Math.round(r.width),
		h: Math.round(r.height),
		top: Math.round(r.top),
		left: Math.round(r.left),
		pos: c.position,
		z: c.zIndex,
		disp: c.display,
		vis: c.visibility,
	};
}

function row(el: Element): string {
	const c = getComputedStyle(el);
	const r = el.getBoundingClientRect();
	const scroll =
		c.overflowY === "auto" || c.overflowY === "scroll"
			? " +" + (el.scrollHeight - el.clientHeight)
			: "";
	return (
		[
			pad(labelOf(el), 26),
			num(r.height),
			num(r.top),
			pad(c.height, 11),
			pad(c.minHeight, 6),
			pad(c.flex || "-", 9),
			pad(c.overflowY, 6),
		].join(" ") + scroll
	);
}

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
		"max-height:74vh",
		"overflow:auto",
		"white-space:pre",
		"pointer-events:none",
		"border-bottom:2px solid #0f0",
	].join(";");
	host.appendChild(pre);

	let baseline = new Map<string, Box>();
	let lastEvent = "init";
	let lastEventAt = performance.now();
	let baselineAt = "";

	const interesting = (el: Element, b: Box): boolean => {
		if (el === pre || pre.contains(el)) return false;
		if (b.disp === "none" || b.vis === "hidden") return false;
		if (el.contains(host) || host.contains(el)) return true;
		const wide = b.w >= window.innerWidth * 0.5;
		return (wide && b.h >= 40) || b.pos === "fixed" || b.pos === "sticky";
	};

	const capture = (): Map<string, Box> => {
		const map = new Map<string, Box>();
		const all = document.body.querySelectorAll("*");
		const cap = Math.min(all.length, 4000);
		for (let i = 0; i < cap; i++) {
			const el = all[i];
			let b: Box;
			try {
				b = boxOf(el);
			} catch {
				continue;
			}
			if (interesting(el, b)) map.set(keyOf(el), b);
		}
		return map;
	};

	const refreshBaseline = (): void => {
		if (document.activeElement && document.activeElement !== document.body) return;
		baseline = capture();
		baselineAt = new Date().toISOString().slice(11, 19);
	};

	const fmtDiff = (sign: string, before: Box | undefined, after: Box): string =>
		[
			sign,
			pad(after.label.slice(0, 34), 35),
			String(before ? before.h : 0).padStart(4),
			"->",
			String(after.h).padStart(4),
			"@y=" + String(after.top).padStart(4),
			after.pos !== "static" ? after.pos : "",
			after.z !== "auto" ? "z=" + after.z : "",
		]
			.filter(Boolean)
			.join(" ");

	const render = (): void => {
		const now = capture();
		const lines: string[] = [];

		const page = document.querySelector(".tabula-file-root");
		const pageH = page ? Math.round(page.getBoundingClientRect().height) : 0;
		const viewH = Math.round(host.getBoundingClientRect().height);
		const ms = Math.round(performance.now() - lastEventAt);
		lines.push(
			"vh=" + window.innerHeight +
				" vv=" + (window.visualViewport ? Math.round(window.visualViewport.height) : "?") +
				" rows=" + document.querySelectorAll(".tabula-grid tbody tr").length +
				"  t+" + ms + "ms(" + lastEvent + ")",
		);
		lines.push(
			"VIEW " + viewH + "px   PAGE " + pageH + "px   FILL " +
				(viewH ? Math.round((pageH / viewH) * 100) : 0) + "%" +
				"   baseline=" + (baselineAt || "none"),
		);
		const ae = document.activeElement;
		lines.push(
			"focus=" + (ae && ae !== document.body ? labelOf(ae) : "(none)") +
				"  ua=" + pad(navigator.userAgent, 60).trim(),
		);
		lines.push("body: " + pad(document.body.className || "(no classes)", 70).trim());

		// What did the tap change? This is the section that names the
		// surface the user watched slide up from below.
		lines.push("");
		lines.push("-- what the tap changed --");
		if (!baseline.size) {
			lines.push("(no baseline yet -- tap out, then tap the input again)");
		} else {
			const grew: string[] = [];
			const shrank: string[] = [];
			const moved: string[] = [];
			now.forEach((after, key) => {
				const before = baseline.get(key);
				if (!before || before.h < 8) {
					if (after.h >= 40 && after.top < window.innerHeight)
						grew.push(fmtDiff("+", before, after));
				} else if (after.h - before.h >= 40) {
					grew.push(fmtDiff("+", before, after));
				} else if (before.h - after.h >= 40) {
					shrank.push(fmtDiff("-", before, after));
				} else if (Math.abs(after.top - before.top) >= 40) {
					moved.push(fmtDiff("~", before, after));
				}
			});
			baseline.forEach((before, key) => {
				if (!now.has(key) && before.h >= 40) shrank.push(fmtDiff("-", before, { ...before, h: 0, top: before.top } as Box));
			});
			const all = [...grew.slice(0, 12), ...shrank.slice(0, 12), ...moved.slice(0, 8)];
			if (all.length) lines.push(...all);
			else lines.push("(nothing changed vs baseline)");
		}

		// Full-app keyboard padding / safe-area probe: if the dark middle
		// region is just painted container background, the evidence is here.
		lines.push("");
		lines.push("-- app padding / insets --");
		const app = document.querySelector(".app-container");
		if (app) {
			const c = getComputedStyle(app);
			lines.push(
				pad(".app-container", 22) +
					"h=" + num(Math.round(app.getBoundingClientRect().height)) +
					" pad t=" + pad(c.paddingTop, 7) + " b=" + pad(c.paddingBottom, 7) +
					" pos=" + c.position + " bg=" + pad(c.backgroundColor, 18),
			);
		}
		const bodyC = getComputedStyle(document.body);
		lines.push(
			pad("body", 22) +
				"h=" + num(Math.round(document.body.getBoundingClientRect().height)) +
				" pad b=" + pad(bodyC.paddingBottom, 7) +
				" --safe-area-inset-bottom=" +
				pad(bodyC.getPropertyValue("--safe-area-inset-bottom") || "(unset)", 8),
		);

		// Whole-document covering-layer inventory this time, not view-only.
		lines.push("");
		lines.push("-- covering layer inventory (whole app) --");
		let covers = 0;
		now.forEach((b) => {
			if (b.pos !== "fixed" && b.pos !== "absolute" && b.pos !== "sticky") return;
			if (b.h < 60 || b.w < 60) return;
			covers++;
			if (covers > 14) return;
			lines.push(
				pad(b.label, 34) +
					num(b.h) + "@" + String(b.top).padStart(4) + " " +
					pad(b.pos, 9) + "z=" + b.z,
			);
		});
		if (!covers) lines.push("(none -- the cover is painted background, not an element)");

		// The two chains, kept from v0.1.27 for continuity of comparison.
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

		pre.textContent = lines.join("\n");
	};

	const onEvent = (e: Event): void => {
		lastEvent = e.type;
		lastEventAt = performance.now();
		if (e.type === "focusout") window.setTimeout(refreshBaseline, 600);
		render();
	};
	const events = ["focusin", "focusout", "resize", "scroll", "touchstart"] as const;
	events.forEach((e) => document.addEventListener(e, onEvent, true));
	const timer = window.setInterval(render, 500);
	refreshBaseline();
	render();

	return () => {
		window.clearInterval(timer);
		events.forEach((e) => document.removeEventListener(e, onEvent, true));
		pre.remove();
	};
}
