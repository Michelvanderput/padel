import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: DashboardView
  },
  {
    path: '/leden',
    name: 'leden',
    component: () => import('../views/MembersView.vue')
  },
  {
    path: '/nieuw',
    name: 'nieuw',
    component: () => import('../views/NewReservationView.vue')
  },
  {
    path: '/wachtrij',
    name: 'wachtrij',
    component: () => import('../views/QueueView.vue')
  },
  {
    path: '/beschikbaarheid',
    name: 'beschikbaarheid',
    component: () => import('../views/AvailabilityView.vue')
  },
  {
    path: '/instellingen',
    name: 'instellingen',
    component: () => import('../views/SettingsView.vue')
  }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
