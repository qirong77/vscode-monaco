/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { hasDriveLetter } from './extpath.js';
import { isWindows } from './platform.js';

export function normalizeDriveLetter(path: string, isWindowsOS: boolean = isWindows): string {
	if (hasDriveLetter(path, isWindowsOS)) {
		return path.charAt(0).toUpperCase() + path.slice(1);
	}

	return path;
}

let normalizedUserHomeCached: { original: string; normalized: string } = Object.create(null);
