
import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../base/common/lifecycle.js';
import { RawContextKey } from '../../contextkey/common/contextkey.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export const ILogService = createDecorator<ILogService>('logService');

export enum LogLevel {
	Off,
	Trace,
	Debug,
	Info,
	Warning,
	Error
}

export const DEFAULT_LOG_LEVEL: LogLevel = LogLevel.Info;

export interface ILogger extends IDisposable {
	onDidChangeLogLevel: Event<LogLevel>;
	getLevel(): LogLevel;
	setLevel(level: LogLevel): void;

	trace(message: string, ...args: any[]): void;
	debug(message: string, ...args: any[]): void;
	info(message: string, ...args: any[]): void;
	warn(message: string, ...args: any[]): void;
	error(message: string | Error, ...args: any[]): void;
}

export interface ILogService extends ILogger {
	readonly _serviceBrand: undefined;
}

export abstract class AbstractLogger extends Disposable implements ILogger {

	private level: LogLevel = DEFAULT_LOG_LEVEL;
	private readonly _onDidChangeLogLevel: Emitter<LogLevel> = this._register(new Emitter<LogLevel>());
	readonly onDidChangeLogLevel: Event<LogLevel> = this._onDidChangeLogLevel.event;

	setLevel(level: LogLevel): void {
		if (this.level !== level) {
			this.level = level;
			this._onDidChangeLogLevel.fire(this.level);
		}
	}

	getLevel(): LogLevel {
		return this.level;
	}

	protected checkLogLevel(level: LogLevel): boolean {
		return this.level !== LogLevel.Off && this.level <= level;
	}

	abstract trace(message: string, ...args: any[]): void;
	abstract debug(message: string, ...args: any[]): void;
	abstract info(message: string, ...args: any[]): void;
	abstract warn(message: string, ...args: any[]): void;
	abstract error(message: string | Error, ...args: any[]): void;
}

export class ConsoleLogger extends AbstractLogger implements ILogger {

	constructor(logLevel: LogLevel = DEFAULT_LOG_LEVEL, private readonly useColors: boolean = true) {
		super();
		this.setLevel(logLevel);
	}

	trace(message: string, ...args: any[]): void {
		if (this.checkLogLevel(LogLevel.Trace)) {
			if (this.useColors) {
				console.log('%cTRACE', 'color: #888', message, ...args);
			} else {
				console.log(message, ...args);
			}
		}
	}

	debug(message: string, ...args: any[]): void {
		if (this.checkLogLevel(LogLevel.Debug)) {
			if (this.useColors) {
				console.log('%cDEBUG', 'background: #eee; color: #888', message, ...args);
			} else {
				console.log(message, ...args);
			}
		}
	}

	info(message: string, ...args: any[]): void {
		if (this.checkLogLevel(LogLevel.Info)) {
			if (this.useColors) {
				console.log('%c INFO', 'color: #33f', message, ...args);
			} else {
				console.log(message, ...args);
			}
		}
	}

	warn(message: string | Error, ...args: any[]): void {
		if (this.checkLogLevel(LogLevel.Warning)) {
			if (this.useColors) {
				console.log('%c WARN', 'color: #993', message, ...args);
			} else {
				console.log(message, ...args);
			}
		}
	}

	error(message: string, ...args: any[]): void {
		if (this.checkLogLevel(LogLevel.Error)) {
			if (this.useColors) {
				console.log('%c  ERR', 'color: #f33', message, ...args);
			} else {
				console.error(message, ...args);
			}
		}
	}
}

export class MultiplexLogger extends AbstractLogger implements ILogger {

	constructor(private readonly loggers: ReadonlyArray<ILogger>) {
		super();
		if (loggers.length) {
			this.setLevel(loggers[0].getLevel());
		}
	}

	override setLevel(level: LogLevel): void {
		for (const logger of this.loggers) {
			logger.setLevel(level);
		}
		super.setLevel(level);
	}

	trace(message: string, ...args: any[]): void {
		for (const logger of this.loggers) {
			logger.trace(message, ...args);
		}
	}

	debug(message: string, ...args: any[]): void {
		for (const logger of this.loggers) {
			logger.debug(message, ...args);
		}
	}

	info(message: string, ...args: any[]): void {
		for (const logger of this.loggers) {
			logger.info(message, ...args);
		}
	}

	warn(message: string, ...args: any[]): void {
		for (const logger of this.loggers) {
			logger.warn(message, ...args);
		}
	}

	error(message: string | Error, ...args: any[]): void {
		for (const logger of this.loggers) {
			logger.error(message, ...args);
		}
	}

	override dispose(): void {
		for (const logger of this.loggers) {
			logger.dispose();
		}
		super.dispose();
	}
}

export function LogLevelToString(logLevel: LogLevel): string {
	switch (logLevel) {
		case LogLevel.Trace: return 'trace';
		case LogLevel.Debug: return 'debug';
		case LogLevel.Info: return 'info';
		case LogLevel.Warning: return 'warn';
		case LogLevel.Error: return 'error';
		case LogLevel.Off: return 'off';
	}
}

// Contexts
export const CONTEXT_LOG_LEVEL = new RawContextKey<string>('logLevel', LogLevelToString(LogLevel.Info));
