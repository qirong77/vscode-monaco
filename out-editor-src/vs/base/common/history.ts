
import { ArrayNavigator, INavigator } from './navigator.js';

export class HistoryNavigator<T> implements INavigator<T> {

	private _history!: Set<T>;
	private _limit: number;
	private _navigator!: ArrayNavigator<T>;

	constructor(history: readonly T[] = [], limit: number = 10) {
		this._initialize(history);
		this._limit = limit;
		this._onChange();
	}

	public getHistory(): T[] {
		return this._elements;
	}

	public add(t: T) {
		this._history.delete(t);
		this._history.add(t);
		this._onChange();
	}

	public next(): T | null {
		// This will navigate past the end of the last element, and in that case the input should be cleared
		return this._navigator.next();
	}

	public previous(): T | null {
		if (this._currentPosition() !== 0) {
			return this._navigator.previous();
		}
		return null;
	}

	public current(): T | null {
		return this._navigator.current();
	}

	public first(): T | null {
		return this._navigator.first();
	}

	public last(): T | null {
		return this._navigator.last();
	}

	public isLast(): boolean {
		return this._currentPosition() >= this._elements.length - 1;
	}

	public isNowhere(): boolean {
		return this._navigator.current() === null;
	}

	public has(t: T): boolean {
		return this._history.has(t);
	}

	private _onChange() {
		this._reduceToLimit();
		const elements = this._elements;
		this._navigator = new ArrayNavigator(elements, 0, elements.length, elements.length);
	}

	private _reduceToLimit() {
		const data = this._elements;
		if (data.length > this._limit) {
			this._initialize(data.slice(data.length - this._limit));
		}
	}

	private _currentPosition(): number {
		const currentElement = this._navigator.current();
		if (!currentElement) {
			return -1;
		}

		return this._elements.indexOf(currentElement);
	}

	private _initialize(history: readonly T[]): void {
		this._history = new Set();
		for (const entry of history) {
			this._history.add(entry);
		}
	}

	private get _elements(): T[] {
		const elements: T[] = [];
		this._history.forEach(e => elements.push(e));
		return elements;
	}
}
