
import { Emitter, Event, PauseableEmitter } from '../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../base/common/lifecycle.js';
import { isUndefinedOrNull } from '../../../base/common/types.js';
import { InMemoryStorageDatabase, IStorage, IStorageChangeEvent, Storage, StorageHint, StorageValue } from '../../../base/parts/storage/common/storage.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
export const TARGET_KEY = '__$__targetStorageMarker';

export const IStorageService = createDecorator<IStorageService>('storageService');

export enum WillSaveStateReason {

	/**
	 * No specific reason to save state.
	 */
	NONE,

	/**
	 * A hint that the workbench is about to shutdown.
	 */
	SHUTDOWN
}

export interface IWillSaveStateEvent {
	readonly reason: WillSaveStateReason;
}

export interface IWorkspaceStorageValueChangeEvent extends IStorageValueChangeEvent {
}

export interface IProfileStorageValueChangeEvent extends IStorageValueChangeEvent {
}

export interface IApplicationStorageValueChangeEvent extends IStorageValueChangeEvent {
}

export interface IStorageService {

	readonly _serviceBrand: undefined;

	/**
	 * Emitted whenever data is updated or deleted on the given
	 * scope and optional key.
	 *
	 * @param scope the `StorageScope` to listen to changes
	 * @param key the optional key to filter for or all keys of
	 * the scope if `undefined`
	 */
	onDidChangeValue(scope: StorageScope.WORKSPACE, key: string | undefined, disposable: DisposableStore): Event<IWorkspaceStorageValueChangeEvent>;
	onDidChangeValue(scope: StorageScope.PROFILE, key: string | undefined, disposable: DisposableStore): Event<IProfileStorageValueChangeEvent>;
	onDidChangeValue(scope: StorageScope.APPLICATION, key: string | undefined, disposable: DisposableStore): Event<IApplicationStorageValueChangeEvent>;
	onDidChangeValue(scope: StorageScope, key: string | undefined, disposable: DisposableStore): Event<IStorageValueChangeEvent>;

	/**
	 * Emitted when the storage is about to persist. This is the right time
	 * to persist data to ensure it is stored before the application shuts
	 * down.
	 *
	 * The will save state event allows to optionally ask for the reason of
	 * saving the state, e.g. to find out if the state is saved due to a
	 * shutdown.
	 *
	 * Note: this event may be fired many times, not only on shutdown to prevent
	 * loss of state in situations where the shutdown is not sufficient to
	 * persist the data properly.
	 */
	readonly onWillSaveState: Event<IWillSaveStateEvent>;

	/**
	 * Retrieve an element stored with the given key from storage. Use
	 * the provided `defaultValue` if the element is `null` or `undefined`.
	 *
	 * @param scope allows to define the scope of the storage operation
	 * to either the current workspace only, all workspaces or all profiles.
	 */
	get(key: string, scope: StorageScope, fallbackValue: string): string;
	get(key: string, scope: StorageScope, fallbackValue?: string): string | undefined;

	/**
	 * Retrieve an element stored with the given key from storage. Use
	 * the provided `defaultValue` if the element is `null` or `undefined`.
	 * The element will be converted to a `boolean`.
	 *
	 * @param scope allows to define the scope of the storage operation
	 * to either the current workspace only, all workspaces or all profiles.
	 */
	getBoolean(key: string, scope: StorageScope, fallbackValue: boolean): boolean;
	getBoolean(key: string, scope: StorageScope, fallbackValue?: boolean): boolean | undefined;

	/**
	 * Retrieve an element stored with the given key from storage. Use
	 * the provided `defaultValue` if the element is `null` or `undefined`.
	 * The element will be converted to a `number` using `parseInt` with a
	 * base of `10`.
	 *
	 * @param scope allows to define the scope of the storage operation
	 * to either the current workspace only, all workspaces or all profiles.
	 */
	getNumber(key: string, scope: StorageScope, fallbackValue: number): number;
	getNumber(key: string, scope: StorageScope, fallbackValue?: number): number | undefined;

	/**
	 * Store a value under the given key to storage. The value will be
	 * converted to a `string`. Storing either `undefined` or `null` will
	 * remove the entry under the key.
	 *
	 * @param scope allows to define the scope of the storage operation
	 * to either the current workspace only, all workspaces or all profiles.
	 *
	 * @param target allows to define the target of the storage operation
	 * to either the current machine or user.
	 */
	store(key: string, value: StorageValue, scope: StorageScope, target: StorageTarget): void;

	/**
	 * Delete an element stored under the provided key from storage.
	 *
	 * The scope argument allows to define the scope of the storage
	 * operation to either the current workspace only, all workspaces
	 * or all profiles.
	 */
	remove(key: string, scope: StorageScope): void;
}

export const enum StorageScope {

	/**
	 * The stored data will be scoped to all workspaces across all profiles.
	 */
	APPLICATION = -1,

	/**
	 * The stored data will be scoped to all workspaces of the same profile.
	 */
	PROFILE = 0,

	/**
	 * The stored data will be scoped to the current workspace.
	 */
	WORKSPACE = 1
}

export const enum StorageTarget {

	/**
	 * The stored data is user specific and applies across machines.
	 */
	USER,

	/**
	 * The stored data is machine specific.
	 */
	MACHINE
}

export interface IStorageValueChangeEvent {

	/**
	 * The scope for the storage entry that changed
	 * or was removed.
	 */
	readonly scope: StorageScope;

	/**
	 * The `key` of the storage entry that was changed
	 * or was removed.
	 */
	readonly key: string;

	/**
	 * The `target` can be `undefined` if a key is being
	 * removed.
	 */
	readonly target: StorageTarget | undefined;

	/**
	 * A hint how the storage change event was triggered. If
	 * `true`, the storage change was triggered by an external
	 * source, such as:
	 * - another process (for example another window)
	 * - operations such as settings sync or profiles change
	 */
	readonly external?: boolean;
}

export interface IStorageTargetChangeEvent {

	/**
	 * The scope for the target that changed. Listeners
	 * should use `keys(scope, target)` to get an updated
	 * list of keys for the given `scope` and `target`.
	 */
	readonly scope: StorageScope;
}

interface IKeyTargets {
	[key: string]: StorageTarget;
}

export interface IStorageServiceOptions {
	readonly flushInterval: number;
}

export function loadKeyTargets(storage: IStorage): IKeyTargets {
	const keysRaw = storage.get(TARGET_KEY);
	if (keysRaw) {
		try {
			return JSON.parse(keysRaw);
		} catch (error) {
			// Fail gracefully
		}
	}

	return Object.create(null);
}

export abstract class AbstractStorageService extends Disposable implements IStorageService {

	declare readonly _serviceBrand: undefined;

	private static DEFAULT_FLUSH_INTERVAL = 60 * 1000; // every minute

	private readonly _onDidChangeValue = this._register(new PauseableEmitter<IStorageValueChangeEvent>());

	private readonly _onDidChangeTarget = this._register(new PauseableEmitter<IStorageTargetChangeEvent>());

	private readonly _onWillSaveState = this._register(new Emitter<IWillSaveStateEvent>());
	readonly onWillSaveState = this._onWillSaveState.event;

	constructor(private readonly options: IStorageServiceOptions = { flushInterval: AbstractStorageService.DEFAULT_FLUSH_INTERVAL }) {
		super();
	}

	onDidChangeValue(scope: StorageScope.WORKSPACE, key: string | undefined, disposable: DisposableStore): Event<IWorkspaceStorageValueChangeEvent>;
	onDidChangeValue(scope: StorageScope.PROFILE, key: string | undefined, disposable: DisposableStore): Event<IProfileStorageValueChangeEvent>;
	onDidChangeValue(scope: StorageScope.APPLICATION, key: string | undefined, disposable: DisposableStore): Event<IApplicationStorageValueChangeEvent>;
	onDidChangeValue(scope: StorageScope, key: string | undefined, disposable: DisposableStore): Event<IStorageValueChangeEvent> {
		return Event.filter(this._onDidChangeValue.event, e => e.scope === scope && (key === undefined || e.key === key), disposable);
	}

	protected emitDidChangeValue(scope: StorageScope, event: IStorageChangeEvent): void {
		const { key, external } = event;

		// Specially handle `TARGET_KEY`
		if (key === TARGET_KEY) {

			// Clear our cached version which is now out of date
			switch (scope) {
				case StorageScope.APPLICATION:
					this._applicationKeyTargets = undefined;
					break;
				case StorageScope.PROFILE:
					this._profileKeyTargets = undefined;
					break;
				case StorageScope.WORKSPACE:
					this._workspaceKeyTargets = undefined;
					break;
			}

			// Emit as `didChangeTarget` event
			this._onDidChangeTarget.fire({ scope });
		}

		// Emit any other key to outside
		else {
			this._onDidChangeValue.fire({ scope, key, target: this.getKeyTargets(scope)[key], external });
		}
	}

	get(key: string, scope: StorageScope, fallbackValue: string): string;
	get(key: string, scope: StorageScope): string | undefined;
	get(key: string, scope: StorageScope, fallbackValue?: string): string | undefined {
		return this.getStorage(scope)?.get(key, fallbackValue);
	}

	getBoolean(key: string, scope: StorageScope, fallbackValue: boolean): boolean;
	getBoolean(key: string, scope: StorageScope): boolean | undefined;
	getBoolean(key: string, scope: StorageScope, fallbackValue?: boolean): boolean | undefined {
		return this.getStorage(scope)?.getBoolean(key, fallbackValue);
	}

	getNumber(key: string, scope: StorageScope, fallbackValue: number): number;
	getNumber(key: string, scope: StorageScope): number | undefined;
	getNumber(key: string, scope: StorageScope, fallbackValue?: number): number | undefined {
		return this.getStorage(scope)?.getNumber(key, fallbackValue);
	}

	store(key: string, value: StorageValue, scope: StorageScope, target: StorageTarget, external = false): void {

		// We remove the key for undefined/null values
		if (isUndefinedOrNull(value)) {
			this.remove(key, scope, external);
			return;
		}

		// Update our datastructures but send events only after
		this.withPausedEmitters(() => {

			// Update key-target map
			this.updateKeyTarget(key, scope, target);

			// Store actual value
			this.getStorage(scope)?.set(key, value, external);
		});
	}

	remove(key: string, scope: StorageScope, external = false): void {

		// Update our datastructures but send events only after
		this.withPausedEmitters(() => {

			// Update key-target map
			this.updateKeyTarget(key, scope, undefined);

			// Remove actual key
			this.getStorage(scope)?.delete(key, external);
		});
	}

	private withPausedEmitters(fn: Function): void {

		// Pause emitters
		this._onDidChangeValue.pause();
		this._onDidChangeTarget.pause();

		try {
			fn();
		} finally {

			// Resume emitters
			this._onDidChangeValue.resume();
			this._onDidChangeTarget.resume();
		}
	}

	private updateKeyTarget(key: string, scope: StorageScope, target: StorageTarget | undefined, external = false): void {

		// Add
		const keyTargets = this.getKeyTargets(scope);
		if (typeof target === 'number') {
			if (keyTargets[key] !== target) {
				keyTargets[key] = target;
				this.getStorage(scope)?.set(TARGET_KEY, JSON.stringify(keyTargets), external);
			}
		}

		// Remove
		else {
			if (typeof keyTargets[key] === 'number') {
				delete keyTargets[key];
				this.getStorage(scope)?.set(TARGET_KEY, JSON.stringify(keyTargets), external);
			}
		}
	}

	private _workspaceKeyTargets: IKeyTargets | undefined = undefined;
	private get workspaceKeyTargets(): IKeyTargets {
		if (!this._workspaceKeyTargets) {
			this._workspaceKeyTargets = this.loadKeyTargets(StorageScope.WORKSPACE);
		}

		return this._workspaceKeyTargets;
	}

	private _profileKeyTargets: IKeyTargets | undefined = undefined;
	private get profileKeyTargets(): IKeyTargets {
		if (!this._profileKeyTargets) {
			this._profileKeyTargets = this.loadKeyTargets(StorageScope.PROFILE);
		}

		return this._profileKeyTargets;
	}

	private _applicationKeyTargets: IKeyTargets | undefined = undefined;
	private get applicationKeyTargets(): IKeyTargets {
		if (!this._applicationKeyTargets) {
			this._applicationKeyTargets = this.loadKeyTargets(StorageScope.APPLICATION);
		}

		return this._applicationKeyTargets;
	}

	private getKeyTargets(scope: StorageScope): IKeyTargets {
		switch (scope) {
			case StorageScope.APPLICATION:
				return this.applicationKeyTargets;
			case StorageScope.PROFILE:
				return this.profileKeyTargets;
			default:
				return this.workspaceKeyTargets;
		}
	}

	private loadKeyTargets(scope: StorageScope): { [key: string]: StorageTarget } {
		const storage = this.getStorage(scope);

		return storage ? loadKeyTargets(storage) : Object.create(null);
	}

	protected abstract getStorage(scope: StorageScope): IStorage | undefined;
}

export class InMemoryStorageService extends AbstractStorageService {

	private readonly applicationStorage = this._register(new Storage(new InMemoryStorageDatabase(), { hint: StorageHint.STORAGE_IN_MEMORY }));
	private readonly profileStorage = this._register(new Storage(new InMemoryStorageDatabase(), { hint: StorageHint.STORAGE_IN_MEMORY }));
	private readonly workspaceStorage = this._register(new Storage(new InMemoryStorageDatabase(), { hint: StorageHint.STORAGE_IN_MEMORY }));

	constructor() {
		super();

		this._register(this.workspaceStorage.onDidChangeStorage(e => this.emitDidChangeValue(StorageScope.WORKSPACE, e)));
		this._register(this.profileStorage.onDidChangeStorage(e => this.emitDidChangeValue(StorageScope.PROFILE, e)));
		this._register(this.applicationStorage.onDidChangeStorage(e => this.emitDidChangeValue(StorageScope.APPLICATION, e)));
	}

	protected getStorage(scope: StorageScope): IStorage {
		switch (scope) {
			case StorageScope.APPLICATION:
				return this.applicationStorage;
			case StorageScope.PROFILE:
				return this.profileStorage;
			default:
				return this.workspaceStorage;
		}
	}
}
