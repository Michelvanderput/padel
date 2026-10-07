<script setup>
defineProps({ status: { type: String, required: true } })

const config = {
  pending:   { label: 'Wachtend',     dot: 'bg-amber',  badge: 'border-amber/30 bg-amber/10 text-amber',   pulse: false },
  active:    { label: 'Actief',       dot: 'bg-sky',    badge: 'border-sky/30 bg-sky/10 text-sky',         pulse: true  },
  reserved:  { label: 'Gereserveerd', dot: 'bg-lime',   badge: 'border-lime/30 bg-lime/10 text-lime',      pulse: false },
  failed:    { label: 'Mislukt',      dot: 'bg-danger', badge: 'border-danger/30 bg-danger/10 text-danger', pulse: false },
  cancelled: { label: 'Geannuleerd',  dot: 'bg-mist',   badge: 'border-line bg-white/5 text-mist',         pulse: false },
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.12em]"
    :class="config[status]?.badge ?? 'border-line bg-white/5 text-mist'"
  >
    <span class="relative flex h-1.5 w-1.5 flex-shrink-0">
      <span v-if="config[status]?.pulse" class="absolute inline-flex h-full w-full animate-pulse-ring rounded-full" :class="config[status]?.dot"></span>
      <span class="relative inline-flex h-1.5 w-1.5 rounded-full" :class="config[status]?.dot ?? 'bg-mist'"></span>
    </span>
    {{ config[status]?.label ?? status }}
  </span>
</template>
