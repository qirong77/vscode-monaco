/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getActiveWindow } from '../../../base/browser/dom.js';
import { Disposable, toDisposable } from '../../../base/common/lifecycle.js';

/**
 * Copyright (c) 2022 The xterm.js authors. All rights reserved.
 * @license MIT
 */

interface ITaskQueue {
}

interface ITaskDeadline {
	timeRemaining(): number;
}
type CallbackWithDeadline = (deadline: ITaskDeadline) => void;

abstract class TaskQueue extends Disposable implements ITaskQueue {
	private _tasks: (() => boolean | void)[] = [];
	private _idleCallback?: number;
	private _i = 0;

	constructor() {
		super();
		this._register(toDisposable(() => this.clear()));
	}

	protected abstract _requestCallback(callback: CallbackWithDeadline): number;
	protected abstract _cancelCallback(identifier: number): void;

	public enqueue(task: () => boolean | void): void {
		this._tasks.push(task);
		this._start();
	}

	public clear(): void {
		if (this._idleCallback) {
			this._cancelCallback(this._idleCallback);
			this._idleCallback = undefined;
		}
		this._i = 0;
		this._tasks.length = 0;
	}

	private _start(): void {
		if (!this._idleCallback) {
			this._idleCallback = this._requestCallback(this._process.bind(this));
		}
	}

	private _process(deadline: ITaskDeadline): void {
		this._idleCallback = undefined;
		let taskDuration = 0;
		let longestTask = 0;
		let lastDeadlineRemaining = deadline.timeRemaining();
		let deadlineRemaining = 0;
		while (this._i < this._tasks.length) {
			taskDuration = Date.now();
			if (!this._tasks[this._i]()) {
				this._i++;
			}
			// other than performance.now, Date.now might not be stable (changes on wall clock changes),
			// this is not an issue here as a clock change during a short running task is very unlikely
			// in case it still happened and leads to negative duration, simply assume 1 msec
			taskDuration = Math.max(1, Date.now() - taskDuration);
			longestTask = Math.max(taskDuration, longestTask);
			// Guess the following task will take a similar time to the longest task in this batch, allow
			// additional room to try avoid exceeding the deadline
			deadlineRemaining = deadline.timeRemaining();
			if (longestTask * 1.5 > deadlineRemaining) {
				// Warn when the time exceeding the deadline is over 20ms, if this happens in practice the
				// task should be split into sub-tasks to ensure the UI remains responsive.
				if (lastDeadlineRemaining - taskDuration < -20) {
					console.warn(`task queue exceeded allotted deadline by ${Math.abs(Math.round(lastDeadlineRemaining - taskDuration))}ms`);
				}
				this._start();
				return;
			}
			lastDeadlineRemaining = deadlineRemaining;
		}
		this.clear();
	}
}

/**
 * A queue of that runs tasks over several idle callbacks, trying to respect the idle callback's
 * deadline given by the environment. The tasks will run in the order they are enqueued, but they
 * will run some time later, and care should be taken to ensure they're non-urgent and will not
 * introduce race conditions.
 */
export class IdleTaskQueue extends TaskQueue {
	protected _requestCallback(callback: IdleRequestCallback): number {
		return getActiveWindow().requestIdleCallback(callback);
	}

	protected _cancelCallback(identifier: number): void {
		getActiveWindow().cancelIdleCallback(identifier);
	}
}
