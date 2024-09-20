
import { createDecorator } from '../../instantiation/common/instantiation.js';

export const IEnvironmentService = createDecorator<IEnvironmentService>('environmentService');

/**
 * A basic environment service that can be used in various processes,
 * such as main, renderer and shared process. Use subclasses of this
 * service for specific environment.
 */
export interface IEnvironmentService {

	readonly _serviceBrand: undefined;
	isExtensionDevelopment: boolean;
	isBuilt: boolean;

	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	//
	// NOTE: KEEP THIS INTERFACE AS SMALL AS POSSIBLE.
	//
	// AS SUCH:
	//   - PUT NON-WEB PROPERTIES INTO NATIVE ENVIRONMENT SERVICE
	//   - PUT WORKBENCH ONLY PROPERTIES INTO WORKBENCH ENVIRONMENT SERVICE
	//   - PUT ELECTRON-MAIN ONLY PROPERTIES INTO MAIN ENVIRONMENT SERVICE
	//
	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
}
