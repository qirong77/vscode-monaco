
import { localize } from '../../../nls.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export const IAccessibilitySignalService = createDecorator<IAccessibilitySignalService>('accessibilitySignalService');

export interface IAccessibilitySignalService {
	readonly _serviceBrand: undefined;
	playSignal(signal: AccessibilitySignal, options?: IAccessbilitySignalOptions): Promise<void>;
}

/** Make sure you understand the doc comments of the method you want to call when using this token! */
export const AcknowledgeDocCommentsToken = Symbol('AcknowledgeDocCommentsToken');

export interface IAccessbilitySignalOptions {

	/**
	 * The source that triggered the signal (e.g. "diffEditor.cursorPositionChanged").
	 */
	source?: string;

	/**
	 * For actions like save or format, depending on the
	 * configured value, we will only
	 * play the sound if the user triggered the action.
	 */
	userGesture?: boolean;
}

/**
 * Corresponds to the audio files in ./media.
*/
export class Sound {
	private static register(options: { fileName: string }): Sound {
		const sound = new Sound(options.fileName);
		return sound;
	}

	public static readonly error = Sound.register({ fileName: 'error.mp3' });
	public static readonly warning = Sound.register({ fileName: 'warning.mp3' });
	public static readonly success = Sound.register({ fileName: 'success.mp3' });
	public static readonly foldedArea = Sound.register({ fileName: 'foldedAreas.mp3' });
	public static readonly break = Sound.register({ fileName: 'break.mp3' });
	public static readonly quickFixes = Sound.register({ fileName: 'quickFixes.mp3' });
	public static readonly taskCompleted = Sound.register({ fileName: 'taskCompleted.mp3' });
	public static readonly taskFailed = Sound.register({ fileName: 'taskFailed.mp3' });
	public static readonly terminalBell = Sound.register({ fileName: 'terminalBell.mp3' });
	public static readonly diffLineInserted = Sound.register({ fileName: 'diffLineInserted.mp3' });
	public static readonly diffLineDeleted = Sound.register({ fileName: 'diffLineDeleted.mp3' });
	public static readonly diffLineModified = Sound.register({ fileName: 'diffLineModified.mp3' });
	public static readonly chatRequestSent = Sound.register({ fileName: 'chatRequestSent.mp3' });
	public static readonly chatResponseReceived1 = Sound.register({ fileName: 'chatResponseReceived1.mp3' });
	public static readonly chatResponseReceived2 = Sound.register({ fileName: 'chatResponseReceived2.mp3' });
	public static readonly chatResponseReceived3 = Sound.register({ fileName: 'chatResponseReceived3.mp3' });
	public static readonly chatResponseReceived4 = Sound.register({ fileName: 'chatResponseReceived4.mp3' });
	public static readonly clear = Sound.register({ fileName: 'clear.mp3' });
	public static readonly save = Sound.register({ fileName: 'save.mp3' });
	public static readonly format = Sound.register({ fileName: 'format.mp3' });
	public static readonly voiceRecordingStarted = Sound.register({ fileName: 'voiceRecordingStarted.mp3' });
	public static readonly voiceRecordingStopped = Sound.register({ fileName: 'voiceRecordingStopped.mp3' });
	public static readonly progress = Sound.register({ fileName: 'progress.mp3' });

	private constructor(public readonly fileName: string) { }
}

export class SoundSource {
	constructor(
		public readonly randomOneOf: Sound[]
	) { }
}

export class AccessibilitySignal {
	private constructor(
		public readonly sound: SoundSource,
		public readonly name: string,
		public readonly legacySoundSettingsKey: string | undefined,
		public readonly settingsKey: string,
		public readonly legacyAnnouncementSettingsKey: string | undefined,
		public readonly announcementMessage: string | undefined
	) { }

	private static _signals = new Set<AccessibilitySignal>();
	private static register(options: {
		name: string;
		sound: Sound | {
			/**
			 * Gaming and other apps often play a sound variant when the same event happens again
			 * for an improved experience. This option enables playing a random sound.
			 */
			randomOneOf: Sound[];
		};
		legacySoundSettingsKey?: string;
		settingsKey: string;
		legacyAnnouncementSettingsKey?: string;
		announcementMessage?: string;
		delaySettingsKey?: string;
	}): AccessibilitySignal {
		const soundSource = new SoundSource('randomOneOf' in options.sound ? options.sound.randomOneOf : [options.sound]);
		const signal = new AccessibilitySignal(
			soundSource,
			options.name,
			options.legacySoundSettingsKey,
			options.settingsKey,
			options.legacyAnnouncementSettingsKey,
			options.announcementMessage,
		);
		AccessibilitySignal._signals.add(signal);
		return signal;
	}

	public static readonly errorAtPosition = AccessibilitySignal.register({
		name: localize('accessibilitySignals.positionHasError.name', 'Error at Position'),
		sound: Sound.error,
		announcementMessage: localize('accessibility.signals.positionHasError', 'Error'),
		settingsKey: 'accessibility.signals.positionHasError',
		delaySettingsKey: 'accessibility.signalOptions.delays.errorAtPosition'
	});
	public static readonly warningAtPosition = AccessibilitySignal.register({
		name: localize('accessibilitySignals.positionHasWarning.name', 'Warning at Position'),
		sound: Sound.warning,
		announcementMessage: localize('accessibility.signals.positionHasWarning', 'Warning'),
		settingsKey: 'accessibility.signals.positionHasWarning',
		delaySettingsKey: 'accessibility.signalOptions.delays.warningAtPosition'
	});

	public static readonly errorOnLine = AccessibilitySignal.register({
		name: localize('accessibilitySignals.lineHasError.name', 'Error on Line'),
		sound: Sound.error,
		legacySoundSettingsKey: 'audioCues.lineHasError',
		legacyAnnouncementSettingsKey: 'accessibility.alert.error',
		announcementMessage: localize('accessibility.signals.lineHasError', 'Error on Line'),
		settingsKey: 'accessibility.signals.lineHasError',
	});

	public static readonly warningOnLine = AccessibilitySignal.register({
		name: localize('accessibilitySignals.lineHasWarning.name', 'Warning on Line'),
		sound: Sound.warning,
		legacySoundSettingsKey: 'audioCues.lineHasWarning',
		legacyAnnouncementSettingsKey: 'accessibility.alert.warning',
		announcementMessage: localize('accessibility.signals.lineHasWarning', 'Warning on Line'),
		settingsKey: 'accessibility.signals.lineHasWarning',
	});
	public static readonly foldedArea = AccessibilitySignal.register({
		name: localize('accessibilitySignals.lineHasFoldedArea.name', 'Folded Area on Line'),
		sound: Sound.foldedArea,
		legacySoundSettingsKey: 'audioCues.lineHasFoldedArea',
		legacyAnnouncementSettingsKey: 'accessibility.alert.foldedArea',
		announcementMessage: localize('accessibility.signals.lineHasFoldedArea', 'Folded'),
		settingsKey: 'accessibility.signals.lineHasFoldedArea',
	});
	public static readonly break = AccessibilitySignal.register({
		name: localize('accessibilitySignals.lineHasBreakpoint.name', 'Breakpoint on Line'),
		sound: Sound.break,
		legacySoundSettingsKey: 'audioCues.lineHasBreakpoint',
		legacyAnnouncementSettingsKey: 'accessibility.alert.breakpoint',
		announcementMessage: localize('accessibility.signals.lineHasBreakpoint', 'Breakpoint'),
		settingsKey: 'accessibility.signals.lineHasBreakpoint',
	});
	public static readonly inlineSuggestion = AccessibilitySignal.register({
		name: localize('accessibilitySignals.lineHasInlineSuggestion.name', 'Inline Suggestion on Line'),
		sound: Sound.quickFixes,
		legacySoundSettingsKey: 'audioCues.lineHasInlineSuggestion',
		settingsKey: 'accessibility.signals.lineHasInlineSuggestion',
	});

	public static readonly terminalQuickFix = AccessibilitySignal.register({
		name: localize('accessibilitySignals.terminalQuickFix.name', 'Terminal Quick Fix'),
		sound: Sound.quickFixes,
		legacySoundSettingsKey: 'audioCues.terminalQuickFix',
		legacyAnnouncementSettingsKey: 'accessibility.alert.terminalQuickFix',
		announcementMessage: localize('accessibility.signals.terminalQuickFix', 'Quick Fix'),
		settingsKey: 'accessibility.signals.terminalQuickFix',
	});

	public static readonly onDebugBreak = AccessibilitySignal.register({
		name: localize('accessibilitySignals.onDebugBreak.name', 'Debugger Stopped on Breakpoint'),
		sound: Sound.break,
		legacySoundSettingsKey: 'audioCues.onDebugBreak',
		legacyAnnouncementSettingsKey: 'accessibility.alert.onDebugBreak',
		announcementMessage: localize('accessibility.signals.onDebugBreak', 'Breakpoint'),
		settingsKey: 'accessibility.signals.onDebugBreak',
	});

	public static readonly noInlayHints = AccessibilitySignal.register({
		name: localize('accessibilitySignals.noInlayHints', 'No Inlay Hints on Line'),
		sound: Sound.error,
		legacySoundSettingsKey: 'audioCues.noInlayHints',
		legacyAnnouncementSettingsKey: 'accessibility.alert.noInlayHints',
		announcementMessage: localize('accessibility.signals.noInlayHints', 'No Inlay Hints'),
		settingsKey: 'accessibility.signals.noInlayHints',
	});

	public static readonly taskCompleted = AccessibilitySignal.register({
		name: localize('accessibilitySignals.taskCompleted', 'Task Completed'),
		sound: Sound.taskCompleted,
		legacySoundSettingsKey: 'audioCues.taskCompleted',
		legacyAnnouncementSettingsKey: 'accessibility.alert.taskCompleted',
		announcementMessage: localize('accessibility.signals.taskCompleted', 'Task Completed'),
		settingsKey: 'accessibility.signals.taskCompleted',
	});

	public static readonly taskFailed = AccessibilitySignal.register({
		name: localize('accessibilitySignals.taskFailed', 'Task Failed'),
		sound: Sound.taskFailed,
		legacySoundSettingsKey: 'audioCues.taskFailed',
		legacyAnnouncementSettingsKey: 'accessibility.alert.taskFailed',
		announcementMessage: localize('accessibility.signals.taskFailed', 'Task Failed'),
		settingsKey: 'accessibility.signals.taskFailed',
	});

	public static readonly terminalCommandFailed = AccessibilitySignal.register({
		name: localize('accessibilitySignals.terminalCommandFailed', 'Terminal Command Failed'),
		sound: Sound.error,
		legacySoundSettingsKey: 'audioCues.terminalCommandFailed',
		legacyAnnouncementSettingsKey: 'accessibility.alert.terminalCommandFailed',
		announcementMessage: localize('accessibility.signals.terminalCommandFailed', 'Command Failed'),
		settingsKey: 'accessibility.signals.terminalCommandFailed',
	});

	public static readonly terminalCommandSucceeded = AccessibilitySignal.register({
		name: localize('accessibilitySignals.terminalCommandSucceeded', 'Terminal Command Succeeded'),
		sound: Sound.success,
		announcementMessage: localize('accessibility.signals.terminalCommandSucceeded', 'Command Succeeded'),
		settingsKey: 'accessibility.signals.terminalCommandSucceeded',
	});

	public static readonly terminalBell = AccessibilitySignal.register({
		name: localize('accessibilitySignals.terminalBell', 'Terminal Bell'),
		sound: Sound.terminalBell,
		legacySoundSettingsKey: 'audioCues.terminalBell',
		legacyAnnouncementSettingsKey: 'accessibility.alert.terminalBell',
		announcementMessage: localize('accessibility.signals.terminalBell', 'Terminal Bell'),
		settingsKey: 'accessibility.signals.terminalBell',
	});

	public static readonly notebookCellCompleted = AccessibilitySignal.register({
		name: localize('accessibilitySignals.notebookCellCompleted', 'Notebook Cell Completed'),
		sound: Sound.taskCompleted,
		legacySoundSettingsKey: 'audioCues.notebookCellCompleted',
		legacyAnnouncementSettingsKey: 'accessibility.alert.notebookCellCompleted',
		announcementMessage: localize('accessibility.signals.notebookCellCompleted', 'Notebook Cell Completed'),
		settingsKey: 'accessibility.signals.notebookCellCompleted',
	});

	public static readonly notebookCellFailed = AccessibilitySignal.register({
		name: localize('accessibilitySignals.notebookCellFailed', 'Notebook Cell Failed'),
		sound: Sound.taskFailed,
		legacySoundSettingsKey: 'audioCues.notebookCellFailed',
		legacyAnnouncementSettingsKey: 'accessibility.alert.notebookCellFailed',
		announcementMessage: localize('accessibility.signals.notebookCellFailed', 'Notebook Cell Failed'),
		settingsKey: 'accessibility.signals.notebookCellFailed',
	});

	public static readonly diffLineInserted = AccessibilitySignal.register({
		name: localize('accessibilitySignals.diffLineInserted', 'Diff Line Inserted'),
		sound: Sound.diffLineInserted,
		legacySoundSettingsKey: 'audioCues.diffLineInserted',
		settingsKey: 'accessibility.signals.diffLineInserted',
	});

	public static readonly diffLineDeleted = AccessibilitySignal.register({
		name: localize('accessibilitySignals.diffLineDeleted', 'Diff Line Deleted'),
		sound: Sound.diffLineDeleted,
		legacySoundSettingsKey: 'audioCues.diffLineDeleted',
		settingsKey: 'accessibility.signals.diffLineDeleted',
	});

	public static readonly diffLineModified = AccessibilitySignal.register({
		name: localize('accessibilitySignals.diffLineModified', 'Diff Line Modified'),
		sound: Sound.diffLineModified,
		legacySoundSettingsKey: 'audioCues.diffLineModified',
		settingsKey: 'accessibility.signals.diffLineModified',
	});

	public static readonly chatRequestSent = AccessibilitySignal.register({
		name: localize('accessibilitySignals.chatRequestSent', 'Chat Request Sent'),
		sound: Sound.chatRequestSent,
		legacySoundSettingsKey: 'audioCues.chatRequestSent',
		legacyAnnouncementSettingsKey: 'accessibility.alert.chatRequestSent',
		announcementMessage: localize('accessibility.signals.chatRequestSent', 'Chat Request Sent'),
		settingsKey: 'accessibility.signals.chatRequestSent',
	});

	public static readonly chatResponseReceived = AccessibilitySignal.register({
		name: localize('accessibilitySignals.chatResponseReceived', 'Chat Response Received'),
		legacySoundSettingsKey: 'audioCues.chatResponseReceived',
		sound: {
			randomOneOf: [
				Sound.chatResponseReceived1,
				Sound.chatResponseReceived2,
				Sound.chatResponseReceived3,
				Sound.chatResponseReceived4
			]
		},
		settingsKey: 'accessibility.signals.chatResponseReceived'
	});

	public static readonly progress = AccessibilitySignal.register({
		name: localize('accessibilitySignals.progress', 'Progress'),
		sound: Sound.progress,
		legacySoundSettingsKey: 'audioCues.chatResponsePending',
		legacyAnnouncementSettingsKey: 'accessibility.alert.progress',
		announcementMessage: localize('accessibility.signals.progress', 'Progress'),
		settingsKey: 'accessibility.signals.progress'
	});

	public static readonly clear = AccessibilitySignal.register({
		name: localize('accessibilitySignals.clear', 'Clear'),
		sound: Sound.clear,
		legacySoundSettingsKey: 'audioCues.clear',
		legacyAnnouncementSettingsKey: 'accessibility.alert.clear',
		announcementMessage: localize('accessibility.signals.clear', 'Clear'),
		settingsKey: 'accessibility.signals.clear'
	});

	public static readonly save = AccessibilitySignal.register({
		name: localize('accessibilitySignals.save', 'Save'),
		sound: Sound.save,
		legacySoundSettingsKey: 'audioCues.save',
		legacyAnnouncementSettingsKey: 'accessibility.alert.save',
		announcementMessage: localize('accessibility.signals.save', 'Save'),
		settingsKey: 'accessibility.signals.save'
	});

	public static readonly format = AccessibilitySignal.register({
		name: localize('accessibilitySignals.format', 'Format'),
		sound: Sound.format,
		legacySoundSettingsKey: 'audioCues.format',
		legacyAnnouncementSettingsKey: 'accessibility.alert.format',
		announcementMessage: localize('accessibility.signals.format', 'Format'),
		settingsKey: 'accessibility.signals.format'
	});

	public static readonly voiceRecordingStarted = AccessibilitySignal.register({
		name: localize('accessibilitySignals.voiceRecordingStarted', 'Voice Recording Started'),
		sound: Sound.voiceRecordingStarted,
		legacySoundSettingsKey: 'audioCues.voiceRecordingStarted',
		settingsKey: 'accessibility.signals.voiceRecordingStarted'
	});

	public static readonly voiceRecordingStopped = AccessibilitySignal.register({
		name: localize('accessibilitySignals.voiceRecordingStopped', 'Voice Recording Stopped'),
		sound: Sound.voiceRecordingStopped,
		legacySoundSettingsKey: 'audioCues.voiceRecordingStopped',
		settingsKey: 'accessibility.signals.voiceRecordingStopped'
	});
}

