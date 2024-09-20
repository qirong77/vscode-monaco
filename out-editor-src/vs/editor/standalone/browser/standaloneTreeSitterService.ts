
import { ITextModel } from '../../common/model.js';
import { ITreeSitterParseResult, ITreeSitterParserService } from '../../common/services/treeSitterParserService.js';

/**
 * The monaco build doesn't like the dynamic import of tree sitter in the real service.
 * We use a dummy sertive here to make the build happy.
 */
export class StandaloneTreeSitterParserService implements ITreeSitterParserService {
	readonly _serviceBrand: undefined;
	getParseResult(textModel: ITextModel): ITreeSitterParseResult | undefined {
		return undefined;
	}
}
