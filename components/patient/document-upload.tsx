'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, FileText, Brain, ImageIcon, FolderUp, Loader2, Info, Play } from 'lucide-react'
import { uploadGuidanceLines, UPLOAD_GUIDANCE } from '@/lib/documents/upload-guidance'
import {
  validateDocumentFile,
  inferRenderType,
  isIgnorableCompanionFile,
  DOCUMENT_VALIDATION_MESSAGES,
  MAX_DOCUMENTS_PER_REQUEST,
  type DocumentRenderType,
} from '@/lib/documents/patient-documents'
import { getDocumentAcceptAttribute } from '@/lib/features/mp4-viewer'
import { importDicomFolder, formatEmptyDicomFolderMessage } from '@/lib/imaging/dicom-folder-import'
import {
  configureWebkitDirectoryInput,
  filesFromDataTransfer,
  snapshotFileList,
} from '@/lib/imaging/directory-picker'

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
  /** Envoi serveur en cours (fiche patient). */
  isUploading?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function RenderTypeIcon({ type }: { type: DocumentRenderType }) {
  if (type === 'dicom') return <Brain className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
  if (type === 'image') return <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
  if (type === 'video') return <Play className="w-4 h-4 text-violet-600 shrink-0" aria-hidden="true" />
  return <FileText className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
}

export default function DocumentUpload({
  files,
  onChange,
  disabled = false,
  isUploading = false,
}: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [folderImporting, setFolderImporting] = useState(false)
  const [folderNote, setFolderNote] = useState<string | null>(null)
  const [folderError, setFolderError] = useState<string | null>(null)
  const [seriesPreview, setSeriesPreview] = useState<{ label: string; count: number }[]>([])
  const [importSummary, setImportSummary] = useState<string | null>(null)

  // webkitdirectory nest pas dans les typings React : pose imperatif comme questionnaires.
  useEffect(() => {
    const input = folderInputRef.current
    if (!input) return
    configureWebkitDirectoryInput(input)
  }, [])

  const mergeAccepted = useCallback(
    (accepted: File[]) => {
      const existingKeys = new Set(files.map((f) => `${f.name}:${f.size}:${f.lastModified}`))
      const merged = [...files]
      for (const file of accepted) {
        const key = `${file.name}:${file.size}:${file.lastModified}`
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
    async (fileList: FileList | File[]) => {
      if (disabled) return
      const snapshot = Array.isArray(fileList) ? fileList : snapshotFileList(fileList)
      setFolderImporting(true)
      setFolderNote(`Lecture de ${snapshot.length} fichier(s)… Ne fermez pas la page.`)
      setFolderError(null)
      setSeriesPreview([])
      setImportSummary(null)
      await new Promise((resolve) => window.setTimeout(resolve, 50))
      try {
        const result = await importDicomFolder(snapshot, (done, total) => {
          setFolderNote(`Analyse DICOM ${done} / ${total}… Ne fermez pas la page.`)
        })
        const prepared = result.series.flatMap((s) => s.files.map((f) => f.file))
        const totalImages = prepared.length

        if (prepared.length === 0) {
          setFolderError(formatEmptyDicomFolderMessage(result))
          return
        }

        setSeriesPreview(
          result.series.map((s) => ({
            label: s.label,
            count: s.files.length,
          })),
        )
        const existingKeys = new Set(files.map((f) => `${f.name}:${f.size}:${f.lastModified}`))
        const newFileCount = prepared.filter(
          (f) => !existingKeys.has(`${f.name}:${f.size}:${f.lastModified}`),
        ).length

        mergeAccepted(prepared)

        const notes: string[] = []
        if (newFileCount === 0) {
          notes.push('Ce dossier est deja importe (fichiers identiques).')
        }
        if (result.ignoredCompanionCount > 0) {
          notes.push(`${result.ignoredCompanionCount} fichier(s) parasite(s) ignore(s)`)
        }
        if (result.skippedNonDicomCount > 0) {
          notes.push(`${result.skippedNonDicomCount} fichier(s) non-DICOM ignore(s)`)
          if (result.sampleSkippedPaths.length > 0) {
            notes.push(`ex. ${result.sampleSkippedPaths.slice(0, 3).join(', ')}`)
          }
        }
        if (notes.length > 0) setFolderNote(notes.join(' · '))

        setImportSummary(
          `${result.series.length} serie(s), ${totalImages} image(s) importee(s)${
            result.skippedNonDicomCount > 0
              ? `, ${result.skippedNonDicomCount} ignore(s)`
              : ''
          }`,
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : "Echec de l'analyse du dossier DICOM."
        setFolderError(message)
      } finally {
        setFolderImporting(false)
      }
    },
    [disabled, files, mergeAccepted],
  )

  const openFolderPicker = useCallback(() => {
    if (disabled || folderImporting) return
    setFolderError(null)
    const input = folderInputRef.current
    if (!input) return
    // Repose webkitdirectory au clic : Safari peut perdre l'attribut.
    configureWebkitDirectoryInput(input)
    input.click()
  }, [disabled, folderImporting])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      if (disabled) return
      void (async () => {
        try {
          const snapshot = await filesFromDataTransfer(e.dataTransfer)
          if (snapshot.length === 0) return
          const looksLikeFolder =
            snapshot.length > 1 ||
            snapshot.some((file) => {
              const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
              return Boolean(rel && rel.includes('/'))
            })
          if (looksLikeFolder) {
            await handleFolderImport(snapshot)
            return
          }
          addFiles(snapshot)
        } catch (err) {
          setFolderError(err instanceof Error ? err.message : "Impossible de lire le dossier déposé.")
        }
      })()
    },
    [addFiles, disabled, handleFolderImport],
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
        role="note"
        className="rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-2.5 text-xs text-blue-900"
      >
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-700" aria-hidden="true" />
          <ul className="list-disc space-y-0.5 pl-4">
            {uploadGuidanceLines().map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>

      {(isUploading || folderImporting) && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
          {isUploading ? UPLOAD_GUIDANCE.uploadingNote : UPLOAD_GUIDANCE.folderAnalyzingNote}
        </p>
      )}

      <div
        role="button"
        tabIndex={disabled || folderImporting ? -1 : 0}
        aria-disabled={disabled || folderImporting}
        aria-label="Importer le CD complet"
        onClick={() => openFolderPicker()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openFolderPicker()
          }
        }}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragActive
            ? 'border-[#2563EB] bg-blue-50'
            : 'border-[#2563EB]/40 bg-[#EBF0FA] hover:bg-[#dfe6f6]'
        } ${disabled || folderImporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragActive(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragActive(false)
        }}
        onDrop={handleDrop}
      >
        {folderImporting ? (
          <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" aria-hidden="true" />
        ) : (
          <FolderUp className="w-8 h-8 text-[#2563EB]" aria-hidden="true" />
        )}
        <p className="text-base font-bold text-[#1E2B70]">
          {folderImporting ? 'Analyse du CD en cours…' : 'Importer le CD complet'}
        </p>
        <p className="max-w-md text-sm text-[#2E3450]">
          Cliquez et choisissez le dossier racine (bouton <strong>Ouvrir</strong> sur Mac), ou
          glissez le dossier ici. Toutes les séries sont lues d’un coup — pas image par image.
        </p>
      </div>

      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const input = e.target
          const picked = input.files
          if (!picked?.length) return
          const snapshot = snapshotFileList(picked)
          input.value = ''
          void handleFolderImport(snapshot)
        }}
      />

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={getDocumentAcceptAttribute()}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <p className="text-center text-xs text-gray-500">
        Un PDF ou une image isolée ?{' '}
        <button
          type="button"
          disabled={disabled || folderImporting}
          onClick={() => inputRef.current?.click()}
          className="font-medium text-[#2563EB] hover:underline disabled:opacity-50"
        >
          Ajouter des fichiers isolés
        </button>
      </p>

      {seriesPreview.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2">
          {seriesPreview.slice(0, 12).map((entry) => (
            <li key={entry.label} className="text-xs text-indigo-900">
              {entry.label}
            </li>
          ))}
          {seriesPreview.length > 12 ? (
            <li className="text-xs text-indigo-700">+ {seriesPreview.length - 12} série(s)</li>
          ) : null}
        </ul>
      )}

      {folderNote ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
          {folderNote}
        </p>
      ) : null}
      {importSummary ? (
        <p className="text-sm font-medium text-indigo-800">{importSummary}</p>
      ) : null}
      {folderError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {folderError}
        </p>
      ) : null}

      {files.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-800">
            {files.length} fichier{files.length > 1 ? 's' : ''} prêt
            {files.length > 1 ? 's' : ''} · {formatSize(files.reduce((sum, file) => sum + file.size, 0))}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-medium text-gray-500 hover:text-red-600"
            >
              Tout retirer
            </button>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <ul className="space-y-1">
          {errors.map((err, i) => (
            <li key={i} className="text-xs text-red-600">
              {err}
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && files.length <= 12 && (
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
      {files.length > 12 && (
        <p className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600">
          Liste masquée ({files.length} fichiers). Cliquez <strong>Envoyer</strong> pour tout
          transférer d’un coup.
        </p>
      )}
    </div>
  )
}
