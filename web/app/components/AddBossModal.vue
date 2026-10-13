<script setup lang="ts">
import { parseHms } from '../../shared/bosses'
import { useBossStore } from '../../stores/bosses'

const open = defineModel<boolean>('open', { required: true })
const store = useBossStore()

const name = ref('')
const location = ref('')
const hours = ref('1')
const minutes = ref('0')
const seconds = ref('')

function close() {
  open.value = false
}

function submit() {
  const m = parseHms(hours.value, minutes.value, seconds.value)
  if (!name.value.trim() || !Number.isFinite(m) || m < 1) return
  store.addCustomBoss(name.value, location.value, m)
  name.value = ''
  location.value = ''
  hours.value = '1'
  minutes.value = '0'
  seconds.value = ''
  close()
}
</script>

<template>
  <UiAppModal
    v-model:open="open"
    title="Добавить босса"
    size="sm"
  >
    <div class="modal-fields">
      <input v-model="name" class="field-input" type="text" placeholder="Название" autofocus>
      <input v-model="location" class="field-input" type="text" placeholder="Место (необязательно)">
      <p class="countdown-caption">Интервал респауна (пустое поле = 0)</p>
      <div class="duration-fields">
        <label class="duration-field">
          <span>ч</span>
          <input v-model="hours" class="field-input" type="number" min="0" step="1" inputmode="numeric">
        </label>
        <label class="duration-field">
          <span>мин</span>
          <input v-model="minutes" class="field-input" type="number" min="0" step="1" inputmode="numeric">
        </label>
        <label class="duration-field">
          <span>сек</span>
          <input v-model="seconds" class="field-input" type="number" min="0" step="1" inputmode="numeric">
        </label>
      </div>
    </div>

    <template #footer>
      <button type="button" class="btn" @click="close">
        Отмена
      </button>
      <button type="button" class="btn btn-primary" @click="submit">
        Добавить
      </button>
    </template>
  </UiAppModal>
</template>
