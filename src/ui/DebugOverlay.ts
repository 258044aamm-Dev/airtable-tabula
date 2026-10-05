/**
 * TEMPORARY DIAGNOSTIC BUILD -- remove before shipping anything user-facing.
 *
 * v0.1.29 (whole-document tap diff) caught the smoking gun on the user's
 * Vivo/Android 14 phone:
 *
 *     keyboard OPEN:   .app-container  860 -> 389
 *                      .workspace / split / main-container  860 -> 389
 *                      .view-content.tabula-view  482  (css-height 482.4px)
 *                      .tabula-mount  0   .tabula-file-root  20   .tabula-root 1
 *     keyboard CLOSED: .app-container  860   view 776   mount 732   fill 94%
 *
 * Obsidian's own mobile shell compresses the whole app container when the
 * keyboard opens. The plugin stylesheets never set an explicit height on
 * .view-content.tabula-view, yet the phone computes one (482.4px open,
 * 775.733px closed) -- so a rule we do not control is sizing the view, and
 * its formula changes with keyboard state. Computed css-height on
 * .tabula-mount nevertheless reports 0px. That number was computed SOMEWHERE.
 *
 * This build ends all cascade speculation in one screenshot:
 *
 *   1. CASCADE DUMP -- for .tabula-view / .tabula-mount / .tabula-file-root,
 *      every size-bearing rule from every stylesheet on the page (with its
 *      origin and order), plus the element's inline style. Whichever rule
 *      sets the view's height and whatever zeroes the mount will be named.
 *   2. SELF-SIZE TOGGLE -- a panel button applies geometry measured from the
 *      view's own rect directly onto the mount (bypassing the inherited
 *      chain). If the fill jumps from 4% to ~100% while everything else is
 *      untouched, the fix mechanism is proven on-device in the same session.
 *   3. State classes of .app-container / leaf / leaf-content, in case a
 *      keyboard-open class is what the height rule keys on.
 *   4. The v0.1.29 tap-diff, retained, with the baseline now refreshed only
 *      in a healthy state (mount > 100px) so baselines are never captured
 *      mid-collapse.
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

const CASCADE_TARGETS = [".tabula-view", ".tabula-mount", ".tabula-file-root"];
const SIZE_PROPS = [
	"height", "min-height", "max-height",
	"flex", "flex-direction", "align-items",
	"position", "top", "bottom", "inset",
	"padding-top", "padding-bottom",
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
			const same = Array.from(parent.children).filter((c) => labelOf(c) === part);
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
		label: labelOf(el), w: Math.round(r.width), h: Math.round(r.height),
		top: Math.round(r.top), left: Math.round(r.left),
		pos: c.position, z: c.zIndex, disp: c.display, vis: c.visibility,
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
		[pad(labelOf(el), 26), num(r.height), num(r.top), pad(c.height, 11),
		 pad(c.minHeight, 6), pad(c.flex || "-", 9), pad(c.overflowY, 6)].join(" ") + scroll
	);
}

/** Every size-bearing declaration that matches el, in document order. */
function cascadeFor(el: Element, selfLabel: string): string[] {
	const hits: string[] = [];
	let sheetIdx = 0;
	for (const sheet of Array.from(document.styleSheets)) {
		sheetIdx++;
		let origin = "inline";
		try {
			origin = sheet.href ? sheet.href.split("/").slice(-1)[0] : "inline";
		} catch { origin = "?"; }
		let order = 0;
		const walk = (rules: CSSRuleList | undefined): void => {
			if (!rules) return;
			for (const rule of Array.from(rules)) {
				order++;
				const anyRule = rule as CSSRule & {
					selectorText?: string;
					style?: CSSStyleDeclaration;
					cssRules?: CSSRuleList;
				};
				if (anyRule.cssRules) { walk(anyRule.cssRules); continue; }
				if (!anyRule.selectorText || !anyRule.style) continue;
				const groups = anyRule.selectorText.split(",");
				let matched = false;
				for (const sel of groups) {
					try {
						if (el.matches(sel.trim())) { matched = true; break; }
					} catch { /* unparseable selector */ }
				}
				if (!matched) continue;
				const decls: string[] = [];
				for (const prop of SIZE_PROPS) {
					const v = anyRule.style.getPropertyValue(prop);
					if (v) decls.push(prop + ":" + v + (anyRule.style.getPropertyPriority(prop) ? "!" : ""));
				}
				for (const sh of ["flex-grow", "flex-shrink", "flex-basis"]) {
					const v = anyRule.style.getPropertyValue(sh);
					if (v) decls.push(sh + ":" + v);
				}
				if (!decls.length) continue;
				hits.push(
					"  s" + sheetIdx + "#" + order + " " + pad(origin, 15) +
					pad(tidySelector(anyRule.selectorText), 27) + decls.join("  "),
				);
			}
		};
		try { walk((sheet as CSSStyleSheet).cssRules); } catch { /* cross-origin */ }
	}
	const inline = (el as HTMLElement).getAttribute("style");
	const out = [pad("> " + selfLabel, 28) + (inline ? "inline=[" + inline + "]" : "inline=(none)")];
	out.push(...hits.slice(0, 10));
	return out;
}

function tidySelector(s: string): string { return s.replace(/\s+/g, " ").trim(); }

export function installDebugOverlay(host: HTMLElement): () => void {
	const pre = document.createElement("pre");
	pre.style.cssText = [
		"position:fixed", "left:0", "right:0", "top:0", "z-index:2147483647",
		"background:#000", "color:#3f6", "font:9px/1.25 ui-monospace,monospace",
		"padding:4px", "margin:0", "max-height:82vh", "overflow:auto",
		"white-space:pre", "pointer-events:none", "border-bottom:2px solid #0f0",
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
			let b: Box;
			try { b = boxOf(all[i]); } catch { continue; }
			if (interesting(all[i], b)) map.set(keyOf(all[i]), b);
		}
		return map;
	};

	const healthy = (): boolean => {
		const m = host.querySelector(".tabula-mount");
		return !!m && m.getBoundingClientRect().height > 100;
	};

	const refreshBaseline = (): void => {
		if (document.activeElement && document.activeElement !== document.body) return;
		if (!healthy()) return; // never baseline mid-collapse
		baseline = capture();
		baselineAt = new Date().toISOString().slice(11, 19);
	};

	const fmtDiff = (sign: string, before: Box | undefined, after: Box): string =>
		[ sign, pad(after.label.slice(0, 34), 35), String(before ? before.h : 0).padStart(4),
		  "->", String(after.h).padStart(4), "@y=" + String(after.top).padStart(4),
		  after.pos !== "static" ? after.pos : "", after.z !== "auto" ? "z=" + after.z : "",
		].filter(Boolean).join(" ");

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
			"   baseline=" + (baselineAt || "none") +
			"   anchor=" + pad(host.querySelector<HTMLElement>(".tabula-mount")?.style.getPropertyValue("--tabula-mount-h") || "(unset)", 9) +
			" mountH=" + (host.querySelector<HTMLElement>(".tabula-mount")?.getBoundingClientRect().height.toFixed(0) ?? "?"),
		);
		const ae = document.activeElement;
		lines.push("focus=" + (ae && ae !== document.body ? labelOf(ae) : "(none)"));
		const app = document.querySelector(".app-container");
		const leafC = document.querySelector(".workspace-leaf-content");
		lines.push(
			"body: " + pad(document.body.className || "-", 52).trim(),
		);
		lines.push(
			"appcls: " + pad(app ? (app.getAttribute("class") || "-") : "-", 60).trim(),
		);
		lines.push(
			"leafcls: " + pad(leafC ? (leafC.getAttribute("class") || "-") : "-", 60).trim(),
		);

		lines.push("");
		lines.push("-- cascade: size rules matching our chain --");
		for (const sel of CASCADE_TARGETS) {
			const el = sel === ".tabula-view" ? host : document.querySelector(sel);
			lines.push(...(el ? cascadeFor(el, sel) : [pad(sel, 28) + "(none)"]));
		}

		lines.push("");
		lines.push("-- what the tap changed --");
		if (!baseline.size) {
			lines.push("(no healthy baseline yet)");
		} else {
			const grew: string[] = [], shrank: string[] = [], moved: string[] = [];
			now.forEach((after, key) => {
				const before = baseline.get(key);
				if (!before || before.h < 8) {
					if (after.h >= 40 && after.top < window.innerHeight) grew.push(fmtDiff("+", before, after));
				} else if (after.h - before.h >= 40) grew.push(fmtDiff("+", before, after));
				else if (before.h - after.h >= 40) shrank.push(fmtDiff("-", before, after));
				else if (Math.abs(after.top - before.top) >= 40) moved.push(fmtDiff("~", before, after));
			});
			baseline.forEach((before, key) => {
				if (!now.has(key) && before.h >= 40)
					shrank.push(fmtDiff("-", before, { ...before, h: 0, top: before.top } as Box));
			});
			const all = [...grew.slice(0, 14), ...shrank.slice(0, 14), ...moved.slice(0, 8)];
			lines.push(...(all.length ? all : ["(nothing changed vs baseline)"]));
		}

		lines.push("");
		lines.push("-- app padding / insets --");
		if (app) {
			const c = getComputedStyle(app);
			lines.push(
				pad(".app-container", 22) + "h=" + num(Math.round(app.getBoundingClientRect().height)) +
				" pad t=" + pad(c.paddingTop, 7) + " b=" + pad(c.paddingBottom, 7),
			);
		}
		const bodyC = getComputedStyle(document.body);
		lines.push(
			pad("body", 22) + "h=" + num(Math.round(document.body.getBoundingClientRect().height)) +
			" safe-inset-bottom=" +
			pad(bodyC.getPropertyValue("--safe-area-inset-bottom") || "(unset)", 8) +
			" safe-inset-top=" + pad(bodyC.getPropertyValue("--safe-area-inset-top") || "(unset)", 7),
		);

		lines.push("");
		lines.push("-- covering layer inventory (whole app) --");
		let covers = 0;
		now.forEach((b) => {
			if (b.pos !== "fixed" && b.pos !== "absolute" && b.pos !== "sticky") return;
			if (b.h < 60 || b.w < 60) return;
			covers++;
			if (covers > 14) return;
			lines.push(pad(b.label, 34) + num(b.h) + "@" + String(b.top).padStart(4) + " " +
				pad(b.pos, 9) + "z=" + b.z);
		});
		if (!covers) lines.push("(none -- the cover is painted background, not an element)");

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
