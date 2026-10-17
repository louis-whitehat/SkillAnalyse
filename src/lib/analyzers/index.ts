import type { PosePoint, Skill } from '../../types'
import { analyzeBentArmPress } from './bentArmPress'
import { analyzeFrontLever } from './frontLever'
import { analyzeHandstand } from './handstand'
import { analyzeHandstandPushUp } from './handstandPushUp'
import type { SkillFrame } from './types'

export function analyzeSkillFrame(skill: Skill, points: PosePoint[]): SkillFrame {
  switch (skill.category) {
    case 'front-lever':
      return analyzeFrontLever(points)
    case 'handstand':
      return analyzeHandstand(points)
    case 'handstand-push-up':
      return analyzeHandstandPushUp(points)
    case 'bent-arm-press':
      return analyzeBentArmPress(points)
  }
}
