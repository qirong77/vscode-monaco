/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { distinct } from '../../../base/common/arrays.js';
import { IStringDictionary } from '../../../base/common/collections.js';
import { Emitter } from '../../../base/common/event.js';
import { IJSONSchema } from '../../../base/common/jsonSchema.js';
import * as types from '../../../base/common/types.js';
import * as nls from '../../../nls.js';
import { getLanguageTagSettingPlainKey } from './configuration.js';
import { Extensions as JSONExtensions, IJSONContributionRegistry } from '../../jsonschemas/common/jsonContributionRegistry.js';
import { PolicyName } from '../../policy/common/policy.js';
import { Registry } from '../../registry/common/platform.js';

export const Extensions = {
	Configuration: 'base.contributions.configuration'
};

export interface IConfigurationRegistry {

	/**
	 * Register a configuration to the registry.
	 */
	registerConfiguration(configuration: IConfigurationNode): void;

	/**
	 * Register multiple default configurations to the registry.
	 */
	registerDefaultConfigurations(defaultConfigurations: IConfigurationDefaults[]): void;

	/**
	 * Returns all configurations settings of all configuration nodes contributed to this registry.
	 */
	getConfigurationProperties(): IStringDictionary<IRegisteredConfigurationPropertySchema>;

	/**
	 * Register the identifiers for editor configurations
	 */
	registerOverrideIdentifiers(identifiers: string[]): void;
}

export const enum ConfigurationScope {
	/**
	 * Application specific configuration, which can be configured only in local user settings.
	 */
	APPLICATION = 1,
	/**
	 * Machine specific configuration, which can be configured only in local and remote user settings.
	 */
	MACHINE,
	/**
	 * Window specific configuration, which can be configured in the user or workspace settings.
	 */
	WINDOW,
	/**
	 * Resource specific configuration, which can be configured in the user, workspace or folder settings.
	 */
	RESOURCE,
	/**
	 * Resource specific configuration that can be configured in language specific settings
	 */
	LANGUAGE_OVERRIDABLE,
	/**
	 * Machine specific configuration that can also be configured in workspace or folder settings.
	 */
	MACHINE_OVERRIDABLE,
}

export interface IPolicy {

	/**
	 * The policy name.
	 */
	readonly name: PolicyName;
}

export interface IConfigurationPropertySchema extends IJSONSchema {

	scope?: ConfigurationScope;

	/**
	 * When restricted, value of this configuration will be read only from trusted sources.
	 * For eg., If the workspace is not trusted, then the value of this configuration is not read from workspace settings file.
	 */
	restricted?: boolean;

	/**
	 * When `false` this property is excluded from the registry. Default is to include.
	 */
	included?: boolean;

	/**
	 * List of tags associated to the property.
	 *  - A tag can be used for filtering
	 *  - Use `experimental` tag for marking the setting as experimental. **Note:** Defaults of experimental settings can be changed by the running experiments.
	 */
	tags?: string[];

	/**
	 * Disallow extensions to contribute configuration default value for this setting.
	 */
	disallowConfigurationDefault?: boolean;

	/**
	 * When specified, this setting's value can always be overwritten by
	 * a system-wide policy.
	 */
	policy?: IPolicy;
}

export interface IExtensionInfo {
}

export interface IConfigurationNode {
	id?: string;
	order?: number;
	type?: string | string[];
	title?: string;
	properties?: IStringDictionary<IConfigurationPropertySchema>;
	allOf?: IConfigurationNode[];
	scope?: ConfigurationScope;
	extensionInfo?: IExtensionInfo;
	restrictedProperties?: string[];
}

export type ConfigurationDefaultValueSource = IExtensionInfo | Map<string, IExtensionInfo>;

export interface IConfigurationDefaults {
	overrides: IStringDictionary<any>;
	source?: IExtensionInfo;
}

export type IRegisteredConfigurationPropertySchema = IConfigurationPropertySchema & {
	defaultDefaultValue?: any;
	source?: IExtensionInfo; // Source of the Property
	defaultValueSource?: ConfigurationDefaultValueSource; // Source of the Default Value
};

export interface IConfigurationDefaultOverride {
	readonly value: any;
	readonly source?: IExtensionInfo;  // Source of the default override
}

export interface IConfigurationDefaultOverrideValue {
	readonly value: any;
	readonly source?: ConfigurationDefaultValueSource;
}

export const allSettings: { properties: IStringDictionary<IConfigurationPropertySchema>; patternProperties: IStringDictionary<IConfigurationPropertySchema> } = { properties: {}, patternProperties: {} };
export const applicationSettings: { properties: IStringDictionary<IConfigurationPropertySchema>; patternProperties: IStringDictionary<IConfigurationPropertySchema> } = { properties: {}, patternProperties: {} };
export const machineSettings: { properties: IStringDictionary<IConfigurationPropertySchema>; patternProperties: IStringDictionary<IConfigurationPropertySchema> } = { properties: {}, patternProperties: {} };
export const machineOverridableSettings: { properties: IStringDictionary<IConfigurationPropertySchema>; patternProperties: IStringDictionary<IConfigurationPropertySchema> } = { properties: {}, patternProperties: {} };
export const windowSettings: { properties: IStringDictionary<IConfigurationPropertySchema>; patternProperties: IStringDictionary<IConfigurationPropertySchema> } = { properties: {}, patternProperties: {} };
export const resourceSettings: { properties: IStringDictionary<IConfigurationPropertySchema>; patternProperties: IStringDictionary<IConfigurationPropertySchema> } = { properties: {}, patternProperties: {} };

export const resourceLanguageSettingsSchemaId = 'vscode://schemas/settings/resourceLanguage';

const contributionRegistry = Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);

class ConfigurationRegistry implements IConfigurationRegistry {

	private readonly registeredConfigurationDefaults: IConfigurationDefaults[] = [];
	private readonly configurationDefaultsOverrides: Map<string, { configurationDefaultOverrides: IConfigurationDefaultOverride[]; configurationDefaultOverrideValue?: IConfigurationDefaultOverrideValue }>;
	private readonly defaultLanguageConfigurationOverridesNode: IConfigurationNode;
	private readonly configurationContributors: IConfigurationNode[];
	private readonly configurationProperties: IStringDictionary<IRegisteredConfigurationPropertySchema>;
	private readonly policyConfigurations: Map<PolicyName, string>;
	private readonly excludedConfigurationProperties: IStringDictionary<IRegisteredConfigurationPropertySchema>;
	private readonly resourceLanguageSettingsSchema: IJSONSchema;
	private readonly overrideIdentifiers = new Set<string>();

	private readonly _onDidSchemaChange = new Emitter<void>();

	private readonly _onDidUpdateConfiguration = new Emitter<{ properties: ReadonlySet<string>; defaultsOverrides?: boolean }>();

	constructor() {
		this.configurationDefaultsOverrides = new Map();
		this.defaultLanguageConfigurationOverridesNode = {
			id: 'defaultOverrides',
			title: nls.localize('defaultLanguageConfigurationOverrides.title', "Default Language Configuration Overrides"),
			properties: {}
		};
		this.configurationContributors = [this.defaultLanguageConfigurationOverridesNode];
		this.resourceLanguageSettingsSchema = {
			properties: {},
			patternProperties: {},
			additionalProperties: true,
			allowTrailingCommas: true,
			allowComments: true
		};
		this.configurationProperties = {};
		this.policyConfigurations = new Map<PolicyName, string>();
		this.excludedConfigurationProperties = {};

		contributionRegistry.registerSchema(resourceLanguageSettingsSchemaId, this.resourceLanguageSettingsSchema);
		this.registerOverridePropertyPatternKey();
	}

	public registerConfiguration(configuration: IConfigurationNode, validate: boolean = true): void {
		this.registerConfigurations([configuration], validate);
	}

	public registerConfigurations(configurations: IConfigurationNode[], validate: boolean = true): void {
		const properties = new Set<string>();
		this.doRegisterConfigurations(configurations, validate, properties);

		contributionRegistry.registerSchema(resourceLanguageSettingsSchemaId, this.resourceLanguageSettingsSchema);
		this._onDidSchemaChange.fire();
		this._onDidUpdateConfiguration.fire({ properties });
	}

	public registerDefaultConfigurations(configurationDefaults: IConfigurationDefaults[]): void {
		const properties = new Set<string>();
		this.doRegisterDefaultConfigurations(configurationDefaults, properties);
		this._onDidSchemaChange.fire();
		this._onDidUpdateConfiguration.fire({ properties, defaultsOverrides: true });
	}

	private doRegisterDefaultConfigurations(configurationDefaults: IConfigurationDefaults[], bucket: Set<string>) {

		this.registeredConfigurationDefaults.push(...configurationDefaults);

		const overrideIdentifiers: string[] = [];

		for (const { overrides, source } of configurationDefaults) {
			for (const key in overrides) {
				bucket.add(key);

				const configurationDefaultOverridesForKey = this.configurationDefaultsOverrides.get(key)
					?? this.configurationDefaultsOverrides.set(key, { configurationDefaultOverrides: [] }).get(key)!;

				const value = overrides[key];
				configurationDefaultOverridesForKey.configurationDefaultOverrides.push({ value, source });

				// Configuration defaults for Override Identifiers
				if (OVERRIDE_PROPERTY_REGEX.test(key)) {
					const newDefaultOverride = this.mergeDefaultConfigurationsForOverrideIdentifier(key, value, source, configurationDefaultOverridesForKey.configurationDefaultOverrideValue);
					if (!newDefaultOverride) {
						continue;
					}

					configurationDefaultOverridesForKey.configurationDefaultOverrideValue = newDefaultOverride;
					this.updateDefaultOverrideProperty(key, newDefaultOverride, source);
					overrideIdentifiers.push(...overrideIdentifiersFromKey(key));
				}

				// Configuration defaults for Configuration Properties
				else {
					const newDefaultOverride = this.mergeDefaultConfigurationsForConfigurationProperty(key, value, source, configurationDefaultOverridesForKey.configurationDefaultOverrideValue);
					if (!newDefaultOverride) {
						continue;
					}

					configurationDefaultOverridesForKey.configurationDefaultOverrideValue = newDefaultOverride;
					const property = this.configurationProperties[key];
					if (property) {
						this.updatePropertyDefaultValue(key, property);
						this.updateSchema(key, property);
					}
				}

			}
		}

		this.doRegisterOverrideIdentifiers(overrideIdentifiers);
	}

	private updateDefaultOverrideProperty(key: string, newDefaultOverride: IConfigurationDefaultOverrideValue, source: IExtensionInfo | undefined): void {
		const property: IRegisteredConfigurationPropertySchema = {
			type: 'object',
			default: newDefaultOverride.value,
			description: nls.localize('defaultLanguageConfiguration.description', "Configure settings to be overridden for the {0} language.", getLanguageTagSettingPlainKey(key)),
			$ref: resourceLanguageSettingsSchemaId,
			defaultDefaultValue: newDefaultOverride.value,
			source,
			defaultValueSource: source
		};
		this.configurationProperties[key] = property;
		this.defaultLanguageConfigurationOverridesNode.properties![key] = property;
	}

	private mergeDefaultConfigurationsForOverrideIdentifier(overrideIdentifier: string, configurationValueObject: IStringDictionary<any>, valueSource: IExtensionInfo | undefined, existingDefaultOverride: IConfigurationDefaultOverrideValue | undefined): IConfigurationDefaultOverrideValue | undefined {
		const defaultValue = existingDefaultOverride?.value || {};
		const source = existingDefaultOverride?.source ?? new Map<string, IExtensionInfo>();

		// This should not happen
		if (!(source instanceof Map)) {
			console.error('objectConfigurationSources is not a Map');
			return undefined;
		}

		for (const propertyKey of Object.keys(configurationValueObject)) {
			const propertyDefaultValue = configurationValueObject[propertyKey];

			const isObjectSetting = types.isObject(propertyDefaultValue) &&
				(types.isUndefined(defaultValue[propertyKey]) || types.isObject(defaultValue[propertyKey]));

			// If the default value is an object, merge the objects and store the source of each keys
			if (isObjectSetting) {
				defaultValue[propertyKey] = { ...(defaultValue[propertyKey] ?? {}), ...propertyDefaultValue };
				// Track the source of each value in the object
				if (valueSource) {
					for (const objectKey in propertyDefaultValue) {
						source.set(`${propertyKey}.${objectKey}`, valueSource);
					}
				}
			}

			// Primitive values are overridden
			else {
				defaultValue[propertyKey] = propertyDefaultValue;
				if (valueSource) {
					source.set(propertyKey, valueSource);
				} else {
					source.delete(propertyKey);
				}
			}
		}

		return { value: defaultValue, source };
	}

	private mergeDefaultConfigurationsForConfigurationProperty(propertyKey: string, value: any, valuesSource: IExtensionInfo | undefined, existingDefaultOverride: IConfigurationDefaultOverrideValue | undefined): IConfigurationDefaultOverrideValue | undefined {
		const property = this.configurationProperties[propertyKey];
		const existingDefaultValue = existingDefaultOverride?.value ?? property?.defaultDefaultValue;
		let source: ConfigurationDefaultValueSource | undefined = valuesSource;

		const isObjectSetting = types.isObject(value) &&
			(
				property !== undefined && property.type === 'object' ||
				property === undefined && (types.isUndefined(existingDefaultValue) || types.isObject(existingDefaultValue))
			);

		// If the default value is an object, merge the objects and store the source of each keys
		if (isObjectSetting) {
			source = existingDefaultOverride?.source ?? new Map<string, IExtensionInfo>();

			// This should not happen
			if (!(source instanceof Map)) {
				console.error('defaultValueSource is not a Map');
				return undefined;
			}

			for (const objectKey in value) {
				if (valuesSource) {
					source.set(`${propertyKey}.${objectKey}`, valuesSource);
				}
			}
			value = { ...(types.isObject(existingDefaultValue) ? existingDefaultValue : {}), ...value };
		}

		return { value, source };
	}

	public registerOverrideIdentifiers(overrideIdentifiers: string[]): void {
		this.doRegisterOverrideIdentifiers(overrideIdentifiers);
		this._onDidSchemaChange.fire();
	}

	private doRegisterOverrideIdentifiers(overrideIdentifiers: string[]) {
		for (const overrideIdentifier of overrideIdentifiers) {
			this.overrideIdentifiers.add(overrideIdentifier);
		}
		this.updateOverridePropertyPatternKey();
	}

	private doRegisterConfigurations(configurations: IConfigurationNode[], validate: boolean, bucket: Set<string>): void {

		configurations.forEach(configuration => {

			this.validateAndRegisterProperties(configuration, validate, configuration.extensionInfo, configuration.restrictedProperties, undefined, bucket);

			this.configurationContributors.push(configuration);
			this.registerJSONConfiguration(configuration);
		});
	}

	private validateAndRegisterProperties(configuration: IConfigurationNode, validate: boolean = true, extensionInfo: IExtensionInfo | undefined, restrictedProperties: string[] | undefined, scope: ConfigurationScope = ConfigurationScope.WINDOW, bucket: Set<string>): void {
		scope = types.isUndefinedOrNull(configuration.scope) ? scope : configuration.scope;
		const properties = configuration.properties;
		if (properties) {
			for (const key in properties) {
				const property: IRegisteredConfigurationPropertySchema = properties[key];
				if (validate && validateProperty(key, property)) {
					delete properties[key];
					continue;
				}

				property.source = extensionInfo;

				// update default value
				property.defaultDefaultValue = properties[key].default;
				this.updatePropertyDefaultValue(key, property);

				// update scope
				if (OVERRIDE_PROPERTY_REGEX.test(key)) {
					property.scope = undefined; // No scope for overridable properties `[${identifier}]`
				} else {
					property.scope = types.isUndefinedOrNull(property.scope) ? scope : property.scope;
					property.restricted = types.isUndefinedOrNull(property.restricted) ? !!restrictedProperties?.includes(key) : property.restricted;
				}

				// Add to properties maps
				// Property is included by default if 'included' is unspecified
				if (properties[key].hasOwnProperty('included') && !properties[key].included) {
					this.excludedConfigurationProperties[key] = properties[key];
					delete properties[key];
					continue;
				} else {
					this.configurationProperties[key] = properties[key];
					if (properties[key].policy?.name) {
						this.policyConfigurations.set(properties[key].policy!.name, key);
					}
				}

				if (!properties[key].deprecationMessage && properties[key].markdownDeprecationMessage) {
					// If not set, default deprecationMessage to the markdown source
					properties[key].deprecationMessage = properties[key].markdownDeprecationMessage;
				}

				bucket.add(key);
			}
		}
		const subNodes = configuration.allOf;
		if (subNodes) {
			for (const node of subNodes) {
				this.validateAndRegisterProperties(node, validate, extensionInfo, restrictedProperties, scope, bucket);
			}
		}
	}

	getConfigurationProperties(): IStringDictionary<IRegisteredConfigurationPropertySchema> {
		return this.configurationProperties;
	}

	getPolicyConfigurations(): Map<PolicyName, string> {
		return this.policyConfigurations;
	}

	private registerJSONConfiguration(configuration: IConfigurationNode) {
		const register = (configuration: IConfigurationNode) => {
			const properties = configuration.properties;
			if (properties) {
				for (const key in properties) {
					this.updateSchema(key, properties[key]);
				}
			}
			const subNodes = configuration.allOf;
			subNodes?.forEach(register);
		};
		register(configuration);
	}

	private updateSchema(key: string, property: IConfigurationPropertySchema): void {
		allSettings.properties[key] = property;
		switch (property.scope) {
			case ConfigurationScope.APPLICATION:
				applicationSettings.properties[key] = property;
				break;
			case ConfigurationScope.MACHINE:
				machineSettings.properties[key] = property;
				break;
			case ConfigurationScope.MACHINE_OVERRIDABLE:
				machineOverridableSettings.properties[key] = property;
				break;
			case ConfigurationScope.WINDOW:
				windowSettings.properties[key] = property;
				break;
			case ConfigurationScope.RESOURCE:
				resourceSettings.properties[key] = property;
				break;
			case ConfigurationScope.LANGUAGE_OVERRIDABLE:
				resourceSettings.properties[key] = property;
				this.resourceLanguageSettingsSchema.properties![key] = property;
				break;
		}
	}

	private updateOverridePropertyPatternKey(): void {
		for (const overrideIdentifier of this.overrideIdentifiers.values()) {
			const overrideIdentifierProperty = `[${overrideIdentifier}]`;
			const resourceLanguagePropertiesSchema: IJSONSchema = {
				type: 'object',
				description: nls.localize('overrideSettings.defaultDescription', "Configure editor settings to be overridden for a language."),
				errorMessage: nls.localize('overrideSettings.errorMessage', "This setting does not support per-language configuration."),
				$ref: resourceLanguageSettingsSchemaId,
			};
			this.updatePropertyDefaultValue(overrideIdentifierProperty, resourceLanguagePropertiesSchema);
			allSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
			applicationSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
			machineSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
			machineOverridableSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
			windowSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
			resourceSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
		}
	}

	private registerOverridePropertyPatternKey(): void {
		const resourceLanguagePropertiesSchema: IJSONSchema = {
			type: 'object',
			description: nls.localize('overrideSettings.defaultDescription', "Configure editor settings to be overridden for a language."),
			errorMessage: nls.localize('overrideSettings.errorMessage', "This setting does not support per-language configuration."),
			$ref: resourceLanguageSettingsSchemaId,
		};
		allSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
		applicationSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
		machineSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
		machineOverridableSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
		windowSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
		resourceSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
		this._onDidSchemaChange.fire();
	}

	private updatePropertyDefaultValue(key: string, property: IRegisteredConfigurationPropertySchema): void {
		const configurationdefaultOverride = this.configurationDefaultsOverrides.get(key)?.configurationDefaultOverrideValue;
		let defaultValue = undefined;
		let defaultSource = undefined;
		if (configurationdefaultOverride
			&& (!property.disallowConfigurationDefault || !configurationdefaultOverride.source) // Prevent overriding the default value if the property is disallowed to be overridden by configuration defaults from extensions
		) {
			defaultValue = configurationdefaultOverride.value;
			defaultSource = configurationdefaultOverride.source;
		}
		if (types.isUndefined(defaultValue)) {
			defaultValue = property.defaultDefaultValue;
			defaultSource = undefined;
		}
		if (types.isUndefined(defaultValue)) {
			defaultValue = getDefaultValue(property.type);
		}
		property.default = defaultValue;
		property.defaultValueSource = defaultSource;
	}
}

const OVERRIDE_IDENTIFIER_PATTERN = `\\[([^\\]]+)\\]`;
const OVERRIDE_IDENTIFIER_REGEX = new RegExp(OVERRIDE_IDENTIFIER_PATTERN, 'g');
export const OVERRIDE_PROPERTY_PATTERN = `^(${OVERRIDE_IDENTIFIER_PATTERN})+$`;
export const OVERRIDE_PROPERTY_REGEX = new RegExp(OVERRIDE_PROPERTY_PATTERN);

export function overrideIdentifiersFromKey(key: string): string[] {
	const identifiers: string[] = [];
	if (OVERRIDE_PROPERTY_REGEX.test(key)) {
		let matches = OVERRIDE_IDENTIFIER_REGEX.exec(key);
		while (matches?.length) {
			const identifier = matches[1].trim();
			if (identifier) {
				identifiers.push(identifier);
			}
			matches = OVERRIDE_IDENTIFIER_REGEX.exec(key);
		}
	}
	return distinct(identifiers);
}

export function getDefaultValue(type: string | string[] | undefined) {
	const t = Array.isArray(type) ? (<string[]>type)[0] : <string>type;
	switch (t) {
		case 'boolean':
			return false;
		case 'integer':
		case 'number':
			return 0;
		case 'string':
			return '';
		case 'array':
			return [];
		case 'object':
			return {};
		default:
			return null;
	}
}

const configurationRegistry = new ConfigurationRegistry();
Registry.add(Extensions.Configuration, configurationRegistry);

export function validateProperty(property: string, schema: IRegisteredConfigurationPropertySchema): string | null {
	if (!property.trim()) {
		return nls.localize('config.property.empty', "Cannot register an empty property");
	}
	if (OVERRIDE_PROPERTY_REGEX.test(property)) {
		return nls.localize('config.property.languageDefault', "Cannot register '{0}'. This matches property pattern '\\\\[.*\\\\]$' for describing language specific editor settings. Use 'configurationDefaults' contribution.", property);
	}
	if (configurationRegistry.getConfigurationProperties()[property] !== undefined) {
		return nls.localize('config.property.duplicate', "Cannot register '{0}'. This property is already registered.", property);
	}
	if (schema.policy?.name && configurationRegistry.getPolicyConfigurations().get(schema.policy?.name) !== undefined) {
		return nls.localize('config.policy.duplicate', "Cannot register '{0}'. The associated policy {1} is already registered with {2}.", property, schema.policy?.name, configurationRegistry.getPolicyConfigurations().get(schema.policy?.name));
	}
	return null;
}
