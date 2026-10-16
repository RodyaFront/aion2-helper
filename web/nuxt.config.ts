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
      script: [
        {
          // Hash router ignores the path. `http://localhost:3000/monsters#/`
          // would open bosses (`#/`). Jump to the monsters tab before Vue boots.
          innerHTML: "(function(){var p=location.pathname.replace(/\\/+$/,'')||'/';var h=location.hash;if((p==='/monsters'||p.indexOf('/monsters/')===0)&&(h===''||h==='#'||h==='#/')){location.replace('/#/monsters')}})()",
          tagPriority: 'critical',
        },
      ],
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
