import clipboard from "clipboardy"

export class ClipboardService {
	static read(): string {
		try {
			return clipboard.readSync()
		} catch {
			return ""
		}
	}

	static write(text: string) {
		try {
			clipboard.writeSync(text ?? "")
		} catch {
			// silently ignore
		}
	}
}
