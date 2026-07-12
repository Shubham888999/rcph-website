import { useState } from "react";
import {
  addResolutionSection,
  addResolutionPageBlock,
  createDefaultResolutionPageConfig,
  createDefaultResolutionSections,
  deleteResolutionPageBlock,
  deleteResolutionSection,
  describeResolutionPageBlock,
  describeResolutionSection,
  duplicateResolutionPageBlock,
  duplicateResolutionSection,
  moveResolutionPageBlock,
  moveResolutionSection,
  normalizeResolutionPageConfig,
  normalizeResolutionSection,
  normalizeResolutionPageBlock,
  RESOLUTION_PAGE_LIMITS,
  RESOLUTION_ALIGNMENTS,
  RESOLUTION_FONTS,
  RESOLUTION_SECTION_TYPES,
  updateResolutionPageBlock,
  updateResolutionSection,
  VOTES_TABLE_COLUMNS,
} from "../../resolutions/resolutionSectionsModel";
import {
  GENERATED_PAGES_PREVIEW_MODES,
  getGeneratedPagesPreviewAvailability,
  normalizeGeneratedPagesPreviewMode,
} from "../../resolutions/resolutionPreview";
import ResolutionPdfUploadPanel from "./ResolutionPdfUploadPanel";

const TYPE_LABELS = { heading: "Heading", paragraph: "Paragraph", table: "Table", votesTable: "Votes Table", spacer: "Spacer / Page Break" };
const COLUMN_LABELS = { name: "Name", position: "Position", vote: "Vote", timestamp: "Timestamp", signature: "Signature" };

function NumberField({ label, value, min, max, step = 1, onChange }) {
  return <label>{label}<input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function TextStyleEditor({ style, onChange, paragraph = false }) {
  const set = (key, value) => onChange({ ...style, [key]: value });
  return <div className="resolution-builder__style admin-form-grid">
    <label>Font<select value={style.fontFamily} onChange={(event) => set("fontFamily", event.target.value)}>{RESOLUTION_FONTS.map((font) => <option key={font}>{font}</option>)}</select></label>
    <NumberField label="Font size" min={8} max={20} value={style.fontSize} onChange={(value) => set("fontSize", value)} />
    <label>Alignment<select value={style.alignment} onChange={(event) => set("alignment", event.target.value)}>{RESOLUTION_ALIGNMENTS.map((alignment) => <option key={alignment}>{alignment}</option>)}</select></label>
    {paragraph ? <NumberField label="Line spacing" min={1} max={2} step={0.05} value={style.lineSpacing} onChange={(value) => set("lineSpacing", value)} /> : null}
    <NumberField label="Space before" min={0} max={72} value={style.spaceBefore} onChange={(value) => set("spaceBefore", value)} />
    <NumberField label="Space after" min={0} max={72} value={style.spaceAfter} onChange={(value) => set("spaceAfter", value)} />
    <div className="resolution-builder__checks">
      {[["bold", "Bold"], ["italic", "Italic"], ["underline", "Underline"]].map(([key, label]) => <label key={key}><input type="checkbox" checked={style[key]} onChange={(event) => set(key, event.target.checked)} /> {label}</label>)}
    </div>
  </div>;
}

function TableEditor({ section, onChange, maxRows = 200, maxColumns = 20, normalize = normalizeResolutionSection }) {
  const set = (changes) => onChange(normalize({ ...section, ...changes }, section.id));
  const setCell = (rowId, columnId, value) => {
    const rows = section.rows.map((row) => row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row);
    set({ rows });
  };
  const addRow = () => {
    if (section.rows.length >= maxRows) return;
    const rowNumber = section.rows.length + 1;
    set({ rows: [...section.rows, { id: `row_${rowNumber}`, cells: Object.fromEntries(section.columns.map((column) => [column.id, ""])) }] });
  };
  const removeRow = () => section.rows.length > 1 && set({ rows: section.rows.slice(0, -1) });
  const addColumn = () => {
    if (section.columns.length >= maxColumns) return;
    const columnId = `column_${section.columns.length + 1}`;
    set({ columns: [...section.columns, { id: columnId, label: "", widthPercent: 1, alignment: "left" }], rows: section.rows.map((row) => ({ ...row, cells: { ...row.cells, [columnId]: "" } })) });
  };
  const removeColumn = () => {
    if (section.columns.length <= 1) return;
    const removed = section.columns.at(-1).id;
    set({ columns: section.columns.slice(0, -1), rows: section.rows.map((row) => ({ ...row, cells: Object.fromEntries(Object.entries(row.cells).filter(([key]) => key !== removed)) })) });
  };
  return <div className="resolution-builder__table-editor">
    <div className="admin-actions"><button type="button" onClick={addRow} disabled={section.rows.length >= maxRows}>Add row</button><button type="button" onClick={removeRow} disabled={section.rows.length <= 1}>Remove row</button><button type="button" onClick={addColumn} disabled={section.columns.length >= maxColumns}>Add column</button><button type="button" onClick={removeColumn} disabled={section.columns.length <= 1}>Remove column</button></div>
    <div className="admin-table-wrap"><table><caption>Custom table cells</caption><thead><tr>{section.columns.map((column, index) => <th key={column.id}><span>Column {index + 1}</span><input aria-label={`Column ${index + 1} label`} placeholder="Optional label" value={column.label} onChange={(event) => set({ columns: section.columns.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} /><select aria-label={`Column ${index + 1} alignment`} value={column.alignment} onChange={(event) => set({ columns: section.columns.map((item, itemIndex) => itemIndex === index ? { ...item, alignment: event.target.value } : item) })}>{RESOLUTION_ALIGNMENTS.map((alignment) => <option key={alignment}>{alignment}</option>)}</select><input aria-label={`Column ${index + 1} width percentage`} type="number" min="1" max="100" value={Number(column.widthPercent.toFixed(2))} onChange={(event) => set({ columns: section.columns.map((item, itemIndex) => itemIndex === index ? { ...item, widthPercent: Number(event.target.value) } : item) })} /></th>)}</tr></thead><tbody>{section.rows.map((row, rowIndex) => <tr key={row.id}>{section.columns.map((column, columnIndex) => <td key={`${row.id}_${column.id}`}><textarea aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`} rows="2" value={row.cells[column.id] || ""} onChange={(event) => setCell(row.id, column.id, event.target.value)} /></td>)}</tr>)}</tbody></table></div>
    <div className="resolution-builder__checks">
      <label><input type="checkbox" checked={section.options.hasHeaderRow} onChange={(event) => set({ options: { ...section.options, hasHeaderRow: event.target.checked } })} /> Header row</label>
      <label><input type="checkbox" checked={section.options.repeatHeader} onChange={(event) => set({ options: { ...section.options, repeatHeader: event.target.checked } })} /> Repeat header</label>
      <label><input type="checkbox" checked={section.options.showBorders} onChange={(event) => set({ options: { ...section.options, showBorders: event.target.checked } })} /> Borders</label>
      <label><input type="checkbox" checked={section.style.boldHeader} onChange={(event) => set({ style: { ...section.style, boldHeader: event.target.checked } })} /> Bold header</label>
    </div>
    <div className="admin-form-grid"><label>Font<select value={section.style.fontFamily} onChange={(event) => set({ style: { ...section.style, fontFamily: event.target.value } })}>{RESOLUTION_FONTS.map((font) => <option key={font}>{font}</option>)}</select></label><NumberField label="Font size" min={8} max={20} value={section.style.fontSize} onChange={(value) => set({ style: { ...section.style, fontSize: value } })} /><NumberField label="Cell padding" min={1} max={12} value={section.style.cellPadding} onChange={(value) => set({ style: { ...section.style, cellPadding: value } })} /><NumberField label="Space before" min={0} max={72} value={section.style.spaceBefore} onChange={(value) => set({ style: { ...section.style, spaceBefore: value } })} /><NumberField label="Space after" min={0} max={72} value={section.style.spaceAfter} onChange={(value) => set({ style: { ...section.style, spaceAfter: value } })} /></div>
  </div>;
}

function ResolutionPageTableEditor({ block, onChange }) {
  const set = (changes) => onChange(normalizeResolutionPageBlock({ ...block, ...changes }, block.id));
  return <div className="resolution-page-builder__table">
    <label>Table title <span className="admin-optional">Optional</span><input value={block.title || ""} maxLength="200" onChange={(event) => set({ title: event.target.value })} /></label>
    <TableEditor section={block} maxRows={RESOLUTION_PAGE_LIMITS.tableRows} maxColumns={RESOLUTION_PAGE_LIMITS.tableColumns} normalize={normalizeResolutionPageBlock} onChange={onChange} />
    <div className="admin-form-grid">
      <label>Header font<select value={block.style.headerFontFamily || block.style.fontFamily} onChange={(event) => set({ style: { ...block.style, headerFontFamily: event.target.value } })}>{RESOLUTION_FONTS.map((font) => <option key={font}>{font}</option>)}</select></label>
      <NumberField label="Header size" min={8} max={20} value={block.style.headerFontSize || block.style.fontSize} onChange={(value) => set({ style: { ...block.style, headerFontSize: value } })} />
      <label>Row spacing<select value={block.options.compactRows ? "compact" : "standard"} onChange={(event) => set({ options: { ...block.options, compactRows: event.target.value === "compact" } })}><option value="standard">Standard</option><option value="compact">Compact</option></select></label>
    </div>
  </div>;
}

function ResolutionPageBlockEditor({ block, index, total, onUpdate, onDelete, onDuplicate, onMove }) {
  const setStyle = (style) => onUpdate({ style });
  return <details className="resolution-builder__section resolution-page-builder__block" open>
    <summary><span>{index + 1}. {block.type === "table" ? "Table" : "Paragraph"}</span><small>{describeResolutionPageBlock(block)}</small></summary>
    <div className="resolution-builder__section-body">
      {block.type === "paragraph" ? <><label>Paragraph text<textarea rows="5" maxLength={RESOLUTION_PAGE_LIMITS.paragraphCharacters} value={block.text} onChange={(event) => onUpdate({ text: event.target.value })} /></label><TextStyleEditor style={block.style} paragraph onChange={setStyle} /></> : null}
      {block.type === "table" ? <ResolutionPageTableEditor block={block} onChange={(next) => onUpdate(next)} /> : null}
      <div className="resolution-builder__section-actions"><button type="button" aria-label={`Move Resolution Page block ${index + 1} up`} disabled={index === 0} onClick={() => onMove("up")}>Move up</button><button type="button" aria-label={`Move Resolution Page block ${index + 1} down`} disabled={index === total - 1} onClick={() => onMove("down")}>Move down</button><button type="button" onClick={onDuplicate}>Duplicate</button><button type="button" className="danger" onClick={onDelete}>Delete block</button></div>
    </div>
  </details>;
}

function ResolutionPageEditor({ resolution, config, onChange }) {
  const set = (changes) => onChange(normalizeResolutionPageConfig({ ...config, ...changes }, resolution));
  const setDetails = (key) => (event) => set({ details: { ...config.details, [key]: event.target.value } });
  const setHeading = (changes) => set({ heading: { ...config.heading, ...changes } });
  const setMainStatement = (changes) => set({ mainStatement: { ...config.mainStatement, ...changes } });
  const setBlocks = (blocks) => set({ blocks });
  return <section className="resolution-page-builder" aria-label="Generated Resolution Page editor">
    <div className="resolution-page-builder__heading">
      <h4>Generated Resolution Page</h4>
      <p className="admin-help">Generate an editable official resolution page on the RCPH letterhead and include it in the final PDF.</p>
    </div>
    <label>Page heading<input value={config.heading.text} maxLength="120" onChange={(event) => setHeading({ text: event.target.value })} /></label>
    <TextStyleEditor style={config.heading} onChange={(style) => setHeading(style)} />
    <fieldset className="resolution-page-builder__details">
      <legend>Resolution details</legend>
      <div className="admin-form-grid">
        <label>Subject<input value={config.details.subject} maxLength="300" onChange={setDetails("subject")} /></label>
        <label>Date<input value={config.details.date} maxLength="80" onChange={setDetails("date")} /></label>
        <label>Place<input value={config.details.place} maxLength="160" onChange={setDetails("place")} /></label>
        <label>No. of Board Members<input value={config.details.boardMembersPresent} maxLength="80" onChange={setDetails("boardMembersPresent")} /></label>
        <label>Total No. of Board Members<input value={config.details.totalBoardMembers} maxLength="80" onChange={setDetails("totalBoardMembers")} /></label>
      </div>
      <TextStyleEditor style={config.detailsStyle} onChange={(detailsStyle) => set({ detailsStyle })} />
    </fieldset>
    <label>Main statement<textarea rows="5" maxLength={RESOLUTION_PAGE_LIMITS.paragraphCharacters} value={config.mainStatement.text} onChange={(event) => setMainStatement({ text: event.target.value })} /></label>
    <TextStyleEditor style={config.mainStatement} paragraph onChange={(style) => setMainStatement(style)} />
    <div className="resolution-page-builder__custom">
      <div className="resolution-page-builder__subhead"><h4>Additional content</h4><span>{config.blocks.length}/{RESOLUTION_PAGE_LIMITS.blocks}</span></div>
      <div className="admin-actions resolution-builder__add"><button type="button" disabled={config.blocks.length >= RESOLUTION_PAGE_LIMITS.blocks} onClick={() => setBlocks(addResolutionPageBlock(config.blocks, "paragraph"))}>Add paragraph</button><button type="button" disabled={config.blocks.length >= RESOLUTION_PAGE_LIMITS.blocks} onClick={() => setBlocks(addResolutionPageBlock(config.blocks, "table"))}>Add table</button></div>
      <div className="resolution-builder__sections">{config.blocks.map((block, index) => <ResolutionPageBlockEditor key={block.id} block={block} index={index} total={config.blocks.length} onUpdate={(changes) => setBlocks(updateResolutionPageBlock(config.blocks, block.id, changes))} onDelete={() => setBlocks(deleteResolutionPageBlock(config.blocks, block.id))} onDuplicate={() => setBlocks(duplicateResolutionPageBlock(config.blocks, block.id))} onMove={(direction) => setBlocks(moveResolutionPageBlock(config.blocks, block.id, direction))} />)}</div>
      {!config.blocks.length ? <p className="admin-empty">No additional content blocks.</p> : null}
    </div>
  </section>;
}

function VotesTableEditor({ section, onChange }) {
  const set = (changes) => onChange(normalizeResolutionSection({ ...section, ...changes }, section.id));
  return <div className="resolution-builder__votes">
    <label>Table title<input value={section.title} maxLength="200" onChange={(event) => set({ title: event.target.value })} /></label>
    <fieldset><legend>Include columns</legend><div className="resolution-builder__checks">{VOTES_TABLE_COLUMNS.map((key) => <label key={key}><input type="checkbox" checked={section.columns[key]} onChange={(event) => set({ columns: { ...section.columns, [key]: event.target.checked } })} /> {COLUMN_LABELS[key]}</label>)}</div></fieldset>
    <fieldset><legend>Voters</legend><label><input type="radio" name={`${section.id}_scope`} checked={section.options.voterScope === "submitted"} onChange={() => set({ options: { ...section.options, voterScope: "submitted" } })} /> Only submitted votes</label><label><input type="radio" name={`${section.id}_scope`} checked={section.options.voterScope === "all"} onChange={() => set({ options: { ...section.options, voterScope: "all" } })} /> All eligible voters</label></fieldset>
    <div className="resolution-builder__checks"><label><input type="checkbox" checked={section.options.showTitle} onChange={(event) => set({ options: { ...section.options, showTitle: event.target.checked } })} /> Show table title</label><label><input type="checkbox" checked={section.options.repeatHeader} onChange={(event) => set({ options: { ...section.options, repeatHeader: event.target.checked } })} /> Repeat header</label><label><input type="checkbox" checked={section.options.showResultSummary} onChange={(event) => set({ options: { ...section.options, showResultSummary: event.target.checked } })} /> Show final result</label></div>
    <div className="admin-form-grid"><label>Font<select value={section.style.fontFamily} onChange={(event) => set({ style: { ...section.style, fontFamily: event.target.value } })}>{RESOLUTION_FONTS.map((font) => <option key={font}>{font}</option>)}</select></label><NumberField label="Font size" min={8} max={20} value={section.style.fontSize} onChange={(value) => set({ style: { ...section.style, fontSize: value } })} /><NumberField label="Header size" min={8} max={20} value={section.style.headerFontSize} onChange={(value) => set({ style: { ...section.style, headerFontSize: value } })} /><NumberField label="Cell padding" min={1} max={12} value={section.style.cellPadding} onChange={(value) => set({ style: { ...section.style, cellPadding: value } })} /></div>
  </div>;
}

function SectionEditor({ section, index, total, onUpdate, onDelete, onDuplicate, onMove }) {
  const setStyle = (style) => onUpdate({ style });
  return <details className="resolution-builder__section" open>
    <summary><span>{index + 1}. {TYPE_LABELS[section.type]}</span><small>{describeResolutionSection(section)}</small></summary>
    <div className="resolution-builder__section-body">
      {section.type === "heading" || section.type === "paragraph" ? <><label>{section.type === "heading" ? "Heading text" : "Paragraph text"}<textarea rows={section.type === "heading" ? 2 : 6} value={section.text} onChange={(event) => onUpdate({ text: event.target.value })} /></label>{section.type === "paragraph" ? <label>List style<select value={section.listStyle} onChange={(event) => onUpdate({ listStyle: event.target.value })}><option value="none">None</option><option value="bullet">Bullet</option><option value="numbered">Numbered</option></select></label> : null}<TextStyleEditor style={section.style} paragraph={section.type === "paragraph"} onChange={setStyle} /></> : null}
      {section.type === "table" ? <TableEditor section={section} onChange={(next) => onUpdate(next)} /> : null}
      {section.type === "votesTable" ? <VotesTableEditor section={section} onChange={(next) => onUpdate(next)} /> : null}
      {section.type === "spacer" ? <label>Spacing<select value={section.mode} onChange={(event) => onUpdate({ mode: event.target.value })}><option value="small">Small (6 pt)</option><option value="medium">Medium (12 pt)</option><option value="large">Large (24 pt)</option><option value="pageBreak">Forced page break</option></select></label> : null}
      <div className="resolution-builder__section-actions"><button type="button" aria-label={`Move section ${index + 1} up`} disabled={index === 0} onClick={() => onMove("up")}>Move up</button><button type="button" aria-label={`Move section ${index + 1} down`} disabled={index === total - 1} onClick={() => onMove("down")}>Move down</button><button type="button" onClick={onDuplicate}>Duplicate</button><button type="button" className="danger" onClick={onDelete}>Delete</button></div>
    </div>
  </details>;
}

export default function ResolutionPdfBuilder({ value, onChange, disabled = false, onPreview, onGeneratedPagesPreview, onNotice, onPersisted, onEnsurePersisted }) {
  const [generatedPreview, setGeneratedPreview] = useState({ mode: GENERATED_PAGES_PREVIEW_MODES.ALL, action: "", error: "" });
  const mode = value.documentSourceMode || (value.pdfLayoutMode === "custom" ? "custom" : "standard");
  const sections = value.pdfSections || [];
  const resolutionPageConfig = normalizeResolutionPageConfig(value.resolutionPageConfig, value);
  const generatedPageOrder = Array.isArray(value.generatedPageOrder) ? value.generatedPageOrder : ["resolution_page", "vote_table"];
  const setSections = (pdfSections) => onChange({ ...value, pdfSections });
  const setMode = (documentSourceMode) => onChange({ ...value, documentSourceMode, pdfLayoutMode: documentSourceMode === "custom" ? "custom" : "standard" });
  const setResolutionPageConfig = (config) => onChange({ ...value, resolutionPageConfig: normalizeResolutionPageConfig(config, value) });
  const setGeneratedPageOrder = (order) => onChange({ ...value, generatedPageOrder: order });
  const toggleResolutionPage = (enabled) => setResolutionPageConfig(enabled ? { ...(value.resolutionPageConfig ? resolutionPageConfig : createDefaultResolutionPageConfig(value)), enabled: true } : { ...resolutionPageConfig, enabled: false });
  const generatedOrderValue = generatedPageOrder[0] === "vote_table" ? "vote_table_first" : "resolution_page_first";
  const modeLocked = !["draft", undefined, ""].includes(value.status) || (mode === "uploadedPdf" && value.uploadedSource?.status === "ready");
  const previewMode = normalizeGeneratedPagesPreviewMode(generatedPreview.mode);
  const generatedPreviewAvailability = getGeneratedPagesPreviewAvailability({ resolution: { ...value, resolutionPageConfig, generatedPageOrder } });
  const selectedPreviewAvailable = generatedPreviewAvailability.modes[previewMode] === true;
  const generatedPreviewBusy = Boolean(generatedPreview.action);
  const generatedPreviewDisabled = disabled || !onGeneratedPagesPreview || !generatedPreviewAvailability.enabled || !selectedPreviewAvailable || generatedPreviewBusy;
  const generatedPreviewMessage = !generatedPreviewAvailability.enabled
    ? generatedPreviewAvailability.message
    : !selectedPreviewAvailable
      ? previewMode === GENERATED_PAGES_PREVIEW_MODES.RESOLUTION_PAGE
        ? "Enable the Resolution Page before previewing it."
        : "Enable the Voting Table before previewing it."
      : "";
  const setGeneratedPreviewMode = (event) => setGeneratedPreview({ mode: event.target.value, action: "", error: "" });
  const runGeneratedPagesPreview = async (action) => {
    if (generatedPreviewDisabled) return;
    setGeneratedPreview((current) => ({ ...current, action, error: "" }));
    try {
      await onGeneratedPagesPreview({ previewMode, action });
      setGeneratedPreview((current) => ({ ...current, action: "", error: "" }));
    } catch (error) {
      setGeneratedPreview((current) => ({ ...current, action: "", error: error?.message || "PDF generation failed." }));
    }
  };
  return <fieldset className="resolution-builder" disabled={disabled}>
    <legend>Resolution PDF Source</legend>
    <div className="resolution-builder__modes"><label><input type="radio" disabled={modeLocked} name={`pdf-mode-${value.id || "new"}`} checked={mode === "standard"} onChange={() => setMode("standard")} /> Standard Resolution Format</label><label><input type="radio" disabled={modeLocked} name={`pdf-mode-${value.id || "new"}`} checked={mode === "custom"} onChange={() => setMode("custom")} /> Custom Section Layout</label><label><input type="radio" disabled={modeLocked} name={`pdf-mode-${value.id || "new"}`} checked={mode === "uploadedPdf"} onChange={() => setMode("uploadedPdf")} /> Upload Ready-Made PDF</label></div>
    {mode === "custom" ? <div className="resolution-builder__custom">
      <div className="admin-actions resolution-builder__add">{RESOLUTION_SECTION_TYPES.map((type) => <button type="button" key={type} disabled={sections.length >= 100} onClick={() => setSections(addResolutionSection(sections, type))}>Add {TYPE_LABELS[type]}</button>)}<button type="button" onClick={() => setSections(createDefaultResolutionSections())}>Use starter template</button><button type="button" onClick={() => setSections([])}>Start empty</button></div>
      <p className="admin-help">{sections.length}/100 sections. Votes Table rows are resolved from authoritative voting data when the PDF is generated.</p>
      <div className="resolution-builder__sections">{sections.map((section, index) => <SectionEditor key={section.id} section={section} index={index} total={sections.length} onUpdate={(changes) => setSections(updateResolutionSection(sections, section.id, changes))} onDelete={() => setSections(deleteResolutionSection(sections, section.id))} onDuplicate={() => setSections(duplicateResolutionSection(sections, section.id))} onMove={(direction) => setSections(moveResolutionSection(sections, section.id, direction))} />)}</div>
      {!sections.length ? <p className="admin-empty">This custom layout is empty. Add a section or use the starter template.</p> : null}
      <section className="resolution-builder__preview" aria-label="Ordered PDF section preview"><h4>Preview summary</h4><ol>{sections.map((section) => <li key={section.id}><strong>{TYPE_LABELS[section.type]}</strong><span>{describeResolutionSection(section)}</span></li>)}</ol>{onPreview ? <button type="button" onClick={onPreview}>Download Preview PDF</button> : null}</section>
    </div> : mode === "uploadedPdf" ? <ResolutionPdfUploadPanel value={value} onChange={onChange} disabled={disabled} onNotice={onNotice} onPersisted={onPersisted} onEnsurePersisted={onEnsurePersisted} /> : <p className="admin-help">Uses the existing standard Resolution PDF layout.</p>}
    <section className="resolution-builder__generated">
      <label className="resolution-append-toggle"><input type="checkbox" checked={resolutionPageConfig.enabled} onChange={(event) => toggleResolutionPage(event.target.checked)} /> Add Resolution Page</label>
      <p className="admin-help">Generate an editable official resolution page on the RCPH letterhead and include it in the final PDF.</p>
      {resolutionPageConfig.enabled && value.appendVoteTable !== false ? <fieldset className="resolution-builder__generated-order">
        <legend>Generated page order</legend>
        <label><input type="radio" name={`generated-page-order-${value.id || "new"}`} checked={generatedOrderValue === "resolution_page_first"} onChange={() => setGeneratedPageOrder(["resolution_page", "vote_table"])} /> Resolution Page -&gt; Voting Table</label>
        <label><input type="radio" name={`generated-page-order-${value.id || "new"}`} checked={generatedOrderValue === "vote_table_first"} onChange={() => setGeneratedPageOrder(["vote_table", "resolution_page"])} /> Voting Table -&gt; Resolution Page</label>
      </fieldset> : null}
      <section className="resolution-builder__generated-preview" aria-label="Generated page preview">
        <div>
          <h4>Generated Page Preview</h4>
          <p className="admin-help">Generate a temporary PDF containing only the Resolution Page and Voting Table using the current editor values. Nothing will be saved or finalized.</p>
        </div>
        <div className="admin-form-grid resolution-builder__preview-controls">
          <label>Preview
            <select value={previewMode} onChange={setGeneratedPreviewMode}>
              <option value={GENERATED_PAGES_PREVIEW_MODES.ALL} disabled={!generatedPreviewAvailability.modes.all}>All enabled generated pages</option>
              <option value={GENERATED_PAGES_PREVIEW_MODES.RESOLUTION_PAGE} disabled={!generatedPreviewAvailability.modes.resolution_page}>Resolution Page only</option>
              <option value={GENERATED_PAGES_PREVIEW_MODES.VOTE_TABLE} disabled={!generatedPreviewAvailability.modes.vote_table}>Voting Table only</option>
            </select>
          </label>
          <div className="admin-actions resolution-builder__preview-actions">
            <button type="button" disabled={generatedPreviewDisabled} onClick={() => runGeneratedPagesPreview("open")}>{generatedPreview.action === "open" ? "Generating preview..." : "Open Preview"}</button>
            <button type="button" disabled={generatedPreviewDisabled} onClick={() => runGeneratedPagesPreview("download")}>{generatedPreview.action === "download" ? "Generating preview..." : "Download Preview"}</button>
          </div>
        </div>
        {generatedPreviewMessage ? <p className="resolution-builder__preview-status" role="status">{generatedPreviewMessage}</p> : null}
        {generatedPreview.error ? <p className="resolution-builder__preview-error" role="alert">{generatedPreview.error}</p> : null}
      </section>
      {resolutionPageConfig.enabled ? <ResolutionPageEditor resolution={value} config={resolutionPageConfig} onChange={setResolutionPageConfig} /> : null}
    </section>
  </fieldset>;
}
