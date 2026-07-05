<script setup lang="ts">
const props = defineProps<{
  kind: "privacy" | "terms";
}>();

const sections =
  props.kind === "privacy"
    ? [
        {
          title: "What we collect",
          body: "Scope Trips stores the account details you provide (email and display name), the spots, trips, reviews, and photos you create, and basic usage analytics when you consent to them. Location data is only used to power map features you interact with.",
        },
        {
          title: "How we use it",
          body: "Your data powers the product: rendering your map, building itineraries, and sharing what you choose to share with friends. We do not sell personal data to third parties.",
        },
        {
          title: "Cookies and analytics",
          body: "We use a session cookie to keep you signed in and optional analytics that you can decline from the cookie banner. Declining analytics never limits app functionality.",
        },
        {
          title: "Your controls",
          body: "You can edit or delete your content at any time, and you can request account deletion from Settings. Deleting your account removes your personal data from active systems.",
        },
        {
          title: "Contact",
          body: "Questions about privacy? Reach out through the contact options listed on the About page and we will respond promptly.",
        },
      ]
    : [
        {
          title: "Using Scope Trips",
          body: "Scope Trips is provided for personal, non-commercial trip planning and discovery. You are responsible for the content you post and for keeping your account credentials secure.",
        },
        {
          title: "Your content",
          body: "You keep ownership of the spots, reviews, and photos you publish. By posting, you grant Scope Trips a license to display that content within the product so features like the shared map and social feed can work.",
        },
        {
          title: "Acceptable use",
          body: "Do not post unlawful content, impersonate others, scrape the service, or attempt to disrupt the platform. We may remove content or suspend accounts that violate these rules.",
        },
        {
          title: "Service availability",
          body: "We work to keep Scope Trips reliable, but the service is provided as-is without warranties. Features may change or be discontinued as the product evolves.",
        },
        {
          title: "Changes to these terms",
          body: "If these terms change in a meaningful way, we will note the update here. Continuing to use Scope Trips after changes means you accept the updated terms.",
        },
      ];
</script>

<template>
  <main class="section padded-top">
    <article class="card article-card">
      <p class="eyebrow">
        Scope Trips
      </p>
      <h1>{{ kind === 'privacy' ? 'Privacy Policy' : 'Terms of Service' }}</h1>
      <p class="lead">
        {{
          kind === 'privacy'
            ? 'How Scope Trips handles the data behind your maps, trips, and shared adventures.'
            : 'The ground rules for planning, posting, and exploring with Scope Trips.'
        }}
      </p>
      <template
        v-for="section in sections"
        :key="section.title"
      >
        <h2>{{ section.title }}</h2>
        <p>{{ section.body }}</p>
      </template>
    </article>
  </main>
</template>
