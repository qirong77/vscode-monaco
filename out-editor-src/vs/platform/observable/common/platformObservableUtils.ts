/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from '../../../base/common/lifecycle.js';
import { autorunOpts, IReader } from '../../../base/common/observable.js';
import { ContextKeyValue, IContextKeyService, RawContextKey } from '../../contextkey/common/contextkey.js';

/** Update the configuration key with a value derived from observables. */
export function bindContextKey<T extends ContextKeyValue>(key: RawContextKey<T>, service: IContextKeyService, computeValue: (reader: IReader) => T): IDisposable {
	const boundKey = key.bindTo(service);
	return autorunOpts({ debugName: () => `Set Context Key "${key.key}"` }, reader => {
		boundKey.set(computeValue(reader));
	});
}

