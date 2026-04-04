export const EXPERIENCE_LEVEL_LABELS: Record<string, string> = {
  ENTRY: 'Không yêu cầu kinh nghiệm',
  JUNIOR: 'Junior',
  MIDDLE: 'Middle',
  SENIOR: 'Senior',
  LEAD: 'Lead',
}

export function getExperienceLevelLabel(level: string | undefined | null): string {
  if (!level) return ''
  return EXPERIENCE_LEVEL_LABELS[level] || level
}
