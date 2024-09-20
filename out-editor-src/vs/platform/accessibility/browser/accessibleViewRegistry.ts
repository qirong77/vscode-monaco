/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from '../../../base/common/lifecycle.js';

export interface IAccessibleViewImplentation {
}

export const AccessibleViewRegistry = new class AccessibleViewRegistry {
	_implementations: IAccessibleViewImplentation[] = [];

	register(implementation: IAccessibleViewImplentation): IDisposable {
		this._implementations.push(implementation);
		return {
			dispose: () => {
				const idx = this._implementations.indexOf(implementation);
				if (idx !== -1) {
					this._implementations.splice(idx, 1);
				}
			}
		};
	}

	getImplementations(): IAccessibleViewImplentation[] {
		return this._implementations;
	}
};

