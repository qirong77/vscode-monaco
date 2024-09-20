/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../instantiation/common/instantiation.js';
import { ClassifiedEvent, IGDPRProperty, OmitMetadata, StrictPropertyCheck } from './gdprTypings.js';

export const ITelemetryService = createDecorator<ITelemetryService>('telemetryService');

export interface ITelemetryService {

	readonly _serviceBrand: undefined;

	/**
	 * Sends a telemetry event that has been privacy approved.
	 * Do not call this unless you have been given approval.
	 */
	publicLog2<E extends ClassifiedEvent<OmitMetadata<T>> = never, T extends IGDPRProperty = never>(eventName: string, data?: StrictPropertyCheck<T, E>): void;
}
