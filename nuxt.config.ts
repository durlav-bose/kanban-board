// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  build: {
    transpile: ['vue-virtual-scroller']
  },

  css: [
    'vue-virtual-scroller/dist/vue-virtual-scroller.css'
  ],
  
  vite: {
    server: {
      allowedHosts: [
        '.trycloudflare.com'  // Allow all cloudflare tunnel hosts
      ]
    }
  }
})
