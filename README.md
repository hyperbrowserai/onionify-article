## Here's a way to add some fun to your dry new cycle.

Now you can convert any new article into a more fun and interesting "Onionified" article.

### Steps

- First install the dependencies. We recommend yarn as a package manager

```bash
yarn
```

- Then build the project

```bash
yarn build
```

- And finally start the project. 

```bash
OPENAI_API_KEY=... HYPERBROWSER_API_KEY=... yarn start <ARTICLE URL GOES HERE>
```

### Env variables

This project requires
 - HYPERBROWSER_API_KEY: Used to scrape a website for the article and convert it to markdown.
 - OPENAI_API_KEY: Used to convert extracted text into the onion style article.