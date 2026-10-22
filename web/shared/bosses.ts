export interface BossDef {
  id: string
  name: string
  nameRu: string
  location: string
  locationRu: string
  respawnMinutes: number
  image: string
  /** Game NPC template ids from packets (SkeeveAN field_bosses.json). */
  npcIds?: number[]
}

/**
 * Verteron field bosses (Elyos / Lamuatan). Respawn is kill-based (timer from kill).
 * RU names/locations: wikily client data; cross-checked with questlog.gg RU NPC pages
 * (e.g. Silent Dartan = Немая Тартан, https://questlog.gg/aion-2/ru/db/npc/2101120).
 * Note: https://questlog.gg/aion-2/en/boss-schedule is Reshanta fixed schedule only —
 * it does not list Verteron field-boss intervals.
 */
export const VERTERON_BOSSES: BossDef[] = [
  { id: 'kernon_west', name: 'Kernon of the West', nameRu: 'Кернон запада', location: 'Cantas Valley', locationRu: 'Запад долины Кантаса', respawnMinutes: 30, image: '/bosses/kernon_west.webp', npcIds: [2100050] },
  { id: 'neikel_east', name: 'Neikel of the East', nameRu: 'Нейкель востока', location: 'Dawn Legion Base', locationRu: 'Восток долины Кантаса', respawnMinutes: 30, image: '/bosses/neikel_east.webp', npcIds: [2100003] },
  { id: 'rotten_kutar', name: 'Rotten Kutar', nameRu: 'Гнилой Кутар', location: 'Marsh Legion Campsite', locationRu: 'Болото реки Эллун', respawnMinutes: 30, image: '/bosses/rotten_kutar.webp', npcIds: [2100040] },
  { id: 'blooming_korin', name: 'Blooming Korin', nameRu: 'Расцветший Корин', location: 'Ellun River Midstream', locationRu: 'Среднее течение реки Эллун', respawnMinutes: 60, image: '/bosses/blooming_korin.webp', npcIds: [2100141] },
  { id: 'bodyguard_teegant', name: 'Bodyguard Teegant', nameRu: 'Стражник Тигант', location: 'Destroyed Abyss Gate', locationRu: 'Разрушенные врата Бездны', respawnMinutes: 90, image: '/bosses/bodyguard_teegant.webp', npcIds: [2100079] },
  { id: 'kusan_mad', name: 'Kusan the Mad Gladiator', nameRu: 'Безумный берсерк Кусан', location: 'Verteron Fortress Ruins', locationRu: 'Руины крепости Бертрон', respawnMinutes: 120, image: '/bosses/kusan_mad.webp', npcIds: [2100076] },
  { id: 'ritualist_garshim', name: 'Ritualist Garshim', nameRu: 'Ритуалист Гаршим', location: 'Verteron Fortress Ruins', locationRu: 'Руины крепости Бертрон', respawnMinutes: 120, image: '/bosses/ritualist_garshim.webp', npcIds: [2100077] },
  { id: 'scholar_aulla', name: 'Scholar Aulla', nameRu: 'Ученый Раулла', location: 'Aullaeu Village', locationRu: 'Поселение ауллау', respawnMinutes: 120, image: '/bosses/scholar_aulla.webp', npcIds: [2100988] },
  { id: 'chaser_taulo', name: 'Chaser Taulo', nameRu: 'Гонитель Тауло', location: 'Forest of Exiles', locationRu: 'Лес изгнанников', respawnMinutes: 120, image: '/bosses/chaser_taulo.webp', npcIds: [2100991] },
  { id: 'bloodfang_pnyn', name: 'Bloodfang Pnyn', nameRu: 'Кровоклык Фнин', location: 'Northern Tolbas Forest', locationRu: 'Север леса Тольбас', respawnMinutes: 180, image: '/bosses/bloodfang_pnyn.webp', npcIds: [2100178] },
  { id: 'furious_saursus', name: 'Furious Saursus', nameRu: 'Разъяренная Сарус', location: 'Night Dew Cave', locationRu: 'Пещера ночной росы', respawnMinutes: 180, image: '/bosses/furious_saursus.webp', npcIds: [2100177] },
  { id: 'heretic_layla', name: 'Heretic Layla', nameRu: 'Отступница Лейла', location: 'Rock Tomb Hill', locationRu: 'Холм скалистой гробницы', respawnMinutes: 180, image: '/bosses/heretic_layla.webp', npcIds: [2100582] },
  { id: 'harvest_moshav', name: 'Harvest Manager Moshav', nameRu: 'Управляющий сбором Мошав', location: 'Drana Plantation', locationRu: 'Зона переработки драны', respawnMinutes: 180, image: '/bosses/harvest_moshav.webp', npcIds: [2100876] },
  { id: 'black_tentacle_lawa', name: 'Black Tentacle Lawa', nameRu: 'Черное щупальце Лава', location: 'Ancient Zumion Temple Site', locationRu: 'Артамийское ущелье', respawnMinutes: 240, image: '/bosses/black_tentacle_lawa.webp', npcIds: [2100617] },
  { id: 'forest_aullamu', name: 'Forest Warrior Aullamu', nameRu: 'Лесной воин Ураму', location: 'Aullaeu Village', locationRu: 'Поселение ауллау', respawnMinutes: 240, image: '/bosses/forest_aullamu.webp', npcIds: [2100989] },
  { id: 'centurion_demiros', name: 'Centurion Demiros', nameRu: 'Центурион Демирос', location: 'Destroyed Temple Site', locationRu: 'Место разрушенного храма', respawnMinutes: 240, image: '/bosses/centurion_demiros.webp', npcIds: [2100708] },
  { id: 'sentinel_knash', name: "Sentinel K'nash", nameRu: 'Страж Кнаш', location: 'Drana Transport Hub', locationRu: 'Зона переработки драны', respawnMinutes: 240, image: '/bosses/sentinel_knash.webp', npcIds: [2100877] },
  { id: 'divine_ansas', name: 'Divine Ansas', nameRu: 'Священный Ансас', location: 'Contaminated Sanctum', locationRu: 'Зараженное святилище', respawnMinutes: 360, image: '/bosses/divine_ansas.webp', npcIds: [2100718] },
  { id: 'phantasm_kasia', name: 'Phantasm Kasia', nameRu: 'Касия фантазии', location: 'Garden of the Illusion God', locationRu: 'Сад Бога иллюзий', respawnMinutes: 360, image: '/bosses/phantasm_kasia.webp', npcIds: [2100661] },
  { id: 'soul_kashapa', name: 'Soul Ruler Kashapa', nameRu: 'Властелин душ Кашапа', location: 'Ancient Zumion Temple Site', locationRu: 'Восток Артамийского плато', respawnMinutes: 360, image: '/bosses/soul_kashapa.webp', npcIds: [2101122] },
  { id: 'researcher_setram', name: 'Researcher Setram', nameRu: 'Исследователь Сетрам', location: 'Nahid Brigade Fortress', locationRu: 'Крепость армии Нахида', respawnMinutes: 360, image: '/bosses/researcher_setram.webp', npcIds: [2101016] },
  { id: 'silent_dartan', name: 'Silent Dartan', nameRu: 'Немая Тартан', location: 'Southern Altamia Highland', locationRu: 'Юг Артамийского плато', respawnMinutes: 360, image: '/bosses/silent_dartan.webp', npcIds: [2101120] },
  { id: 'high_commander_lagta', name: 'High Commander Lagta', nameRu: 'Глава армии Рагт', location: 'Drana Plantation', locationRu: 'Плантация драны', respawnMinutes: 720, image: '/bosses/high_commander_lagta.webp', npcIds: [2101131] },
  { id: 'eternal_gartua', name: 'Eternal Gartua', nameRu: 'Вечный Гартуа', location: 'Forest of Exiles', locationRu: 'Остров вечности', respawnMinutes: 720, image: '/bosses/eternal_gartua.webp', npcIds: [2101074] },
]

/**
 * Altgard field bosses (Asmodian). Same kill-based respawn tiers as Verteron
 * after the Dec 2025 interval shortening. Ids are prefixed so shared names
 * (Silent Dartan, Kashapa, Lagta, Gartua) keep separate timers.
 * EN names/locations: MetaBot / grimvane; RU names: dbaion2.ru Altgard map.
 */
export const ALTGARD_BOSSES: BossDef[] = [
  { id: 'altgard_melted_danar', name: 'Melted Danar', nameRu: 'Расплавленный Данар', location: 'Dredgion Crash Site', locationRu: 'Место крушения дреджна', respawnMinutes: 30, image: '', npcIds: [2400017] },
  { id: 'altgard_black_warrior_aed', name: 'Black Warrior Aed', nameRu: 'Черный воин Аэд', location: 'Nameless Cemetery', locationRu: 'Безымянное кладбище', respawnMinutes: 30, image: '', npcIds: [2400074] },
  { id: 'altgard_faithful_rajit', name: 'Faithful Rajit', nameRu: 'Верный Ладжит', location: 'Sanctum Outpost', locationRu: 'Застава святилища', respawnMinutes: 30, image: '', npcIds: [2400140] },
  { id: 'altgard_berserker_vargor', name: 'Berserker Vargor', nameRu: 'Берсерк Вальг', location: 'Sanctum Outpost', locationRu: 'Застава святилища', respawnMinutes: 60, image: '', npcIds: [2400141] },
  { id: 'altgard_blood_warrior_lannar', name: 'Blood Warrior Lannar', nameRu: 'Воин крови Ланнар', location: 'Moslan Forest', locationRu: 'Лес Мослан', respawnMinutes: 90, image: '', npcIds: [2400223] },
  { id: 'altgard_predator_garsan', name: 'Predator Garsan', nameRu: 'Хищник Гарсан', location: 'Moslan Forest', locationRu: 'Лес Мослан', respawnMinutes: 120, image: '', npcIds: [2400212] },
  { id: 'altgard_deceiver_trid', name: 'Deceiver Trid', nameRu: 'Притворщица Трида', location: 'Uruthumheim', locationRu: 'Уртумхейм', respawnMinutes: 120, image: '', npcIds: [2400274] },
  { id: 'altgard_blue_wave_kelpina', name: 'Blue Wave Kelpina', nameRu: 'Келпина лазурной волны', location: 'Purifying Forest', locationRu: 'Очищающий лес', respawnMinutes: 120, image: '', npcIds: [2400335] },
  { id: 'altgard_high_overseer_nutah', name: 'High Overseer Nutah', nameRu: 'Главный надзиратель Нута', location: 'Dranactus', locationRu: 'Дранактус', respawnMinutes: 120, image: '', npcIds: [2400353] },
  { id: 'altgard_advisor_resana', name: 'Advisor Resana', nameRu: 'Советник Рсан', location: 'Dranactus', locationRu: 'Дранактус', respawnMinutes: 180, image: '', npcIds: [2400358] },
  { id: 'altgard_ops_leader_linx', name: 'Special Operations Leader Linx', nameRu: 'Капитан спецотряда Линкс', location: 'Basfelt Ruins', locationRu: 'Руины Басфельта', respawnMinutes: 180, image: '', npcIds: [2400419] },
  { id: 'altgard_addicted_hardirun', name: 'Addicted Hardirun', nameRu: 'Одурманенный Хадирун', location: 'Fafnite Deposit', locationRu: 'Залежи фафнита', respawnMinutes: 180, image: '', npcIds: [2400474] },
  { id: 'altgard_veteran_shujakan', name: 'Veteran Shujakan', nameRu: 'Ветеран Шужакан', location: 'Black Claw Village', locationRu: 'Деревня Черного Когтя', respawnMinutes: 180, image: '', npcIds: [2400607] },
  { id: 'altgard_desecrator_newbold', name: 'Desecrator Newbold', nameRu: 'Осквернитель Ноблуд', location: 'Legion Base Ruins', locationRu: 'Руины базы легиона', respawnMinutes: 240, image: '', npcIds: [2400424] },
  { id: 'altgard_specter_axios', name: 'Specter Archon Axios', nameRu: 'Акан потерянных душ Аксиос', location: 'Basfelt Ruins', locationRu: 'Руины Басфельта', respawnMinutes: 240, image: '', npcIds: [2400425] },
  { id: 'altgard_executioner_barthien', name: 'Executioner Barthien', nameRu: 'Эмиссар Варсиен', location: 'Western Gribade Highland', locationRu: 'Запад Грибадского нагорья', respawnMinutes: 240, image: '', npcIds: [2400504] },
  { id: 'altgard_visionary_karuka', name: 'Visionary Karuka', nameRu: 'Визионер Карука', location: 'Black Claw Village', locationRu: 'Деревня Черного Когтя', respawnMinutes: 240, image: '', npcIds: [2400608] },
  { id: 'altgard_weapon_guruta', name: 'Drakan Battalion Weapon Guruta', nameRu: 'Биооружие отряда драканов Гурута', location: 'Eastern Gribade Highland', locationRu: 'Восток Грибадского нагорья', respawnMinutes: 360, image: '', npcIds: [2400593] },
  { id: 'altgard_dark_shadow_vishwada', name: 'Dark Shadow Vishwada', nameRu: 'Вишвада темной тени', location: 'Lagta Fortress', locationRu: 'Крепость Рагта', respawnMinutes: 360, image: '', npcIds: [2400659] },
  { id: 'altgard_sharp_shylak', name: 'Sharp Shylak', nameRu: 'Острый Шурак', location: 'Impetusium Square', locationRu: 'Площадь Импетусиум', respawnMinutes: 360, image: '', npcIds: [2400709] },
  { id: 'altgard_silent_dartan', name: 'Silent Dartan', nameRu: 'Немая Тартан', location: 'Basfelt Ruins', locationRu: 'Руины Басфельта', respawnMinutes: 360, image: '', npcIds: [2400855] },
  { id: 'altgard_soul_kashapa', name: 'Soul Ruler Kashapa', nameRu: 'Властелин душ Кашапа', location: 'Fafnite Deposit', locationRu: 'Залежи фафнита', respawnMinutes: 360, image: '', npcIds: [2400854] },
  { id: 'altgard_high_commander_lagta', name: 'High Commander Lagta', nameRu: 'Глава армии Рагт', location: 'Lagta Fortress', locationRu: 'Крепость Рагта', respawnMinutes: 720, image: '', npcIds: [2400853] },
  { id: 'altgard_immortal_gartua', name: 'Immortal Gartua', nameRu: 'Бессмертный Гартуа', location: 'Immortal Isle', locationRu: 'Остров бессмертия', respawnMinutes: 720, image: '', npcIds: [2400800] },
]

export type BossRegionId = 'verteron' | 'altgard'

export function bossesForRegion(regionId: BossRegionId): BossDef[] {
  return regionId === 'altgard' ? ALTGARD_BOSSES : VERTERON_BOSSES
}

/** Resolve a packet NPC id only within one region (no cross-faction fallback). */
export function bossByNpcIdInRegion(npcId: number, regionId: BossRegionId): BossDef | undefined {
  if (!Number.isFinite(npcId)) return undefined
  return bossesForRegion(regionId).find((b) => b.npcIds?.includes(npcId))
}

/** Resolve a packet NPC id to a catalog boss for the active region (then any region). */
export function bossByNpcId(npcId: number, regionId: BossRegionId): BossDef | undefined {
  if (!Number.isFinite(npcId)) return undefined
  return bossByNpcIdInRegion(npcId, regionId)
    ?? VERTERON_BOSSES.find((b) => b.npcIds?.includes(npcId))
    ?? ALTGARD_BOSSES.find((b) => b.npcIds?.includes(npcId))
}

/**
 * Seconds-before-respawn warnings (mild → aggressive).
 * 15m ping · 10m warning · 10s ALERT
 */
export const ALERT_THRESHOLDS_SEC = [900, 600, 10] as const
export const READY_ALERT = 0 as const
export type WarnThreshold = (typeof ALERT_THRESHOLDS_SEC)[number]
export type AlertThreshold = WarnThreshold | typeof READY_ALERT
export type BossWarnTier = 'ping' | 'warning' | 'alert'

export function warnTierForThreshold(sec: WarnThreshold): BossWarnTier {
  if (sec <= 10) return 'alert'
  if (sec <= 600) return 'warning'
  return 'ping'
}

export function formatWarnLead(sec: number): string {
  if (sec < 60) return `${sec} сек`
  const mins = Math.round(sec / 60)
  return `${mins} мин`
}

const VALID_ALERT_THRESHOLDS = new Set<number>([...ALERT_THRESHOLDS_SEC, READY_ALERT])

export function normalizeFiredAlerts(raw: unknown): AlertThreshold[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is AlertThreshold => typeof x === 'number' && VALID_ALERT_THRESHOLDS.has(x))
}

/** Empty / invalid part → 0 (not a validation error). */
export function parseDurationPart(raw: string | number | null | undefined): number {
  if (raw === '' || raw == null) return 0
  const n = Number(String(raw).trim().replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

/** Hours + minutes + seconds → total minutes (fractional from seconds). */
export function parseHms(
  h: string | number | null | undefined,
  m: string | number | null | undefined,
  s: string | number | null | undefined,
): number {
  return parseDurationPart(h) * 60 + parseDurationPart(m) + parseDurationPart(s) / 60
}

export function splitMinutes(totalMinutes: number): { h: number, m: number, s: number } {
  const totalSec = Math.max(0, Math.round(totalMinutes * 60))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return { h, m, s }
}

export function formatInterval(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '-'
  const totalSec = Math.round(minutes * 60)
  if (totalSec < 60) return `${totalSec} сек`
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return s === 0 ? `${m} мин` : `${m} мин ${s} сек`
  }
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`
}

export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return 'Готов'
  const s = Math.floor(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '_').replace(/^_|_$/g, '')
  return base || 'boss'
}
