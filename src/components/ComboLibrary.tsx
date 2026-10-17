import { useCallback, useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, Copy, Plus, Save, Trash2 } from 'lucide-react'
import { comboTemplates, type ComboItem } from '../data/combos'
import { skills } from '../data/skills'
import { translate, type Language } from '../lib/language'

interface UserCombo {
  id: string
  name: string
  difficulty: number
  steps: ComboItem[]
}

const storageKey = 'skillanalyse-user-combos'
const defaultSkillId = skills.find((skill) => skill.name === 'Standard Push-ups')?.id ?? skills[0].id
const newStep = (): ComboItem => ({
  id: crypto.randomUUID(),
  skillId: defaultSkillId,
  repetitions: 1,
  holdSeconds: 0,
  restSeconds: 0,
  transition: '',
  note: '',
})

function loadCombos(): UserCombo[] {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.every((combo) =>
      typeof combo.id === 'string' && typeof combo.name === 'string' && Array.isArray(combo.steps) &&
      combo.steps.every((step: unknown) => typeof step === 'object' && step !== null &&
        'skillId' in step && typeof step.skillId === 'string' &&
        'id' in step && typeof step.id === 'string'),
    )) throw new Error('Saved combo data is not in the expected format.')
    return parsed as UserCombo[]
  } catch (reason) {
    console.warn('Could not load saved combos.', reason)
    return []
  }
}

export function ComboLibrary({ language, onFreestyle }: { language: Language; onFreestyle: (name: string) => void }) {
  const t = useCallback((value: string) => translate(value, language), [language])
  const [saved, setSaved] = useState<UserCombo[]>(loadCombos)
  const [name, setName] = useState('')
  const [draftDifficulty, setDraftDifficulty] = useState(3)
  const [steps, setSteps] = useState<ComboItem[]>([newStep()])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('all')
  const [comparisonId, setComparisonId] = useState('')
  const [error, setError] = useState('')

  const visibleTemplates = useMemo(() => comboTemplates.filter((combo) =>
    (difficulty === 'all' || combo.difficulty === Number(difficulty)) &&
    (`${combo.name} ${combo.category} ${combo.description}`.toLowerCase().includes(search.toLowerCase()) ||
    `${t(combo.name)} ${t(combo.category)} ${t(combo.description)}`.toLowerCase().includes(search.toLowerCase())),
  ), [difficulty, search, t])
  const visibleSaved = saved.filter((combo) => `${combo.name} ${t(combo.name)} ${combo.steps.map((step) => skills.find((skill) => skill.id === step.skillId)?.name ?? '').join(' ')}`.toLowerCase().includes(search.toLowerCase()))

  const persist = (combos: UserCombo[]) => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(combos))
      setSaved(combos)
      setError('')
      return true
    } catch (reason) {
      console.error('Could not save custom combos locally.', reason)
      setError(t('Could not save your combo in this browser. Check available local storage.'))
      return false
    }
  }

  const edit = (combo: UserCombo) => {
    setName(combo.name)
    setDraftDifficulty(combo.difficulty ?? 3)
    setSteps(combo.steps.map((step) => ({ ...step })))
    setEditingId(combo.id)
  }

  const loadTemplate = (templateId: string) => {
    const template = comboTemplates.find((candidate) => candidate.id === templateId)
    if (!template) return
    setName(template.name)
    setDraftDifficulty(template.difficulty)
    setSteps(template.steps.map((step) => ({ ...step, id: crypto.randomUUID() })))
    setEditingId(null)
  }

  const save = () => {
    const trimmedName = name.trim()
    if (!trimmedName || steps.length === 0) {
      setError(t('Give the combo a name and add at least one skill.'))
      return
    }
    const id = editingId ?? crypto.randomUUID()
    const next = { id, name: trimmedName, difficulty: draftDifficulty, steps: steps.map((step) => ({ ...step })) }
    const updated = editingId
      ? saved.map((combo) => combo.id === editingId ? next : combo)
      : [...saved, next]
    if (persist(updated)) setEditingId(id)
  }

  const duplicate = (combo: UserCombo) => {
    persist([...saved, { ...combo, id: crypto.randomUUID(), name: `${combo.name} (${t('copy')})`, steps: combo.steps.map((step) => ({ ...step, id: crypto.randomUUID() })) }])
  }

  const remove = (combo: UserCombo) => {
    if (!window.confirm(t(`Delete combo “${combo.name}”?`))) return
    persist(saved.filter((candidate) => candidate.id !== combo.id))
    if (editingId === combo.id) {
      setEditingId(null)
      setName('')
      setDraftDifficulty(3)
      setSteps([newStep()])
    }
  }

  const updateStep = (stepId: string, changes: Partial<ComboItem>) => {
    setSteps((previous) => previous.map((step) => step.id === stepId ? { ...step, ...changes } : step))
  }

  const comparison = comboTemplates.find((template) => template.id === comparisonId)

  return <section className="combo-library panel">
    <div className="panel-heading"><div><div className="eyebrow">{t('COMBO LIBRARY')}</div><h2>{t('Combo library & builder')}</h2></div></div>
    <p className="combo-intro">{t('Browse example sequences or save your own. Combo templates are suggestions, not safety guarantees; scale skills to your current ability.')}</p>
    <div className="combo-library-filters"><label className="search-field combo-search"><span className="sr-only">{t('Search combos')}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search combos…')} /></label><label>{t('Filter combos by difficulty')}<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="all">{t('All levels')}</option>{[1, 2, 3, 4, 5].map((level) => <option value={level} key={level}>{t('Level')} {level}</option>)}</select></label></div>
    <div className="combo-template-grid">
      {visibleTemplates.map((template) => <article className="combo-template-card panel" key={template.id}>
        <div className="combo-template-head"><span className="combo-difficulty">{t('Level')} {template.difficulty}</span><span>{t(template.category)}</span></div>
        <h3>{t(template.name)}</h3><p>{t(template.description)}</p>
        <ol>{template.steps.map((step) => {
          const skillName = skills.find((skill) => skill.id === step.skillId)?.name ?? ''
          return <li key={step.id}>{t(skillName)}{step.repetitions > 1 ? ` · ${step.repetitions} ${t('reps')}` : ''}{step.holdSeconds > 0 ? ` · ${step.holdSeconds}s` : ''}</li>
        })}</ol>
        <small><strong>{t('Prerequisites')}:</strong> {template.prerequisites.map(t).join(' · ')}</small>
        <div className="combo-template-actions"><button className="button-secondary" onClick={() => loadTemplate(template.id)}><ArrowDown size={14} /> {t('Edit as my combo')}</button><button className="text-button" onClick={() => onFreestyle(template.name)}>{t('Use as freestyle reference')} <ArrowRight size={14} /></button><button className="text-button" onClick={() => setComparisonId(comparisonId === template.id ? '' : template.id)}>{comparisonId === template.id ? t('Hide comparison') : t('Compare')}</button></div>
      </article>)}
    </div>
    {comparison && <div className="combo-comparison panel"><strong>{t('Reference sequence')}: {t(comparison.name)}</strong><ol>{comparison.steps.map((step) => <li key={step.id}>{t(skills.find((skill) => skill.id === step.skillId)?.name ?? '')}</li>)}</ol><p>{t('Compare the reference with your current draft below; this is a planning aid, not a movement assessment.')}</p><strong>{t('Your draft')}: {name ? t(name) : t('Untitled combo')}</strong><ol>{steps.map((step) => <li key={step.id}>{t(skills.find((skill) => skill.id === step.skillId)?.name ?? '')}</li>)}</ol></div>}

    <div className="combo-draft panel">
      <div className="panel-heading"><div><div className="eyebrow">{t('YOUR COMBOS')}</div><h3>{editingId ? t('Edit saved combo') : t('Create a custom combo')}</h3></div><button className="button-secondary" onClick={() => { setEditingId(null); setName(''); setDraftDifficulty(3); setSteps([newStep()]); setError('') }}>{t('New combo')}</button></div>
      <div className="combo-draft-meta"><label className="combo-name-field">{t('Combo name')}<input value={name} maxLength={70} onChange={(event) => setName(event.target.value)} placeholder={t('Name your sequence')} /></label><label>{t('Difficulty')}<select value={draftDifficulty} onChange={(event) => setDraftDifficulty(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((level) => <option value={level} key={level}>{t('Level')} {level}</option>)}</select></label></div>
      <div className="combo-step-list">{steps.map((step, index) => <div className="combo-step-editor panel" key={step.id}>
        <div className="combo-step-number">{String(index + 1).padStart(2, '0')}</div>
        <div className="combo-step-fields">
          <label>{t('Skill')}<select value={step.skillId} onChange={(event) => updateStep(step.id, { skillId: event.target.value })}>{skills.map((skill) => <option value={skill.id} key={skill.id}>{t(skill.name)} · {t(skill.categoryName)}</option>)}</select></label>
          <label>{t('Reps')}<input type="number" min="0" max="99" value={step.repetitions} onChange={(event) => updateStep(step.id, { repetitions: Math.max(0, Math.min(99, Number(event.target.value) || 0)) })} /></label>
          <label>{t('Hold (sec)')}<input type="number" min="0" max="600" value={step.holdSeconds} onChange={(event) => updateStep(step.id, { holdSeconds: Math.max(0, Math.min(600, Number(event.target.value) || 0)) })} /></label>
          <label>{t('Rest (sec)')}<input type="number" min="0" max="600" value={step.restSeconds} onChange={(event) => updateStep(step.id, { restSeconds: Math.max(0, Math.min(600, Number(event.target.value) || 0)) })} /></label>
          <label>{t('Transition')}<input value={step.transition} maxLength={100} placeholder={t('e.g. stabilize before moving on')} onChange={(event) => updateStep(step.id, { transition: event.target.value })} /></label>
          <label>{t('Note')}<input value={step.note} maxLength={100} placeholder={t('Optional note')} onChange={(event) => updateStep(step.id, { note: event.target.value })} /></label>
        </div>
        <div className="combo-step-actions"><button className="icon-button" aria-label={t(`Move step ${index + 1} up`)} disabled={index === 0} onClick={() => setSteps((previous) => { const next = [...previous]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next })}><ArrowUp size={14} /></button><button className="icon-button" aria-label={t(`Move step ${index + 1} down`)} disabled={index === steps.length - 1} onClick={() => setSteps((previous) => { const next = [...previous]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next })}><ArrowDown size={14} /></button><button className="icon-button destructive" aria-label={t(`Remove step ${index + 1}`)} disabled={steps.length <= 1} onClick={() => setSteps((previous) => previous.filter((candidate) => candidate.id !== step.id))}><Trash2 size={14} /></button></div>
      </div>)}</div>
      <div className="combo-editor-footer"><button className="button-secondary" onClick={() => setSteps((previous) => [...previous, newStep()])}><Plus size={15} /> {t('Add skill')}</button><button className="button-primary" onClick={save}><Save size={15} /> {t('Save combo')}</button></div>
      {error && <p className="combo-save-error" role="alert">{error}</p>}
      {visibleSaved.length > 0 && <div className="saved-combo-list"><h3>{t('Saved combos')}</h3>{visibleSaved.map((combo) => <div className="saved-combo-row" key={combo.id}><div><strong>{t(combo.name)} · {t('Level')} {combo.difficulty ?? 3}</strong><small>· {combo.steps.length} {t('steps')} · {combo.steps.map((step) => t(skills.find((skill) => skill.id === step.skillId)?.name ?? '')).join(' → ')}</small></div><div><button className="text-button" onClick={() => edit(combo)}>{t('Edit')}</button><button className="text-button" onClick={() => duplicate(combo)}><Copy size={13} /> {t('Duplicate')}</button><button className="text-button destructive-text" onClick={() => remove(combo)}><Trash2 size={13} /> {t('Delete')}</button><button className="text-button" onClick={() => onFreestyle(combo.name)}>{t('Freestyle')}</button></div></div>)}</div>}
    </div>
  </section>
}
