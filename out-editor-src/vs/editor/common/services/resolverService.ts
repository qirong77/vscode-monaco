
import { IReference } from '../../../base/common/lifecycle.js';
import { URI } from '../../../base/common/uri.js';
import { ITextModel } from '../model.js';
import { IResolvableEditorModel } from '../../../platform/editor/common/editor.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';

export const ITextModelService = createDecorator<ITextModelService>('textModelService');

export interface ITextModelService {
	readonly _serviceBrand: undefined;

	/**
	 * Provided a resource URI, it will return a model reference
	 * which should be disposed once not needed anymore.
	 */
	createModelReference(resource: URI): Promise<IReference<IResolvedTextEditorModel>>;
}

export interface ITextEditorModel extends IResolvableEditorModel {

	/**
	 * Provides access to the underlying `ITextModel`.
	 */
	readonly textEditorModel: ITextModel | null;
}

export interface IResolvedTextEditorModel extends ITextEditorModel {

	/**
	 * Same as ITextEditorModel#textEditorModel, but never null.
	 */
	readonly textEditorModel: ITextModel;
}
