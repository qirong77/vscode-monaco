
import { URI } from '../../../base/common/uri.js';
import { IPosition } from '../core/position.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';

export const ITextResourceConfigurationService = createDecorator<ITextResourceConfigurationService>('textResourceConfigurationService');

export interface ITextResourceConfigurationChangeEvent {

	/**
	 * All affected keys. Also includes language overrides and keys changed under language overrides.
	 */
	readonly affectedKeys: ReadonlySet<string>;

	/**
	 * Returns `true` if the given section has changed for the given resource.
	 *
	 * Example: To check if the configuration section has changed for a given resource use `e.affectsConfiguration(resource, section)`.
	 *
	 * @param resource Resource for which the configuration has to be checked.
	 * @param section Section of the configuration
	 */
	affectsConfiguration(resource: URI | undefined, section: string): boolean;
}

export interface ITextResourceConfigurationService {

	readonly _serviceBrand: undefined;

	/**
	 * Fetches the value of the section for the given resource by applying language overrides.
	 * Value can be of native type or an object keyed off the section name.
	 *
	 * @param resource - Resource for which the configuration has to be fetched.
	 * @param position - Position in the resource for which configuration has to be fetched.
	 * @param section - Section of the configuration.
	 *
	 */
	getValue<T>(resource: URI | undefined, section?: string): T;
	getValue<T>(resource: URI | undefined, position?: IPosition, section?: string): T;

}

export const ITextResourcePropertiesService = createDecorator<ITextResourcePropertiesService>('textResourcePropertiesService');

export interface ITextResourcePropertiesService {

	readonly _serviceBrand: undefined;

	/**
	 * Returns the End of Line characters for the given resource
	 */
	getEOL(resource: URI, language?: string): string;
}
