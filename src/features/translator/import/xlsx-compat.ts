import JSZip from "jszip";

/**
 * Makes workbooks written by tools other than Excel readable by ExcelJS, before the parser loads them.
 *
 * Some writers (for example the .NET Open XML SDK) produce valid .xlsx files that ExcelJS
 * can't open, because ExcelJS matches XML element names literally and resolves part paths only
 * relative to their folder. Two differences are fixed here, and nothing else is changed:
 *
 * 1. Prefixed namespaces: `<x:workbook xmlns:x="…/spreadsheetml/2006/main">` becomes
 *    `<workbook xmlns="…">`. Only the SpreadsheetML and package-relationship namespaces are
 *    unprefixed; drawing, chart and extension namespaces keep their prefixes, as in Excel files.
 * 2. Absolute part paths: a relationship `Target="/xl/tables/table1.xml"` becomes the same path
 *    relative to the part that owns it (`../tables/table1.xml`). External links are left alone.
 *
 * docs/translator/JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx is written this way, so real
 * exports may be too. A workbook saved by Excel has neither difference and is returned unchanged,
 * without being re-zipped. Some writers use only absolute paths (openpyxl, which wrote the
 * synthetic sample); ExcelJS reads most of those, and making them relative is harmless.
 *
 * Pure: no React, no network, no logging. Throws when the bytes aren't a ZIP archive.
 */

/** Namespaces ExcelJS expects as the default (unprefixed) namespace. */
const UNPREFIXED_NAMESPACES = [
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  "http://schemas.openxmlformats.org/package/2006/relationships",
  "http://schemas.openxmlformats.org/package/2006/content-types",
] as const;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

/** `<x:` and `</x:` for every prefix bound to one of the namespaces above, or null when there is none. */
function unprefixXml(xml: string): string | null {
  let result = xml;
  for (const namespace of UNPREFIXED_NAMESPACES) {
    const declaration = new RegExp(`\\sxmlns:([A-Za-z_][\\w.-]*)="${escapeRegExp(namespace)}"`);
    const match = result.match(declaration);
    if (!match) continue;
    const prefix = escapeRegExp(match[1]);
    // In XML text and attribute values "<" is always escaped, so every "<x:" here is a tag.
    result = result.replace(new RegExp(`<(/?)${prefix}:`, "g"), "<$1");
    // Rebind the namespace as the default unless the part already declares one.
    if (!/\sxmlns="/.test(result)) result = result.replace(declaration, ` xmlns="${namespace}"`);
  }
  return result === xml ? null : result;
}

/** The folder of the part a .rels file belongs to: "xl/worksheets/_rels/sheet2.xml.rels" → ["xl", "worksheets"]. */
function relsOwnerFolder(relsPath: string): string[] {
  return relsPath.split("/").slice(0, -2);
}

/** "/xl/tables/table1.xml" seen from ["xl", "worksheets"] → "../tables/table1.xml". */
function relativeTarget(fromFolder: readonly string[], absoluteTarget: string): string {
  const to = absoluteTarget.replace(/^\/+/, "").split("/");
  let shared = 0;
  while (shared < fromFolder.length && shared < to.length - 1 && fromFolder[shared] === to[shared]) shared++;
  return [...fromFolder.slice(shared).map(() => ".."), ...to.slice(shared)].join("/");
}

/** Absolute internal relationship targets made relative, or null when there is none. */
function relativizeRels(xml: string, relsPath: string): string | null {
  const folder = relsOwnerFolder(relsPath);
  const result = xml.replace(/<(?:[\w.-]+:)?Relationship\b[^>]*>/g, (element) =>
    /\bTargetMode="External"/.test(element)
      ? element
      : element.replace(/\bTarget="(\/[^"]*)"/, (_, target: string) => `Target="${relativeTarget(folder, target)}"`),
  );
  return result === xml ? null : result;
}

/**
 * The workbook's bytes, rewritten only if it uses one of the two differences above. Returns the
 * same `buffer` when nothing needs changing.
 */
export async function makeExcelJsCompatible(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  const parts = Object.values(zip.files).filter(
    (entry) => !entry.dir && (entry.name.endsWith(".xml") || entry.name.endsWith(".rels")),
  );

  let changed = false;
  for (const part of parts) {
    const xml = await part.async("string");
    const unprefixed = unprefixXml(xml);
    const current = unprefixed ?? xml;
    const fixed = part.name.endsWith(".rels") ? (relativizeRels(current, part.name) ?? unprefixed) : unprefixed;
    if (fixed === null) continue;
    zip.file(part.name, fixed);
    changed = true;
  }

  return changed ? zip.generateAsync({ type: "arraybuffer" }) : buffer;
}
