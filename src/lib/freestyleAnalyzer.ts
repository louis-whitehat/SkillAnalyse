import type { AnalysisReport, FreestyleAnalysis, FreestyleSegment, LiveMetrics, PosePoint } from '../types'
import { analyzeFrontLever } from './analyzers/frontLever'
import { analyzeHandstand } from './analyzers/handstand'
import { analyzeHandstandPushUp } from './analyzers/handstandPushUp'
import { analyzePushUp } from './analyzers/pushUp'
import { landmark, midpoint } from './analyzers/common'

type PoseKind = FreestyleSegment['kind']

interface FrameSample {
  time: number
  kind: PoseKind | null
  confidence: number
  alignment: number
  elbowAngle: number
  kneeAngle: number
  hipAngle: number
  hipY: number
  ankleY: number
}

interface EventWindow {
  kind: PoseKind
  samples: FrameSample[]
}

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

function classifyPose(points: PosePoint[]): FrameSample {
  const handstand = analyzeHandstand(points)
  const hspu = analyzeHandstandPushUp(points)
  const lever = analyzeFrontLever(points)
  const pushup = analyzePushUp(points)
  const shoulder = midpoint(points[landmark.leftShoulder], points[landmark.rightShoulder])
  const wrists = midpoint(points[landmark.leftWrist], points[landmark.rightWrist])
  const ankles = midpoint(points[landmark.leftAnkle], points[landmark.rightAnkle])
  const confidence = handstand.confidence
  const handstandCue = confidence >= 0.45 && ankles.y < shoulder.y - 0.025 && handstand.verticalDeviation < 42
  const horizontalCue = confidence >= 0.45 && lever.frontLine < 28
  let kind: PoseKind | null = null
  let alignment = 0
  let elbowAngle = handstand.elbowAngle
  let kneeAngle = handstand.kneeAngle
  let hipAngle = handstand.hipAngle

  if (handstandCue) {
    kind = 'handstand'
    alignment = handstand.alignment
    elbowAngle = hspu.elbowAngle
  } else if (horizontalCue && wrists.y < shoulder.y - 0.015 && lever.elbowAngle > 125) {
    kind = 'front-lever'
    alignment = lever.alignment
    elbowAngle = lever.elbowAngle
    kneeAngle = lever.kneeAngle
    hipAngle = lever.hipAngle
  } else if (horizontalCue && wrists.y > shoulder.y + 0.015 && pushup.elbowAngle > 0) {
    kind = 'push-up'
    alignment = pushup.alignment
    elbowAngle = pushup.elbowAngle
    kneeAngle = pushup.kneeAngle
    hipAngle = pushup.hipAngle
  }
  if (!kind && confidence >= 0.45) kind = 'unknown'

  return {
    time: 0,
    kind,
    confidence,
    alignment,
    elbowAngle,
    kneeAngle,
    hipAngle,
    hipY: midpoint(points[landmark.leftHip], points[landmark.rightHip]).y,
    ankleY: ankles.y,
  }
}

function countCycles(samples: FrameSample[]) {
  let phase: 'top' | 'bottom' = 'top'
  let bottomAt: number | undefined
  let repetitions = 0
  let partialRepetitions = 0
  let previousTime: number | undefined
  for (const sample of samples) {
    if (sample.elbowAngle < 95 && phase === 'top') {
      phase = 'bottom'
      bottomAt = sample.time
    } else if (sample.elbowAngle > 145 && phase === 'bottom') {
      if (bottomAt !== undefined && sample.time - bottomAt >= 0.25) repetitions += 1
      else partialRepetitions += 1
      phase = 'top'
      bottomAt = undefined
    }
    previousTime = sample.time
  }
  if (phase === 'bottom' && bottomAt !== undefined && previousTime !== undefined) partialRepetitions += 1
  return { repetitions, partialRepetitions }
}

export class FreestyleAnalyzer {
  private samples: FrameSample[] = []
  private lowConfidenceFrames = 0
  private previousTime: number | undefined
  private previousKind: PoseKind | null = null
  private bottomAt: number | undefined
  private liveRepetitions = 0
  private livePartialRepetitions = 0
  private currentHold = 0
  private totalHold = 0
  private longestHold = 0
  private lastMetrics: LiveMetrics = { confidence: 0, validReps: 0, partialReps: 0, currentHold: 0, longestHold: 0, totalHold: 0 }

  consume(points: PosePoint[] | null, time: number): LiveMetrics {
    if (!points || points.length <= landmark.rightAnkle) {
      this.lowConfidenceFrames += 1
      this.samples.push({ time, kind: null, confidence: 0, alignment: 0, elbowAngle: 0, kneeAngle: 0, hipAngle: 0, hipY: 0, ankleY: 0 })
      this.lastMetrics = { ...this.lastMetrics, confidence: 0, currentHold: 0 }
      if (this.bottomAt !== undefined) {
        this.livePartialRepetitions += 1
        this.bottomAt = undefined
      }
      this.previousTime = time
      this.previousKind = null
      return this.lastMetrics
    }
    const sample = classifyPose(points)
    sample.time = time
    if (sample.confidence < 0.45) this.lowConfidenceFrames += 1
    this.samples.push(sample)
    const dt = this.previousTime === undefined ? 0 : Math.max(0, Math.min(0.25, time - this.previousTime))
    const matchingPosture = sample.confidence >= 0.45 && sample.kind !== null && sample.kind === this.previousKind
    if ((sample.kind === 'handstand' || sample.kind === 'front-lever') && sample.elbowAngle >= 125 && matchingPosture) {
      this.currentHold += dt
      this.totalHold += dt
      this.longestHold = Math.max(this.longestHold, this.currentHold)
    } else {
      this.currentHold = 0
    }
    const repetitionPosture = sample.kind === 'handstand' || sample.kind === 'push-up'
    if (repetitionPosture && sample.elbowAngle < 95 && this.bottomAt === undefined) {
      this.bottomAt = time
    } else if (repetitionPosture && sample.elbowAngle > 145 && this.bottomAt !== undefined) {
      if (time - this.bottomAt >= 0.25) this.liveRepetitions += 1
      else this.livePartialRepetitions += 1
      this.bottomAt = undefined
    } else if (!repetitionPosture && this.bottomAt !== undefined) {
      this.livePartialRepetitions += 1
      this.bottomAt = undefined
    }
    this.previousTime = time
    this.previousKind = sample.confidence >= 0.45 ? sample.kind : null
    this.lastMetrics = {
      confidence: sample.confidence,
      validReps: this.liveRepetitions,
      partialReps: this.livePartialRepetitions,
      currentHold: this.currentHold,
      longestHold: this.longestHold,
      totalHold: this.totalHold,
    }
    return this.lastMetrics
  }

  analysis(): FreestyleAnalysis {
    const duration = this.samples[this.samples.length - 1]?.time ?? 0
    const segments = this.buildSegments()
    return {
      duration,
      framesAnalyzed: this.samples.filter((sample) => sample.confidence >= 0.45).length,
      lowConfidenceFrames: this.lowConfidenceFrames,
      segments,
      reliableRepetitions: segments.reduce((sum, segment) =>
        sum + (segment.status === 'reliable' ? segment.repetitions : 0), 0),
      note: 'Skill labels are estimates from 2D pose geometry, not validated exercise recognition. Camera angle, equipment, wall contact, depth and occlusion are not identified. Similar variations (for example push-up styles, muscle-ups and pull-ups) cannot be reliably distinguished by these pose landmarks.',
    }
  }

  report(): AnalysisReport {
    const analysis = this.analysis()
    const validSamples = this.samples.filter((sample) => sample.confidence >= 0.45)
    const confidence = mean(this.samples.map((sample) => sample.confidence))
    const hasEnoughFrames = validSamples.length >= 12 && confidence >= 0.45 && validSamples.length / Math.max(1, this.samples.length) >= 0.4
    const totalHold = analysis.segments.reduce((sum, segment) => sum + segment.holdSeconds, 0)
    const longestHold = analysis.segments.reduce((longest, segment) => Math.max(longest, segment.holdSeconds), 0)
    const reps = analysis.segments.reduce((sum, segment) => sum + segment.repetitions, 0)
    const partial = analysis.segments.reduce((sum, segment) => sum + segment.partialRepetitions, 0)
    const issues = analysis.segments.flatMap((segment) => segment.status === 'unclear' ? [segment.feedback] : [])
    return {
      score: null,
      confidence: Math.round(confidence * 100),
      insufficientConfidence: !hasEnoughFrames,
      framesAnalyzed: validSamples.length,
      validReps: reps,
      partialReps: partial,
      longestHold,
      totalHold,
      repConfidence: [],
      criteria: [],
      issues,
      positives: hasEnoughFrames ? ['Pose landmarks were visible for enough frames to inspect broad movement patterns.'] : ['There were not enough clear pose frames to classify movement reliably.'],
      suggestions: ['Use a side view and keep hands, shoulders, hips, knees and ankles visible for the whole recording.'],
      timestampExamples: [],
      movementRange: 'not-assessable',
      limitations: [analysis.note, ...(hasEnoughFrames ? [] : ['The camera did not provide enough confident pose frames; no skill result should be inferred.'])],
    }
  }

  private buildSegments(): FreestyleSegment[] {
    const events: EventWindow[] = []
    let active: EventWindow | undefined
    let lastKnownTime = -1
    for (const sample of this.samples) {
      const kind = sample.confidence >= 0.45 ? sample.kind : null
      if (!kind) {
        if (active && sample.time - lastKnownTime > 0.65) active = undefined
        continue
      }
      if (active?.kind === kind && sample.time - lastKnownTime <= 0.65) {
        active.samples.push(sample)
      } else {
        active = { kind, samples: [sample] }
        events.push(active)
      }
      lastKnownTime = sample.time
    }
    return events.flatMap((event) => {
      const samples = event.samples
      const start = samples[0]?.time ?? 0
      const end = samples[samples.length - 1]?.time ?? start
      const duration = Math.max(0, end - start)
      if (samples.length < 8 || duration < 0.55) return []
      const meanConfidence = mean(samples.map((sample) => sample.confidence))
      const alignment = mean(samples.map((sample) => sample.alignment))
      const cycles = event.kind === 'handstand' || event.kind === 'push-up' ? countCycles(samples) : { repetitions: 0, partialRepetitions: 0 }
      const holdSeconds = cycles.repetitions > 0 || event.kind === 'unknown' || event.kind === 'push-up' ? 0 : duration
      const kind: PoseKind = event.kind === 'handstand' && cycles.repetitions > 0
        ? 'handstand-push-up'
        : event.kind
      if (kind === 'unknown' && duration < 1.5) return []
      if (kind === 'unknown') {
        const bodyMotion = Math.max(
          Math.max(...samples.map((sample) => sample.hipY)) - Math.min(...samples.map((sample) => sample.hipY)),
          Math.max(...samples.map((sample) => sample.ankleY)) - Math.min(...samples.map((sample) => sample.ankleY)),
        )
        const elbowMotion = Math.max(...samples.map((sample) => sample.elbowAngle)) - Math.min(...samples.map((sample) => sample.elbowAngle))
        if (bodyMotion < 0.035 && elbowMotion < 25) return []
      }
      const highVisibility = meanConfidence >= 0.78
      const status: FreestyleSegment['status'] = kind === 'unknown' || kind === 'handstand' && !highVisibility
        ? 'unclear'
        : highVisibility && (kind === 'handstand-push-up' || kind === 'push-up') && cycles.repetitions > 0
          ? 'reliable'
          : 'estimated'
      const name = kind === 'unknown'
        ? 'Unclassified movement'
        : kind === 'handstand-push-up'
        ? 'Handstand Push-up pattern'
        : kind === 'handstand'
          ? 'Handstand hold'
          : kind === 'front-lever'
            ? this.frontLeverName(samples)
            : 'Push-up pattern'
      const feedback = kind === 'unknown'
        ? 'Pose landmarks were visible, but no supported movement pattern matched this interval. Choose a label only after checking the video.'
        : alignment < 60
        ? 'Alignment varied in the visible 2D landmarks; perspective can affect this estimate.'
        : alignment < 78
          ? 'Some body-line deviation was visible; review the video from a side angle.'
          : 'A broadly aligned body line was visible; balance and full 3D technique are not verified.'
      return [{
        id: crypto.randomUUID(),
        kind,
        name,
        start,
        end,
        repetitions: cycles.repetitions,
        partialRepetitions: cycles.partialRepetitions,
        holdSeconds,
        confidence: Math.round(meanConfidence * 100),
        status,
        alignment: Math.round(alignment),
        feedback,
        confirmed: false,
      }]
    })
  }

  private frontLeverName(samples: FrameSample[]) {
    const kneeAngle = mean(samples.map((sample) => sample.kneeAngle))
    const hipAngle = mean(samples.map((sample) => sample.hipAngle))
    if (kneeAngle < 105) return hipAngle < 100 ? 'Tuck front-lever pattern' : 'Advanced-tuck front-lever pattern'
    if (kneeAngle > 155) return 'Extended front-lever pattern'
    return 'Front-lever pattern'
  }
}
