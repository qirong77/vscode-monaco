
import { URI } from '../../../base/common/uri.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export const ILabelService = createDecorator<ILabelService>('labelService');

export interface ILabelService {

	readonly _serviceBrand: undefined;

	/**
	 * Gets the human readable label for a uri.
	 * If `relative` is passed returns a label relative to the workspace root that the uri belongs to.
	 * If `noPrefix` is passed does not tildify the label and also does not prepand the root name for relative labels in a multi root scenario.
	 * If `separator` is passed, will use that over the defined path separator of the formatter.
	 */
	getUriLabel(resource: URI, options?: { relative?: boolean; noPrefix?: boolean; separator?: '/' | '\\' }): string;
	getUriBasenameLabel(resource: URI): string;
}
