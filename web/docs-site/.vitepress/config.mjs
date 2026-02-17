export default {
  title: "The Book Project",
  description: "Documentation and Guides",
  base: "/docs/",
  outDir: "../docs",
  ignoreDeadLinks: true,

  themeConfig: {
    logo: "../../assets/img/Icon.png",

    nav: [
      { text: "Guides", link: "/guides/setup/getting-started" },
      { text: "FAQ", link: "/faq" },
      { text: "Privacy", link: "/legal/privacy-policy" },
      { text: "Terms", link: "/legal/terms-of-use" },
      { text: "Back to App", link: "https://bookproject.fjnel.co.za/dashboard" }
    ],

    sidebar: {
      "/guides/": [
        {
          text: "Setup",
          items: [
            { text: "Getting Started", link: "/guides/setup/getting-started" },
            { text: "Creating an Account", link: "/guides/setup/creating-an-account" },
            { text: "Reset Your Password", link: "/guides/setup/reset-your-password" }
          ]
        },
        {
          text: "Library",
          items: [
            { text: "Managing Books", link: "/guides/library/managing-books" },
            { text: "Adding a Book", link: "/guides/library/books-adding-a-book" },
            { text: "Editing a Book", link: "/guides/library/books-editing-a-book" },
            { text: "Browsing Books", link: "/guides/library/books-browsing-books" },
            { text: "Book Details", link: "/guides/library/books-book-details" },
            { text: "Managing Book Copies", link: "/guides/library/books-managing-copies" },
            { text: "Managing Authors", link: "/guides/library/managing-authors" },
            { text: "Managing Authors (Full Guide)", link: "/guides/library/authors-managing-authors" },
            { text: "Managing Publishers", link: "/guides/library/publishers-managing-publishers" },
            { text: "Managing Series", link: "/guides/library/series-managing-series" },
            { text: "Managing Book Types", link: "/guides/library/book-types-managing-book-types" },
            { text: "Managing Tags", link: "/guides/library/tags-managing-tags" },
            { text: "Languages in Books", link: "/guides/library/languages-in-books" },
            { text: "Managing Storage Locations", link: "/guides/library/storage-locations" }
          ]
        },
        {
          text: "Account",
          items: [
            { text: "Updating Your Profile", link: "/guides/account/updating-your-profile" },
            { text: "Changing Theme", link: "/guides/account/changing-theme" },
            { text: "Changing Your Password", link: "/guides/account/changing-your-password" },
            { text: "Changing Your Email Address", link: "/guides/account/changing-your-email" },
            { text: "Changing Email Preferences", link: "/guides/account/changing-email-preferences" },
            { text: "Devices and Sessions", link: "/guides/account/devices-and-sessions" },
            { text: "API Keys", link: "/guides/account/api-keys" },
            { text: "Disabling Your Account", link: "/guides/account/disabling-your-account" },
            { text: "Deleting Your Account", link: "/guides/account/deleting-your-account" }
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
