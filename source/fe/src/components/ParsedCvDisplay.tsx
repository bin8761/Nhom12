import type { ParsedFields } from '../services/cvService'

interface ParsedCvDisplayProps {
  parsedFields: ParsedFields
  compact?: boolean
}

export default function ParsedCvDisplay({ parsedFields, compact = false }: ParsedCvDisplayProps) {
  if (!parsedFields) return null

  if (compact) {
    // Hiển thị compact cho danh sách applications
    return (
      <div className="space-y-3">
        {/* AI Feedback - Compact */}
        {parsedFields.aiFeedback && (
          <div className="p-3 bg-purple-50 border border-purple-200 rounded">
            <div className="flex items-start gap-2">
              <span className="text-lg">🤖</span>
              <div className="flex-1">
                <p className="text-xs font-semibold text-purple-900 mb-1">Đánh giá AI:</p>
                <p className="text-xs text-gray-700 line-clamp-3">{parsedFields.aiFeedback}</p>
              </div>
            </div>
          </div>
        )}

        {/* Thông tin cơ bản */}
        {(parsedFields.fullName || parsedFields.email || parsedFields.phone || parsedFields.yearsExperience !== undefined) && (
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-xs space-y-1">
              {parsedFields.fullName && <p>👤 {parsedFields.fullName}</p>}
              {parsedFields.email && <p>📧 {parsedFields.email}</p>}
              {parsedFields.phone && <p>📱 {parsedFields.phone}</p>}
              {parsedFields.yearsExperience !== undefined && (
                <p>💼 Kinh nghiệm: <span className="font-semibold">{parsedFields.yearsExperience} năm</span></p>
              )}
            </div>
          </div>
        )}

        {/* Kỹ năng */}
        {parsedFields.skills && parsedFields.skills.length > 0 && (
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-xs font-semibold mb-2">🔧 Kỹ năng:</p>
            <div className="flex flex-wrap gap-1">
              {parsedFields.skills.map((skill, idx) => (
                <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Học vấn */}
        {parsedFields.education && parsedFields.education.length > 0 && (
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-xs font-semibold mb-2">🎓 Học vấn:</p>
            <div className="space-y-2">
              {parsedFields.education.map((edu, idx) => (
                <div key={idx} className="text-xs">
                  {edu.degree && <p className="font-medium">{edu.degree}</p>}
                  {edu.institution && <p className="text-gray-600">{edu.institution}</p>}
                  {edu.graduationYear && <p className="text-gray-500">Năm {edu.graduationYear}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kinh nghiệm */}
        {parsedFields.experience && parsedFields.experience.length > 0 && (
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-xs font-semibold mb-2">💼 Kinh nghiệm:</p>
            <div className="space-y-2">
              {parsedFields.experience.map((exp, idx) => (
                <div key={idx} className="text-xs">
                  {exp.position && <p className="font-medium">{exp.position}</p>}
                  {exp.company && <p className="text-gray-600">{exp.company}</p>}
                  {exp.duration && <p className="text-gray-500">{exp.duration}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chứng chỉ */}
        {parsedFields.certificates && parsedFields.certificates.length > 0 && (
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-xs font-semibold mb-2">🏆 Chứng chỉ:</p>
            <div className="flex flex-wrap gap-1">
              {parsedFields.certificates.map((cert, idx) => (
                <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                  {cert}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Hiển thị đầy đủ cho modal/detail view
  return (
    <div className="space-y-4">
      {/* AI Feedback */}
      {parsedFields.aiFeedback && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-3xl">🤖</span>
            <div className="flex-1">
              <p className="font-bold text-purple-900 mb-2 text-lg">Đánh giá từ AI</p>
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                {parsedFields.aiFeedback}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Thông tin cơ bản */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {parsedFields.fullName && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">👤 Họ tên</p>
            <p className="font-semibold text-gray-900">{parsedFields.fullName}</p>
          </div>
        )}
        {parsedFields.email && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">📧 Email</p>
            <p className="font-semibold text-gray-900">{parsedFields.email}</p>
          </div>
        )}
        {parsedFields.phone && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">📱 Số điện thoại</p>
            <p className="font-semibold text-gray-900">{parsedFields.phone}</p>
          </div>
        )}
        {parsedFields.yearsExperience !== undefined && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">💼 Kinh nghiệm</p>
            <p className="font-bold text-blue-900 text-xl">{parsedFields.yearsExperience} năm</p>
          </div>
        )}
      </div>

      {/* Mục tiêu */}
      {parsedFields.objective && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="font-semibold text-green-900 mb-2 flex items-center gap-2">
            <span>🎯</span> Mục tiêu nghề nghiệp
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{parsedFields.objective}</p>
        </div>
      )}

      {/* Tóm tắt */}
      {parsedFields.summary && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
            <span>📝</span> Tóm tắt
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{parsedFields.summary}</p>
        </div>
      )}

      {/* Kỹ năng */}
      {parsedFields.skills && parsedFields.skills.length > 0 && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
            <span>🔧</span> Kỹ năng
          </p>
          <div className="flex flex-wrap gap-2">
            {parsedFields.skills.map((skill, idx) => (
              <span key={idx} className="px-3 py-2 bg-indigo-200 text-indigo-900 rounded-full text-sm font-medium">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Học vấn */}
      {parsedFields.education && parsedFields.education.length > 0 && (
        <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
          <p className="font-semibold text-cyan-900 mb-3 flex items-center gap-2">
            <span>🎓</span> Học vấn
          </p>
          <div className="space-y-3">
            {parsedFields.education.map((edu, idx) => (
              <div key={idx} className="p-4 bg-white rounded-lg border-l-4 border-cyan-500 shadow-sm">
                {edu.degree && (
                  <p className="font-semibold text-gray-900 text-base">{edu.degree}</p>
                )}
                {edu.institution && (
                  <p className="text-sm text-gray-700 mt-1 flex items-center gap-1">
                    <span>🏫</span> {edu.institution}
                  </p>
                )}
                {edu.graduationYear && (
                  <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                    <span>📅</span> Năm tốt nghiệp: {edu.graduationYear}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kinh nghiệm làm việc */}
      {parsedFields.experience && parsedFields.experience.length > 0 && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
            <span>💼</span> Kinh nghiệm làm việc
          </p>
          <div className="space-y-3">
            {parsedFields.experience.map((exp, idx) => (
              <div key={idx} className="p-4 bg-white rounded-lg border-l-4 border-emerald-500 shadow-sm">
                {exp.position && (
                  <p className="font-semibold text-gray-900 text-base">{exp.position}</p>
                )}
                {exp.company && (
                  <p className="text-sm text-gray-700 mt-1 flex items-center gap-1">
                    <span>🏢</span> {exp.company}
                  </p>
                )}
                {exp.duration && (
                  <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                    <span>📅</span> {exp.duration}
                  </p>
                )}
                {exp.description && (
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed border-t pt-2">
                    {exp.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chứng chỉ */}
      {parsedFields.certificates && parsedFields.certificates.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
          <p className="font-semibold text-rose-900 mb-3 flex items-center gap-2">
            <span>🏆</span> Chứng chỉ
          </p>
          <div className="flex flex-wrap gap-2">
            {parsedFields.certificates.map((cert, idx) => (
              <span key={idx} className="px-3 py-2 bg-rose-200 text-rose-900 rounded-full text-sm font-medium">
                {cert}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Hoạt động */}
      {parsedFields.activities && parsedFields.activities.length > 0 && (
        <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
          <p className="font-semibold text-violet-900 mb-3 flex items-center gap-2">
            <span>🎭</span> Hoạt động
          </p>
          <ul className="space-y-2">
            {parsedFields.activities.map((activity, idx) => (
              <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                <span className="text-violet-600 mt-1">•</span>
                <span className="flex-1">{activity}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
