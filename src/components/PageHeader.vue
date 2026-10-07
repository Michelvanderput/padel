<script setup>
defineProps({
  eyebrow:  { type: String, required: true },
  title:    { type: String, required: true },   // \n = regeleinde
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <header class="mb-10 flex flex-wrap items-end justify-between gap-6 sm:mb-14">
    <div class="min-w-0">
      <p data-reveal class="eyebrow eyebrow-lime mb-4 flex items-center gap-3"><span class="h-px w-8 bg-lime"></span>{{ eyebrow }}</p>
      <h1 data-split class="display title-lg text-fog" style="white-space: pre-line">{{ title }}</h1>
      <p v-if="subtitle" data-reveal class="mt-5 max-w-lg text-lg leading-snug text-mist">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.default" data-reveal class="flex flex-wrap gap-3"><slot /></div>
  </header>
</template>
