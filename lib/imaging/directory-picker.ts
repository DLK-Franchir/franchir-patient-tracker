/**
 * Sélection de dossier CD DICOM : File System Access API (Chrome/Edge) avec
 * repli webkitdirectory (Safari/Firefox).
 */

type DirectoryHandleWithEntries = FileSystemDirectoryHandle & {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>
}

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
}

export type DirectoryPickResult = {
  files: File[]
  source: 'fs-access' | 'webkitdirectory'
}

export type DirectoryPickOutcome =
  | { status: 'picked'; result: DirectoryPickResult }
  | { status: 'cancelled' }
  | { status: 'unsupported' }

type FileWithRelativePath = File & { webkitRelativePath?: string }

export function supportsDirectoryPicker(): boolean {
  const win = window as WindowWithDirectoryPicker
  return typeof window !== 'undefined' && typeof win.showDirectoryPicker === 'function'
}

/** Copie immédiate du FileList avant reset de l'input (Safari invalide sinon). */
export function snapshotFileList(fileList: FileList): File[] {
  return Array.from(fileList)
}

export function fileRelativePath(file: File): string {
  const rel = (file as FileWithRelativePath).webkitRelativePath?.trim()
  return rel && rel.length > 0 ? rel : file.name
}

function withRelativePath(file: File, relativePath: string): File {
  if ((file as FileWithRelativePath).webkitRelativePath === relativePath) return file
  const tagged = new File([file], file.name, {
    type: file.type,
    lastModified: file.lastModified,
  })
  Object.defineProperty(tagged, 'webkitRelativePath', {
    value: relativePath,
    writable: false,
    configurable: true,
  })
  return tagged
}

async function collectFromDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  basePath = '',
): Promise<File[]> {
  const files: File[] = []
  const dir = handle as DirectoryHandleWithEntries
  for await (const [name, child] of dir.entries()) {
    const childPath = basePath ? `${basePath}/${name}` : name
    if (child.kind === 'file') {
      files.push(withRelativePath(await (child as FileSystemFileHandle).getFile(), childPath))
    } else if (child.kind === 'directory') {
      files.push(...(await collectFromDirectoryHandle(child as FileSystemDirectoryHandle, childPath)))
    }
  }
  return files
}

/** Ouvre le selecteur natif de dossier (Chrome/Edge). */
export async function pickDirectoryViaFileSystemAccess(): Promise<DirectoryPickOutcome> {
  if (!supportsDirectoryPicker()) return { status: 'unsupported' }

  try {
    const win = window as WindowWithDirectoryPicker
    const dir = await win.showDirectoryPicker!({ mode: 'read' })
    const files = await collectFromDirectoryHandle(dir)
    return { status: 'picked', result: { files, source: 'fs-access' } }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return { status: 'cancelled' }
    throw err
  }
}

/** Attributs webkitdirectory requis sur macOS Safari. */
export function configureWebkitDirectoryInput(input: HTMLInputElement): void {
  input.multiple = true
  input.setAttribute('webkitdirectory', '')
  input.setAttribute('directory', '')
  const extended = input as HTMLInputElement & { webkitdirectory?: boolean; directory?: boolean }
  extended.webkitdirectory = true
  extended.directory = true
}
