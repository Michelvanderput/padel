<script setup>
// Padelbaan van boven (10 × 20 m, 10 eenheden per meter). Alleen lijnen, zodat
// DrawSVG ze kan "tekenen".
defineProps({ strokeWidth: { type: Number, default: 1.4 } })
</script>

<template>
  <svg viewBox="-6 -6 112 212" fill="none" stroke="currentColor" :stroke-width="strokeWidth"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <rect class="court-line" x="0" y="0" width="100" height="200" rx="2" />
    <line class="court-line" x1="-4" y1="100" x2="104" y2="100" />
    <line class="court-line" x1="0" y1="30.5" x2="100" y2="30.5" />
    <line class="court-line" x1="0" y1="169.5" x2="100" y2="169.5" />
    <line class="court-line" x1="50" y1="30.5" x2="50" y2="169.5" />
    <slot />
  </svg>
</template>
