export const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Toàn thời gian',
  PART_TIME: 'Bán thời gian',
  CONTRACT: 'Hợp đồng',
  INTERN: 'Thực tập',
  REMOTE: 'Từ xa',
}

export function getJobTypeLabel(jobType: string | undefined | null): string {
  if (!jobType) return ''
  return JOB_TYPE_LABELS[jobType] || jobType
}
