/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode, createStyleSheet } from '../../dom.js';
import { getBaseLayerHoverDelegate } from '../hover/hoverDelegate2.js';
import { getDefaultHoverDelegate } from '../hover/hoverDelegateFactory.js';
import { IListRenderer, IListVirtualDelegate } from '../list/list.js';
import { IListOptions, IListOptionsUpdate, IListStyles, List, unthemedListStyles } from '../list/listWidget.js';
import { ISplitViewDescriptor, IView, Orientation, SplitView } from '../splitview/splitview.js';
import { ITableColumn, ITableEvent, ITableMouseEvent, ITableRenderer, ITableVirtualDelegate } from './table.js';
import { Emitter, Event } from '../../../common/event.js';
import { Disposable, DisposableStore, IDisposable } from '../../../common/lifecycle.js';
import { ScrollbarVisibility, ScrollEvent } from '../../../common/scrollable.js';
import { ISpliceable } from '../../../common/sequence.js';
import './table.css';

// TODO@joao
type TCell = any;

interface RowTemplateData {
	readonly container: HTMLElement;
	readonly cellContainers: HTMLElement[];
	readonly cellTemplateData: unknown[];
}

class TableListRenderer<TRow> implements IListRenderer<TRow, RowTemplateData> {

	static TemplateId = 'row';
	readonly templateId = TableListRenderer.TemplateId;
	private renderers: ITableRenderer<TCell, unknown>[];
	private renderedTemplates = new Set<RowTemplateData>();

	constructor(
		private columns: ITableColumn<TRow, TCell>[],
		renderers: ITableRenderer<TCell, unknown>[],
		private getColumnSize: (index: number) => number
	) {
		const rendererMap = new Map(renderers.map(r => [r.templateId, r]));
		this.renderers = [];

		for (const column of columns) {
			const renderer = rendererMap.get(column.templateId);

			if (!renderer) {
				throw new Error(`Table cell renderer for template id ${column.templateId} not found.`);
			}

			this.renderers.push(renderer);
		}
	}

	renderTemplate(container: HTMLElement) {
		const rowContainer = append(container, $('.monaco-table-tr'));
		const cellContainers: HTMLElement[] = [];
		const cellTemplateData: unknown[] = [];

		for (let i = 0; i < this.columns.length; i++) {
			const renderer = this.renderers[i];
			const cellContainer = append(rowContainer, $('.monaco-table-td', { 'data-col-index': i }));

			cellContainer.style.width = `${this.getColumnSize(i)}px`;
			cellContainers.push(cellContainer);
			cellTemplateData.push(renderer.renderTemplate(cellContainer));
		}

		const result = { container, cellContainers, cellTemplateData };
		this.renderedTemplates.add(result);

		return result;
	}

	renderElement(element: TRow, index: number, templateData: RowTemplateData, height: number | undefined): void {
		for (let i = 0; i < this.columns.length; i++) {
			const column = this.columns[i];
			const cell = column.project(element);
			const renderer = this.renderers[i];
			renderer.renderElement(cell, index, templateData.cellTemplateData[i], height);
		}
	}

	disposeElement(element: TRow, index: number, templateData: RowTemplateData, height: number | undefined): void {
		for (let i = 0; i < this.columns.length; i++) {
			const renderer = this.renderers[i];

			if (renderer.disposeElement) {
				const column = this.columns[i];
				const cell = column.project(element);

				renderer.disposeElement(cell, index, templateData.cellTemplateData[i], height);
			}
		}
	}

	disposeTemplate(templateData: RowTemplateData): void {
		for (let i = 0; i < this.columns.length; i++) {
			const renderer = this.renderers[i];
			renderer.disposeTemplate(templateData.cellTemplateData[i]);
		}

		clearNode(templateData.container);
		this.renderedTemplates.delete(templateData);
	}

	layoutColumn(index: number, size: number): void {
		for (const { cellContainers } of this.renderedTemplates) {
			cellContainers[index].style.width = `${size}px`;
		}
	}
}

function asListVirtualDelegate<TRow>(delegate: ITableVirtualDelegate<TRow>): IListVirtualDelegate<TRow> {
	return {
		getHeight(row) { return delegate.getHeight(row); },
		getTemplateId() { return TableListRenderer.TemplateId; },
	};
}

class ColumnHeader<TRow, TCell> extends Disposable implements IView {

	readonly element: HTMLElement;

	get minimumSize() { return this.column.minimumWidth ?? 120; }
	get maximumSize() { return this.column.maximumWidth ?? Number.POSITIVE_INFINITY; }
	get onDidChange() { return this.column.onDidChangeWidthConstraints ?? Event.None; }

	private _onDidLayout = new Emitter<[number, number]>();
	readonly onDidLayout = this._onDidLayout.event;

	constructor(readonly column: ITableColumn<TRow, TCell>, private index: number) {
		super();

		this.element = $('.monaco-table-th', { 'data-col-index': index }, column.label);

		if (column.tooltip) {
			this._register(getBaseLayerHoverDelegate().setupManagedHover(getDefaultHoverDelegate('mouse'), this.element, column.tooltip));
		}
	}

	layout(size: number): void {
		this._onDidLayout.fire([this.index, size]);
	}
}

export interface ITableOptions<TRow> extends IListOptions<TRow> { }
export interface ITableOptionsUpdate extends IListOptionsUpdate { }
export interface ITableStyles extends IListStyles { }

export class Table<TRow> implements ISpliceable<TRow>, IDisposable {

	private static InstanceCount = 0;
	readonly domId = `table_id_${++Table.InstanceCount}`;

	readonly domNode: HTMLElement;
	private splitview: SplitView;
	private list: List<TRow>;
	private styleElement: HTMLStyleElement;
	protected readonly disposables = new DisposableStore();

	private cachedWidth: number = 0;
	private cachedHeight: number = 0;

	get onDidChangeFocus(): Event<ITableEvent<TRow>> { return this.list.onDidChangeFocus; }
	get onDidChangeSelection(): Event<ITableEvent<TRow>> { return this.list.onDidChangeSelection; }

	get onDidScroll(): Event<ScrollEvent> { return this.list.onDidScroll; }
	get onMouseDblClick(): Event<ITableMouseEvent<TRow>> { return this.list.onMouseDblClick; }
	get onPointer(): Event<ITableMouseEvent<TRow>> { return this.list.onPointer; }

	get onDidFocus(): Event<void> { return this.list.onDidFocus; }

	get scrollTop(): number { return this.list.scrollTop; }
	set scrollTop(scrollTop: number) { this.list.scrollTop = scrollTop; }
	get scrollHeight(): number { return this.list.scrollHeight; }
	get renderHeight(): number { return this.list.renderHeight; }
	get onDidDispose(): Event<void> { return this.list.onDidDispose; }

	constructor(
		user: string,
		container: HTMLElement,
		private virtualDelegate: ITableVirtualDelegate<TRow>,
		private columns: ITableColumn<TRow, TCell>[],
		renderers: ITableRenderer<TCell, unknown>[],
		_options?: ITableOptions<TRow>
	) {
		this.domNode = append(container, $(`.monaco-table.${this.domId}`));

		const headers = columns.map((c, i) => this.disposables.add(new ColumnHeader(c, i)));
		const descriptor: ISplitViewDescriptor = {
			size: headers.reduce((a, b) => a + b.column.weight, 0),
			views: headers.map(view => ({ size: view.column.weight, view }))
		};

		this.splitview = this.disposables.add(new SplitView(this.domNode, {
			orientation: Orientation.HORIZONTAL,
			scrollbarVisibility: ScrollbarVisibility.Hidden,
			getSashOrthogonalSize: () => this.cachedHeight,
			descriptor
		}));

		this.splitview.el.style.height = `${virtualDelegate.headerRowHeight}px`;
		this.splitview.el.style.lineHeight = `${virtualDelegate.headerRowHeight}px`;

		const renderer = new TableListRenderer(columns, renderers, i => this.splitview.getViewSize(i));
		this.list = this.disposables.add(new List(user, this.domNode, asListVirtualDelegate(virtualDelegate), [renderer], _options));

		Event.any(...headers.map(h => h.onDidLayout))
			(([index, size]) => renderer.layoutColumn(index, size), null, this.disposables);

		this.splitview.onDidSashReset(index => {
			const totalWeight = columns.reduce((r, c) => r + c.weight, 0);
			const size = columns[index].weight / totalWeight * this.cachedWidth;
			this.splitview.resizeView(index, size);
		}, null, this.disposables);

		this.styleElement = createStyleSheet(this.domNode);
		this.style(unthemedListStyles);
	}

	updateOptions(options: ITableOptionsUpdate): void {
		this.list.updateOptions(options);
	}

	splice(start: number, deleteCount: number, elements: readonly TRow[] = []): void {
		this.list.splice(start, deleteCount, elements);
	}

	getHTMLElement(): HTMLElement {
		return this.domNode;
	}

	style(styles: ITableStyles): void {
		const content: string[] = [];

		content.push(`.monaco-table.${this.domId} > .monaco-split-view2 .monaco-sash.vertical::before {
			top: ${this.virtualDelegate.headerRowHeight + 1}px;
			height: calc(100% - ${this.virtualDelegate.headerRowHeight}px);
		}`);

		this.styleElement.textContent = content.join('\n');
		this.list.style(styles);
	}

	getSelectedElements(): TRow[] {
		return this.list.getSelectedElements();
	}

	getSelection(): number[] {
		return this.list.getSelection();
	}

	getFocus(): number[] {
		return this.list.getFocus();
	}

	dispose(): void {
		this.disposables.dispose();
	}
}
