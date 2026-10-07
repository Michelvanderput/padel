// Pagina-animaties wachten op de preloader (alleen bij het eerste bezoek per sessie).
let resolve
export const introReady = new Promise(r => { resolve = r })
export const finishIntro = () => resolve()
