import { BufferBar } from "@/components/Trackpad/Buffer"
import type { ModifierState } from "@/types"
import { createFileRoute } from "@tanstack/react-router"
import { useRef, useState, useEffect, useCallback } from "react"
import { ControlBar } from "../components/Trackpad/ControlBar"
import { ExtraKeys } from "../components/Trackpad/ExtraKeys"
import { TouchArea } from "../components/Trackpad/TouchArea"
import { useRemoteConnection } from "../hooks/useRemoteConnection"
import { useTrackpadGesture } from "../hooks/useTrackpadGesture"
import { ScreenMirror } from "../components/Trackpad/ScreenMirror"

export const Route = createFileRoute("/trackpad")({
	component: TrackpadPage,
})

type BottomPanel = "extrakeys" | "keyboard" | "hidden"

function TrackpadPage() {
	const [scrollMode, setScrollMode] = useState(false)
	const [modifier, setModifier] = useState<ModifierState>("Release")
	const [buffer, setBuffer] = useState<string[]>([])
	const bufferText = buffer.join(" + ")
	const hiddenInputRef = useRef<HTMLInputElement>(null)
	const clipboardInputRef = useRef<HTMLTextAreaElement>(null)

	// Single source of truth for bottom panel state — no more two-state conflicts
	const [bottomPanel, setBottomPanel] = useState<BottomPanel>("extrakeys")

	const pcClipboardRef = useRef<string | null>(null)
	const [copyStatus, setCopyStatus] = useState<"idle" | "ok" | "fail">("idle")

	const [sensitivity] = useState(() => {
		if (typeof window === "undefined") return 1.0
		const s = localStorage.getItem("rein_sensitivity")
		return s ? Number.parseFloat(s) : 1.0
	})

	const [invertScroll] = useState(() => {
		if (typeof window === "undefined") return false
		const s = localStorage.getItem("rein_invert")
		return s ? JSON.parse(s) : false
	})

	const { status, send, sendCombo, subscribe } = useRemoteConnection()
	// Pass sensitivity and invertScroll to the gesture hook

	const { isTracking, handlers } = useTrackpadGesture(
		send,
		scrollMode,
		sensitivity,
		invertScroll,
	)

	// Derived booleans from single state
	const keyboardOpen = bottomPanel === "keyboard"
	const extraKeysVisible = bottomPanel === "extrakeys"

	// Focus/blur hidden input based on keyboard state
	useEffect(() => {
		if (keyboardOpen) {
			// Small delay so the state settles before focusing
			setTimeout(() => hiddenInputRef.current?.focus(), 50)
		} else {
			hiddenInputRef.current?.blur()
		}
	}, [keyboardOpen])

	// Copy text to mobile clipboard — works on HTTP via execCommand
	const copyToMobileClipboard = useCallback((text: string) => {
		const el = clipboardInputRef.current
		if (!el) return
		try {
			el.value = text
			el.style.display = "block"
			el.focus()
			el.select()
			el.setSelectionRange(0, text.length)
			document.execCommand("copy")
		} catch {}
		el.style.display = "none"
		// Don't refocus hiddenInput here — let keyboard state manage focus
	}, [])

	// Receive clipboard text from server silently
	useEffect(() => {
		const unsubscribe = subscribe("clipboard-sync", (msg: unknown) => {
			const m = msg as { type: string; text: string }
			if (typeof m.text === "string" && m.text.trim().length > 0) {
				const text = m.text.trim()
				pcClipboardRef.current = text

				if (navigator.clipboard?.writeText) {
					navigator.clipboard.writeText(text).catch(() => {
						copyToMobileClipboard(text)
					})
				} else {
					copyToMobileClipboard(text)
				}

				setCopyStatus("ok")
				setTimeout(() => setCopyStatus("idle"), 1500)
			} else {
				setCopyStatus("fail")
				setTimeout(() => setCopyStatus("idle"), 1500)
			}
		})
		return unsubscribe
	}, [subscribe, copyToMobileClipboard])

	const focusInput = () => hiddenInputRef.current?.focus()

	const handleClick = (button: "left" | "right") => {
		send({ type: "click", button, press: true })
		// Release after short delay to simulate click
		setTimeout(() => send({ type: "click", button, press: false }), 50)
	}

	// Copy: fetch server clipboard silently, no panel change
	const handleCopy = () => {
		send({ type: "copy" })
	}

	const handlePaste = async () => {
		if (pcClipboardRef.current) {
			send({ type: "text", text: pcClipboardRef.current })
			return
		}
		if (navigator.clipboard?.readText) {
			try {
				const text = await navigator.clipboard.readText()
				if (text) {
					send({ type: "text", text })
					return
				}
			} catch {}
		}
		send({ type: "paste" })
	}

	// Keyboard toggle: switch between keyboard and extrakeys
	const handleKeyboardToggle = () => {
		setBottomPanel((prev) => (prev === "keyboard" ? "extrakeys" : "keyboard"))
	}

	// Extra keys toggle: switch between extrakeys and hidden
	const handleExtraKeysToggle = () => {
		setBottomPanel((prev) => (prev === "extrakeys" ? "hidden" : "extrakeys"))
	}

	const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const nativeEvent = e.nativeEvent as InputEvent
		const inputType = nativeEvent.inputType
		const data = nativeEvent.data
		const val = e.target.value

		// Synchronous Reset: Reset the input immediately to prevent buffer accumulation
		const resetInput = () => {
			if (hiddenInputRef.current) {
				hiddenInputRef.current.value = " "
				hiddenInputRef.current.setSelectionRange(1, 1)
			}
		}

		// 1. Explicit Backspace Detection
		if (inputType === "deleteContentBackward" || val.length === 0) {
			send({ type: "key", key: "backspace" })
			resetInput()
			return
		}

		// 2. Explicit New Line / Enter
		if (inputType === "insertLineBreak" || inputType === "insertParagraph") {
			send({ type: "key", key: "enter" })
			resetInput()
			return
		}

		// 3. Handle Text Insertion
		const textToSend = data || (val.length > 1 ? val.slice(1) : null)

		if (textToSend) {
			if (modifier !== "Release") {
				handleModifier(textToSend)
			} else {
				// Map space character to the 'space' key command specifically
				if (textToSend === " ") {
					send({ type: "key", key: "space" })
				} else {
					send({ type: "text", text: textToSend })
				}
			}
		}

		resetInput()
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		const key = e.key.toLowerCase()

		if (key === "enter") {
			send({ type: "key", key: "enter" })
			if (hiddenInputRef.current) hiddenInputRef.current.value = " "
			return
		}

		if (modifier !== "Release") {
			if (key === "escape") {
				e.preventDefault()
				setModifier("Release")
				setBuffer([])
				return
			}
			if (key.length > 1 && key !== "unidentified" && key !== "backspace") {
				e.preventDefault()
				handleModifier(key)
				return
			}
		}

		// 3. Special keys (Arrows, Tab, etc.)
		if (
			key.length > 1 &&
			key !== "unidentified" &&
			key !== "backspace" &&
			key !== "process"
		) {
			send({ type: "key", key })
		}
	}

	const handleModifierState = () => {
		switch (modifier) {
			case "Active":
				if (buffer.length > 0) setModifier("Hold")
				else setModifier("Release")
				break
			case "Hold":
				setModifier("Release")
				setBuffer([])
				break
			case "Release":
				setModifier("Active")
				setBuffer([])
				break
		}
	}

	const handleModifier = (key: string) => {
		console.log(
			`handleModifier called with key: ${key}, current modifier: ${modifier}, buffer:`,
			buffer,
		)
		if (modifier === "Hold") {
			const comboKeys = [...buffer, key]
			console.log("Sending combo:", comboKeys)
			sendCombo(comboKeys)
		} else if (modifier === "Active") {
			setBuffer((prev) => [...prev, key])
		}
	}

	return (
		<div className="flex flex-col h-full min-h-0 bg-base-300 overflow-hidden">
			{/* TOUCH AREA */}
			<div className="flex-1 min-h-0 relative flex flex-col border-b border-base-200">
				{/* Touch Surface */}
				<TouchArea
					isTracking={isTracking}
					scrollMode={scrollMode}
					handlers={handlers}
					status={status}
				/>
				<ScreenMirror
					isTracking={isTracking}
					scrollMode={scrollMode}
					handlers={handlers}
				/>
				{bufferText !== "" && <BufferBar bufferText={bufferText} />}

				{copyStatus !== "idle" && (
					<div
						className={`absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium shadow
							${copyStatus === "ok" ? "bg-success text-success-content" : "bg-error text-error-content"}`}
					>
						{copyStatus === "ok" ? "✓ Clipboard synced" : "✗ Clipboard empty"}
					</div>
				)}
			</div>

			{/* CONTROL BAR */}
			<div className="shrink-0 border-b border-base-200">
				<ControlBar
					onCopy={handleCopy}
					onPaste={handlePaste}
					scrollMode={scrollMode}
					modifier={modifier}
					buffer={buffer.join(" + ")}
					keyboardOpen={keyboardOpen}
					extraKeysVisible={extraKeysVisible}
					onToggleScroll={() => setScrollMode(!scrollMode)}
					onLeftClick={() => handleClick("left")}
					onRightClick={() => handleClick("right")}
					onKeyboardToggle={handleKeyboardToggle}
					onModifierToggle={handleModifierState}
					onExtraKeysToggle={handleExtraKeysToggle}
				/>
			</div>

			{/* Extra keys — only shown when bottomPanel === "extrakeys" */}
			<div
				className={`shrink-0 overflow-hidden transition-all duration-300 ${
					extraKeysVisible
						? "max-h-[50vh] opacity-100"
						: "max-h-0 opacity-0 pointer-events-none"
				}`}
			>
				{/* Extra Keys */}
				<ExtraKeys
					sendKey={(k) => {
						if (modifier !== "Release") handleModifier(k)
						else send({ type: "key", key: k })
					}}
					onInputFocus={focusInput}
				/>
			</div>

			{/* Hidden Input for Mobile Keyboard */}
			<input
				ref={hiddenInputRef}
				className="opacity-0 absolute bottom-0 pointer-events-none h-0 w-0"
				defaultValue=" "
				onKeyDown={handleKeyDown}
				onChange={handleInput}
				autoComplete="off"
				autoCorrect="off"
				autoCapitalize="off"
				spellCheck={false}
				inputMode="text"
				enterKeyHint="enter"
			/>

			<textarea
				ref={clipboardInputRef}
				tabIndex={-1}
				readOnly
				className="fixed top-0 left-0 w-px h-px opacity-0 pointer-events-none hidden text-base"
			/>
		</div>
	)
}
