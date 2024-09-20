/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as arrays from '../../../base/common/arrays.js';
import { IStringDictionary } from '../../../base/common/collections.js';
import { ResourceMap } from '../../../base/common/map.js';
import * as objects from '../../../base/common/objects.js';
import * as types from '../../../base/common/types.js';
import { URI, UriComponents } from '../../../base/common/uri.js';
import { addToValueTree, ConfigurationTarget, getConfigurationValue, IConfigurationChange, IConfigurationChangeEvent, IConfigurationData, IConfigurationModel, IConfigurationOverrides, IConfigurationUpdateOverrides, IConfigurationValue, IInspectValue, IOverrides, removeFromValueTree, toValuesTree } from './configuration.js';
import { ConfigurationScope, Extensions, IConfigurationPropertySchema, IConfigurationRegistry, overrideIdentifiersFromKey, OVERRIDE_PROPERTY_REGEX } from './configurationRegistry.js';
import { ILogService } from '../../log/common/log.js';
import { Registry } from '../../registry/common/platform.js';
import { Workspace } from '../../workspace/common/workspace.js';

function freeze<T>(data: T): T {
	return Object.isFrozen(data) ? data : objects.deepFreeze(data);
}

type InspectValue<V> = IInspectValue<V> & { merged?: V };

export class ConfigurationModel implements IConfigurationModel {

	static createEmptyModel(logService: ILogService): ConfigurationModel {
		return new ConfigurationModel({}, [], [], undefined, logService);
	}

	private readonly overrideConfigurations = new Map<string, ConfigurationModel>();

	constructor(
		private readonly _contents: any,
		private readonly _keys: string[],
		private readonly _overrides: IOverrides[],
		readonly raw: ReadonlyArray<IStringDictionary<any> | ConfigurationModel> | undefined,
		private readonly logService: ILogService
	) {
	}

	private _rawConfiguration: ConfigurationModel | undefined;
	get rawConfiguration(): ConfigurationModel {
		if (!this._rawConfiguration) {
			if (this.raw?.length) {
				const rawConfigurationModels = this.raw.map(raw => {
					if (raw instanceof ConfigurationModel) {
						return raw;
					}
					const parser = new ConfigurationModelParser('', this.logService);
					parser.parseRaw(raw);
					return parser.configurationModel;
				});
				this._rawConfiguration = rawConfigurationModels.reduce((previous, current) => current === previous ? current : previous.merge(current), rawConfigurationModels[0]);
			} else {
				// raw is same as current
				this._rawConfiguration = this;
			}
		}
		return this._rawConfiguration;
	}

	get contents(): any {
		return this._contents;
	}

	get overrides(): IOverrides[] {
		return this._overrides;
	}

	get keys(): string[] {
		return this._keys;
	}

	isEmpty(): boolean {
		return this._keys.length === 0 && Object.keys(this._contents).length === 0 && this._overrides.length === 0;
	}

	getValue<V>(section: string | undefined): V {
		return section ? getConfigurationValue<any>(this.contents, section) : this.contents;
	}

	inspect<V>(section: string | undefined, overrideIdentifier?: string | null): InspectValue<V> {
		const that = this;
		return {
			get value() {
				return freeze(that.rawConfiguration.getValue<V>(section));
			},
			get override() {
				return overrideIdentifier ? freeze(that.rawConfiguration.getOverrideValue<V>(section, overrideIdentifier)) : undefined;
			},
			get merged() {
				return freeze(overrideIdentifier ? that.rawConfiguration.override(overrideIdentifier).getValue<V>(section) : that.rawConfiguration.getValue<V>(section));
			},
			get overrides() {
				const overrides: { readonly identifiers: string[]; readonly value: V }[] = [];
				for (const { contents, identifiers, keys } of that.rawConfiguration.overrides) {
					const value = new ConfigurationModel(contents, keys, [], undefined, that.logService).getValue<V>(section);
					if (value !== undefined) {
						overrides.push({ identifiers, value });
					}
				}
				return overrides.length ? freeze(overrides) : undefined;
			}
		};
	}

	getOverrideValue<V>(section: string | undefined, overrideIdentifier: string): V | undefined {
		const overrideContents = this.getContentsForOverrideIdentifer(overrideIdentifier);
		return overrideContents
			? section ? getConfigurationValue<any>(overrideContents, section) : overrideContents
			: undefined;
	}

	override(identifier: string): ConfigurationModel {
		let overrideConfigurationModel = this.overrideConfigurations.get(identifier);
		if (!overrideConfigurationModel) {
			overrideConfigurationModel = this.createOverrideConfigurationModel(identifier);
			this.overrideConfigurations.set(identifier, overrideConfigurationModel);
		}
		return overrideConfigurationModel;
	}

	merge(...others: ConfigurationModel[]): ConfigurationModel {
		const contents = objects.deepClone(this.contents);
		const overrides = objects.deepClone(this.overrides);
		const keys = [...this.keys];
		const raws = this.raw?.length ? [...this.raw] : [this];

		for (const other of others) {
			raws.push(...(other.raw?.length ? other.raw : [other]));
			if (other.isEmpty()) {
				continue;
			}
			this.mergeContents(contents, other.contents);

			for (const otherOverride of other.overrides) {
				const [override] = overrides.filter(o => arrays.equals(o.identifiers, otherOverride.identifiers));
				if (override) {
					this.mergeContents(override.contents, otherOverride.contents);
					override.keys.push(...otherOverride.keys);
					override.keys = arrays.distinct(override.keys);
				} else {
					overrides.push(objects.deepClone(otherOverride));
				}
			}
			for (const key of other.keys) {
				if (keys.indexOf(key) === -1) {
					keys.push(key);
				}
			}
		}
		return new ConfigurationModel(contents, keys, overrides, raws.every(raw => raw instanceof ConfigurationModel) ? undefined : raws, this.logService);
	}

	private createOverrideConfigurationModel(identifier: string): ConfigurationModel {
		const overrideContents = this.getContentsForOverrideIdentifer(identifier);

		if (!overrideContents || typeof overrideContents !== 'object' || !Object.keys(overrideContents).length) {
			// If there are no valid overrides, return self
			return this;
		}

		const contents: any = {};
		for (const key of arrays.distinct([...Object.keys(this.contents), ...Object.keys(overrideContents)])) {

			let contentsForKey = this.contents[key];
			const overrideContentsForKey = overrideContents[key];

			// If there are override contents for the key, clone and merge otherwise use base contents
			if (overrideContentsForKey) {
				// Clone and merge only if base contents and override contents are of type object otherwise just override
				if (typeof contentsForKey === 'object' && typeof overrideContentsForKey === 'object') {
					contentsForKey = objects.deepClone(contentsForKey);
					this.mergeContents(contentsForKey, overrideContentsForKey);
				} else {
					contentsForKey = overrideContentsForKey;
				}
			}

			contents[key] = contentsForKey;
		}

		return new ConfigurationModel(contents, this.keys, this.overrides, undefined, this.logService);
	}

	private mergeContents(source: any, target: any): void {
		for (const key of Object.keys(target)) {
			if (key in source) {
				if (types.isObject(source[key]) && types.isObject(target[key])) {
					this.mergeContents(source[key], target[key]);
					continue;
				}
			}
			source[key] = objects.deepClone(target[key]);
		}
	}

	private getContentsForOverrideIdentifer(identifier: string): any {
		let contentsForIdentifierOnly: IStringDictionary<any> | null = null;
		let contents: IStringDictionary<any> | null = null;
		const mergeContents = (contentsToMerge: any) => {
			if (contentsToMerge) {
				if (contents) {
					this.mergeContents(contents, contentsToMerge);
				} else {
					contents = objects.deepClone(contentsToMerge);
				}
			}
		};
		for (const override of this.overrides) {
			if (override.identifiers.length === 1 && override.identifiers[0] === identifier) {
				contentsForIdentifierOnly = override.contents;
			} else if (override.identifiers.includes(identifier)) {
				mergeContents(override.contents);
			}
		}
		// Merge contents of the identifier only at the end to take precedence.
		mergeContents(contentsForIdentifierOnly);
		return contents;
	}

	toJSON(): IConfigurationModel {
		return {
			contents: this.contents,
			overrides: this.overrides,
			keys: this.keys
		};
	}

	public setValue(key: string, value: any): void {
		this.updateValue(key, value, false);
	}

	public removeValue(key: string): void {
		const index = this.keys.indexOf(key);
		if (index === -1) {
			return;
		}
		this.keys.splice(index, 1);
		removeFromValueTree(this.contents, key);
		if (OVERRIDE_PROPERTY_REGEX.test(key)) {
			this.overrides.splice(this.overrides.findIndex(o => arrays.equals(o.identifiers, overrideIdentifiersFromKey(key))), 1);
		}
	}

	private updateValue(key: string, value: any, add: boolean): void {
		addToValueTree(this.contents, key, value, e => this.logService.error(e));
		add = add || this.keys.indexOf(key) === -1;
		if (add) {
			this.keys.push(key);
		}
		if (OVERRIDE_PROPERTY_REGEX.test(key)) {
			const identifiers = overrideIdentifiersFromKey(key);
			const override = {
				identifiers,
				keys: Object.keys(this.contents[key]),
				contents: toValuesTree(this.contents[key], message => this.logService.error(message)),
			};
			const index = this.overrides.findIndex(o => arrays.equals(o.identifiers, identifiers));
			if (index !== -1) {
				this.overrides[index] = override;
			} else {
				this.overrides.push(override);
			}
		}
	}
}

export interface ConfigurationParseOptions {
	scopes?: ConfigurationScope[];
	skipRestricted?: boolean;
	include?: string[];
	exclude?: string[];
}

export class ConfigurationModelParser {

	private _raw: any = null;
	private _configurationModel: ConfigurationModel | null = null;
	private _restrictedConfigurations: string[] = [];

	constructor(
		protected readonly _name: string,
		protected readonly logService: ILogService
	) { }

	get configurationModel(): ConfigurationModel {
		return this._configurationModel || ConfigurationModel.createEmptyModel(this.logService);
	}

	public parseRaw(raw: any, options?: ConfigurationParseOptions): void {
		this._raw = raw;
		const { contents, keys, overrides, restricted, hasExcludedProperties } = this.doParseRaw(raw, options);
		this._configurationModel = new ConfigurationModel(contents, keys, overrides, hasExcludedProperties ? [raw] : undefined /* raw has not changed */, this.logService);
		this._restrictedConfigurations = restricted || [];
	}

	protected doParseRaw(raw: any, options?: ConfigurationParseOptions): IConfigurationModel & { restricted?: string[]; hasExcludedProperties?: boolean } {
		const configurationProperties = Registry.as<IConfigurationRegistry>(Extensions.Configuration).getConfigurationProperties();
		const filtered = this.filter(raw, configurationProperties, true, options);
		raw = filtered.raw;
		const contents = toValuesTree(raw, message => this.logService.error(`Conflict in settings file ${this._name}: ${message}`));
		const keys = Object.keys(raw);
		const overrides = this.toOverrides(raw, message => this.logService.error(`Conflict in settings file ${this._name}: ${message}`));
		return { contents, keys, overrides, restricted: filtered.restricted, hasExcludedProperties: filtered.hasExcludedProperties };
	}

	private filter(properties: any, configurationProperties: { [qualifiedKey: string]: IConfigurationPropertySchema | undefined }, filterOverriddenProperties: boolean, options?: ConfigurationParseOptions): { raw: {}; restricted: string[]; hasExcludedProperties: boolean } {
		let hasExcludedProperties = false;
		if (!options?.scopes && !options?.skipRestricted && !options?.exclude?.length) {
			return { raw: properties, restricted: [], hasExcludedProperties };
		}
		const raw: any = {};
		const restricted: string[] = [];
		for (const key in properties) {
			if (OVERRIDE_PROPERTY_REGEX.test(key) && filterOverriddenProperties) {
				const result = this.filter(properties[key], configurationProperties, false, options);
				raw[key] = result.raw;
				hasExcludedProperties = hasExcludedProperties || result.hasExcludedProperties;
				restricted.push(...result.restricted);
			} else {
				const propertySchema = configurationProperties[key];
				const scope = propertySchema ? typeof propertySchema.scope !== 'undefined' ? propertySchema.scope : ConfigurationScope.WINDOW : undefined;
				if (propertySchema?.restricted) {
					restricted.push(key);
				}
				if (!options.exclude?.includes(key) /* Check exclude */
					&& (options.include?.includes(key) /* Check include */
						|| ((scope === undefined || options.scopes === undefined || options.scopes.includes(scope)) /* Check scopes */
							&& !(options.skipRestricted && propertySchema?.restricted)))) /* Check restricted */ {
					raw[key] = properties[key];
				} else {
					hasExcludedProperties = true;
				}
			}
		}
		return { raw, restricted, hasExcludedProperties };
	}

	private toOverrides(raw: any, conflictReporter: (message: string) => void): IOverrides[] {
		const overrides: IOverrides[] = [];
		for (const key of Object.keys(raw)) {
			if (OVERRIDE_PROPERTY_REGEX.test(key)) {
				const overrideRaw: any = {};
				for (const keyInOverrideRaw in raw[key]) {
					overrideRaw[keyInOverrideRaw] = raw[key][keyInOverrideRaw];
				}
				overrides.push({
					identifiers: overrideIdentifiersFromKey(key),
					keys: Object.keys(overrideRaw),
					contents: toValuesTree(overrideRaw, conflictReporter)
				});
			}
		}
		return overrides;
	}

}

class ConfigurationInspectValue<V> implements IConfigurationValue<V> {

	constructor(
		private readonly key: string,
		private readonly overrides: IConfigurationOverrides,
		private readonly _value: V | undefined,
		readonly overrideIdentifiers: string[] | undefined,
		private readonly defaultConfiguration: ConfigurationModel,
		private readonly policyConfiguration: ConfigurationModel | undefined,
		private readonly applicationConfiguration: ConfigurationModel | undefined,
		private readonly userConfiguration: ConfigurationModel,
		private readonly localUserConfiguration: ConfigurationModel,
		private readonly remoteUserConfiguration: ConfigurationModel,
		private readonly workspaceConfiguration: ConfigurationModel | undefined,
		private readonly folderConfigurationModel: ConfigurationModel | undefined,
		private readonly memoryConfigurationModel: ConfigurationModel
	) {
	}

	private toInspectValue(inspectValue: IInspectValue<V> | undefined | null): IInspectValue<V> | undefined {
		return inspectValue?.value !== undefined || inspectValue?.override !== undefined || inspectValue?.overrides !== undefined ? inspectValue : undefined;
	}

	private _userInspectValue: InspectValue<V> | undefined;
	private get userInspectValue(): InspectValue<V> {
		if (!this._userInspectValue) {
			this._userInspectValue = this.userConfiguration.inspect<V>(this.key, this.overrides.overrideIdentifier);
		}
		return this._userInspectValue;
	}

	get user(): IInspectValue<V> | undefined {
		return this.toInspectValue(this.userInspectValue);
	}

}

export class Configuration {

	private _workspaceConsolidatedConfiguration: ConfigurationModel | null = null;
	private _foldersConsolidatedConfigurations = new ResourceMap<ConfigurationModel>();

	constructor(
		private _defaultConfiguration: ConfigurationModel,
		private _policyConfiguration: ConfigurationModel,
		private _applicationConfiguration: ConfigurationModel,
		private _localUserConfiguration: ConfigurationModel,
		private _remoteUserConfiguration: ConfigurationModel,
		private _workspaceConfiguration: ConfigurationModel,
		private _folderConfigurations: ResourceMap<ConfigurationModel>,
		private _memoryConfiguration: ConfigurationModel,
		private _memoryConfigurationByResource: ResourceMap<ConfigurationModel>,
		private readonly logService: ILogService
	) {
	}

	getValue(section: string | undefined, overrides: IConfigurationOverrides, workspace: Workspace | undefined): any {
		const consolidateConfigurationModel = this.getConsolidatedConfigurationModel(section, overrides, workspace);
		return consolidateConfigurationModel.getValue(section);
	}

	updateValue(key: string, value: any, overrides: IConfigurationUpdateOverrides = {}): void {
		let memoryConfiguration: ConfigurationModel | undefined;
		if (overrides.resource) {
			memoryConfiguration = this._memoryConfigurationByResource.get(overrides.resource);
			if (!memoryConfiguration) {
				memoryConfiguration = ConfigurationModel.createEmptyModel(this.logService);
				this._memoryConfigurationByResource.set(overrides.resource, memoryConfiguration);
			}
		} else {
			memoryConfiguration = this._memoryConfiguration;
		}

		if (value === undefined) {
			memoryConfiguration.removeValue(key);
		} else {
			memoryConfiguration.setValue(key, value);
		}

		if (!overrides.resource) {
			this._workspaceConsolidatedConfiguration = null;
		}
	}

	inspect<C>(key: string, overrides: IConfigurationOverrides, workspace: Workspace | undefined): IConfigurationValue<C> {
		const consolidateConfigurationModel = this.getConsolidatedConfigurationModel(key, overrides, workspace);
		const folderConfigurationModel = this.getFolderConfigurationModelForResource(overrides.resource, workspace);
		const memoryConfigurationModel = overrides.resource ? this._memoryConfigurationByResource.get(overrides.resource) || this._memoryConfiguration : this._memoryConfiguration;
		const overrideIdentifiers = new Set<string>();
		for (const override of consolidateConfigurationModel.overrides) {
			for (const overrideIdentifier of override.identifiers) {
				if (consolidateConfigurationModel.getOverrideValue(key, overrideIdentifier) !== undefined) {
					overrideIdentifiers.add(overrideIdentifier);
				}
			}
		}

		return new ConfigurationInspectValue<C>(
			key,
			overrides,
			consolidateConfigurationModel.getValue<C>(key),
			overrideIdentifiers.size ? [...overrideIdentifiers] : undefined,
			this._defaultConfiguration,
			this._policyConfiguration.isEmpty() ? undefined : this._policyConfiguration,
			this.applicationConfiguration.isEmpty() ? undefined : this.applicationConfiguration,
			this.userConfiguration,
			this.localUserConfiguration,
			this.remoteUserConfiguration,
			workspace ? this._workspaceConfiguration : undefined,
			folderConfigurationModel ? folderConfigurationModel : undefined,
			memoryConfigurationModel
		);

	}

	get applicationConfiguration(): ConfigurationModel {
		return this._applicationConfiguration;
	}

	private _userConfiguration: ConfigurationModel | null = null;
	get userConfiguration(): ConfigurationModel {
		if (!this._userConfiguration) {
			this._userConfiguration = this._remoteUserConfiguration.isEmpty() ? this._localUserConfiguration : this._localUserConfiguration.merge(this._remoteUserConfiguration);
		}
		return this._userConfiguration;
	}

	get localUserConfiguration(): ConfigurationModel {
		return this._localUserConfiguration;
	}

	get remoteUserConfiguration(): ConfigurationModel {
		return this._remoteUserConfiguration;
	}

	private getConsolidatedConfigurationModel(section: string | undefined, overrides: IConfigurationOverrides, workspace: Workspace | undefined): ConfigurationModel {
		let configurationModel = this.getConsolidatedConfigurationModelForResource(overrides, workspace);
		if (overrides.overrideIdentifier) {
			configurationModel = configurationModel.override(overrides.overrideIdentifier);
		}
		if (!this._policyConfiguration.isEmpty() && this._policyConfiguration.getValue(section) !== undefined) {
			configurationModel = configurationModel.merge(this._policyConfiguration);
		}
		return configurationModel;
	}

	private getConsolidatedConfigurationModelForResource({ resource }: IConfigurationOverrides, workspace: Workspace | undefined): ConfigurationModel {
		let consolidateConfiguration = this.getWorkspaceConsolidatedConfiguration();

		if (workspace && resource) {
			const root = workspace.getFolder(resource);
			if (root) {
				consolidateConfiguration = this.getFolderConsolidatedConfiguration(root.uri) || consolidateConfiguration;
			}
			const memoryConfigurationForResource = this._memoryConfigurationByResource.get(resource);
			if (memoryConfigurationForResource) {
				consolidateConfiguration = consolidateConfiguration.merge(memoryConfigurationForResource);
			}
		}

		return consolidateConfiguration;
	}

	private getWorkspaceConsolidatedConfiguration(): ConfigurationModel {
		if (!this._workspaceConsolidatedConfiguration) {
			this._workspaceConsolidatedConfiguration = this._defaultConfiguration.merge(this.applicationConfiguration, this.userConfiguration, this._workspaceConfiguration, this._memoryConfiguration);
		}
		return this._workspaceConsolidatedConfiguration;
	}

	private getFolderConsolidatedConfiguration(folder: URI): ConfigurationModel {
		let folderConsolidatedConfiguration = this._foldersConsolidatedConfigurations.get(folder);
		if (!folderConsolidatedConfiguration) {
			const workspaceConsolidateConfiguration = this.getWorkspaceConsolidatedConfiguration();
			const folderConfiguration = this._folderConfigurations.get(folder);
			if (folderConfiguration) {
				folderConsolidatedConfiguration = workspaceConsolidateConfiguration.merge(folderConfiguration);
				this._foldersConsolidatedConfigurations.set(folder, folderConsolidatedConfiguration);
			} else {
				folderConsolidatedConfiguration = workspaceConsolidateConfiguration;
			}
		}
		return folderConsolidatedConfiguration;
	}

	private getFolderConfigurationModelForResource(resource: URI | null | undefined, workspace: Workspace | undefined): ConfigurationModel | undefined {
		if (workspace && resource) {
			const root = workspace.getFolder(resource);
			if (root) {
				return this._folderConfigurations.get(root.uri);
			}
		}
		return undefined;
	}

	toData(): IConfigurationData {
		return {
			defaults: {
				contents: this._defaultConfiguration.contents,
				overrides: this._defaultConfiguration.overrides,
				keys: this._defaultConfiguration.keys
			},
			policy: {
				contents: this._policyConfiguration.contents,
				overrides: this._policyConfiguration.overrides,
				keys: this._policyConfiguration.keys
			},
			application: {
				contents: this.applicationConfiguration.contents,
				overrides: this.applicationConfiguration.overrides,
				keys: this.applicationConfiguration.keys
			},
			user: {
				contents: this.userConfiguration.contents,
				overrides: this.userConfiguration.overrides,
				keys: this.userConfiguration.keys
			},
			workspace: {
				contents: this._workspaceConfiguration.contents,
				overrides: this._workspaceConfiguration.overrides,
				keys: this._workspaceConfiguration.keys
			},
			folders: [...this._folderConfigurations.keys()].reduce<[UriComponents, IConfigurationModel][]>((result, folder) => {
				const { contents, overrides, keys } = this._folderConfigurations.get(folder)!;
				result.push([folder, { contents, overrides, keys }]);
				return result;
			}, [])
		};
	}

	static parse(data: IConfigurationData, logService: ILogService): Configuration {
		const defaultConfiguration = this.parseConfigurationModel(data.defaults, logService);
		const policyConfiguration = this.parseConfigurationModel(data.policy, logService);
		const applicationConfiguration = this.parseConfigurationModel(data.application, logService);
		const userConfiguration = this.parseConfigurationModel(data.user, logService);
		const workspaceConfiguration = this.parseConfigurationModel(data.workspace, logService);
		const folders: ResourceMap<ConfigurationModel> = data.folders.reduce((result, value) => {
			result.set(URI.revive(value[0]), this.parseConfigurationModel(value[1], logService));
			return result;
		}, new ResourceMap<ConfigurationModel>());
		return new Configuration(
			defaultConfiguration,
			policyConfiguration,
			applicationConfiguration,
			userConfiguration,
			ConfigurationModel.createEmptyModel(logService),
			workspaceConfiguration,
			folders,
			ConfigurationModel.createEmptyModel(logService),
			new ResourceMap<ConfigurationModel>(),
			logService
		);
	}

	private static parseConfigurationModel(model: IConfigurationModel, logService: ILogService): ConfigurationModel {
		return new ConfigurationModel(model.contents, model.keys, model.overrides, undefined, logService);
	}

}

export class ConfigurationChangeEvent implements IConfigurationChangeEvent {

	private readonly _marker = '\n';
	private readonly _markerCode1 = this._marker.charCodeAt(0);
	private readonly _markerCode2 = '.'.charCodeAt(0);
	private readonly _affectsConfigStr: string;

	readonly affectedKeys = new Set<string>();
	source!: ConfigurationTarget;

	constructor(
		readonly change: IConfigurationChange,
		private readonly previous: { workspace?: Workspace; data: IConfigurationData } | undefined,
		private readonly currentConfiguraiton: Configuration,
		private readonly currentWorkspace: Workspace | undefined,
		private readonly logService: ILogService
	) {
		for (const key of change.keys) {
			this.affectedKeys.add(key);
		}
		for (const [, keys] of change.overrides) {
			for (const key of keys) {
				this.affectedKeys.add(key);
			}
		}

		// Example: '\nfoo.bar\nabc.def\n'
		this._affectsConfigStr = this._marker;
		for (const key of this.affectedKeys) {
			this._affectsConfigStr += key + this._marker;
		}
	}

	private _previousConfiguration: Configuration | undefined = undefined;
	get previousConfiguration(): Configuration | undefined {
		if (!this._previousConfiguration && this.previous) {
			this._previousConfiguration = Configuration.parse(this.previous.data, this.logService);
		}
		return this._previousConfiguration;
	}

	affectsConfiguration(section: string, overrides?: IConfigurationOverrides): boolean {
		// we have one large string with all keys that have changed. we pad (marker) the section
		// and check that either find it padded or before a segment character
		const needle = this._marker + section;
		const idx = this._affectsConfigStr.indexOf(needle);
		if (idx < 0) {
			// NOT: (marker + section)
			return false;
		}
		const pos = idx + needle.length;
		if (pos >= this._affectsConfigStr.length) {
			return false;
		}
		const code = this._affectsConfigStr.charCodeAt(pos);
		if (code !== this._markerCode1 && code !== this._markerCode2) {
			// NOT: section + (marker | segment)
			return false;
		}
		if (overrides) {
			const value1 = this.previousConfiguration ? this.previousConfiguration.getValue(section, overrides, this.previous?.workspace) : undefined;
			const value2 = this.currentConfiguraiton.getValue(section, overrides, this.currentWorkspace);
			return !objects.equals(value1, value2);
		}
		return true;
	}
}
