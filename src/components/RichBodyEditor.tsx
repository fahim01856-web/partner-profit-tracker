import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: string;
  onChange: (html: string) => void;
  rows?: number;
};

/**
 * WYSIWYG editor with table editing (insert table, add/remove rows & columns,
 * merge/split, bold/italic). Falls back to raw HTML textarea toggle.
 */
export function RichBodyEditor({ value, onChange, rows = 14 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"wysiwyg" | "html">("wysiwyg");
  const lastValueRef = useRef<string>("");
  const savedRangeRef = useRef<Range | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickR, setPickR] = useState(0);
  const [pickC, setPickC] = useState(0);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };
  const restoreSelection = () => {
    const r = savedRangeRef.current;
    if (!r) { ref.current?.focus(); return; }
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  };

  // Sync external value -> editor (only when it differs from what we emitted)
  useEffect(() => {
    if (mode !== "wysiwyg") return;
    const el = ref.current;
    if (!el) return;
    if (value !== lastValueRef.current && value !== el.innerHTML) {
      el.innerHTML = value || "";
      lastValueRef.current = value || "";
    }
  }, [value, mode]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML;
    lastValueRef.current = html;
    onChange(html);
  };

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    emit();
  };

  const getSelectionCell = (): HTMLTableCellElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== ref.current) {
      if (node instanceof HTMLTableCellElement) return node;
      node = node.parentNode;
    }
    return null;
  };

  const insertTable = (rows: number, cols: number) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    let html = `<table style="border-collapse:collapse;width:auto;margin:8px 0;resize:both;overflow:auto;display:inline-table;" border="1"><tbody>`;
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html += `<td style="border:1px solid #999;padding:6px;min-width:40px;resize:both;overflow:auto;">&nbsp;</td>`;
      }
      html += "</tr>";
    }
    html += "</tbody></table><p><br/></p>";
    document.execCommand("insertHTML", false, html);
    emit();
  };

  const addRow = (where: "above" | "below") => {
    const cell = getSelectionCell();
    const row = cell?.parentElement as HTMLTableRowElement | null;
    if (!row) return;
    const cols = row.cells.length;
    const newRow = row.ownerDocument.createElement("tr");
    for (let i = 0; i < cols; i++) {
      const td = row.ownerDocument.createElement("td");
      td.style.border = "1px solid #999";
      td.style.padding = "6px";
      td.innerHTML = "&nbsp;";
      newRow.appendChild(td);
    }
    row.parentElement?.insertBefore(newRow, where === "above" ? row : row.nextSibling);
    emit();
  };

  const addCol = (where: "left" | "right") => {
    const cell = getSelectionCell();
    if (!cell) return;
    const table = cell.closest("table");
    if (!table) return;
    const colIndex = cell.cellIndex;
    table.querySelectorAll("tr").forEach((tr) => {
      const td = tr.ownerDocument.createElement("td");
      td.style.border = "1px solid #999";
      td.style.padding = "6px";
      td.innerHTML = "&nbsp;";
      const ref = tr.cells[colIndex];
      if (where === "left") tr.insertBefore(td, ref);
      else tr.insertBefore(td, ref?.nextSibling || null);
    });
    emit();
  };

  const deleteRow = () => {
    const cell = getSelectionCell();
    cell?.parentElement?.remove();
    emit();
  };

  const deleteCol = () => {
    const cell = getSelectionCell();
    if (!cell) return;
    const table = cell.closest("table");
    const colIndex = cell.cellIndex;
    table?.querySelectorAll("tr").forEach((tr) => tr.cells[colIndex]?.remove());
    emit();
  };

  const deleteTable = () => {
    const cell = getSelectionCell();
    cell?.closest("table")?.remove();
    emit();
  };

  const mergeRight = () => {
    const cell = getSelectionCell();
    if (!cell) return;
    const next = cell.nextElementSibling as HTMLTableCellElement | null;
    if (!next) return;
    cell.colSpan = (cell.colSpan || 1) + (next.colSpan || 1);
    cell.innerHTML = (cell.innerHTML + " " + next.innerHTML).trim() || "&nbsp;";
    next.remove();
    emit();
  };

  const mergeDown = () => {
    const cell = getSelectionCell();
    const row = cell?.parentElement as HTMLTableRowElement | null;
    if (!cell || !row) return;
    const nextRow = row.nextElementSibling as HTMLTableRowElement | null;
    const below = nextRow?.cells[cell.cellIndex];
    if (!below) return;
    cell.rowSpan = (cell.rowSpan || 1) + (below.rowSpan || 1);
    cell.innerHTML = (cell.innerHTML + " " + below.innerHTML).trim() || "&nbsp;";
    below.remove();
    emit();
  };

  const splitCell = () => {
    const cell = getSelectionCell();
    if (!cell) return;
    cell.colSpan = 1;
    cell.rowSpan = 1;
    emit();
  };

  const insertNestedTable = () => {
    const cell = getSelectionCell();
    if (!cell) return;
    const r = parseInt(prompt("ভিতরের টেবিলের রো?", "2") || "0", 10);
    const c = parseInt(prompt("ভিতরের টেবিলের কলাম?", "2") || "0", 10);
    if (r <= 0 || c <= 0) return;
    let html = `<table style="border-collapse:collapse;width:100%;margin:4px 0;" border="1"><tbody>`;
    for (let i = 0; i < r; i++) {
      html += "<tr>";
      for (let j = 0; j < c; j++) html += `<td style="border:1px solid #999;padding:4px;">&nbsp;</td>`;
      html += "</tr>";
    }
    html += "</tbody></table>";
    ref.current?.focus();
    document.execCommand("insertHTML", false, html);
    emit();
  };

  const setCellSize = () => {
    const cell = getSelectionCell();
    if (!cell) return;
    const w = prompt("সেলের width (px বা %, খালি = অপরিবর্তিত)", cell.style.width || "");
    const h = prompt("সেলের height (px, খালি = অপরিবর্তিত)", cell.style.height || "");
    if (w !== null && w !== "") cell.style.width = w;
    if (h !== null && h !== "") cell.style.height = h;
    emit();
  };

  return (
    <div className="border rounded">
      <div className="flex flex-wrap gap-1 p-1 border-b bg-muted/30 text-xs">
        <Button type="button" size="sm" variant={mode === "wysiwyg" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setMode("wysiwyg")}>এডিটর</Button>
        <Button type="button" size="sm" variant={mode === "html" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setMode("html")}>HTML</Button>
        {mode === "wysiwyg" && (
          <>
            <span className="mx-1 w-px bg-border" />
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => exec("bold")}><b>B</b></Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 italic" onClick={() => exec("italic")}>I</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 underline" onClick={() => exec("underline")}>U</Button>
            <span className="mx-1 w-px bg-border" />
            <div
              className="relative"
              onMouseLeave={() => { setPickerOpen(false); setPickR(0); setPickC(0); }}
            >
              <Button
                type="button" size="sm" variant="secondary" className="h-7 px-2"
                onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
                onClick={() => setPickerOpen((o) => !o)}
              >+ টেবিল ▾</Button>
              {pickerOpen && (
                <div
                  className="absolute z-50 left-0 top-8 bg-popover border rounded shadow p-2"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <div className="text-[10px] mb-1 text-muted-foreground">{pickR || "—"} × {pickC || "—"} (ক্লিক করুন)</div>
                  <div className="grid gap-[2px]" style={{ gridTemplateColumns: "repeat(10, 14px)" }}>
                    {Array.from({ length: 100 }).map((_, i) => {
                      const r = Math.floor(i / 10) + 1;
                      const c = (i % 10) + 1;
                      const active = r <= pickR && c <= pickC;
                      return (
                        <div
                          key={i}
                          onMouseEnter={() => { setPickR(r); setPickC(c); }}
                          onClick={() => {
                            restoreSelection();
                            insertTable(r, c);
                            setPickerOpen(false); setPickR(0); setPickC(0);
                          }}
                          className={`w-[14px] h-[14px] border cursor-pointer ${active ? "bg-primary border-primary" : "bg-background border-border"}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => addRow("above")}>↑ রো</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => addRow("below")}>↓ রো</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => addCol("left")}>← কলাম</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => addCol("right")}>→ কলাম</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={deleteRow}>− রো</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={deleteCol}>− কলাম</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={deleteTable}>× টেবিল</Button>
            <span className="mx-1 w-px bg-border" />
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={mergeRight}>⇆ মার্জ</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={mergeDown}>⇣ মার্জ</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={splitCell}>স্প্লিট</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={insertNestedTable}>+ নেস্টেড</Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={setCellSize}>সাইজ</Button>
          </>
        )}
      </div>
      {mode === "wysiwyg" ? (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onPaste={(e) => {
            const html = e.clipboardData.getData("text/html");
            const text = e.clipboardData.getData("text/plain");
            if (html) {
              e.preventDefault();
              const doc = new DOMParser().parseFromString(html, "text/html");
              const styleTags = Array.from(doc.querySelectorAll("style"))
                .map((s) => s.textContent || "")
                .join("\n");
              const bodyHtml = doc.body ? doc.body.innerHTML : html;
              const wrapped = styleTags
                ? `<div><style>${styleTags}</style>${bodyHtml}</div>`
                : bodyHtml;
              document.execCommand("insertHTML", false, wrapped);
              emit();
            } else if (text) {
              e.preventDefault();
              document.execCommand("insertText", false, text);
              emit();
            } else {
              setTimeout(emit, 0);
            }
          }}
          className="p-3 min-h-[280px] max-h-[60vh] overflow-auto text-sm focus:outline-none prose prose-sm max-w-none [&_table]:resize [&_table]:overflow-auto [&_table]:border-collapse [&_td]:resize [&_td]:overflow-auto [&_td]:border [&_td]:border-gray-400 [&_td]:p-1.5 [&_th]:border [&_th]:border-gray-400 [&_th]:p-1.5"
          style={{ minHeight: `${rows * 20}px` }}
        />
      ) : (
        <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs border-0 rounded-none" />
      )}
    </div>
  );
}
