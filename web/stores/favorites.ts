import { defineStore } from 'pinia'
import { loadPersisted, savePersisted } from '../shared/persist'

type FavoritesPayload = {
  itemIds?: unknown
  mobIds?: unknown
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids = value.filter((id): id is string => typeof id === 'string' && id.length > 0)
  return [...new Set(ids)]
}

function toggleId(ids: string[], id: string): string[] {
  const next = new Set(ids)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return [...next]
}

export const useFavoritesStore = defineStore('favorites', {
  state: () => ({
    hydrated: false,
    itemIds: [] as string[],
    mobIds: [] as string[],
  }),

  getters: {
    itemIdSet(state): Set<string> {
      return new Set(state.itemIds)
    },
    mobIdSet(state): Set<string> {
      return new Set(state.mobIds)
    },
  },

  actions: {
    async hydrate() {
      if (!import.meta.client || this.hydrated) return
      const parsed = await loadPersisted<FavoritesPayload>('favorites')
      this.itemIds = idList(parsed?.itemIds)
      this.mobIds = idList(parsed?.mobIds)
      this.hydrated = true
    },

    persist() {
      if (!import.meta.client || !this.hydrated) return
      void savePersisted('favorites', {
        itemIds: this.itemIds,
        mobIds: this.mobIds,
      })
    },

    toggleItem(id: string) {
      this.itemIds = toggleId(this.itemIds, id)
      this.persist()
    },

    toggleMob(id: string) {
      this.mobIds = toggleId(this.mobIds, id)
      this.persist()
    },
  },
})
