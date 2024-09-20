/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CodeWindow, mainWindow } from './window.js';

class WindowManager {

	static readonly INSTANCE = new WindowManager();

	// --- Zoom Factor

	private readonly mapWindowIdToZoomFactor = new Map<number, number>();

	getZoomFactor(targetWindow: Window): number {
		return this.mapWindowIdToZoomFactor.get(this.getWindowId(targetWindow)) ?? 1;
	}

	private getWindowId(targetWindow: Window): number {
		return (targetWindow as CodeWindow).vscodeWindowId;
	}
}

export function addMatchMediaChangeListener(targetWindow: Window, query: string | MediaQueryList, callback: (this: MediaQueryList, ev: MediaQueryListEvent) => unknown): void {
	if (typeof query === 'string') {
		query = targetWindow.matchMedia(query);
	}
	query.addEventListener('change', callback);
}

/** The zoom scale for an index, e.g. 1, 1.2, 1.4 */
export function getZoomFactor(targetWindow: Window): number {
	return WindowManager.INSTANCE.getZoomFactor(targetWindow);
}

const userAgent = navigator.userAgent;

export const isFirefox = (userAgent.indexOf('Firefox') >= 0);
export const isWebKit = (userAgent.indexOf('AppleWebKit') >= 0);
export const isChrome = (userAgent.indexOf('Chrome') >= 0);
export const isSafari = (!isChrome && (userAgent.indexOf('Safari') >= 0));
export const isWebkitWebView = (!isChrome && !isSafari && isWebKit);
export const isElectron = (userAgent.indexOf('Electron/') >= 0);
export const isAndroid = (userAgent.indexOf('Android') >= 0);

let standalone = false;
if (typeof mainWindow.matchMedia === 'function') {
	const standaloneMatchMedia = mainWindow.matchMedia('(display-mode: standalone) or (display-mode: window-controls-overlay)');
	const fullScreenMatchMedia = mainWindow.matchMedia('(display-mode: fullscreen)');
	standalone = standaloneMatchMedia.matches;
	addMatchMediaChangeListener(mainWindow, standaloneMatchMedia, ({ matches }) => {
		// entering fullscreen would change standaloneMatchMedia.matches to false
		// if standalone is true (running as PWA) and entering fullscreen, skip this change
		if (standalone && fullScreenMatchMedia.matches) {
			return;
		}
		// otherwise update standalone (browser to PWA or PWA to browser)
		standalone = matches;
	});
}
export function isStandalone(): boolean {
	return standalone;
}
