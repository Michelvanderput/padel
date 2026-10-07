import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import magnetic from './directives/magnetic'
import tilt from './directives/tilt'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.directive('magnetic', magnetic)
app.directive('tilt', tilt)
app.mount('#app')
