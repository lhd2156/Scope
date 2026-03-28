<template>
  <AppShell>
    <div class="page-container page-stack">
      <SectionHeading
        eyebrow="Spot detail"
        title="Spot depth view"
        description="Photos, reviews, and trip-worthiness all tied to the content engine contract."
      />
      <SpotDetail :spot="spotsStore.selectedSpot" />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '@/components/common/AppShell.vue';
import SectionHeading from '@/components/common/SectionHeading.vue';
import SpotDetail from '@/components/spots/SpotDetail.vue';
import { useSpotsStore } from '@/stores/spots';

const route = useRoute();
const spotsStore = useSpotsStore();

onMounted(async () => {
  await spotsStore.fetchSpot(String(route.params.id));
});
</script>
