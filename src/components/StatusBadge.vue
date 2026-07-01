<script setup>
defineProps({ status: { type: String, required: true } })

const config = {
  pending:   { label: 'Wachtend',     dot: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 border border-amber-200',   pulse: false },
  active:    { label: 'Actief',       dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700 border border-blue-200',       pulse: true  },
  reserved:  { label: 'Gereserveerd',dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border border-green-200',    pulse: false },
  failed:    { label: 'Mislukt',      dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border border-red-200',          pulse: false },
  cancelled: { label: 'Geannuleerd', dot: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-500 border border-slate-200',   pulse: false },
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
    :class="config[status]?.badge ?? 'bg-slate-100 text-slate-500'"
  >
    <span
      class="w-1.5 h-1.5 rounded-full flex-shrink-0"
      :class="[config[status]?.dot ?? 'bg-slate-400', config[status]?.pulse ? 'animate-pulse' : '']"
    ></span>
    {{ config[status]?.label ?? status }}
  </span>
</template>
