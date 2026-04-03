import { X } from 'lucide-react'
import ParsedCvDisplay from './ParsedCvDisplay'
import type { ParsedFields } from '../services/cvService'
import Button from './Button'

interface CvDetailModalProps {
  isOpen: boolean
  onClose: () => void
  parsedFields: ParsedFields | null
  candidateName?: string
  pdfUrl?: string
}

export default function CvDetailModal({ 
  isOpen, 
  onClose, 
  parsedFields, 
  candidateName,
  pdfUrl 
}: CvDetailModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Chi tiết CV {candidateName && `- ${candidateName}`}
              </h2>
              <p className="text-sm text-gray-600 mt-1">Thông tin đã được phân tích bởi AI</p>
            </div>
            <div className="flex items-center gap-2">
              {pdfUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(pdfUrl, '_blank')}
                >
                  📄 Xem PDF gốc
                </Button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 160px)' }}>
            <div className="px-6 py-6">
              {parsedFields ? (
                <ParsedCvDisplay parsedFields={parsedFields} compact={false} />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Không có thông tin CV</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
            <Button onClick={onClose} variant="outline">
              Đóng
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
