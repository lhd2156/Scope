import { mount, RouterLinkStub } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import App from "@/App.vue";
import { assetPath, featureDeepDives, features, findPostBySlug, navLinks, posts, stats } from "@/data";
import AboutPage from "@/pages/AboutPage.vue";
import BlogPage from "@/pages/BlogPage.vue";
import BlogPostPage from "@/pages/BlogPostPage.vue";
import DownloadPage from "@/pages/DownloadPage.vue";
import FeaturesPage from "@/pages/FeaturesPage.vue";
import HomePage from "@/pages/HomePage.vue";
import LegalPage from "@/pages/LegalPage.vue";

let routeSlug: string | undefined = "ai-trip-planning";

vi.mock("vue-router", async () => {
  const actual = await vi.importActual<typeof import("vue-router")>("vue-router");
  return {
    ...actual,
    useRoute: () => ({ params: { slug: routeSlug } }),
  };
});

const stubs = {
  RouterLink: RouterLinkStub,
  RouterView: { template: "<main>route outlet</main>" },
};

describe("site data and pages", () => {
  it("renders the app shell navigation, menu toggles, and footer links", async () => {
    const wrapper = mount(App, { global: { stubs } });

    expect(wrapper.text()).toContain("Scope");
    for (const link of navLinks) {
      expect(wrapper.text()).toContain(link.label);
    }

    const button = wrapper.get("button");
    expect(button.text()).toBe("Menu");
    await button.trigger("click");
    expect(button.text()).toBe("Close");
    await wrapper.findAllComponents(RouterLinkStub)[1].trigger("click");
    expect(button.text()).toBe("Menu");
  });

  it("renders all marketing pages from shared data", () => {
    expect(assetPath("/screenshots/map-view.png")).toContain("/screenshots/map-view.png");
    expect(navLinks).toHaveLength(4);
    expect(stats).toHaveLength(4);
    expect(features).toHaveLength(6);
    expect(featureDeepDives).toHaveLength(3);
    expect(posts).toHaveLength(3);
    expect(findPostBySlug("ai-trip-planning").title).toBe("AI Trip Planning With Community Signal");
    expect(findPostBySlug(["missing-post"]).title).toBe(posts[0].title);

    const home = mount(HomePage, { global: { stubs } });
    expect(home.text()).toContain("Plan Real Trips");
    expect(home.text()).toContain(features[0].title);
    expect(home.find("img").attributes("src")).toContain("/screenshots/map-view.png");

    const featuresPage = mount(FeaturesPage);
    expect(featuresPage.text()).toContain("Discovery, planning, and sharing");
    expect(featuresPage.text()).toContain(featureDeepDives[1].badges[0]);

    expect(mount(AboutPage).text()).toContain("Architecture");
    expect(mount(BlogPage, { global: { stubs } }).text()).toContain(posts[0].title);
    expect(mount(DownloadPage).text()).toContain("Open App");
  });

  it("renders blog post matches, fallback posts, and legal variants", () => {
    routeSlug = "building-scope-architecture";
    const matched = mount(BlogPostPage, { global: { stubs } });
    expect(matched.text()).toContain("Building Scope Trips Architecture");
    expect(matched.text()).toContain("engineering");

    routeSlug = "missing-post";
    const fallback = mount(BlogPostPage, { global: { stubs } });
    expect(fallback.text()).toContain(posts[0].title);

    expect(mount(LegalPage, { props: { kind: "privacy" } }).text()).toContain("Privacy");
    expect(mount(LegalPage, { props: { kind: "terms" } }).text()).toContain("Terms");
  });
});
