/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { range } from '../../../common/arrays.js';
import { CancellationTokenSource } from '../../../common/cancellation.js';
import { Event } from '../../../common/event.js';
import { Disposable, IDisposable } from '../../../common/lifecycle.js';
import { IPagedModel } from '../../../common/paging.js';
import './list.css';
import { IListEvent, IListMouseEvent, IListRenderer, IListVirtualDelegate } from './list.js';
import { IListAccessibilityProvider, IListOptions, IListOptionsUpdate, IListStyles, List } from './listWidget.js';

export interface IPagedRenderer<TElement, TTemplateData> extends IListRenderer<TElement, TTemplateData> {
	renderPlaceholder(index: number, templateData: TTemplateData): void;
}

export interface ITemplateData<T> {
	data?: T;
	disposable?: IDisposable;
}

class PagedRenderer<TElement, TTemplateData> implements IListRenderer<number, ITemplateData<TTemplateData>> {

	get templateId(): string { return this.renderer.templateId; }

	constructor(
		private renderer: IPagedRenderer<TElement, TTemplateData>,
		private modelProvider: () => IPagedModel<TElement>
	) { }

	renderTemplate(container: HTMLElement): ITemplateData<TTemplateData> {
		const data = this.renderer.renderTemplate(container);
		return { data, disposable: Disposable.None };
	}

	renderElement(index: number, _: number, data: ITemplateData<TTemplateData>, height: number | undefined): void {
		data.disposable?.dispose();

		if (!data.data) {
			return;
		}

		const model = this.modelProvider();

		if (model.isResolved(index)) {
			return this.renderer.renderElement(model.get(index), index, data.data, height);
		}

		const cts = new CancellationTokenSource();
		const promise = model.resolve(index, cts.token);
		data.disposable = { dispose: () => cts.cancel() };

		this.renderer.renderPlaceholder(index, data.data);
		promise.then(entry => this.renderer.renderElement(entry, index, data.data!, height));
	}

	disposeTemplate(data: ITemplateData<TTemplateData>): void {
		if (data.disposable) {
			data.disposable.dispose();
			data.disposable = undefined;
		}
		if (data.data) {
			this.renderer.disposeTemplate(data.data);
			data.data = undefined;
		}
	}
}

class PagedAccessibilityProvider<T> implements IListAccessibilityProvider<number> {

	constructor(
		private modelProvider: () => IPagedModel<T>,
		private accessibilityProvider: IListAccessibilityProvider<T>
	) { }

	getWidgetAriaLabel(): string {
		return this.accessibilityProvider.getWidgetAriaLabel();
	}

	getAriaLabel(index: number) {
		const model = this.modelProvider();

		if (!model.isResolved(index)) {
			return null;
		}

		return this.accessibilityProvider.getAriaLabel(model.get(index));
	}
}

export interface IPagedListOptions<T> {
	readonly keyboardSupport?: boolean;
	readonly accessibilityProvider?: IListAccessibilityProvider<T>;
	readonly horizontalScrolling?: boolean;
}

function fromPagedListOptions<T>(modelProvider: () => IPagedModel<T>, options: IPagedListOptions<T>): IListOptions<number> {
	return {
		...options,
		accessibilityProvider: options.accessibilityProvider && new PagedAccessibilityProvider(modelProvider, options.accessibilityProvider)
	};
}

export class PagedList<T> implements IDisposable {

	private list: List<number>;
	private _model!: IPagedModel<T>;

	constructor(
		user: string,
		container: HTMLElement,
		virtualDelegate: IListVirtualDelegate<number>,
		renderers: IPagedRenderer<T, any>[],
		options: IPagedListOptions<T> = {}
	) {
		const modelProvider = () => this.model;
		const pagedRenderers = renderers.map(r => new PagedRenderer<T, ITemplateData<T>>(r, modelProvider));
		this.list = new List(user, container, virtualDelegate, pagedRenderers, fromPagedListOptions(modelProvider, options));
	}

	updateOptions(options: IListOptionsUpdate) {
		this.list.updateOptions(options);
	}

	getHTMLElement(): HTMLElement {
		return this.list.getHTMLElement();
	}

	get onDidFocus(): Event<void> {
		return this.list.onDidFocus;
	}

	get widget(): List<number> {
		return this.list;
	}

	get onDidDispose(): Event<void> {
		return this.list.onDidDispose;
	}

	get onMouseDblClick(): Event<IListMouseEvent<T>> {
		return Event.map(this.list.onMouseDblClick, ({ element, index, browserEvent }) => ({ element: element === undefined ? undefined : this._model.get(element), index, browserEvent }));
	}

	get onPointer(): Event<IListMouseEvent<T>> {
		return Event.map(this.list.onPointer, ({ element, index, browserEvent }) => ({ element: element === undefined ? undefined : this._model.get(element), index, browserEvent }));
	}

	get onDidChangeSelection(): Event<IListEvent<T>> {
		return Event.map(this.list.onDidChangeSelection, ({ elements, indexes, browserEvent }) => ({ elements: elements.map(e => this._model.get(e)), indexes, browserEvent }));
	}

	get model(): IPagedModel<T> {
		return this._model;
	}

	set model(model: IPagedModel<T>) {
		this._model = model;
		this.list.splice(0, this.list.length, range(model.length));
	}

	getFocus(): number[] {
		return this.list.getFocus();
	}

	getSelection(): number[] {
		return this.list.getSelection();
	}

	getSelectedElements(): T[] {
		return this.getSelection().map(i => this.model.get(i));
	}

	style(styles: IListStyles): void {
		this.list.style(styles);
	}

	dispose(): void {
		this.list.dispose();
	}
}
