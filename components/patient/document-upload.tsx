'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { UploadCloud, X, FileText, Brain, ImageIcon, FolderUp, Loader2 } from 'lucide-react'
import {
  validateDocumentFile,
  inferRenderType,
  isIgnorableCompanionFile,
  DOCUMENT_VALIDATION_MESSAGES,
  MAX_DOCUMENTS_PER_REQUEST,
  type DocumentRenderType,
} from '@/lib/documents/patient-documents'
import { importDicomFolder } from '@/lib/imaging/dicom-folder-import'

/**
 * Sélecteur de fichiers réutilisable (DICOM + PDF/images), drag & drop +
 * validation côté client. Composant CONTRÔLÉ : il ne fait PAS l'upload ;
 * il remonte la liste de fichiers au parent (formulaire de création ou fiche
 * patient), qui décide quand/comment uploader.
 */

type DocumentUploadProps = {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}

const ACCEPT = '.dcm,.dicom,.pdf,.jpg,.jpeg,.png,.webp,.gif,application/dicom,application/pdf,image/*'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function RenderTypeIcon({ type }: { type: DocumentRenderType }) {
  if (type === 'dicom') return <Brain className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
  if (type === 'image') return <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
  return <FileText className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
}

export default function DocumentUpload({ files, onChange, disabled = false }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [folderImporting, setFolderImporting] = useState(false)
  const [folderNote, setFolderNote] = useState<string | null>(null)
  const [folderError, setFolderError] = useState<string | null>(null)
  const [seriesPreview, setSeriesPreview] = useState<string[]>([])

  // webkitdirectory nest pas dans les typings React : pose imperatif comme questionnaires.
  useEffect(() => {
    const input = folderInputRef.current
    if (!input) return
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
  }, [])

  const mergeAccepted = useCallback(
    (accepted: File[]) => {
      const existingKeys = new Set(files.map((f) => `${f.name}:${f.size}`))
      const merged = [...files]
      for (const file of accepted) {
        const key = `${file.name}:${file.size}`
        if (!existingKeys.has(key)) {
          existingKeys.add(key)
          merged.push(file)
        }
      }

      const nextErrors = [...errors]
      if (merged.length > MAX_DOCUMENTS_PER_REQUEST) {
        nextErrors.push(`Maximum ${MAX_DOCUMENTS_PER_REQUEST} fichiers par envoi.`)
        merged.length = MAX_DOCUMENTS_PER_REQUEST
      }

      setErrors(nextErrors)
      onChange(merged)
    },
    [errors, files, onChange],
  )

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming)
      const nextErrors: string[] = []
      const accepted: File[] = []

      for (const file of list) {
        if (isIgnorableCompanionFile(file.name)) {
          continue
        }
        const validationError = validateDocumentFile({
          name: file.name,
          size: file.size,
          type: file.type,
        })
        if (validationError) {
          nextErrors.push(`${file.name} : ${DOCUMENT_VALIDATION_MESSAGES[validationError]}`)
          continue
        }
        accepted.push(file)
      }

      mergeAccepted(accepted)
      if (nextErrors.length > 0) setErrors(nextErrors)
    },
    [mergeAccepted],
  )

  const handleFolderImport = useCallback(
    async (fileList: FileList) => {
      if (disabled) return
      setFolderImporting(true)
      setFolderNote(null)
      setFolderError(null)
      setSeriesPreview([])
      try {
        const result = await importDicomFolder(fileList)
        const prepared = result.series.flatMap((s) => s.files.map((f) => f.file))

        if (prepared.length === 0) {
          setFolderError('Aucune image DICOM reconnue dans ce dossier.')
          return
        }

        setSeriesPreview(result.series.map((s) => s.label))
        mergeAccepted(prepared)

        const notes: string[] = []
        if (result.ignoredCompanionCount > 0) {
          notes.push(`${result.ignoredCompanionCount} fichier(s) parasite(s) ignoré(s)`)
        }
        if (result.skippedNonDicomCount > 0) {
          notes.push(`${result.skippedNonDicomCount} fichier(s) non-DICOM ignoré(s)`)
        }
        if (notes.length > 0) setFolderNote(notes.join(' · '))
      } catch (err) {
        const message = err instanceof Error ? err.message : "Échec de l'analyse du dossier DICOM."
        setFolderError(message)
      } finally {
        setFolderImporting(false)
      }
    },
    [disabled, mergeAccepted],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      if (disabled) return
      if (e.dataTransfer.files?.length) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles, disabled],
  )

  const removeFile = useCallback(
    (index: number) => {
      const next = files.slice()
      next.splice(index, 1)
      onChange(next)
    },
    [files, onChange],
  )

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragActive(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragActive(false)
        }}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        aria-disabled={disabled}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition cursor-pointer ${
          dragActive
            ? 'border-[#2563EB] bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <UploadCloud className="w-7 h-7 text-gray-400" aria-hidden="true" />
        <p className="text-sm font-medium text-gray-700">
          Glissez-déposez vos fichiers ou cliquez pour parcourir
        </p>
        <p className="text-xs text-gray-500">
          Imagerie DICOM (.dcm) · PDF · images (JPG, PNG…) — 100 Mo max par fichier
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            // Réinitialise pour permettre de re-sélectionner le même fichier.
            e.target.value = ''
          }}
        />
        {/* Import de DOSSIER (CD DICOM avec sous-dossiers). webkitdirectory n'est
            pas typé standard → cast. Les fichiers parasites sont filtrés. */}
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.length) void handleFolderImport(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {seriesPreview.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2">
          {seriesPreview.map((label) => (
            <li key={label} className="text-xs text-indigo-900">
              {label}
            </li>
          ))}
        </ul>
      )}

      {folderNote ? <p className="text-xs text-gray-500">{folderNote}</p> : null}
      {folderError ? <p className="text-xs text-red-600">{folderError}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={disabled || folderImporting}
          onClick={() => folderInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-sm text-[#2563EB] hover:text-[#1d4ed8] font-medium disabled:opacity-50"
        >
          {folderImporting ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <FolderUp className="w-4 h-4" aria-hidden="true" />
          )}
          Importer un dossier (CD DICOM)
        </button>
        {files.length > 0 && (
          <span className="text-xs text-gray-500">
            {files.length} fichier{files.length > 1 ? 's' : ''} importé{files.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1">
          {errors.map((err, i) => (
            <li key={i} className="text-xs text-red-600">
              {err}
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}:${file.size}:${index}`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <RenderTypeIcon type={inferRenderType(file.name, file.type)} />
              <span className="flex-1 truncate text-sm text-gray-800">{file.name}</span>
              <span className="text-xs text-gray-500 shrink-0">{formatSize(file.size)}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  aria-label={`Retirer ${file.name}`}
                  className="text-gray-400 hover:text-red-600 transition shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
