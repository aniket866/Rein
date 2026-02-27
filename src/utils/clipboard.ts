export const canUseModernClipboard = () => {
	return (
		typeof navigator !== "undefined" &&
		!!navigator.clipboard &&
		window.isSecureContext
	)
}

export const safeWriteClipboard = async (text: string) => {
	// Try modern API
	if (canUseModernClipboard()) {
		try {
			await navigator.clipboard.writeText(text)
			return true
		} catch {}
	}

	// Fallback: execCommand
	try {
		const textarea = document.createElement("textarea")
		textarea.value = text
		textarea.style.position = "fixed"
		textarea.style.opacity = "0"
		document.body.appendChild(textarea)
		textarea.focus()
		textarea.select()

		const success = document.execCommand("copy")
		document.body.removeChild(textarea)

		return success
	} catch {
		return false
	}
}

