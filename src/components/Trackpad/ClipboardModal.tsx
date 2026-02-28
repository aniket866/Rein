import type React from "react"
import { useState, useRef, useEffect } from "react"
import { X, Send, ClipboardPaste, Copy } from "lucide-react"

interface ClipboardModalProps {
	isOpen: boolean
	onClose: () => void
	onSendText: (text: string) => void
	syncedText: string | null
}

export const ClipboardModal: React.FC<ClipboardModalProps> = ({
	isOpen,
	onClose,
	onSendText,
	syncedText,
}) => {
	const [text, setText] = useState("")
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	useEffect(() => {
		if (isOpen && textareaRef.current) {
			textareaRef.current.focus()
		}
	}, [isOpen])

	// When server sends us clipboard text, show it
	useEffect(() => {
		if (syncedText) {
			setText(syncedText)
		}
	}, [syncedText])

	if (!isOpen) return null

	const handleSend = () => {
		if (text.trim()) {
			onSendText(text)
			onClose()
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
			<div className="w-full bg-base-100 rounded-t-2xl p-4 flex flex-col gap-3 shadow-xl">
				<div className="flex items-center justify-between">
					<span className="font-bold text-base">Send Text to PC</span>
					<button type="button" onPointerDown={onClose}>
						<X size={22} />
					</button>
				</div>

				{/* Server clipboard text received */}
				{syncedText && (
					<div className="bg-base-200 rounded-lg p-2 text-xs text-base-content/70">
						<div className="font-semibold mb-1 text-success">
							✓ Copied from PC clipboard:
						</div>
						<div className="break-all line-clamp-3">{syncedText}</div>
					</div>
				)}

				<textarea
					ref={textareaRef}
					className="textarea textarea-bordered w-full h-32 text-base resize-none"
					placeholder="Type or paste text here, then tap Send to type it on your PC..."
					value={text}
					onChange={(e) => setText(e.target.value)}
				/>

				<div className="flex gap-2">
					<button
						type="button"
						className="btn btn-outline flex-1"
						onPointerDown={onClose}
					>
						Cancel
					</button>
					<button
						type="button"
						className="btn btn-primary flex-1 gap-2"
						onPointerDown={handleSend}
					>
						<Send size={16} />
						Send to PC
					</button>
				</div>
			</div>
		</div>
	)
}
