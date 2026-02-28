declare module "clipboardy" {
	const clipboardy: {
		read(): Promise<string>
		write(text: string): Promise<void>
		readSync(): string
		writeSync(text: string): void
	}
	export default clipboardy
}
