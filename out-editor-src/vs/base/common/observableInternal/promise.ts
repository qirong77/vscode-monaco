/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IObservable, observableValue, transaction } from './base.js';

/**
 * A promise whose state is observable.
 */
export class ObservablePromise<T> {
	public static fromFn<T>(fn: () => Promise<T>): ObservablePromise<T> {
		return new ObservablePromise(fn());
	}

	private readonly _value = observableValue<PromiseResult<T> | undefined>(this, undefined);

	/**
	 * The promise that this object wraps.
	 */
	public readonly promise: Promise<T>;

	/**
	 * The current state of the promise.
	 * Is `undefined` if the promise didn't resolve yet.
	 */
	public readonly promiseResult: IObservable<PromiseResult<T> | undefined> = this._value;

	constructor(promise: Promise<T>) {
		this.promise = promise.then(value => {
			transaction(tx => {
				/** @description onPromiseResolved */
				this._value.set(new PromiseResult(value, undefined), tx);
			});
			return value;
		}, error => {
			transaction(tx => {
				/** @description onPromiseRejected */
				this._value.set(new PromiseResult<T>(undefined, error), tx);
			});
			throw error;
		});
	}
}

export class PromiseResult<T> {
	constructor(
		/**
		 * The value of the resolved promise.
		 * Undefined if the promise rejected.
		 */
		public readonly data: T | undefined,

		/**
		 * The error in case of a rejected promise.
		 * Undefined if the promise resolved.
		 */
		public readonly error: unknown | undefined,
	) {
	}
}
