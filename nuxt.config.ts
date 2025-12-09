// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  
  // modules: [
  //   '@nuxtjs/tailwindcss',
  // ],

  css: [
    'vue-virtual-scroller/dist/vue-virtual-scroller.css',
  ],

  vite: {
    optimizeDeps: {
      include: ['vue-virtual-scroller']
    }
  },

  app: {
    head: {
      title: 'Kanban Board - Virtual Scroll',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    }
  },

  // Performance optimizations
  experimental: {
    payloadExtraction: true,
    renderJsonPayloads: true,
  },
})