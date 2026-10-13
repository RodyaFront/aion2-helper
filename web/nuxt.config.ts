// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  devtools: { enabled: false },
  modules: ['@pinia/nuxt'],
  css: ['~/assets/css/tokens.css', '~/assets/css/main.css'],
  pinia: {
    storesDirs: ['./stores/**'],
  },

  app: {
    head: {
      title: 'AION 2 — трекер боссов',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Локальный трекер полевых боссов Вертерона (Lamuatan)' },
      ],
    },
    baseURL: '/',
  },
  nitro: {
    preset: 'static',
  },
  router: {
    options: {
      hashMode: true,
    },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
})
