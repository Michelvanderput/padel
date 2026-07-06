import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const lisaToken    = ref(localStorage.getItem('knltb-lisa-token') || 'pRBYZW5NuaF9GXaxwHxmXA==')
  const clubId       = ref(localStorage.getItem('knltb-club-id') || '568d56ef-ba65-405d-b2e1-82453a182de1')

  watch(lisaToken,   val => localStorage.setItem('knltb-lisa-token', val))
  watch(clubId,      val => localStorage.setItem('knltb-club-id', val))

  const isConfigured = computed(() => lisaToken.value.trim().length > 0)

  return { lisaToken, clubId, isConfigured }
})
