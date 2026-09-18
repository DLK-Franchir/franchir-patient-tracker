import { describe, expect, it } from 'vitest'
import { filesFromDataTransfer, fileRelativePath, snapshotFileList } from '@/lib/imaging/directory-picker'

function mockFileList(files: File[]): FileList {
  const list = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      for (const file of files) yield file
    },
  }
  files.forEach((file, index) => {
    Object.defineProperty(list, index, { value: file })
  })
  return list as unknown as FileList
}

describe('directory-picker', () => {
  it('snapshotFileList copie FileList avant reset', () => {
    const file = new File(['x'], 'IM0001.dcm')
    const snapshot = snapshotFileList(mockFileList([file]))
    expect(snapshot).toHaveLength(1)
    expect(snapshot[0]?.name).toBe('IM0001.dcm')
  })

  it('fileRelativePath utilise webkitRelativePath', () => {
    const file = new File(['x'], 'IM0001.dcm') as File & { webkitRelativePath?: string }
    Object.defineProperty(file, 'webkitRelativePath', { value: 'SE0001/IM0001.dcm' })
    expect(fileRelativePath(file)).toBe('SE0001/IM0001.dcm')
  })

  it('filesFromDataTransfer retombe sur FileList sans entries', async () => {
    const file = new File(['x'], 'IM0001.dcm')
    const dataTransfer = {
      items: { length: 0 },
      files: mockFileList([file]),
    } as unknown as DataTransfer
    const result = await filesFromDataTransfer(dataTransfer)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('IM0001.dcm')
  })

  it('filesFromDataTransfer lit un dossier depose recursivement', async () => {
    const slice = new File(['dicom'], 'IM0001')
    let batches = 0
    const fileEntry = {
      isFile: true,
      isDirectory: false,
      name: 'IM0001',
      file: (ok: (file: File) => void) => ok(slice),
    }
    const dirEntry = {
      isFile: false,
      isDirectory: true,
      name: 'SE0001',
      createReader: () => ({
        readEntries: (ok: (entries: unknown[]) => void) => {
          batches += 1
          ok(batches === 1 ? [fileEntry] : [])
        },
      }),
    }
    const item = {
      webkitGetAsEntry: () => dirEntry,
    }
    const dataTransfer = {
      items: {
        length: 1,
        0: item,
        [Symbol.iterator]: function* () {
          yield item
        },
      },
      files: mockFileList([]),
    } as unknown as DataTransfer

    const result = await filesFromDataTransfer(dataTransfer)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('IM0001')
    expect(fileRelativePath(result[0]!)).toBe('SE0001/IM0001')
  })
})
