import type { AnalysisReport, LiveMetrics, PosePoint, Skill } from '../types'

const P = { leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14, leftWrist: 15, rightWrist: 16, leftHip: 23, rightHip: 24, leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28 } as const
type Point = { x: number; y: number }

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const angle = (a: Point, b: Point, c: Point) => {
  const bax = a.x - b.x
  const bay = a.y - b.y
  const bcx = c.x - b.x
  const bcy = c.y - b.y
  const cosine = (bax * bcx + bay * bcy) / (Math.hypot(bax, bay) * Math.hypot(bcx, bcy))
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI
}
const avg = (values: number[]) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

interface Sample {
  time: number
  confidence: number
  alignment: number
  symmetry: number
  jointExtension: number
}

export class SkillAnalyzer {
  private samples: Sample[] = []
  private validReps = 0
  private partialReps = 0
  private phase: 'ready' | 'lowered' | 'returning' | 'held' = 'ready'
  private repStarted = 0
  private currentHold = 0
  private longestHold = 0
  private totalHold = 0
  private previousTime: number | undefined
  private countedLeftWrist: number | undefined
  private countedRightWrist: number | undefined
  private lastSample: Sample | undefined

  constructor(
    private readonly skill: Skill,
    private readonly settings: { targetReps: number; measureHold: boolean; targetHold: number; focus: string },
  ) {}

  consume(points: PosePoint[] | null, time: number): LiveMetrics {
    if (!points || points.length <= P.rightAnkle) return this.live(0)
    const visible = [P.leftShoulder, P.rightShoulder, P.leftHip, P.rightHip, P.leftKnee, P.rightKnee, P.leftAnkle, P.rightAnkle].map((index) => points[index].visibility)
    const confidence = avg(visible)
    if (confidence < 0.3) {
      this.currentHold = 0
      this.previousTime = time
      return this.live(confidence)
    }
    const pick = (left: number, right: number) => midpoint(points[left], points[right])
    const shoulder = pick(P.leftShoulder, P.rightShoulder)
    const hip = pick(P.leftHip, P.rightHip)
    const knee = pick(P.leftKnee, P.rightKnee)
    const ankle = pick(P.leftAnkle, P.rightAnkle)
    const elbow = pick(P.leftElbow, P.rightElbow)
    const wrist = pick(P.leftWrist, P.rightWrist)

    const horizontalDeviation = Math.abs(Math.atan2(ankle.y - shoulder.y, ankle.x - shoulder.x) * 180 / Math.PI)
    const frontLine = Math.min(horizontalDeviation, 180 - horizontalDeviation)
    const verticalDeviation = Math.abs(Math.atan2(ankle.x - shoulder.x, ankle.y - shoulder.y) * 180 / Math.PI)
    const alignment = this.skill.category === 'front-lever'
      ? clamp(100 - Math.max(0, frontLine - 8) * 2.7)
      : clamp(100 - Math.max(0, verticalDeviation - 8) * 2.4)
    const symmetry = clamp(100 - Math.abs((points[P.leftHip].y - points[P.leftShoulder].y) - (points[P.rightHip].y - points[P.rightShoulder].y)) * 160)
    const kneeAngle = (angle(points[P.leftHip], points[P.leftKnee], points[P.leftAnkle]) + angle(points[P.rightHip], points[P.rightKnee], points[P.rightAnkle])) / 2
    const elbowAngle = (angle(points[P.leftShoulder], points[P.leftElbow], points[P.leftWrist]) + angle(points[P.rightShoulder], points[P.rightElbow], points[P.rightWrist])) / 2
    const extendedJoint = this.skill.id === 'handstand-push-up-1' || this.skill.category === 'handstand-push-up'
      ? elbowAngle
      : kneeAngle
    const sample: Sample = { time, confidence, alignment, symmetry, jointExtension: clamp(100 - Math.max(0, 165 - extendedJoint) * 2) }
    this.samples.push(sample)
    this.lastSample = sample

    const dt = this.previousTime === undefined ? 0 : Math.max(0, Math.min(0.5, time - this.previousTime))
    this.previousTime = time
    const isStatic = this.skill.type === 'static' || this.skill.type === 'combined'
    const isValidPosition = confidence >= 0.45 && alignment >= 60 && (this.skill.category !== 'front-lever' || kneeAngle >= (this.skill.id.includes('tuck') ? 40 : 125))
    if (this.settings.measureHold && isStatic) {
      if (isValidPosition) {
        this.currentHold += dt
        this.totalHold += dt
        this.longestHold = Math.max(this.longestHold, this.currentHold)
      } else {
        if (this.currentHold > 0.4 && this.currentHold < 1.5) this.partialReps += 1
        this.currentHold = 0
      }
    }
    if (this.skill.type === 'dynamic') this.updateRepetition(elbowAngle, frontLine, time, points)
    return this.live(confidence)
  }

  private updateRepetition(elbowAngle: number, frontLine: number, time: number, points: PosePoint[]) {
    const id = this.skill.id
    const isPress = this.skill.category === 'bent-arm-press'
    const isFrontRaise = this.skill.name === 'Front Lever Raises'
    const isPullUp = this.skill.name.includes('Pull-Ups')
    const isHandstandWalk = this.skill.name === 'Handstand Walking'
    const elbowDriven = this.skill.category === 'handstand-push-up' || isPullUp
    const bottom = isPress ? frontLine > 55 : isFrontRaise ? frontLine > 55 : elbowDriven ? elbowAngle < 100 : elbowAngle < 100
    const top = isPress ? frontLine < 25 : isFrontRaise ? frontLine < 25 : elbowDriven ? elbowAngle > 145 : elbowAngle > 145
    if (isHandstandWalk) {
      const left = points[P.leftWrist]
      const right = points[P.rightWrist]
      const moved = (this.countedLeftWrist !== undefined && Math.abs(left.x - this.countedLeftWrist) > 0.06) ||
        (this.countedRightWrist !== undefined && Math.abs(right.x - this.countedRightWrist) > 0.06)
      if (this.countedLeftWrist === undefined || this.countedRightWrist === undefined) {
        this.countedLeftWrist = left.x
        this.countedRightWrist = right.x
      } else if (moved) {
        this.validReps += 1
        this.countedLeftWrist = left.x
        this.countedRightWrist = right.x
      }
      return
    }
    if (this.phase === 'ready' && (isPress ? bottom : top)) {
      this.phase = 'lowered'
      this.repStarted = time
    } else if (this.phase === 'lowered' && (isPress ? top : bottom) && time - this.repStarted > 0.25) {
      this.phase = 'returning'
    } else if (this.phase === 'returning' && (isPress ? bottom : top)) {
      if (time - this.repStarted > 0.5) this.validReps += 1
      else this.partialReps += 1
      this.phase = 'ready'
    }
    if (this.phase !== 'ready' && time - this.repStarted > 12) {
      this.partialReps += 1
      this.phase = 'ready'
    }
  }

  private live(confidence: number): LiveMetrics {
    return {
      confidence,
      validReps: this.validReps,
      partialReps: this.partialReps,
      currentHold: this.currentHold,
      longestHold: this.longestHold,
      totalHold: this.totalHold,
    }
  }

  report(): AnalysisReport {
    const confidence = avg(this.samples.map((sample) => sample.confidence))
    const alignment = avg(this.samples.map((sample) => sample.alignment))
    const symmetry = avg(this.samples.map((sample) => sample.symmetry))
    const joint = avg(this.samples.map((sample) => sample.jointExtension))
    const enoughEvidence = this.samples.length >= 12 && confidence >= 0.45
    const movement = this.skill.type === 'dynamic'
      ? clamp((this.validReps / this.settings.targetReps) * 100 - this.partialReps * 12)
      : this.settings.measureHold
        ? clamp((this.longestHold / this.settings.targetHold) * 100)
        : clamp(alignment)
    const criteria = [
      { name: 'Body alignment', score: Math.round(alignment), detail: 'Estimated from 2D shoulder, hip and ankle landmarks.' },
      { name: 'Joint position', score: Math.round(joint), detail: 'Estimated joint extension; camera perspective affects angles.' },
      { name: 'Control & stability', score: Math.round(symmetry), detail: 'A rough proxy from visible left-right landmark consistency.' },
      { name: this.skill.type === 'dynamic' ? 'Movement completion' : 'Position consistency', score: Math.round(movement), detail: this.skill.type === 'dynamic' ? 'Based on detected movement phases.' : 'Based on valid-position duration and pose visibility.' },
    ]
    const score = enoughEvidence ? Math.round(avg(criteria.map((criterion) => criterion.score))) : null
    const issues: string[] = []
    if (enoughEvidence && alignment < 65) issues.push(this.skill.category === 'front-lever' ? 'Hips appear to drop below the shoulder-to-ankle line.' : 'Body line drifts from vertical during the analyzed frames.')
    if (enoughEvidence && joint < 65) issues.push('Visible knee or elbow extension appears inconsistent.')
    if (enoughEvidence && symmetry < 65) issues.push('Left and right side landmarks appear uneven; check camera angle and symmetry.')
    if (this.partialReps > 0) issues.push(`${this.partialReps} movement phase${this.partialReps === 1 ? '' : 's'} did not meet the completion criteria.`)
    const positives = enoughEvidence
      ? [alignment >= 75 ? 'Good body-line alignment in the visible frames.' : 'A clear baseline is available for tracking body-line changes.', confidence >= 0.7 ? 'Landmark visibility was strong for most analyzed frames.' : 'Some pose landmarks were visible throughout the attempt.']
      : ['No reliable technique judgment was produced; improve framing and lighting before comparing results.']
    const suggestions = [
      alignment < 75 ? 'Record from the recommended side angle and keep your full body in frame.' : `Keep practicing ${this.skill.name.toLowerCase()} with the same camera setup for comparable results.`,
      joint < 75 ? 'Prioritize a controlled range and pause briefly at the positions you want to own.' : 'Use a slower tempo to make technique changes easier to verify.',
      confidence < 0.65 ? 'Improve lighting and avoid covering joints with clothing or equipment.' :       `Focus on: ${(this.settings.focus || this.skill.checkpoints[0]).toLowerCase()}.`,
    ]
    return {
      score,
      confidence: Math.round(confidence * 100),
      insufficientConfidence: !enoughEvidence,
      framesAnalyzed: this.samples.length,
      validReps: this.validReps,
      partialReps: this.partialReps,
      longestHold: this.longestHold,
      totalHold: this.totalHold,
      criteria,
      issues,
      positives,
      suggestions,
      timestampExamples: issues.slice(0, 3).map((issue) => ({ time: this.lastSample?.time ?? 0, issue })),
    }
  }
}

export const formatTime = (seconds: number) => {
  const total = Math.floor(seconds)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
