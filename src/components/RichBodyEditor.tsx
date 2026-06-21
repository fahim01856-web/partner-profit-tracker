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
    let html = `<table style="border-collapse:collapse;width:100%;margin:8px 0;" border="1"><tbody>`;
    for (let r = 0; r < rows; r++) {
      html += "<tr>";
      for (let c = 0; c < cols; c++) {
        html += `<td style="border:1px solid #999;padding:6px;min-width:40px;">&nbsp;</td>`;
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
            <Button type="button" size="sm" variant="secondary" className="h-7 px-2" onClick={() => {
              const r = parseInt(prompt("রো সংখ্যা?", "3") || "0", 10);
              const c = parseInt(prompt("কলাম সংখ্যা?", "3") || "0", 10);
              if (r > 0 && c > 0) insertTable(r, c);
            }}>+ টেবিল</Button>
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
              // Strip Office/Word wrappers but keep inline styles, tables, images
              const cleaned = html
                .replace(/<!--[\s\S]*?-->/g, "")
                .replace(/<\/?(html|head|body|meta|link|style|o:p|xml)[^>]*>/gi, "")
                .replace(/\sclass="[^"]*"/gi, "");
              document.execCommand("insertHTML", false, cleaned);
              emit();
            } else if (text) {
              e.preventDefault();
              document.execCommand("insertText", false, text);
              emit();
            } else {
              setTimeout(emit, 0);
            }
          }}
          className="p-3 min-h-[280px] max-h-[60vh] overflow-auto text-sm focus:outline-none prose prose-sm max-w-none [&_table]:border-collapse [&_td]:border [&_td]:border-gray-400 [&_td]:p-1.5 [&_th]:border [&_th]:border-gray-400 [&_th]:p-1.5"
          style={{ minHeight: `${rows * 20}px` }}
        />
      ) : (
        <Textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs border-0 rounded-none" />
      )}
    </div>
  );
}
