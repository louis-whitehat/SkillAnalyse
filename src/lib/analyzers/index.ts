import type { PosePoint, Skill } from '../../types'
import { analyzeBentArmPress } from './bentArmPress'
import { analyzeFrontLever } from './frontLever'
import { analyzeHandstand } from './handstand'
import { analyzeHandstandPushUp } from './handstandPushUp'
import { analyzePushUp } from './pushUp'
import type { SkillFrame } from './types'

export function analyzeSkillFrame(skill: Skill, points: PosePoint[]): SkillFrame {
  switch (skill.category) {
    case 'front-lever':
      return analyzeFrontLever(points)
    case 'handstand':
      return analyzeHandstand(points)
    case 'handstand-push-up':
      return analyzeHandstandPushUp(points)
    case 'push-up':
      return analyzePushUp(points)
    case 'bent-arm-press':
      return analyzeBentArmPress(points)
    default:
      return {
        confidence: 0,
        alignment: 0,
        symmetry: 0,
        jointExtension: 0,
        kneeAngle: 0,
        hipAngle: 0,
        elbowAngle: 0,
        elbowAsymmetry: 0,
        frontLine: 0,
        verticalDeviation: 0,
      }
  }
}
