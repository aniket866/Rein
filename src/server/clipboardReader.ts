import { execSync } from "node:child_process"

export async function readSystemClipboard(): Promise<string | null> {
	try {
		const text = execSync("powershell.exe Get-Clipboard", {
			timeout: 3000,
			windowsHide: true,
			encoding: "utf8",
		})
		return text?.trim().length > 0 ? text.trim() : null
	} catch (err) {
		console.error("[clipboard] read failed:", err)
		return null
	}
}

export async function writeSystemClipboard(text: string): Promise<boolean> {
	try {
		const escaped = text.replace(/'/g, "''")
		execSync(`powershell.exe Set-Clipboard -Value '${escaped}'`, {
			timeout: 3000,
			windowsHide: true,
		})
		return true
	} catch (err) {
		console.error("[clipboard] write failed:", err)
		return false
	}
}
