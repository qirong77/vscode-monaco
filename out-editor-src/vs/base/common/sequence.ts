

export interface ISpliceable<T> {
	splice(start: number, deleteCount: number, toInsert: readonly T[]): void;
}
