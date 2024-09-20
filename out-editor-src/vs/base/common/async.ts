/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken, CancellationTokenSource } from './cancellation.js';
import { BugIndicatingError, CancellationError } from './errors.js';
import { Emitter, Event } from './event.js';
import { DisposableStore, IDisposable, toDisposable } from './lifecycle.js';
import { setTimeout0 } from './platform.js';
import { MicrotaskDelay } from './symbols.js';

export function isThenable<T>(obj: unknown): obj is Promise<T> {
	return !!obj && typeof (obj as unknown as Promise<T>).then === 'function';
}

export interface CancelablePromise<T> extends Promise<T> {
	cancel(): void;
}

export function createCancelablePromise<T>(callback: (token: CancellationToken) => Promise<T>): CancelablePromise<T> {
	const source = new CancellationTokenSource();

	const thenable = callback(source.token);
	const promise = new Promise<T>((resolve, reject) => {
		const subscription = source.token.onCancellationRequested(() => {
			subscription.dispose();
			reject(new CancellationError());
		});
		Promise.resolve(thenable).then(value => {
			subscription.dispose();
			source.dispose();
			resolve(value);
		}, err => {
			subscription.dispose();
			source.dispose();
			reject(err);
		});
	});

	return <CancelablePromise<T>>new class {
		cancel() {
			source.cancel();
			source.dispose();
		}
		then<TResult1 = T, TResult2 = never>(resolve?: ((value: T) => TResult1 | Promise<TResult1>) | undefined | null, reject?: ((reason: any) => TResult2 | Promise<TResult2>) | undefined | null): Promise<TResult1 | TResult2> {
			return promise.then(resolve, reject);
		}
		catch<TResult = never>(reject?: ((reason: any) => TResult | Promise<TResult>) | undefined | null): Promise<T | TResult> {
			return this.then(undefined, reject);
		}
		finally(onfinally?: (() => void) | undefined | null): Promise<T> {
			return promise.finally(onfinally);
		}
	};
}

/**
 * Returns a promise that resolves with `undefined` as soon as the passed token is cancelled.
 * @see {@link raceCancellationError}
 */
export function raceCancellation<T>(promise: Promise<T>, token: CancellationToken): Promise<T | undefined>;

/**
 * Returns a promise that resolves with `defaultValue` as soon as the passed token is cancelled.
 * @see {@link raceCancellationError}
 */
export function raceCancellation<T>(promise: Promise<T>, token: CancellationToken, defaultValue: T): Promise<T>;

export function raceCancellation<T>(promise: Promise<T>, token: CancellationToken, defaultValue?: T): Promise<T | undefined> {
	return new Promise((resolve, reject) => {
		const ref = token.onCancellationRequested(() => {
			ref.dispose();
			resolve(defaultValue);
		});
		promise.then(resolve, reject).finally(() => ref.dispose());
	});
}

export interface ITask<T> {
	(): T;
}

/**
 * A helper to prevent accumulation of sequential async tasks.
 *
 * Imagine a mail man with the sole task of delivering letters. As soon as
 * a letter submitted for delivery, he drives to the destination, delivers it
 * and returns to his base. Imagine that during the trip, N more letters were submitted.
 * When the mail man returns, he picks those N letters and delivers them all in a
 * single trip. Even though N+1 submissions occurred, only 2 deliveries were made.
 *
 * The throttler implements this via the queue() method, by providing it a task
 * factory. Following the example:
 *
 * 		const throttler = new Throttler();
 * 		const letters = [];
 *
 * 		function deliver() {
 * 			const lettersToDeliver = letters;
 * 			letters = [];
 * 			return makeTheTrip(lettersToDeliver);
 * 		}
 *
 * 		function onLetterReceived(l) {
 * 			letters.push(l);
 * 			throttler.queue(deliver);
 * 		}
 */
export class Throttler implements IDisposable {

	private activePromise: Promise<any> | null;
	private queuedPromise: Promise<any> | null;
	private queuedPromiseFactory: ITask<Promise<any>> | null;

	private isDisposed = false;

	constructor() {
		this.activePromise = null;
		this.queuedPromise = null;
		this.queuedPromiseFactory = null;
	}

	queue<T>(promiseFactory: ITask<Promise<T>>): Promise<T> {
		if (this.isDisposed) {
			return Promise.reject(new Error('Throttler is disposed'));
		}

		if (this.activePromise) {
			this.queuedPromiseFactory = promiseFactory;

			if (!this.queuedPromise) {
				const onComplete = () => {
					this.queuedPromise = null;

					if (this.isDisposed) {
						return;
					}

					const result = this.queue(this.queuedPromiseFactory!);
					this.queuedPromiseFactory = null;

					return result;
				};

				this.queuedPromise = new Promise(resolve => {
					this.activePromise!.then(onComplete, onComplete).then(resolve);
				});
			}

			return new Promise((resolve, reject) => {
				this.queuedPromise!.then(resolve, reject);
			});
		}

		this.activePromise = promiseFactory();

		return new Promise((resolve, reject) => {
			this.activePromise!.then((result: T) => {
				this.activePromise = null;
				resolve(result);
			}, (err: unknown) => {
				this.activePromise = null;
				reject(err);
			});
		});
	}

	dispose(): void {
		this.isDisposed = true;
	}
}

interface IScheduledLater extends IDisposable {
	isTriggered(): boolean;
}

const timeoutDeferred = (timeout: number, fn: () => void): IScheduledLater => {
	let scheduled = true;
	const handle = setTimeout(() => {
		scheduled = false;
		fn();
	}, timeout);
	return {
		isTriggered: () => scheduled,
		dispose: () => {
			clearTimeout(handle);
			scheduled = false;
		},
	};
};

const microtaskDeferred = (fn: () => void): IScheduledLater => {
	let scheduled = true;
	queueMicrotask(() => {
		if (scheduled) {
			scheduled = false;
			fn();
		}
	});

	return {
		isTriggered: () => scheduled,
		dispose: () => { scheduled = false; },
	};
};

/**
 * A helper to delay (debounce) execution of a task that is being requested often.
 *
 * Following the throttler, now imagine the mail man wants to optimize the number of
 * trips proactively. The trip itself can be long, so he decides not to make the trip
 * as soon as a letter is submitted. Instead he waits a while, in case more
 * letters are submitted. After said waiting period, if no letters were submitted, he
 * decides to make the trip. Imagine that N more letters were submitted after the first
 * one, all within a short period of time between each other. Even though N+1
 * submissions occurred, only 1 delivery was made.
 *
 * The delayer offers this behavior via the trigger() method, into which both the task
 * to be executed and the waiting period (delay) must be passed in as arguments. Following
 * the example:
 *
 * 		const delayer = new Delayer(WAITING_PERIOD);
 * 		const letters = [];
 *
 * 		function letterReceived(l) {
 * 			letters.push(l);
 * 			delayer.trigger(() => { return makeTheTrip(); });
 * 		}
 */
export class Delayer<T> implements IDisposable {

	private deferred: IScheduledLater | null;
	private completionPromise: Promise<any> | null;
	private doResolve: ((value?: any | Promise<any>) => void) | null;
	private doReject: ((err: any) => void) | null;
	private task: ITask<T | Promise<T>> | null;

	constructor(public defaultDelay: number | typeof MicrotaskDelay) {
		this.deferred = null;
		this.completionPromise = null;
		this.doResolve = null;
		this.doReject = null;
		this.task = null;
	}

	trigger(task: ITask<T | Promise<T>>, delay = this.defaultDelay): Promise<T> {
		this.task = task;
		this.cancelTimeout();

		if (!this.completionPromise) {
			this.completionPromise = new Promise((resolve, reject) => {
				this.doResolve = resolve;
				this.doReject = reject;
			}).then(() => {
				this.completionPromise = null;
				this.doResolve = null;
				if (this.task) {
					const task = this.task;
					this.task = null;
					return task();
				}
				return undefined;
			});
		}

		const fn = () => {
			this.deferred = null;
			this.doResolve?.(null);
		};

		this.deferred = delay === MicrotaskDelay ? microtaskDeferred(fn) : timeoutDeferred(delay, fn);

		return this.completionPromise;
	}

	isTriggered(): boolean {
		return !!this.deferred?.isTriggered();
	}

	cancel(): void {
		this.cancelTimeout();

		if (this.completionPromise) {
			this.doReject?.(new CancellationError());
			this.completionPromise = null;
		}
	}

	private cancelTimeout(): void {
		this.deferred?.dispose();
		this.deferred = null;
	}

	dispose(): void {
		this.cancel();
	}
}

/**
 * A helper to delay execution of a task that is being requested often, while
 * preventing accumulation of consecutive executions, while the task runs.
 *
 * The mail man is clever and waits for a certain amount of time, before going
 * out to deliver letters. While the mail man is going out, more letters arrive
 * and can only be delivered once he is back. Once he is back the mail man will
 * do one more trip to deliver the letters that have accumulated while he was out.
 */
export class ThrottledDelayer<T> {

	private delayer: Delayer<Promise<T>>;
	private throttler: Throttler;

	constructor(defaultDelay: number) {
		this.delayer = new Delayer(defaultDelay);
		this.throttler = new Throttler();
	}

	trigger(promiseFactory: ITask<Promise<T>>, delay?: number): Promise<T> {
		return this.delayer.trigger(() => this.throttler.queue(promiseFactory), delay) as unknown as Promise<T>;
	}

	cancel(): void {
		this.delayer.cancel();
	}

	dispose(): void {
		this.delayer.dispose();
		this.throttler.dispose();
	}
}

export function timeout(millis: number): CancelablePromise<void>;
export function timeout(millis: number, token: CancellationToken): Promise<void>;
export function timeout(millis: number, token?: CancellationToken): CancelablePromise<void> | Promise<void> {
	if (!token) {
		return createCancelablePromise(token => timeout(millis, token));
	}

	return new Promise((resolve, reject) => {
		const handle = setTimeout(() => {
			disposable.dispose();
			resolve();
		}, millis);
		const disposable = token.onCancellationRequested(() => {
			clearTimeout(handle);
			disposable.dispose();
			reject(new CancellationError());
		});
	});
}

/**
 * Creates a timeout that can be disposed using its returned value.
 * @param handler The timeout handler.
 * @param timeout An optional timeout in milliseconds.
 * @param store An optional {@link DisposableStore} that will have the timeout disposable managed automatically.
 *
 * @example
 * const store = new DisposableStore;
 * // Call the timeout after 1000ms at which point it will be automatically
 * // evicted from the store.
 * const timeoutDisposable = disposableTimeout(() => {}, 1000, store);
 *
 * if (foo) {
 *   // Cancel the timeout and evict it from store.
 *   timeoutDisposable.dispose();
 * }
 */
export function disposableTimeout(handler: () => void, timeout = 0, store?: DisposableStore): IDisposable {
	const timer = setTimeout(() => {
		handler();
		if (store) {
			disposable.dispose();
		}
	}, timeout);
	const disposable = toDisposable(() => {
		clearTimeout(timer);
		store?.deleteAndLeak(disposable);
	});
	store?.add(disposable);
	return disposable;
}

export function first<T>(promiseFactories: ITask<Promise<T>>[], shouldStop: (t: T) => boolean = t => !!t, defaultValue: T | null = null): Promise<T | null> {
	let index = 0;
	const len = promiseFactories.length;

	const loop: () => Promise<T | null> = () => {
		if (index >= len) {
			return Promise.resolve(defaultValue);
		}

		const factory = promiseFactories[index++];
		const promise = Promise.resolve(factory());

		return promise.then(result => {
			if (shouldStop(result)) {
				return Promise.resolve(result);
			}

			return loop();
		});
	};

	return loop();
}

export class TimeoutTimer implements IDisposable {
	private _token: any;
	private _isDisposed = false;

	constructor();
	constructor(runner: () => void, timeout: number);
	constructor(runner?: () => void, timeout?: number) {
		this._token = -1;

		if (typeof runner === 'function' && typeof timeout === 'number') {
			this.setIfNotSet(runner, timeout);
		}
	}

	dispose(): void {
		this.cancel();
		this._isDisposed = true;
	}

	cancel(): void {
		if (this._token !== -1) {
			clearTimeout(this._token);
			this._token = -1;
		}
	}

	cancelAndSet(runner: () => void, timeout: number): void {
		if (this._isDisposed) {
			throw new BugIndicatingError(`Calling 'cancelAndSet' on a disposed TimeoutTimer`);
		}

		this.cancel();
		this._token = setTimeout(() => {
			this._token = -1;
			runner();
		}, timeout);
	}

	setIfNotSet(runner: () => void, timeout: number): void {
		if (this._isDisposed) {
			throw new BugIndicatingError(`Calling 'setIfNotSet' on a disposed TimeoutTimer`);
		}

		if (this._token !== -1) {
			// timer is already set
			return;
		}
		this._token = setTimeout(() => {
			this._token = -1;
			runner();
		}, timeout);
	}
}

export class IntervalTimer implements IDisposable {

	private disposable: IDisposable | undefined = undefined;
	private isDisposed = false;

	cancel(): void {
		this.disposable?.dispose();
		this.disposable = undefined;
	}

	cancelAndSet(runner: () => void, interval: number, context = globalThis): void {
		if (this.isDisposed) {
			throw new BugIndicatingError(`Calling 'cancelAndSet' on a disposed IntervalTimer`);
		}

		this.cancel();
		const handle = context.setInterval(() => {
			runner();
		}, interval);

		this.disposable = toDisposable(() => {
			context.clearInterval(handle);
			this.disposable = undefined;
		});
	}

	dispose(): void {
		this.cancel();
		this.isDisposed = true;
	}
}

export class RunOnceScheduler implements IDisposable {

	protected runner: ((...args: unknown[]) => void) | null;

	private timeoutToken: any;
	private timeout: number;
	private timeoutHandler: () => void;

	constructor(runner: (...args: any[]) => void, delay: number) {
		this.timeoutToken = -1;
		this.runner = runner;
		this.timeout = delay;
		this.timeoutHandler = this.onTimeout.bind(this);
	}

	/**
	 * Dispose RunOnceScheduler
	 */
	dispose(): void {
		this.cancel();
		this.runner = null;
	}

	/**
	 * Cancel current scheduled runner (if any).
	 */
	cancel(): void {
		if (this.isScheduled()) {
			clearTimeout(this.timeoutToken);
			this.timeoutToken = -1;
		}
	}

	/**
	 * Cancel previous runner (if any) & schedule a new runner.
	 */
	schedule(delay = this.timeout): void {
		this.cancel();
		this.timeoutToken = setTimeout(this.timeoutHandler, delay);
	}

	get delay(): number {
		return this.timeout;
	}

	set delay(value: number) {
		this.timeout = value;
	}

	/**
	 * Returns true if scheduled.
	 */
	isScheduled(): boolean {
		return this.timeoutToken !== -1;
	}

	private onTimeout() {
		this.timeoutToken = -1;
		if (this.runner) {
			this.doRun();
		}
	}

	protected doRun(): void {
		this.runner?.();
	}
}

//#region -- run on idle tricks ------------

export interface IdleDeadline {
	readonly didTimeout: boolean;
	timeRemaining(): number;
}

type IdleApi = Pick<typeof globalThis, 'requestIdleCallback' | 'cancelIdleCallback'>;


/**
 * Execute the callback the next time the browser is idle, returning an
 * {@link IDisposable} that will cancel the callback when disposed. This wraps
 * [requestIdleCallback] so it will fallback to [setTimeout] if the environment
 * doesn't support it.
 *
 * @param callback The callback to run when idle, this includes an
 * [IdleDeadline] that provides the time alloted for the idle callback by the
 * browser. Not respecting this deadline will result in a degraded user
 * experience.
 * @param timeout A timeout at which point to queue no longer wait for an idle
 * callback but queue it on the regular event loop (like setTimeout). Typically
 * this should not be used.
 *
 * [IdleDeadline]: https://developer.mozilla.org/en-US/docs/Web/API/IdleDeadline
 * [requestIdleCallback]: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback
 * [setTimeout]: https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout
 *
 * **Note** that there is `dom.ts#runWhenWindowIdle` which is better suited when running inside a browser
 * context
 */
export let runWhenGlobalIdle: (callback: (idle: IdleDeadline) => void, timeout?: number) => IDisposable;

export let _runWhenIdle: (targetWindow: IdleApi, callback: (idle: IdleDeadline) => void, timeout?: number) => IDisposable;

(function () {
	if (typeof globalThis.requestIdleCallback !== 'function' || typeof globalThis.cancelIdleCallback !== 'function') {
		_runWhenIdle = (_targetWindow, runner) => {
			setTimeout0(() => {
				if (disposed) {
					return;
				}
				const end = Date.now() + 15; // one frame at 64fps
				const deadline: IdleDeadline = {
					didTimeout: true,
					timeRemaining() {
						return Math.max(0, end - Date.now());
					}
				};
				runner(Object.freeze(deadline));
			});
			let disposed = false;
			return {
				dispose() {
					if (disposed) {
						return;
					}
					disposed = true;
				}
			};
		};
	} else {
		_runWhenIdle = (targetWindow: IdleApi, runner, timeout?) => {
			const handle: number = targetWindow.requestIdleCallback(runner, typeof timeout === 'number' ? { timeout } : undefined);
			let disposed = false;
			return {
				dispose() {
					if (disposed) {
						return;
					}
					disposed = true;
					targetWindow.cancelIdleCallback(handle);
				}
			};
		};
	}
	runWhenGlobalIdle = (runner) => _runWhenIdle(globalThis, runner);
})();

export abstract class AbstractIdleValue<T> {

	private readonly _executor: () => void;
	private readonly _handle: IDisposable;

	private _didRun: boolean = false;
	private _value?: T;
	private _error: unknown;

	constructor(targetWindow: IdleApi, executor: () => T) {
		this._executor = () => {
			try {
				this._value = executor();
			} catch (err) {
				this._error = err;
			} finally {
				this._didRun = true;
			}
		};
		this._handle = _runWhenIdle(targetWindow, () => this._executor());
	}

	dispose(): void {
		this._handle.dispose();
	}

	get value(): T {
		if (!this._didRun) {
			this._handle.dispose();
			this._executor();
		}
		if (this._error) {
			throw this._error;
		}
		return this._value!;
	}

	get isInitialized(): boolean {
		return this._didRun;
	}
}

/**
 * An `IdleValue` that always uses the current window (which might be throttled or inactive)
 *
 * **Note** that there is `dom.ts#WindowIdleValue` which is better suited when running inside a browser
 * context
 */
export class GlobalIdleValue<T> extends AbstractIdleValue<T> {

	constructor(executor: () => T) {
		super(globalThis, executor);
	}
}

//#endregion

//#region

export type ValueCallback<T = unknown> = (value: T | Promise<T>) => void;

const enum DeferredOutcome {
	Resolved,
	Rejected
}

/**
 * Creates a promise whose resolution or rejection can be controlled imperatively.
 */
export class DeferredPromise<T> {

	private completeCallback!: ValueCallback<T>;
	private errorCallback!: (err: unknown) => void;
	private outcome?: { outcome: DeferredOutcome.Rejected; value: any } | { outcome: DeferredOutcome.Resolved; value: T };

	public get isRejected() {
		return this.outcome?.outcome === DeferredOutcome.Rejected;
	}

	public get isSettled() {
		return !!this.outcome;
	}

	public readonly p: Promise<T>;

	constructor() {
		this.p = new Promise<T>((c, e) => {
			this.completeCallback = c;
			this.errorCallback = e;
		});
	}

	public complete(value: T) {
		return new Promise<void>(resolve => {
			this.completeCallback(value);
			this.outcome = { outcome: DeferredOutcome.Resolved, value };
			resolve();
		});
	}

	public error(err: unknown) {
		return new Promise<void>(resolve => {
			this.errorCallback(err);
			this.outcome = { outcome: DeferredOutcome.Rejected, value: err };
			resolve();
		});
	}

	public cancel() {
		return this.error(new CancellationError());
	}
}

//#endregion

//#region Promises

export namespace Promises {

	/**
	 * A drop-in replacement for `Promise.all` with the only difference
	 * that the method awaits every promise to either fulfill or reject.
	 *
	 * Similar to `Promise.all`, only the first error will be returned
	 * if any.
	 */
	export async function settled<T>(promises: Promise<T>[]): Promise<T[]> {
		let firstError: Error | undefined = undefined;

		const result = await Promise.all(promises.map(promise => promise.then(value => value, error => {
			if (!firstError) {
				firstError = error;
			}

			return undefined; // do not rethrow so that other promises can settle
		})));

		if (typeof firstError !== 'undefined') {
			throw firstError;
		}

		return result as unknown as T[]; // cast is needed and protected by the `throw` above
	}

	/**
	 * A helper to create a new `Promise<T>` with a body that is a promise
	 * itself. By default, an error that raises from the async body will
	 * end up as a unhandled rejection, so this utility properly awaits the
	 * body and rejects the promise as a normal promise does without async
	 * body.
	 *
	 * This method should only be used in rare cases where otherwise `async`
	 * cannot be used (e.g. when callbacks are involved that require this).
	 */
	export function withAsyncBody<T, E = Error>(bodyFn: (resolve: (value: T) => unknown, reject: (error: E) => unknown) => Promise<unknown>): Promise<T> {
		// eslint-disable-next-line no-async-promise-executor
		return new Promise<T>(async (resolve, reject) => {
			try {
				await bodyFn(resolve, reject);
			} catch (error) {
				reject(error);
			}
		});
	}
}

//#endregion

//#region

const enum AsyncIterableSourceState {
	Initial,
	DoneOK,
	DoneError,
}

/**
 * An object that allows to emit async values asynchronously or bring the iterable to an error state using `reject()`.
 * This emitter is valid only for the duration of the executor (until the promise returned by the executor settles).
 */
export interface AsyncIterableEmitter<T> {
	/**
	 * The value will be appended at the end.
	 *
	 * **NOTE** If `reject()` has already been called, this method has no effect.
	 */
	emitOne(value: T): void;
	/**
	 * The values will be appended at the end.
	 *
	 * **NOTE** If `reject()` has already been called, this method has no effect.
	 */
	emitMany(values: T[]): void;
	/**
	 * Writing an error will permanently invalidate this iterable.
	 * The current users will receive an error thrown, as will all future users.
	 *
	 * **NOTE** If `reject()` have already been called, this method has no effect.
	 */
	reject(error: Error): void;
}

/**
 * An executor for the `AsyncIterableObject` that has access to an emitter.
 */
export interface AsyncIterableExecutor<T> {
	/**
	 * @param emitter An object that allows to emit async values valid only for the duration of the executor.
	 */
	(emitter: AsyncIterableEmitter<T>): void | Promise<void>;
}

/**
 * A rich implementation for an `AsyncIterable<T>`.
 */
export class AsyncIterableObject<T> implements AsyncIterable<T> {

	public static fromArray<T>(items: T[]): AsyncIterableObject<T> {
		return new AsyncIterableObject<T>((writer) => {
			writer.emitMany(items);
		});
	}

	public static fromPromise<T>(promise: Promise<T[]>): AsyncIterableObject<T> {
		return new AsyncIterableObject<T>(async (emitter) => {
			emitter.emitMany(await promise);
		});
	}

	public static fromPromises<T>(promises: Promise<T>[]): AsyncIterableObject<T> {
		return new AsyncIterableObject<T>(async (emitter) => {
			await Promise.all(promises.map(async (p) => emitter.emitOne(await p)));
		});
	}

	public static merge<T>(iterables: AsyncIterable<T>[]): AsyncIterableObject<T> {
		return new AsyncIterableObject(async (emitter) => {
			await Promise.all(iterables.map(async (iterable) => {
				for await (const item of iterable) {
					emitter.emitOne(item);
				}
			}));
		});
	}

	public static EMPTY = AsyncIterableObject.fromArray<any>([]);

	private _state: AsyncIterableSourceState;
	private _results: T[];
	private _error: Error | null;
	private readonly _onReturn?: () => void | Promise<void>;
	private readonly _onStateChanged: Emitter<void>;

	constructor(executor: AsyncIterableExecutor<T>, onReturn?: () => void | Promise<void>) {
		this._state = AsyncIterableSourceState.Initial;
		this._results = [];
		this._error = null;
		this._onReturn = onReturn;
		this._onStateChanged = new Emitter<void>();

		queueMicrotask(async () => {
			const writer: AsyncIterableEmitter<T> = {
				emitOne: (item) => this.emitOne(item),
				emitMany: (items) => this.emitMany(items),
				reject: (error) => this.reject(error)
			};
			try {
				await Promise.resolve(executor(writer));
				this.resolve();
			} catch (err) {
				this.reject(err);
			} finally {
				writer.emitOne = undefined!;
				writer.emitMany = undefined!;
				writer.reject = undefined!;
			}
		});
	}

	[Symbol.asyncIterator](): AsyncIterator<T, undefined, undefined> {
		let i = 0;
		return {
			next: async () => {
				do {
					if (this._state === AsyncIterableSourceState.DoneError) {
						throw this._error;
					}
					if (i < this._results.length) {
						return { done: false, value: this._results[i++] };
					}
					if (this._state === AsyncIterableSourceState.DoneOK) {
						return { done: true, value: undefined };
					}
					await Event.toPromise(this._onStateChanged.event);
				} while (true);
			},
			return: async () => {
				this._onReturn?.();
				return { done: true, value: undefined };
			}
		};
	}

	public static map<T, R>(iterable: AsyncIterable<T>, mapFn: (item: T) => R): AsyncIterableObject<R> {
		return new AsyncIterableObject<R>(async (emitter) => {
			for await (const item of iterable) {
				emitter.emitOne(mapFn(item));
			}
		});
	}

	public map<R>(mapFn: (item: T) => R): AsyncIterableObject<R> {
		return AsyncIterableObject.map(this, mapFn);
	}

	public static filter<T>(iterable: AsyncIterable<T>, filterFn: (item: T) => boolean): AsyncIterableObject<T> {
		return new AsyncIterableObject<T>(async (emitter) => {
			for await (const item of iterable) {
				if (filterFn(item)) {
					emitter.emitOne(item);
				}
			}
		});
	}

	public filter(filterFn: (item: T) => boolean): AsyncIterableObject<T> {
		return AsyncIterableObject.filter(this, filterFn);
	}

	public static coalesce<T>(iterable: AsyncIterable<T | undefined | null>): AsyncIterableObject<T> {
		return <AsyncIterableObject<T>>AsyncIterableObject.filter(iterable, item => !!item);
	}

	public coalesce(): AsyncIterableObject<NonNullable<T>> {
		return AsyncIterableObject.coalesce(this) as AsyncIterableObject<NonNullable<T>>;
	}

	public static async toPromise<T>(iterable: AsyncIterable<T>): Promise<T[]> {
		const result: T[] = [];
		for await (const item of iterable) {
			result.push(item);
		}
		return result;
	}

	public toPromise(): Promise<T[]> {
		return AsyncIterableObject.toPromise(this);
	}

	/**
	 * The value will be appended at the end.
	 *
	 * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
	 */
	private emitOne(value: T): void {
		if (this._state !== AsyncIterableSourceState.Initial) {
			return;
		}
		// it is important to add new values at the end,
		// as we may have iterators already running on the array
		this._results.push(value);
		this._onStateChanged.fire();
	}

	/**
	 * The values will be appended at the end.
	 *
	 * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
	 */
	private emitMany(values: T[]): void {
		if (this._state !== AsyncIterableSourceState.Initial) {
			return;
		}
		// it is important to add new values at the end,
		// as we may have iterators already running on the array
		this._results = this._results.concat(values);
		this._onStateChanged.fire();
	}

	/**
	 * Calling `resolve()` will mark the result array as complete.
	 *
	 * **NOTE** `resolve()` must be called, otherwise all consumers of this iterable will hang indefinitely, similar to a non-resolved promise.
	 * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
	 */
	private resolve(): void {
		if (this._state !== AsyncIterableSourceState.Initial) {
			return;
		}
		this._state = AsyncIterableSourceState.DoneOK;
		this._onStateChanged.fire();
	}

	/**
	 * Writing an error will permanently invalidate this iterable.
	 * The current users will receive an error thrown, as will all future users.
	 *
	 * **NOTE** If `resolve()` or `reject()` have already been called, this method has no effect.
	 */
	private reject(error: Error) {
		if (this._state !== AsyncIterableSourceState.Initial) {
			return;
		}
		this._state = AsyncIterableSourceState.DoneError;
		this._error = error;
		this._onStateChanged.fire();
	}
}

export class CancelableAsyncIterableObject<T> extends AsyncIterableObject<T> {
	constructor(
		private readonly _source: CancellationTokenSource,
		executor: AsyncIterableExecutor<T>
	) {
		super(executor);
	}

	cancel(): void {
		this._source.cancel();
	}
}

export function createCancelableAsyncIterable<T>(callback: (token: CancellationToken) => AsyncIterable<T>): CancelableAsyncIterableObject<T> {
	const source = new CancellationTokenSource();
	const innerIterable = callback(source.token);

	return new CancelableAsyncIterableObject<T>(source, async (emitter) => {
		const subscription = source.token.onCancellationRequested(() => {
			subscription.dispose();
			source.dispose();
			emitter.reject(new CancellationError());
		});
		try {
			for await (const item of innerIterable) {
				if (source.token.isCancellationRequested) {
					// canceled in the meantime
					return;
				}
				emitter.emitOne(item);
			}
			subscription.dispose();
			source.dispose();
		} catch (err) {
			subscription.dispose();
			source.dispose();
			emitter.reject(err);
		}
	});
}

//#endregion
