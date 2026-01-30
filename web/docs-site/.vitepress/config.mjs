export default {
  title: "The Book Project",
  description: "Documentation and Guides",
  base: "/docs/",
  outDir: "../docs",
  ignoreDeadLinks: true,

  themeConfig: {
    logo: "../../assets/img/Icon.png",

    nav: [
      { text: "Guides", link: "/guides/getting-started" },
      { text: "FAQ", link: "/faq" },
      { text: "Privacy", link: "/legal/privacy-policy" },
      { text: "Terms", link: "/legal/terms-of-use" },
      { text: "Back to App", link: "https://bookproject.fjnel.co.za/dashboard" }
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

    search: { provider: "local" },

    footer: {
      message: "The Book Project Documentation",
      copyright: "© 2026 The Book Project"
    },

    lastUpdated: {
      text: "Last Updated"
    }
  }
};
