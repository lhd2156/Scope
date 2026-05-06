import { createRouter, createWebHistory } from "vue-router";
import AboutPage from "@/pages/AboutPage.vue";
import BlogPage from "@/pages/BlogPage.vue";
import BlogPostPage from "@/pages/BlogPostPage.vue";
import DownloadPage from "@/pages/DownloadPage.vue";
import FeaturesPage from "@/pages/FeaturesPage.vue";
import HomePage from "@/pages/HomePage.vue";
import LegalPage from "@/pages/LegalPage.vue";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", component: HomePage },
    { path: "/features", component: FeaturesPage },
    { path: "/about", component: AboutPage },
    { path: "/blog", component: BlogPage },
    { path: "/blog/:slug", component: BlogPostPage },
    { path: "/download", component: DownloadPage },
    { path: "/privacy", component: LegalPage, props: { kind: "privacy" } },
    { path: "/terms", component: LegalPage, props: { kind: "terms" } },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
