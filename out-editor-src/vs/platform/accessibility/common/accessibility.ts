/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { RawContextKey } from '../../contextkey/common/contextkey.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export const IAccessibilityService = createDecorator<IAccessibilityService>('accessibilityService');

export interface IAccessibilityService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeScreenReaderOptimized: Event<void>;
	isScreenReaderOptimized(): boolean;
	isMotionReduced(): boolean;
	getAccessibilitySupport(): AccessibilitySupport;
}

export const enum AccessibilitySupport {
	/**
	 * This should be the browser case where it is not known if a screen reader is attached or no.
	 */
	Unknown = 0,

	Disabled = 1,

	Enabled = 2
}

export const CONTEXT_ACCESSIBILITY_MODE_ENABLED = new RawContextKey<boolean>('accessibilityModeEnabled', false);
