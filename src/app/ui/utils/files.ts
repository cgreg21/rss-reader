/** Saves text content as a file through a temporary link. */
export function download(content: string, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Reads the file picked in an `<input type="file">`, then resets the input. */
export async function pickedText(event: Event): Promise<string | null> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  return file ? file.text() : null;
}
