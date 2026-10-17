import type { PosePoint } from '../../types'
import { bodyAlignment, bodyLine, clamp, frameConfidence, jointAngles } from './common'
import type { SkillFrame } from './types'

export function analyzePushUp(points: PosePoint[]): SkillFrame {
  const body = bodyLine(points)
  const joints = jointAngles(points)
  return {
    confidence: frameConfidence(points),
    alignment: bodyAlignment(body.frontLine, body.hipOffset, 2.7),
    symmetry: clamp(100 - joints.elbowAsymmetry * 1.5),
    jointExtension: clamp(100 - Math.max(0, 165 - joints.elbow) * 2),
    kneeAngle: joints.knee,
    hipAngle: joints.hip,
    elbowAngle: joints.elbow,
    elbowAsymmetry: joints.elbowAsymmetry,
    frontLine: body.frontLine,
    verticalDeviation: body.verticalDeviation,
  }
}
