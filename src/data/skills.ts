import type { CategoryId, Skill } from '../types'

const definitions: Array<{
  category: CategoryId
  categoryName: string
  entries: Array<[string, number, 'static' | 'dynamic' | 'combined', string, string, string[]]>
}> = [
  {
    category: 'front-lever',
    categoryName: 'Front lever',
    entries: [
      ['Tuck Front Lever', 1, 'static', 'Hold a compact horizontal tuck with straight arms and a braced trunk.', 'Side view; frame shoulders through hips and knees.', ['Shoulders depressed', 'Hips level with shoulders', 'Knees tucked symmetrically']],
      ['Advanced Tuck Front Lever', 2, 'static', 'Open the tuck while keeping the trunk and thighs aligned.', 'Side view; full body in frame.', ['Straight elbows', 'No hip sag', 'Controlled tuck']],
      ['One Leg Front Lever', 3, 'static', 'Extend one leg while keeping the pelvis square and body horizontal.', 'Side view; show both legs clearly.', ['Level pelvis', 'Extended knee straight', 'Shoulders and hips aligned']],
      ['Straddle Front Lever', 4, 'static', 'Hold a horizontal body line with legs straddled and knees extended.', 'Side view; include the full straddle.', ['Straight knees', 'Even leg separation', 'No hip sag']],
      ['Full Front Lever', 5, 'static', 'Maintain a straight horizontal line from shoulders to ankles.', 'Side view; camera perpendicular to the body.', ['Straight body line', 'Locked elbows', 'No visible swinging']],
      ['Front Lever Raises', 4, 'dynamic', 'Raise and lower through a controlled range without swinging.', 'Side view; capture the start and horizontal position.', ['Controlled range', 'Straight arms', 'No kip']],
      ['Front Lever Pull-Ups', 5, 'dynamic', 'Pull from a front lever position while keeping the trunk rigid.', 'Side view; shoulders and elbows visible.', ['Elbow flexion', 'Stable body line', 'Controlled return']],
    ],
  },
  {
    category: 'handstand',
    categoryName: 'Handstand',
    entries: [
      ['Wall Handstand', 1, 'static', 'Stack wrists, shoulders, hips and ankles while using the wall for support.', 'Side view; show hands and feet.', ['Shoulders open', 'Hips stacked', 'Straight knees']],
      ['Freestanding Handstand', 3, 'static', 'Balance in a vertical line with small, controlled corrections.', 'Side view, slightly offset; full body visible.', ['Shoulder-hip-ankle stack', 'Quiet legs', 'Controlled balance']],
      ['Handstand Balance Hold', 3, 'static', 'Maintain a stable freestanding line for the longest controlled hold.', 'Side view; keep the whole body in frame.', ['Vertical body line', 'Minimal sway', 'Active shoulders']],
      ['Handstand Kick-Up', 2, 'dynamic', 'Kick up with control and finish in a balanced handstand.', 'Side view with clear floor and full body.', ['Controlled entry', 'Stacked finish', 'No uncontrolled arch']],
      ['Handstand Walking', 4, 'dynamic', 'Travel through alternating hand placements while maintaining control.', 'Front or rear view; show both hands and feet.', ['Alternating hand steps', 'Shoulder control', 'Steady direction']],
      ['Handstand', 3, 'static', 'Hold a freestanding handstand while keeping a controlled vertical line.', 'Side view, slightly offset; keep the full body and hands in frame.', ['Shoulders stacked over wrists', 'Hips near the shoulder-ankle line', 'Controlled balance corrections']],
      ['Handstand at the Wall', 1, 'static', 'Use the wall for support while practicing a stacked handstand position.', 'Side view; show hands, wall contact and feet.', ['Open shoulders', 'Hips stacked', 'Straight knees']],
    ],
  },
  {
    category: 'handstand-push-up',
    categoryName: 'Handstand push-ups',
    entries: [
      ['Pike Push-Ups', 1, 'dynamic', 'Lower the head between the hands and press back to straight arms.', 'Side view; include hands, head and hips.', ['Elbow bend', 'Consistent depth', 'Controlled press']],
      ['Elevated Pike Push-Ups', 2, 'dynamic', 'Press from an elevated pike while maintaining a stable shoulder position.', 'Side view; show elevation and full upper body.', ['Elbow tracking', 'Head reaches target depth', 'No bounce']],
      ['Wall Handstand Push-Ups', 3, 'dynamic', 'Descend and press vertically with the wall supporting balance.', 'Side view; camera perpendicular to wall.', ['Controlled descent', 'Consistent bottom position', 'Full press']],
      ['Deficit Handstand Push-Ups', 4, 'dynamic', 'Use the added range to reach a repeatable, controlled bottom position.', 'Side view; show blocks and head position.', ['Full range', 'Stable elbows', 'No uncontrolled drop']],
      ['Freestanding Handstand Push-Ups', 5, 'dynamic', 'Perform a controlled vertical press without wall support.', 'Side view, slightly offset; full body visible.', ['Balance through range', 'Controlled depth', 'Stable lockout']],
      ['Handstand Push-ups', 4, 'dynamic', 'Lower under control and press back up through a vertical shoulder range.', 'Side view; show hands, head and the full pressing path.', ['Controlled descent', 'Repeatable bottom position', 'Full press']],
    ],
  },
  {
    category: 'bent-arm-press',
    categoryName: 'Bent-arm press to handstand',
    entries: [
      ['Tuck Bent-Arm Press to Handstand', 2, 'dynamic', 'Press from a compact tuck through a controlled bent-arm transition.', 'Side view; show the entire entry and finish.', ['Controlled shoulder lean', 'Compact tuck', 'Stable handstand finish']],
      ['Straddle Bent-Arm Press to Handstand', 3, 'dynamic', 'Press with a wide straddle and controlled hip elevation.', 'Side view; full straddle visible.', ['Even straddle', 'Controlled transition', 'Stacked finish']],
      ['Pike Bent-Arm Press to Handstand', 4, 'dynamic', 'Press with legs together and hips elevated through the transition.', 'Side view; show feet, hips and hands.', ['Hip elevation', 'Legs together', 'No uncontrolled kick']],
      ['Full Bent-Arm Press to Handstand', 5, 'dynamic', 'Press through the bent-arm phase into a stable straight-body handstand.', 'Side view; full body visible throughout.', ['Controlled press', 'Straight finish', 'Minimal momentum']],
    ],
  },
  {
    category: 'push-up',
    categoryName: 'Push-ups',
    entries: [
      ['Standard Push-ups', 1, 'dynamic', 'Lower and press from a straight-body plank with controlled elbow movement.', 'Side view; keep shoulders, hips, elbows and wrists visible.', ['Consistent top and bottom positions', 'Hips stay near shoulder-ankle line', 'Controlled tempo']],
      ['Diamond Push-ups', 2, 'dynamic', 'Perform a close-hand push-up while maintaining a stable trunk.', 'Side view for range; front view for hand spacing.', ['Controlled elbow bend', 'Stable trunk', 'Even press']],
      ['Wide Push-ups', 1, 'dynamic', 'Press with a wider hand position while keeping the body braced.', 'Side view; front view can help show hand spacing.', ['Repeatable depth', 'Hips stay level', 'Controlled press']],
      ['Archer Push-ups', 3, 'dynamic', 'Shift load toward one arm while the opposite arm assists.', 'Front-oblique view; keep both arms visible.', ['Controlled side-to-side shift', 'Working elbow bends', 'Hips remain square']],
      ['Decline Push-ups', 2, 'dynamic', 'Perform a push-up with feet elevated and a stable body line.', 'Side view; show the feet elevation and full body.', ['Stable elevated feet', 'Controlled depth', 'No hip sag']],
      ['Incline Push-ups', 1, 'dynamic', 'Press from an elevated hand position with a controlled range.', 'Side view; show the support surface and full body.', ['Stable support', 'Consistent depth', 'Straight body line']],
      ['Pseudo Planche Push-ups', 3, 'dynamic', 'Lean shoulders forward over the hands and press without losing trunk control.', 'Side-oblique view; include shoulders and wrists.', ['Forward shoulder lean', 'Controlled elbow bend', 'Hips remain braced']],
      ['Explosive Push-ups', 3, 'dynamic', 'Press rapidly from the bottom position; speed itself is not measured.', 'Side view; keep the full press in frame.', ['Repeatable bottom depth', 'Stable trunk', 'Land softly if hands leave the floor']],
      ['Clap Push-ups', 4, 'dynamic', 'Press explosively and clap; airborne timing is not reliably measured by this pose model.', 'Side view; keep hands, shoulders and hips visible.', ['Controlled landing', 'Stable trunk', 'Repeatable depth']],
      ['Pike Push-ups', 1, 'dynamic', 'Use a pike position to practice a shoulder-dominant pressing pattern.', 'Side view; include hands, head and hips.', ['Hips stay elevated', 'Controlled head descent', 'Even press']],
      ['Typewriter Push-ups', 4, 'dynamic', 'Move laterally near the bottom of the push-up while bending one arm more than the other.', 'Front-oblique view; keep both arms visible throughout.', ['Controlled lateral travel', 'Alternate working sides', 'Keep hips square']],
      ['Uneven Push-ups', 3, 'dynamic', 'Press with one hand elevated while maintaining a braced body line.', 'Side-oblique view; show both hand heights.', ['Stable support', 'Controlled depth', 'Avoid trunk rotation']],
      ['One-Arm Push-up', 5, 'dynamic', 'Perform an advanced single-arm push-up with deliberate trunk control.', 'Front-oblique view; keep the supporting arm and hips visible.', ['Controlled range', 'Resist trunk rotation', 'Stable feet']],
    ],
  },
]

export const skills: Skill[] = definitions.flatMap(({ category, categoryName, entries }) =>
  entries.map(([name, level, type, description, camera, checkpoints], index) => ({
    id: `${category}-${index + 1}`,
    name,
    category,
    categoryName,
    level,
    type,
    description,
    camera,
    checkpoints,
    cues: checkpoints,
  })),
)

export const categories = [
  { id: 'all', label: 'All skills' },
  { id: 'front-lever', label: 'Front lever' },
  { id: 'handstand', label: 'Handstand' },
  { id: 'handstand-push-up', label: 'HSPU' },
  { id: 'push-up', label: 'Push-ups' },
  { id: 'bent-arm-press', label: 'Bent-arm press' },
] as const

export const getSkill = (id: string) => skills.find((skill) => skill.id === id)
