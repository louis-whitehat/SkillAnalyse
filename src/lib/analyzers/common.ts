import type { PosePoint } from '../../types'

export const landmark = {
  leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16, leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28,
} as const

export type Point = { x: number; y: number }

export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
export const angle = (a: Point, b: Point, c: Point) => {
  const bax = a.x - b.x
  const bay = a.y - b.y
  const bcx = c.x - b.x
  const bcy = c.y - b.y
  const denominator = Math.hypot(bax, bay) * Math.hypot(bcx, bcy)
  if (denominator < 0.000001) return 0
  const cosine = (bax * bcx + bay * bcy) / denominator
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI
}
export const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
export const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))
export const frameConfidence = (points: PosePoint[]) =>
  average([
    landmark.leftShoulder, landmark.rightShoulder, landmark.leftElbow, landmark.rightElbow,
    landmark.leftWrist, landmark.rightWrist, landmark.leftHip, landmark.rightHip,
    landmark.leftKnee, landmark.rightKnee, landmark.leftAnkle, landmark.rightAnkle,
  ].map((index) => points[index].visibility))

export function jointAngles(points: PosePoint[]) {
  const p = landmark
  const leftElbow = angle(points[p.leftShoulder], points[p.leftElbow], points[p.leftWrist])
  const rightElbow = angle(points[p.rightShoulder], points[p.rightElbow], points[p.rightWrist])
  return {
    knee: (angle(points[p.leftHip], points[p.leftKnee], points[p.leftAnkle]) + angle(points[p.rightHip], points[p.rightKnee], points[p.rightAnkle])) / 2,
    hip: (angle(points[p.leftShoulder], points[p.leftHip], points[p.leftKnee]) + angle(points[p.rightShoulder], points[p.rightHip], points[p.rightKnee])) / 2,
    elbow: (leftElbow + rightElbow) / 2,
    elbowAsymmetry: Math.abs(leftElbow - rightElbow),
  }
}

export function bodyLine(points: PosePoint[]) {
  const shoulder = midpoint(points[landmark.leftShoulder], points[landmark.rightShoulder])
  const hip = midpoint(points[landmark.leftHip], points[landmark.rightHip])
  const ankle = midpoint(points[landmark.leftAnkle], points[landmark.rightAnkle])
  const horizontalDeviation = Math.abs(Math.atan2(ankle.y - shoulder.y, ankle.x - shoulder.x) * 180 / Math.PI)
  const verticalDeviation = Math.abs(Math.atan2(ankle.x - shoulder.x, ankle.y - shoulder.y) * 180 / Math.PI)
  const hipOffset = Math.abs((ankle.x - shoulder.x) * (shoulder.y - hip.y) - (shoulder.x - hip.x) * (ankle.y - shoulder.y)) /
    Math.max(0.001, Math.hypot(ankle.x - shoulder.x, ankle.y - shoulder.y))
  const sideDifference = Math.abs(
    (points[landmark.leftHip].y - points[landmark.leftShoulder].y) -
    (points[landmark.rightHip].y - points[landmark.rightShoulder].y),
  )
  return {
    shoulder,
    hip,
    ankle,
    frontLine: Math.min(horizontalDeviation, 180 - horizontalDeviation),
    verticalDeviation,
    hipOffset,
    hipSag: Math.abs(hip.y - shoulder.y),
    symmetry: clamp(100 - sideDifference * 160),
  }
}

export function bodyAlignment(deviation: number, hipDeviation: number, angleScale: number) {
  return clamp(100 - Math.max(0, deviation - 8) * angleScale - Math.max(0, hipDeviation - 0.025) * 500)
}
