export type CategoryId = 'front-lever' | 'handstand' | 'handstand-push-up' | 'bent-arm-press'
export type SkillType = 'static' | 'dynamic' | 'combined'

export interface Skill {
  id: string
  name: string
  category: CategoryId
  categoryName: string
  level: number
  type: SkillType
  description: string
  checkpoints: string[]
  camera: string
  cues: string[]
}

export interface Criterion {
  name: string
  score: number
  detail: string
}

export interface AnalysisReport {
  score: number | null
  confidence: number
  insufficientConfidence: boolean
  framesAnalyzed: number
  validReps: number
  partialReps: number
  longestHold: number
  totalHold: number
  repConfidence: number[]
  criteria: Criterion[]
  issues: string[]
  positives: string[]
  suggestions: string[]
  timestampExamples: Array<{ time: number; issue: string }>
}

export interface TrainingSession {
  id: string
  date: string
  skillId: string
  skillName: string
  category: CategoryId
  report: AnalysisReport
  settings: {
    targetReps: number
    measureHold: boolean
    targetHold: number
    focus: string
    positionTolerance: number
    smoothingStrength: number
  }
  video?: Blob
}

export interface PosePoint {
  x: number
  y: number
  z: number
  visibility: number
}

export interface LiveMetrics {
  confidence: number
  validReps: number
  partialReps: number
  currentHold: number
  longestHold: number
  totalHold: number
}
