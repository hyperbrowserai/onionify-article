import { OpenAI } from "openai";
import hyperbrowser from "@hyperbrowser/sdk";
import { Command } from "commander";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod.mjs";

import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

marked.setOptions({
  // @ts-ignore
  renderer: new TerminalRenderer(),
});

import ora from "ora";
const spinner = ora();

const MAX_CHECKS = 5;

const ArticleSchema = z.object({
  title: z.string(),
  body: z.string(),
  author: z.string().optional(),
});
type Article = z.infer<typeof ArticleSchema>;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // This is the default and can be omitted
});
const hb_client = new hyperbrowser.default({
  apiKey: process.env.HYPERBROWSER_API_KEY as string,
});

async function sleep(timeout: number) {
  await new Promise((resolve) => setTimeout(resolve, timeout));
}

async function extractArticleFeaturesFromMarkdown(
  text: string
): Promise<Article> {
  spinner.text = "Getting article information from markdown";
  spinner.start();
  try {
    const prompt = `From the provided markdown string, extract the features required by the response format. Stick as close as possible to the provided schema.\n${text}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a data entry operator whose job is to extract certain features from a peice of text.",
        },
        { role: "user", content: prompt },
      ],
      response_format: zodResponseFormat(ArticleSchema, "article"),
      temperature: 0.7,
      max_tokens: 2000,
    });

    const parsedArticleSchema = ArticleSchema.safeParse(
      JSON.parse(response.choices[0].message.content || "")
    );
    if (parsedArticleSchema.success) {
      spinner.succeed("Got Article information from markdown");
      spinner.stop();
      return {
        title: parsedArticleSchema.data.title,
        body: parsedArticleSchema.data.body,
        author: parsedArticleSchema.data.author,
      };
    } else {
      throw new Error(
        `OpenAI produced response doesn't match expected output schema.\nGot ${response.choices[0].message.content}.\n\nZod Error ${parsedArticleSchema.error}`
      );
    }
  } catch (error) {
    spinner.fail("Could not get article info from markdown");
    spinner.stop();
    console.error("Error generating satirical content:", error);
    throw new Error("Failed to onionify article.");
  }
}
async function scrapeArticle(url: string): Promise<Article> {
  spinner.text = "Getting markdown features for article";
  spinner.start();
  try {
    const jobInfo = await hb_client.startScrapeJob({
      url,
      useProxy: false,
      solveCaptchas: false,
    });

    let checkCount = 0;
    while (checkCount < MAX_CHECKS) {
      const scrapeRes = await hb_client.getScrapeJob(jobInfo.jobId);
      if (scrapeRes.status === "completed") {
        if (scrapeRes.data) {
          spinner.succeed("Succeeded in getting markdown from article");
          spinner.stop();
          return extractArticleFeaturesFromMarkdown(scrapeRes.data?.markdown);
        } else {
          throw new Error(
            "Got undefined when extracing markdown from article. Please check"
          );
        }
      } else if (scrapeRes.status === "failed") {
        throw scrapeRes.error;
      }
      await sleep(1000);
    }
    throw new Error(
      "Exceeded maximum checks for getting markdown for article."
    );
  } catch (err) {
    spinner.fail("Failed in getting markdown from article");
    spinner.stop();

    console.log("Could not get article");
    console.error(err);
    throw err;
  }
}
async function onionifyArticle(article: Article): Promise<Article> {
  spinner.text = "Onionifying article";
  spinner.start();
  try {
    const prompt = `
    Rewrite the following article as if it were written for a satirical news website like The Onion.
    Use humor, irony, and exaggeration to transform the content while trying to stick closely to the original intent of the article:

    Title: ${article.title}
    Body: ${article.body}
    Author: ${article.author}

    Make sure the headline is absurd or humorous, and add funny commentary in the body.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a humorous and satirical writer writing for the online newspaper `The Onion`.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const satiricalResponse = response.choices[0].message?.content || "";

    // Split the response into a title and body (adjust parsing as needed)
    const lines = satiricalResponse.split("\n");
    const satiricalTitle = lines[0].replace("Title:", "").trim();
    const satiricalBody = lines.slice(1).join("\n").trim();

    spinner.succeed("Succesfully Onionified article ");
    spinner.stop();

    return {
      title: satiricalTitle,
      body: satiricalBody,
      author: `Parodied version of ${article.author || "Unknown"}`,
    };
  } catch (error) {
    spinner.fail("Could not onionify article");
    spinner.stop();

    console.error("Error generating satirical content:", error);
    throw new Error("Failed to onionify article.");
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing Open AI API Key. Exiting");
  process.exit(1);
}
if (!process.env.HYPERBROWSER_API_KEY) {
  console.error("Missing HyperBrowser API Key. Exiting");
  process.exit(1);
}

const program = new Command();
program
  .version("1.0.0")
  .description("Scrape a news article and onionify it")
  .argument("<url>", "The URL of the news article to scrape")
  .action(async (url: string) => {
    try {
      console.log("Scraping the article...");
      const article = await scrapeArticle(url);

      console.log("\nOriginal Article:");
      console.log("Title:", article.title);

      console.log("Onionifying the article...");
      const onionifiedArticle = await onionifyArticle(article);

      console.log("\n--- Onionified Article ---");
      console.log(marked(onionifiedArticle.title));
      console.log(marked(onionifiedArticle.body));
    } catch (error) {
      // @ts-ignore
      console.error("Error:", error.message);
    }
  });

program.parse(process.argv);
