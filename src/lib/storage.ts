import { openDB } from 'idb'
import type { TrainingSession } from '../types'

const database = openDB('calisthenics-ai', 1, {
  upgrade(db) {
    db.createObjectStore('sessions', { keyPath: 'id' })
  },
})

export const listSessions = async () =>
  (await database).getAll('sessions') as Promise<TrainingSession[]>

export const saveSession = async (session: TrainingSession) =>
  (await database).put('sessions', session)

export const deleteSession = async (id: string) =>
  (await database).delete('sessions', id)

export const clearSessions = async () =>
  (await database).clear('sessions')
