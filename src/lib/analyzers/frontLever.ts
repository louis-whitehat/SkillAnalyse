import type { PosePoint } from '../../types'
import { bodyLine, bodyAlignment, clamp, frameConfidence, jointAngles } from './common'
import type { SkillFrame } from './types'

export function analyzeFrontLever(points: PosePoint[]): SkillFrame {
  const body = bodyLine(points)
  const joints = jointAngles(points)
  const alignment = bodyAlignment(body.frontLine, body.hipSag, 2.7)
  return {
    confidence: frameConfidence(points),
    alignment,
    symmetry: body.symmetry,
    jointExtension: clamp(100 - Math.max(0, 165 - joints.knee) * 2),
    kneeAngle: joints.knee,
    hipAngle: joints.hip,
    elbowAngle: joints.elbow,
    elbowAsymmetry: joints.elbowAsymmetry,
    frontLine: body.frontLine,
    verticalDeviation: body.verticalDeviation,
  }
}
