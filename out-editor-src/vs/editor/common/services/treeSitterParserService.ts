
import { ITextModel } from '../model.js';
import { createDecorator } from '../../../platform/instantiation/common/instantiation.js';

export const ITreeSitterParserService = createDecorator<ITreeSitterParserService>('treeSitterParserService');

export interface ITreeSitterParserService {
	readonly _serviceBrand: undefined;
	getParseResult(textModel: ITextModel): ITreeSitterParseResult | undefined;
}

export interface ITreeSitterParseResult {
}
