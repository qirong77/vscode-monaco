
import { IStringDictionary } from '../../../base/common/collections.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { ConfigurationModel } from './configurationModels.js';
import { Extensions, IConfigurationRegistry, IRegisteredConfigurationPropertySchema } from './configurationRegistry.js';
import { ILogService } from '../../log/common/log.js';
import { Registry } from '../../registry/common/platform.js';

export class DefaultConfiguration extends Disposable {

	private _configurationModel = ConfigurationModel.createEmptyModel(this.logService);
	get configurationModel(): ConfigurationModel {
		return this._configurationModel;
	}

	constructor(private readonly logService: ILogService) {
		super();
	}

	reload(): ConfigurationModel {
		this.resetConfigurationModel();
		return this.configurationModel;
	}

	protected getConfigurationDefaultOverrides(): IStringDictionary<any> {
		return {};
	}

	private resetConfigurationModel(): void {
		this._configurationModel = ConfigurationModel.createEmptyModel(this.logService);
		const properties = Registry.as<IConfigurationRegistry>(Extensions.Configuration).getConfigurationProperties();
		this.updateConfigurationModel(Object.keys(properties), properties);
	}

	private updateConfigurationModel(properties: string[], configurationProperties: IStringDictionary<IRegisteredConfigurationPropertySchema>): void {
		const configurationDefaultsOverrides = this.getConfigurationDefaultOverrides();
		for (const key of properties) {
			const defaultOverrideValue = configurationDefaultsOverrides[key];
			const propertySchema = configurationProperties[key];
			if (defaultOverrideValue !== undefined) {
				this._configurationModel.setValue(key, defaultOverrideValue);
			} else if (propertySchema) {
				this._configurationModel.setValue(key, propertySchema.default);
			} else {
				this._configurationModel.removeValue(key);
			}
		}
	}

}
