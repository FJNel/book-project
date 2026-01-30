export default {
  title: "The Book Project",
  description: "Documentation and guides",
  base: "/docs/",
  outDir: "../docs",
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: "Guides", link: "/guides/getting-started" },
      { text: "FAQ", link: "/faq" },
      { text: "Privacy", link: "/legal/privacy-policy" },
      { text: "Terms", link: "/legal/terms-of-use" },
      { text: "Back to App", link: "/" }
    ],
    sidebar: {
      "/guides/": [
        {
          text: "Guides",
          items: [
            { text: "Getting Started", link: "/guides/getting-started" },
            { text: "Managing Books", link: "/guides/managing-books" },
            { text: "Managing Authors", link: "/guides/managing-authors" }
          ]
        }
      ],
      "/legal/": [
        {
          text: "Legal",
          items: [
            { text: "Privacy Policy", link: "/legal/privacy-policy" },
            { text: "Terms of Use", link: "/legal/terms-of-use" }
          ]
        }
      ]
    },
    search: { provider: "local" }
  }
};
