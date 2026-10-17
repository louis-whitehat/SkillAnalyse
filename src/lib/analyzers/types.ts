import type { PosePoint } from '../../types'

export interface SkillFrame {
  confidence: number
  alignment: number
  symmetry: number
  jointExtension: number
  kneeAngle: number
  hipAngle: number
  elbowAngle: number
  elbowAsymmetry: number
  frontLine: number
  verticalDeviation: number
}

export type SkillFrameAnalyzer = (points: PosePoint[]) => SkillFrame
