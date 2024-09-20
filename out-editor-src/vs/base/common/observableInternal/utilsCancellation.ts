/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IObservable } from './base.js';
import { CancellationError, CancellationToken } from './commonFacade/cancellation.js';
import { autorun } from './autorun.js';

/**
 * Resolves the promise when the observables state matches the predicate.
 */
export function waitForState<T>(observable: IObservable<T | null | undefined>): Promise<T>;
export function waitForState<T, TState extends T>(observable: IObservable<T>, predicate: (state: T) => state is TState, isError?: (state: T) => boolean | unknown | undefined, cancellationToken?: CancellationToken): Promise<TState>;
export function waitForState<T>(observable: IObservable<T>, predicate: (state: T) => boolean, isError?: (state: T) => boolean | unknown | undefined, cancellationToken?: CancellationToken): Promise<T>;
export function waitForState<T>(observable: IObservable<T>, predicate?: (state: T) => boolean, isError?: (state: T) => boolean | unknown | undefined, cancellationToken?: CancellationToken): Promise<T> {
	if (!predicate) {
		predicate = state => state !== null && state !== undefined;
	}
	return new Promise((resolve, reject) => {
		let isImmediateRun = true;
		let shouldDispose = false;
		const stateObs = observable.map(state => {
			/** @description waitForState.state */
			return {
				isFinished: predicate(state),
				error: isError ? isError(state) : false,
				state
			};
		});
		const d = autorun(reader => {
			/** @description waitForState */
			const { isFinished, error, state } = stateObs.read(reader);
			if (isFinished || error) {
				if (isImmediateRun) {
					// The variable `d` is not initialized yet
					shouldDispose = true;
				} else {
					d.dispose();
				}
				if (error) {
					reject(error === true ? state : error);
				} else {
					resolve(state);
				}
			}
		});
		if (cancellationToken) {
			const dc = cancellationToken.onCancellationRequested(() => {
				d.dispose();
				dc.dispose();
				reject(new CancellationError());
			});
			if (cancellationToken.isCancellationRequested) {
				d.dispose();
				dc.dispose();
				reject(new CancellationError());
				return;
			}
		}
		isImmediateRun = false;
		if (shouldDispose) {
			d.dispose();
		}
	});
}
